import type { GroupHandler } from '../types/group.js'
import type { PrivateHandler } from '../types/private.js'
import {
  buildSentences,
  findSorryTemplate,
  SORRY_TEMPLATES,
} from '../data/sorry-templates.js'
import {
  checkSorryReady,
  checkTemplateAssets,
  renderSorryGif,
} from '../services/sorry-render.js'
import { isOnCooldown } from '../utils/cooldown.js'
import { parseCommandArgs } from '../utils/message-parse.js'
import { replyGif, replyText } from '../utils/reply.js'

type MessageEvent = Parameters<typeof replyText>[0]

interface SorryCtx {
  event: MessageEvent
  msg: string
  userId: string
}

function buildHelpText(): string {
  const lines = [
    '【Sorry 表情包】基于 node-sorry，需服务器安装 ffmpeg',
    '',
    '命令：',
    '  /sorry 或 /为所欲为 — 9 句「有钱真的可以为所欲为」',
    '  /王境泽 或 /真香 — 4 句王境泽梗',
    '',
    '自定义文案（用 | 分隔，不足补默认、超出截断）：',
    '  /sorry 句1|句2|...|句9',
    '  /王境泽 句1|句2|句3|句4',
    '',
    '模板：',
    ...SORRY_TEMPLATES.map(
      (tpl) => `  ${tpl.id}（${tpl.aliases.join('/')}）— ${tpl.description}，共 ${tpl.sentenceCount} 句`,
    ),
  ]
  return lines.join('\n')
}

async function processSorry(ctx: SorryCtx): Promise<boolean> {
  const parsed = parseCommandArgs(ctx.msg)
  if (!parsed) return false

  const template = findSorryTemplate(parsed.command)
  if (!template) {
    if (parsed.command.toLowerCase() === 'sorry帮助' || parsed.command === '表情包帮助') {
      await replyText(ctx.event, buildHelpText())
      return true
    }
    return false
  }

  if (parsed.args === '帮助' || parsed.args.toLowerCase() === 'help') {
    await replyText(ctx.event, buildHelpText())
    return true
  }

  if (await isOnCooldown(ctx.userId, 'sorry')) {
    await replyText(ctx.event, '表情包生成冷却中，请稍后再试~')
    return true
  }

  const ready = await checkSorryReady()
  if (!ready.ok) {
    await replyText(ctx.event, ready.reason)
    return true
  }

  const hasAssets = await checkTemplateAssets(template.id)
  if (!hasAssets) {
    await replyText(
      ctx.event,
      `缺少模板素材：assets/sorry/templates/${template.id}/template.mp4 与 template.ejs`,
    )
    return true
  }

  const sentences = buildSentences(template, parsed.args)

  try {
    await replyText(ctx.event, '正在生成表情包，请稍候...')
    const gif = await renderSorryGif(template.id, sentences)
    await replyGif(ctx.event, gif, `${template.description} 生成完成`)
  } catch (error) {
    await replyText(
      ctx.event,
      `生成失败：${error instanceof Error ? error.message : String(error)}`,
    )
  }

  return true
}

export const sorryHandle: GroupHandler = async (ctx) =>
  processSorry({ event: ctx.event, msg: ctx.msg, userId: ctx.userId })

export const sorryPrivateHandle: PrivateHandler = async (ctx) =>
  processSorry({ event: ctx.event, msg: ctx.msg, userId: ctx.userId })
