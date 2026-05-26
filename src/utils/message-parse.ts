import type { Sendable } from 'qq-official-bot'

type MessageElem = Extract<Sendable, object>

/** 去掉 raw_message 中的 at/reply 等段标记，得到可读文本 */
export function extractPlainText(rawMessage: string): string {
  return rawMessage
    .replace(/<at,[^>]*>/gi, '')
    .replace(/<reply,[^>]*>/gi, '')
    .trim()
}

/** 确保命令以 / 开头 */
export function slashCommand(command: string): string {
  return command.startsWith('/') ? command : `/${command}`
}

/** 去掉消息开头的 / 命令前缀 */
export function stripSlashPrefix(text: string): string {
  const plain = extractPlainText(text)
  return plain.startsWith('/') ? plain.slice(1) : plain
}

/** 消息是否包含带 / 的命令（如 @某人 /打飞你） */
export function includesSlashCommand(msg: string, command: string): boolean {
  return extractPlainText(msg).includes(slashCommand(command))
}

/** 消息是否等于某命令（对比时忽略开头的 /） */
export function matchCommand(msg: string, command: string): boolean {
  return stripSlashPrefix(msg) === stripSlashPrefix(command)
}

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
