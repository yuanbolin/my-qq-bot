import { fetchMlyReply } from '../services/mly-api.js'
import type { GroupHandler } from '../types/group.js'
import type { PrivateHandler } from '../types/private.js'
import { isAtUser } from '../utils/message-parse.js'
import { replySendable } from '../utils/reply.js'

function shouldSkipGroupMly(msg: string): boolean {
  return msg.includes('/人生重启') || msg.includes('/重启人生')
}

async function sendMlyGroupReply(ctx: Parameters<GroupHandler>[0]): Promise<boolean> {
  const { event, msg, userId, userName } = ctx

  if (!isAtUser(event.message, event.self_id)) {
    return false
  }

  if (shouldSkipGroupMly(msg)) {
    return false
  }

  const segments = await fetchMlyReply({
    from: userId,
    fromName: userName,
    to: event.self_id,
    type: 2,
    content: msg,
  })

  if (!segments) return false

  await replySendable(event, segments)
  return true
}

async function sendMlyPrivateReply(
  ctx: Parameters<PrivateHandler>[0],
  content: string,
): Promise<boolean> {
  const { event, userId, userName } = ctx

  const segments = await fetchMlyReply({
    from: userId,
    fromName: userName,
    to: event.self_id,
    type: 1,
    content,
  })

  if (!segments) return false

  await replySendable(event, segments)
  return true
}

/** 群聊：@ 机器人时走茉莉云（排除人生重启类前缀） */
export const mlyGroupHandle: GroupHandler = async (ctx) => {
  return sendMlyGroupReply(ctx)
}

/** 私聊：人生重启 / 重启人生 / + 前缀 */
export const mlyPrivateHandle: PrivateHandler = async (ctx) => {
  const { msg } = ctx

  if (msg.startsWith('人生重启') || msg.startsWith('重启人生')) {
    return sendMlyPrivateReply(ctx, msg)
  }

  if (msg.includes('+')) {
    const text = msg.split('+')[1]
    if (!text) return false
    return sendMlyPrivateReply(ctx, text)
  }

  return false
}
