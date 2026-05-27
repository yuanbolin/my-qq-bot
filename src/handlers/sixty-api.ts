import type { GroupHandler } from '../types/group.js'
import type { PrivateHandler } from '../types/private.js'
import {
  getAiNews,
  getBingWallpaper,
  getDongchediHot,
  getDouyinHot,
  getEpicGames,
  getFabingText,
  getKfcCopy,
  getMoyuDaily,
  getRandomLuck,
  getSixtyNews,
  getTodayInHistory,
  getWeiboHot,
  searchLyric,
} from '../services/sixty-api.js'
import { matchCommand, parseCommandArgs } from '../utils/message-parse.js'
import { replyImageUrl, replyText } from '../utils/reply.js'

type MessageEvent = Parameters<typeof replyText>[0]

const SIXTY_COMMANDS = ['/60s', '/读懂世界', '/每天60秒'] as const
const AI_COMMANDS = ['/ai资讯', '/AI资讯'] as const
const HISTORY_COMMANDS = ['/历史上的今天', '/今天历史'] as const
const MOYU_COMMANDS = ['/摸鱼日报', '/摸鱼'] as const
const EPIC_COMMANDS = ['/epic', '/喜加一'] as const
const BING_COMMANDS = ['/必应壁纸', '/必应'] as const
const DOUYIN_COMMANDS = ['/抖音热搜'] as const
const WEIBO_COMMANDS = ['/微博热搜'] as const
const DONGCHEDI_COMMANDS = ['/懂车帝热搜', '/懂车帝'] as const
const KFC_COMMANDS = ['/kfc', '/KFC文案', '/疯狂星期四'] as const
const LUCK_COMMANDS = ['/运势', '/随机运势'] as const
const FABING_COMMANDS = ['发病文学', '发病'] as const
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

  if (matchesAny(msg, EPIC_COMMANDS)) {
    await replyText(event, await getEpicGames())
    return true
  }

  if (matchesAny(msg, BING_COMMANDS)) {
    const { text, imageUrl } = await getBingWallpaper()
    await replyText(event, text)
    if (imageUrl) {
      await replyImageUrl(event, imageUrl)
    }
    return true
  }

  if (matchesAny(msg, DOUYIN_COMMANDS)) {
    await replyText(event, await getDouyinHot())
    return true
  }

  if (matchesAny(msg, WEIBO_COMMANDS)) {
    await replyText(event, await getWeiboHot())
    return true
  }

  if (matchesAny(msg, DONGCHEDI_COMMANDS)) {
    await replyText(event, await getDongchediHot())
    return true
  }

  if (matchesAny(msg, KFC_COMMANDS)) {
    await replyText(event, await getKfcCopy())
    return true
  }

  if (matchesAny(msg, LUCK_COMMANDS)) {
    await replyText(event, await getRandomLuck())
    return true
  }

  const parsed = parseCommandArgs(msg)

  if (parsed && FABING_COMMANDS.includes(parsed.command as (typeof FABING_COMMANDS)[number])) {
    await replyText(event, await getFabingText(parsed.args || undefined))
    return true
  }

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
