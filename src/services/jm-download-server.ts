import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

const TOKEN_PATTERN = /^[a-f0-9]{32}$/
/** 允许 longimg.jpg / longimg-1.jpg / longimg.png / album.pdf */
const ALLOWED_FILE_PATTERN = /^(longimg(-\d+)?\.(jpg|jpeg|png)|album\.pdf)$/i

function resolveContentType(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  return 'image/jpeg'
}

/** 启动 JM 文件 HTTP 下载服务 */
export function startJmDownloadServer(): void {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const match = url.pathname.match(/^\/jm\/([^/]+)\/([^/]+)$/)

      if (!match || req.method !== 'GET') {
        res.writeHead(404)
        res.end('Not Found')
        return
      }

      const [, token, filename] = match
      if (!TOKEN_PATTERN.test(token) || !ALLOWED_FILE_PATTERN.test(filename)) {
        res.writeHead(404)
        res.end('Not Found')
        return
      }

      const filePath = path.join(config.jm.cacheDir, token, filename)
      const stat = await fs.stat(filePath).catch(() => null)
      if (!stat?.isFile()) {
        res.writeHead(404)
        res.end('Not Found')
        return
      }

      res.writeHead(200, {
        'Content-Type': resolveContentType(filename),
        'Content-Length': stat.size,
        'Content-Disposition': `attachment; filename="${filename}"`,
      })
      res.end(await fs.readFile(filePath))
    } catch (error) {
      logger.error('JM 下载服务错误', {
        error: error instanceof Error ? error.message : String(error),
      })
      if (!res.headersSent) {
        res.writeHead(500)
        res.end('Internal Server Error')
      }
    }
  })

  server.listen(config.jm.downloadPort, '0.0.0.0', () => {
    logger.info('JM 下载服务已启动', {
      baseUrl: config.jm.downloadBaseUrl,
      port: config.jm.downloadPort,
      cacheDir: config.jm.cacheDir,
    })
  })
}
