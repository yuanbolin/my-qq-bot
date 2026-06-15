import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config.js'
import type { JmExportResult } from './jm-export.js'

export interface JmDownloadLinks {
  longImg?: string
  pdf?: string
  expiresAt: number
}

/** 将导出文件复制到缓存目录并生成下载链接 */
export async function publishJmDownloads(
  result: JmExportResult,
): Promise<JmDownloadLinks> {
  const token = crypto.randomBytes(16).toString('hex')
  const cacheDir = path.join(config.jm.cacheDir, token)
  await fs.mkdir(cacheDir, { recursive: true })

  const baseUrl = config.jm.downloadBaseUrl.replace(/\/$/, '')
  const links: JmDownloadLinks = {
    expiresAt: Date.now() + config.jm.cacheTtlMs,
  }

  if (result.longImgPath) {
    await fs.copyFile(result.longImgPath, path.join(cacheDir, 'longimg.png'))
    links.longImg = `${baseUrl}/jm/${token}/longimg.png`
  }

  if (result.pdfPath) {
    await fs.copyFile(result.pdfPath, path.join(cacheDir, 'album.pdf'))
    links.pdf = `${baseUrl}/jm/${token}/album.pdf`
  }

  return links
}

/** 清理过期的 JM 缓存目录 */
export async function cleanupExpiredJmCache(): Promise<void> {
  const entries = await fs.readdir(config.jm.cacheDir, { withFileTypes: true })
    .catch(() => [])

  const now = Date.now()
  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const dirPath = path.join(config.jm.cacheDir, entry.name)
    const stat = await fs.stat(dirPath).catch(() => null)
    if (!stat) continue

    if (now - stat.mtimeMs > config.jm.cacheTtlMs) {
      await fs.rm(dirPath, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}

/** 确保缓存根目录存在 */
export async function ensureJmCacheDir(): Promise<void> {
  await fs.mkdir(config.jm.cacheDir, { recursive: true })
}
