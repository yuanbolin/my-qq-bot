import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config.js'
import { resolveAsset } from '../utils/assets.js'

const RELATIVE_DIR = 'auto-reply'

/** 将网络图片下载到 assets/auto-reply/，返回 assets 相对路径 */
export async function downloadImageToAssets(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl, {
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    throw new Error(`下载图片失败：HTTP ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length === 0) {
    throw new Error('下载图片失败：空文件')
  }

  const ext = guessImageExt(imageUrl, response.headers.get('content-type'))
  const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 16)
  const relativePath = path.join(RELATIVE_DIR, `${hash}${ext}`).replace(/\\/g, '/')
  const absPath = resolveAsset(relativePath)

  await fs.mkdir(path.dirname(absPath), { recursive: true })
  await fs.writeFile(absPath, buffer)
  return relativePath
}

function guessImageExt(url: string, contentType: string | null): string {
  const fromType = contentType?.toLowerCase() ?? ''
  if (fromType.includes('png')) return '.png'
  if (fromType.includes('webp')) return '.webp'
  if (fromType.includes('gif')) return '.gif'
  if (fromType.includes('jpeg') || fromType.includes('jpg')) return '.jpg'

  try {
    const pathname = new URL(url).pathname.toLowerCase()
    const match = pathname.match(/\.(png|jpe?g|webp|gif)$/)
    if (match) {
      return match[0] === '.jpeg' ? '.jpg' : match[0]
    }
  } catch {
    // ignore invalid url
  }

  return '.jpg'
}

/** 确保 auto-reply 图片目录存在 */
export async function ensureAutoReplyImageDir(): Promise<void> {
  await fs.mkdir(path.join(config.assetsDir, RELATIVE_DIR), { recursive: true })
}
