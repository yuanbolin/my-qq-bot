import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config.js'

export interface JmExportResult {
  albumId: string
  title: string
  pageCount: number
  pdfPath: string
  longImgPath: string
  jobDir: string
}

interface JmExportJson {
  ok: boolean
  error?: string
  albumId?: string
  title?: string
  pageCount?: number
  pdf?: string
  longImg?: string
}

let globalBusy = false

/** 从参数文本中提取 4~8 位本子号码 */
export function extractJmAlbumId(rawArgs: string): string | null {
  const match = rawArgs.match(/\d{4,8}/)
  return match?.[0] ?? null
}

/** 检查 Python、jmcomic 与配置文件是否可用 */
export async function checkJmReady(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await fs.access(config.jm.scriptPath)
    await fs.access(config.jm.optionPath)
  } catch {
    return {
      ok: false,
      reason: '缺少 JM 脚本或配置，请确认 scripts/jm_export.py 与 config/jmcomic.option.yml 存在',
    }
  }

  const version = await runPython(['--version'], 10_000)
  if (!version.ok) {
    return {
      ok: false,
      reason: `未找到 Python（${config.jm.pythonPath}），请安装 Python 3.12+ 并配置 JM_PYTHON_PATH`,
    }
  }

  const importCheck = await runPython(
    ['-c', 'import jmcomic'],
    15_000,
  )
  if (!importCheck.ok) {
    return {
      ok: false,
      reason: '未安装 jmcomic，请在服务器执行: pip install jmcomic -U',
    }
  }

  return { ok: true }
}

/** 全局下载锁，避免并发压垮服务器 */
export function tryAcquireJmLock(): boolean {
  if (globalBusy) return false
  globalBusy = true
  return true
}

export function releaseJmLock(): void {
  globalBusy = false
}

/** 下载并导出 PDF + 长图 */
export async function exportJmAlbum(albumId: string): Promise<JmExportResult> {
  const jobDir = path.join(
    config.jm.jobsDir,
    `${Date.now()}-${albumId}`,
  )
  await fs.mkdir(jobDir, { recursive: true })

  const result = await runPython(
    [
      config.jm.scriptPath,
      jobDir,
      albumId,
      config.jm.optionPath,
      String(config.jm.maxPages),
    ],
    config.jm.timeoutMs,
  )

  if (!result.ok) {
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => undefined)
    throw new Error(result.error ?? 'JM 导出失败')
  }

  let parsed: JmExportJson
  try {
    parsed = JSON.parse(result.stdout.trim()) as JmExportJson
  } catch {
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => undefined)
    throw new Error(`JM 脚本输出无法解析: ${result.stdout.slice(0, 200)}`)
  }

  if (!parsed.ok || !parsed.pdf || !parsed.longImg) {
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => undefined)
    throw new Error(parsed.error ?? 'JM 导出结果不完整')
  }

  return {
    albumId: parsed.albumId ?? albumId,
    title: parsed.title ?? '',
    pageCount: parsed.pageCount ?? 0,
    pdfPath: parsed.pdf,
    longImgPath: parsed.longImg,
    jobDir,
  }
}

/** 清理任务目录 */
export async function cleanupJmJob(jobDir: string): Promise<void> {
  await fs.rm(jobDir, { recursive: true, force: true }).catch(() => undefined)
}

interface RunPythonResult {
  ok: boolean
  stdout: string
  error?: string
}

function runPython(args: string[], timeoutMs: number): Promise<RunPythonResult> {
  return new Promise((resolve) => {
    const child = spawn(config.jm.pythonPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      resolve({
        ok: false,
        stdout,
        error: `JM 任务超时（${timeoutMs}ms）`,
      })
    }, timeoutMs)

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({
        ok: false,
        stdout,
        error: error.message,
      })
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)

      if (code === 0) {
        resolve({ ok: true, stdout })
        return
      }

      const lastLine = stdout.trim().split('\n').pop() ?? ''
      let message = stderr.trim() || `JM 脚本退出码 ${code}`

      try {
        const json = JSON.parse(lastLine) as JmExportJson
        if (json.error) {
          message = json.error
        }
      } catch {
        // 使用 stderr 默认信息
      }

      resolve({
        ok: false,
        stdout,
        error: message,
      })
    })
  })
}
