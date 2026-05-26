import type { GroupHandler } from '../types/group.js'
import type { PrivateHandler } from '../types/private.js'
import {
  getAiNews,
  getMoyuDaily,
  getSixtyNews,
  getTodayInHistory,
  searchLyric,
} from '../services/sixty-api.js'
import { matchCommand, parseCommandArgs } from '../utils/message-parse.js'
import { replyImageUrl, replyText } from '../utils/reply.js'

type MessageEvent = Parameters<typeof replyText>[0]

const SIXTY_COMMANDS = ['/60s', '/读懂世界', '/每天60秒'] as const
const AI_COMMANDS = ['/ai资讯', '/AI资讯'] as const
const HISTORY_COMMANDS = ['/历史上的今天', '/今天历史'] as const
const MOYU_COMMANDS = ['/摸鱼日报', '/摸鱼'] as const
const LYRIC_COMMANDS = ['歌词', '查歌词'] as const

function matchesAny(msg: string, commands: readonly string[]): boolean {
  return commands.some((cmd) => matchCommand(msg, cmd))
}

async function dispatchSixtyApi(msg: string, event: MessageEvent): Promise<boolean> {
  if (matchesAny(msg, SIXTY_COMMANDS)) {
    const { text, imageUrl } = await getSixtyNews()
    await replyText(event, text)
    if (imageUrl) {
      await replyImageUrl(event, imageUrl)
    }
    return true
  }

  if (matchesAny(msg, AI_COMMANDS)) {
    await replyText(event, await getAiNews())
    return true
  }

  if (matchesAny(msg, HISTORY_COMMANDS)) {
    await replyText(event, await getTodayInHistory())
    return true
  }

  if (matchesAny(msg, MOYU_COMMANDS)) {
    await replyText(event, await getMoyuDaily())
    return true
  }

  const parsed = parseCommandArgs(msg)
  if (parsed && LYRIC_COMMANDS.includes(parsed.command as (typeof LYRIC_COMMANDS)[number])) {
    if (!parsed.args) {
      await replyText(event, '请提供歌曲名称，例如：/歌词 小宇')
      return true
    }
    await replyText(event, await searchLyric(parsed.args))
    return true
  }

  return false
}

export const sixtyApiGroupHandle: GroupHandler = async (ctx) => {
  try {
    return await dispatchSixtyApi(ctx.msg, ctx.event)
  } catch (error) {
    await replyText(
      ctx.event,
      `获取失败：${error instanceof Error ? error.message : String(error)}`,
    )
    return true
  }
}

export const sixtyApiPrivateHandle: PrivateHandler = async (ctx) => {
  try {
    return await dispatchSixtyApi(ctx.msg, ctx.event)
  } catch (error) {
    await replyText(
      ctx.event,
      `获取失败：${error instanceof Error ? error.message : String(error)}`,
    )
    return true
  }
}
