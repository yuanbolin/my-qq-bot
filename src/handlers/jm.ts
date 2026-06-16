import type { GroupMessageEvent, PrivateMessageEvent } from 'qq-official-bot'
import type { GroupHandler } from '../types/group.js'
import type { PrivateHandler } from '../types/private.js'
import { config } from '../config.js'
import {
  checkJmReady,
  cleanupJmJob,
  exportJmAlbum,
  extractJmAlbumId,
  releaseJmLock,
  tryAcquireJmLock,
} from '../services/jm-export.js'
import { publishJmDownloads, type JmDownloadLinks } from '../services/jm-cache.js'
import { isOnCooldown } from '../utils/cooldown.js'
import { matchCommand, parseCommandArgs } from '../utils/message-parse.js'
import { replyText } from '../utils/reply.js'

type MessageEvent = GroupMessageEvent | PrivateMessageEvent

function buildHelpText(): string {
  const ttlHours = Math.round(config.jm.cacheTtlMs / 3_600_000)
  return [
    '【JM 本子下载】基于 jmcomic，需服务器安装 Python 3.12+ 与 pip install jmcomic',
    '',
    '命令：',
    '  /jm 350234 — 下载本子 JM350234',
    '  /jm JM350234 — 自动提取数字车号',
    '  /jm帮助 — 显示本说明',
    '',
    '回复方式：',
    '  下载分张后自动拼接为一张长图，返回单个下载链接',
    `  长图 JPEG 质量 ${config.jm.longImgJpegQuality}，单文件上限约 ${Math.round(config.jm.longImgMaxBytes / 1024 / 1024)}MB`,
    '',
    `页数限制：单本最多 ${config.jm.maxPages} 页`,
    `冷却时间：${Math.round(config.jm.cooldownMs / 60_000)} 分钟`,
  ].join('\n')
}

function isAllowedUser(userId: string): boolean {
  const allowed = config.jm.allowedUsers
  return allowed.length === 0 || allowed.includes(userId)
}

function buildDownloadReply(caption: string, links: JmDownloadLinks): string {
  const ttlHours = Math.round(config.jm.cacheTtlMs / 3_600_000)
  const lines = [caption, '']

  if (links.longImgs.length >= 1) {
    lines.push(`长图下载：${links.longImgs[0]}`)
  }

  if (links.pdf) {
    lines.push(`PDF 下载：${links.pdf}`)
  }

  if (links.longImgs.length === 0 && !links.pdf) {
    lines.push('未生成可下载文件')
  } else {
    lines.push(`链接 ${ttlHours} 小时内有效，请及时保存。`)
  }

  return lines.join('\n')
}

async function processJm(ctx: {
  event: MessageEvent
  msg: string
  userId: string
}): Promise<boolean> {
  const parsed = parseCommandArgs(ctx.msg)
  if (!parsed) return false

  if (matchCommand(ctx.msg, 'jm帮助')) {
    await replyText(ctx.event, buildHelpText())
    return true
  }

  if (parsed.command.toLowerCase() !== 'jm') {
    return false
  }

  if (!parsed.args.trim()) {
    await replyText(ctx.event, buildHelpText())
    return true
  }

  if (!isAllowedUser(ctx.userId)) {
    await replyText(ctx.event, '你暂无权限使用 /jm 命令')
    return true
  }

  const albumId = extractJmAlbumId(parsed.args)
  if (!albumId) {
    await replyText(ctx.event, '请提供有效本子号码，例如：/jm 350234')
    return true
  }

  if (await isOnCooldown(ctx.userId, 'jm', config.jm.cooldownMs)) {
    await replyText(ctx.event, '下载冷却中，请稍后再试~')
    return true
  }

  const ready = await checkJmReady()
  if (!ready.ok) {
    await replyText(ctx.event, ready.reason)
    return true
  }

  if (!tryAcquireJmLock()) {
    await replyText(ctx.event, '已有下载任务进行中，请稍后再试~')
    return true
  }

  let jobDir: string | undefined

  try {
    await replyText(
      ctx.event,
      `正在下载 JM${albumId}，请稍候（可能需数分钟）...\n完成后将拼接为一张长图并返回下载链接。`,
    )

    const result = await exportJmAlbum(albumId)
    jobDir = result.jobDir
    const caption = `[JM${result.albumId}] ${result.title}（${result.pageCount} 页）`
    const links = await publishJmDownloads(result)

    await replyText(ctx.event, buildDownloadReply(caption, links))
  } catch (error) {
    await replyText(
      ctx.event,
      `下载失败：${error instanceof Error ? error.message : String(error)}`,
    )
  } finally {
    releaseJmLock()
    if (jobDir) {
      await cleanupJmJob(jobDir)
    }
  }

  return true
}

export const jmGroupHandle: GroupHandler = async (ctx) =>
  processJm({ event: ctx.event, msg: ctx.msg, userId: ctx.userId })

export const jmPrivateHandle: PrivateHandler = async (ctx) =>
  processJm({ event: ctx.event, msg: ctx.msg, userId: ctx.userId })
