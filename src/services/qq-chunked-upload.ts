import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'

/** QQ 协议：前 10002432 字节的 MD5 */
const MD5_10M_SIZE = 10_002_432

/** 图片上传上限（QQ 官方：30MB） */
export const QQ_IMAGE_MAX_BYTES = 30 * 1024 * 1024

interface FileHashes {
  md5: string
  sha1: string
  md5_10m: string
}

interface UploadPart {
  index: number
  presigned_url: string
}

interface UploadPrepareResponse {
  upload_id: string
  block_size: number
  parts: UploadPart[]
  concurrency?: number
}

interface BotRequest {
  post: (
    url: string,
    data: Record<string, unknown>,
    config?: { timeout?: number },
  ) => Promise<{ data: Record<string, unknown> }>
}

export interface ChunkedUploadTarget {
  type: 'group' | 'user'
  id: string
}

/** 流式计算文件 MD5 / SHA1 / md5_10m */
export async function computeFileHashes(
  filePath: string,
  fileSize: number,
): Promise<FileHashes> {
  return new Promise((resolve, reject) => {
    const md5Hash = crypto.createHash('md5')
    const sha1Hash = crypto.createHash('sha1')
    const md5_10mHash = crypto.createHash('md5')

    let bytesRead = 0
    const need10m = fileSize > MD5_10M_SIZE
    const stream = createReadStream(filePath)

    stream.on('data', (chunk: Buffer) => {
      md5Hash.update(chunk)
      sha1Hash.update(chunk)

      if (need10m) {
        const remaining = MD5_10M_SIZE - bytesRead
        if (remaining > 0) {
          md5_10mHash.update(
            remaining >= chunk.length ? chunk : chunk.subarray(0, remaining),
          )
        }
      }

      bytesRead += chunk.length
    })

    stream.on('end', () => {
      const md5 = md5Hash.digest('hex')
      resolve({
        md5,
        sha1: sha1Hash.digest('hex'),
        md5_10m: need10m ? md5_10mHash.digest('hex') : md5,
      })
    })

    stream.on('error', reject)
  })
}

async function readFileChunk(
  filePath: string,
  offset: number,
  length: number,
): Promise<Buffer> {
  const fd = await fs.open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await fd.read(buffer, 0, length, offset)
    return bytesRead < length ? buffer.subarray(0, bytesRead) : buffer
  } finally {
    await fd.close()
  }
}

async function putToPresignedUrl(
  presignedUrl: string,
  data: Buffer,
): Promise<void> {
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    body: new Uint8Array(data),
    headers: {
      'Content-Length': String(data.length),
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`COS 分片上传失败: ${response.status} ${response.statusText} ${body}`)
  }
}

function getApiBasePath(target: ChunkedUploadTarget): string {
  return target.type === 'group'
    ? `/v2/groups/${target.id}`
    : `/v2/users/${target.id}`
}

/** 分片上传本地文件，返回可用于发消息的 media 对象 */
export async function chunkedUploadFile(
  request: BotRequest,
  target: ChunkedUploadTarget,
  fileType: number,
  filePath: string,
  fileName: string,
): Promise<Record<string, unknown>> {
  const stat = await fs.stat(filePath)
  const fileSize = stat.size

  if (fileSize > QQ_IMAGE_MAX_BYTES) {
    throw new Error(
      `文件过大（${(fileSize / 1024 / 1024).toFixed(1)}MB），超过 QQ 30MB 上限`,
    )
  }

  const hashes = await computeFileHashes(filePath, fileSize)
  const basePath = getApiBasePath(target)

  const { data: prepare } = await request.post(
    `${basePath}/upload_prepare`,
    {
      file_type: fileType,
      file_name: fileName,
      file_size: fileSize,
      md5: hashes.md5,
      sha1: hashes.sha1,
      md5_10m: hashes.md5_10m,
    },
    { timeout: 120_000 },
  )

  const prepareResp = prepare as unknown as UploadPrepareResponse
  const blockSize = Number(prepareResp.block_size)
  const parts = prepareResp.parts ?? []

  for (const part of parts) {
    const offset = (part.index - 1) * blockSize
    const length = Math.min(blockSize, fileSize - offset)
    const chunk = await readFileChunk(filePath, offset, length)
    const partMd5 = crypto.createHash('md5').update(chunk).digest('hex')

    await putToPresignedUrl(part.presigned_url, chunk)
    await request.post(
      `${basePath}/upload_part_finish`,
      {
        upload_id: prepareResp.upload_id,
        part_index: part.index,
        block_size: length,
        md5: partMd5,
      },
      { timeout: 120_000 },
    )
  }

  const { data: uploadResult } = await request.post(
    `${basePath}/files`,
    { upload_id: prepareResp.upload_id },
    { timeout: 120_000 },
  )

  return uploadResult
}
