import type { Sendable } from 'qq-official-bot'

type MessageElem = Extract<Sendable, object>

/** 从消息段中提取 @ 的用户 openid */
export function extractAtUserIds(message: Sendable): string[] {
  const items = normalizeMessage(message)
  const ids: string[] = []

  for (const item of items) {
    if (typeof item === 'string') continue
    if (item.type === 'at') {
      const userId = item.data.user_id
      if (userId && userId !== 'all') {
        ids.push(userId)
      }
    }
  }

  return ids
}

/** 消息是否 @ 了指定用户（含机器人自身） */
export function isAtUser(message: Sendable, userId: string): boolean {
  return extractAtUserIds(message).includes(userId)
}

function normalizeMessage(message: Sendable): MessageElem[] {
  if (Array.isArray(message)) {
    return message.filter((item): item is MessageElem => typeof item !== 'string')
  }
  if (typeof message === 'string') return []
  return [message as MessageElem]
}
