import type { GroupHandler } from '../types/group.js'
import type { PrivateHandler } from '../types/private.js'
import { getRandomMeme } from '../services/meme.js'
import { matchCommand } from '../utils/message-parse.js'
import { replyImageUrl, replyText } from '../utils/reply.js'

type MessageEvent = Parameters<typeof replyText>[0]

const MEME_COMMANDS = ['随机梗图', '/随机梗图', '梗图'] as const

function matchesAny(msg: string, commands: readonly string[]): boolean {
  return commands.some((cmd) => matchCommand(msg, cmd))
}

async function dispatchMeme(msg: string, event: MessageEvent): Promise<boolean> {
  if (!matchesAny(msg, MEME_COMMANDS)) {
    return false
  }

  const meme = await getRandomMeme()
  const lines = [
    '🖼️ 随机梗图',
    meme.title,
    meme.subreddit ? `📂 r/${meme.subreddit}` : undefined,
    meme.author ? `👤 u/${meme.author}` : undefined,
    meme.ups ? `👍 ${meme.ups.toLocaleString()}` : undefined,
  ].filter(Boolean)
  await replyText(event, lines.join('\n'))

  // 依次输出 preview 多张图片（由低到高画质）
  for (const imageUrl of meme.previews) {
    await replyImageUrl(event, imageUrl)
  }

  return true
}

export const memeGroupHandle: GroupHandler = async (ctx) => {
  try {
    return await dispatchMeme(ctx.msg, ctx.event)
  } catch (error) {
    await replyText(
      ctx.event,
      `获取失败：${error instanceof Error ? error.message : String(error)}`,
    )
    return true
  }
}

export const memePrivateHandle: PrivateHandler = async (ctx) => {
  try {
    return await dispatchMeme(ctx.msg, ctx.event)
  } catch (error) {
    await replyText(
      ctx.event,
      `获取失败：${error instanceof Error ? error.message : String(error)}`,
    )
    return true
  }
}
