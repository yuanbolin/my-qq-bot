import type { GroupHandler } from '../types/group.js'
import type { PrivateHandler } from '../types/private.js'
import { getBingDailyImageUrl, getDogDiary } from '../services/oick-fun.js'
import { matchCommand } from '../utils/message-parse.js'
import { replyImageUrl, replyText } from '../utils/reply.js'

type MessageEvent = Parameters<typeof replyText>[0]

const DOG_COMMANDS = ['舔狗日记', '/舔狗日记'] as const
const BING_COMMANDS = ['Bing每日图', '/Bing每日图', '必应每日图'] as const

function matchesAny(msg: string, commands: readonly string[]): boolean {
  return commands.some((cmd) => matchCommand(msg, cmd))
}

async function dispatchOickFun(msg: string, event: MessageEvent): Promise<boolean> {
  if (matchesAny(msg, DOG_COMMANDS)) {
    const content = await getDogDiary()
    await replyText(event, `🐶 舔狗日记\n\n${content}`)
    return true
  }

  if (matchesAny(msg, BING_COMMANDS)) {
    const imageUrl = await getBingDailyImageUrl()
    await replyText(event, '🖼️ Bing 每日图')
    await replyImageUrl(event, imageUrl)
    return true
  }

  return false
}

export const oickFunGroupHandle: GroupHandler = async (ctx) => {
  try {
    return await dispatchOickFun(ctx.msg, ctx.event)
  } catch (error) {
    await replyText(
      ctx.event,
      `获取失败：${error instanceof Error ? error.message : String(error)}`,
    )
    return true
  }
}

export const oickFunPrivateHandle: PrivateHandler = async (ctx) => {
  try {
    return await dispatchOickFun(ctx.msg, ctx.event)
  } catch (error) {
    await replyText(
      ctx.event,
      `获取失败：${error instanceof Error ? error.message : String(error)}`,
    )
    return true
  }
}
