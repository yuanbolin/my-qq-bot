import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import ejs from 'ejs'
import { config } from '../config.js'

/** ffmpeg ass 滤镜路径：Windows 盘符冒号需转义 */
function toFfmpegAssPath(absPath: string): string {
  const normalized = path.resolve(absPath).replace(/\\/g, '/')
  if (/^[A-Za-z]:/.test(normalized)) {
    return normalized.replace(':', '\\:')
  }
  return normalized
}

function cacheFilename(templateId: string, sentences: string[]): string {
  const hash = crypto.createHash('md5').update(JSON.stringify(sentences)).digest('hex')
  return `${templateId}-${hash}.gif`
}

function templateDir(templateId: string): string {
  return path.join(config.sorry.templatesDir, templateId)
}

/** 检查模板与 ffmpeg 是否可用 */
export async function checkSorryReady(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    execFileSync(config.sorry.ffmpegPath, ['-version'], {
      stdio: 'ignore',
      timeout: 5_000,
    })
  } catch {
    return {
      ok: false,
      reason: `未找到 ffmpeg，请安装并加入 PATH，或在 .env 设置 SORRY_FFMPEG_PATH`,
    }
  }

  return { ok: true }
}

/** 检查指定模板素材是否齐全 */
export async function checkTemplateAssets(templateId: string): Promise<boolean> {
  const dir = templateDir(templateId)
  const mp4 = path.join(dir, 'template.mp4')
  const ejsFile = path.join(dir, 'template.ejs')
  try {
    await fs.access(mp4)
    await fs.access(ejsFile)
    return true
  } catch {
    return false
  }
}

async function renderAssFile(
  templateId: string,
  sentences: string[],
  assPath: string,
): Promise<void> {
  const ejsPath = path.join(templateDir(templateId), 'template.ejs')
  const template = await fs.readFile(ejsPath, 'utf8')
  const assText = ejs.render(template, { sentences })
  await fs.writeFile(assPath, assText, 'utf8')
}

async function runFfmpeg(
  templateId: string,
  assPath: string,
  gifPath: string,
): Promise<void> {
  const videoPath = path.join(templateDir(templateId), 'template.mp4')
  const assFilter = toFfmpegAssPath(assPath)
  const vf = `ass=${assFilter},scale=${config.sorry.scaleWidth}:-1`

  try {
    execFileSync(
      config.sorry.ffmpegPath,
      ['-i', videoPath, '-r', String(config.sorry.fps), '-vf', vf, '-y', gifPath],
      {
        stdio: 'pipe',
        timeout: config.sorry.timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      },
    )
  } catch (error) {
    const detail =
      error instanceof Error && 'stderr' in error
        ? String((error as NodeJS.ErrnoException & { stderr?: Buffer }).stderr ?? '')
        : error instanceof Error
          ? error.message
          : String(error)
    throw new Error(`ffmpeg 生成 GIF 失败：${detail.slice(0, 300)}`)
  }
}

/**
 * 渲染 sorry 类 GIF，命中缓存则直接读文件。
 * 逻辑参考 node-sorry controller/render.js
 */
export async function renderSorryGif(
  templateId: string,
  sentences: string[],
): Promise<Buffer> {
  await fs.mkdir(config.sorry.cacheDir, { recursive: true })

  const filename = cacheFilename(templateId, sentences)
  const gifPath = path.join(config.sorry.cacheDir, filename)

  try {
    return await fs.readFile(gifPath)
  } catch {
    // 缓存未命中，继续生成
  }

  const assPath = path.join(config.sorry.cacheDir, `${filename}.ass`)
  await renderAssFile(templateId, sentences, assPath)
  await runFfmpeg(templateId, assPath, gifPath)

  const buffer = await fs.readFile(gifPath)
  await fs.unlink(assPath).catch(() => undefined)
  return buffer
}
