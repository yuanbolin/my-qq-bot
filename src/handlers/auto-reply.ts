import type { GroupHandler } from '../types/group.js'
import type { PrivateHandler } from '../types/private.js'
import { config } from '../config.js'
import {
  deleteAutoReplyRule,
  listAutoReplyRules,
  matchAutoReplyRule,
  upsertAutoReplyRule,
} from '../services/auto-reply-store.js'
import { downloadImageToAssets } from '../utils/download-image.js'
import {
  extractImageUrls,
  matchCommand,
  parseCommandArgs,
  stripSlashPrefix,
} from '../utils/message-parse.js'
import { replyImage, replyText, replyTextImage } from '../utils/reply.js'

type MessageEvent = Parameters<typeof replyText>[0]

const ADMIN_COMMANDS = new Set(['应答设置', '应答删除', '应答列表', '应答帮助'])

function buildHelpText(): string {
  const mode =
    config.autoReply.admins.length === 0
      ? '全员可设置/删除'
      : `仅白名单可设置/删除（${config.autoReply.admins.length} 人）`

  return [
    '【自定义关键词应答】',
    '',
    '管理命令：',
    '  /应答设置 关键词 | 回复文本',
    '    （同条消息可附带图片，将下载保存到本地）',
    '  /应答删除 关键词',
    '  /应答列表',
    '  /应答帮助',
    '',
    '触发：消息中包含关键词即自动回复（大小写不敏感）',
    `权限：${mode}`,
  ].join('\n')
}

function isAdmin(userId: string): boolean {
  const admins = config.autoReply.admins
  return admins.length === 0 || admins.includes(userId)
}

function requireAdmin(userId: string): string | null {
  if (isAdmin(userId)) return null
  return '仅管理员可操作（请在 .env 配置 AUTO_REPLY_ADMINS）'
}

async function replyRule(
  event: MessageEvent,
  text: string,
  image?: string,
): Promise<void> {
  if (image && text) {
    await replyTextImage(event, text, image)
    return
  }
  if (image) {
    await replyImage(event, image)
    return
  }
  await replyText(event, text || '（空回复）')
}

async function handleSet(
  event: MessageEvent,
  args: string,
  userId: string,
  message: Parameters<typeof extractImageUrls>[0],
): Promise<void> {
  const denied = requireAdmin(userId)
  if (denied) {
    await replyText(event, denied)
    return
  }

  const pipe = args.indexOf('|')
  let keyword = ''
  let text = ''

  if (pipe >= 0) {
    keyword = args.slice(0, pipe).trim()
    text = args.slice(pipe + 1).trim()
  } else {
    // 允许「应答设置 关键词」+ 纯图
    keyword = args.trim()
    text = ''
  }

  if (!keyword) {
    await replyText(event, '用法：/应答设置 关键词 | 回复文本\n（可同条消息附带图片）')
    return
  }

  if (ADMIN_COMMANDS.has(keyword) || keyword.startsWith('应答')) {
    await replyText(event, '关键词不能使用管理命令名')
    return
  }

  const imageUrls = extractImageUrls(message)
  let imagePath: string | undefined

  if (imageUrls.length > 0) {
    try {
      imagePath = await downloadImageToAssets(imageUrls[0])
    } catch (error) {
      await replyText(
        event,
        `图片下载失败，未保存规则：${error instanceof Error ? error.message : String(error)}`,
      )
      return
    }
  }

  if (!text && !imagePath) {
    await replyText(event, '回复文本与图片至少提供一项')
    return
  }

  const rule = await upsertAutoReplyRule({
    keyword,
    text,
    image: imagePath,
    updatedBy: userId,
  })

  const parts = [
    `已保存应答规则：`,
    `关键词：${rule.keyword}`,
    `文本：${rule.text || '（无）'}`,
    `图片：${rule.image || '（无）'}`,
  ]
  await replyText(event, parts.join('\n'))
}

async function handleDelete(event: MessageEvent, args: string, userId: string): Promise<void> {
  const denied = requireAdmin(userId)
  if (denied) {
    await replyText(event, denied)
    return
  }

  const keyword = args.trim()
  if (!keyword) {
    await replyText(event, '用法：/应答删除 关键词')
    return
  }

  const ok = await deleteAutoReplyRule(keyword)
  await replyText(event, ok ? `已删除关键词「${keyword}」` : `未找到关键词「${keyword}」`)
}

async function handleList(event: MessageEvent): Promise<void> {
  const rules = await listAutoReplyRules()
  if (rules.length === 0) {
    await replyText(event, '当前没有自定义应答规则')
    return
  }

  const lines = rules.map((rule, index) => {
    const img = rule.image ? '有图' : '无图'
    const preview = rule.text ? rule.text.slice(0, 40) : '（无文本）'
    return `${index + 1}. 「${rule.keyword}」[${img}] ${preview}`
  })

  await replyText(event, [`共 ${rules.length} 条规则：`, ...lines].join('\n'))
}

async function processAutoReply(ctx: {
  event: MessageEvent
  msg: string
  userId: string
  message: Parameters<typeof extractImageUrls>[0]
}): Promise<boolean> {
  const parsed = parseCommandArgs(ctx.msg)

  if (parsed && matchCommand(parsed.command, '应答帮助')) {
    await replyText(ctx.event, buildHelpText())
    return true
  }

  if (parsed && matchCommand(parsed.command, '应答列表')) {
    await handleList(ctx.event)
    return true
  }

  if (parsed && matchCommand(parsed.command, '应答设置')) {
    await handleSet(ctx.event, parsed.args, ctx.userId, ctx.message)
    return true
  }

  if (parsed && matchCommand(parsed.command, '应答删除')) {
    await handleDelete(ctx.event, parsed.args, ctx.userId)
    return true
  }

  // 管理命令前缀不参与关键词触发
  const plain = stripSlashPrefix(ctx.msg)
  if (/^应答(设置|删除|列表|帮助)/.test(plain)) {
    return false
  }

  const rule = await matchAutoReplyRule(plain)
  if (!rule) return false

  await replyRule(ctx.event, rule.text, rule.image)
  return true
}

export const autoReplyGroupHandle: GroupHandler = async (ctx) =>
  processAutoReply({
    event: ctx.event,
    msg: ctx.msg,
    userId: ctx.userId,
    message: ctx.event.message,
  })

export const autoReplyPrivateHandle: PrivateHandler = async (ctx) =>
  processAutoReply({
    event: ctx.event,
    msg: ctx.msg,
    userId: ctx.userId,
    message: ctx.event.message,
  })
