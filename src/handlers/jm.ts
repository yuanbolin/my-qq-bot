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
import { isOnCooldown } from '../utils/cooldown.js'
import { matchCommand, parseCommandArgs } from '../utils/message-parse.js'
import { replyLocalImage, replyPdfFile, replyText } from '../utils/reply.js'

type MessageEvent = GroupMessageEvent | PrivateMessageEvent

function isGroupEvent(event: MessageEvent): event is GroupMessageEvent {
  return event.message_type === 'group'
}

function buildHelpText(): string {
  return [
    '【JM 本子下载】基于 jmcomic，需服务器安装 Python 3.12+ 与 pip install jmcomic',
    '',
    '命令：',
    '  /jm 350234 — 下载本子 JM350234',
    '  /jm JM350234 — 自动提取数字车号',
    '  /jm帮助 — 显示本说明',
    '',
    '回复方式：',
    '  群聊 — 长图 PNG（QQ 群不支持发 PDF）',
    '  私聊 — PDF 文件',
    '',
    `页数限制：单本最多 ${config.jm.maxPages} 页`,
    `冷却时间：${Math.round(config.jm.cooldownMs / 60_000)} 分钟`,
  ].join('\n')
}

function isAllowedUser(userId: string): boolean {
  const allowed = config.jm.allowedUsers
  return allowed.length === 0 || allowed.includes(userId)
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
      `正在下载 JM${albumId}，请稍候（可能需数分钟）...\n群聊将返回长图，私聊将返回 PDF。`,
    )

    const result = await exportJmAlbum(
      albumId,
      isGroupEvent(ctx.event) ? 'longimg' : 'pdf',
    )
    jobDir = result.jobDir
    const caption = `[JM${result.albumId}] ${result.title}（${result.pageCount} 页）`

    if (isGroupEvent(ctx.event)) {
      await replyLocalImage(ctx.event, result.longImgPath, `${caption}\n（PDF 请私聊机器人获取）`)
    } else {
      await replyPdfFile(ctx.event, result.pdfPath, caption)
    }
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
