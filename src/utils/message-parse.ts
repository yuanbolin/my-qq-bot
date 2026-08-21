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

/** 去掉消息开头的 / 命令前缀（兼容半角 / 与全角 ／） */
export function stripSlashPrefix(text: string): string {
  const plain = extractPlainText(text).trim()
  if (plain.startsWith('/') || plain.startsWith('／')) {
    return plain.slice(1).trimStart()
  }
  return plain
}

/** 消息是否包含带 / 的命令（如 @某人 /打飞你） */
export function includesSlashCommand(msg: string, command: string): boolean {
  return extractPlainText(msg).includes(slashCommand(command))
}

/** 消息是否等于某命令（对比时忽略开头的 /，大小写不敏感） */
export function matchCommand(msg: string, command: string): boolean {
  const lhs = stripSlashPrefix(msg).toLowerCase()
  const rhs = stripSlashPrefix(command).toLowerCase()
  return lhs === rhs
}

/** 解析命令与参数（兼容已去掉 / 的消息），如 歌词 小宇 */
export function parseCommandArgs(msg: string): { command: string; args: string } | null {
  const plain = extractPlainText(msg).trim()
  if (!plain) return null

  const normalized = plain.startsWith('/') ? plain.slice(1) : plain
  const spaceIndex = normalized.indexOf(' ')
  if (spaceIndex === -1) {
    return { command: normalized, args: '' }
  }

  return {
    command: normalized.slice(0, spaceIndex),
    args: normalized.slice(spaceIndex + 1).trim(),
  }
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

/** 从消息段中提取图片 URL（接收消息的 file / url 字段） */
export function extractImageUrls(message: Sendable): string[] {
  const items = normalizeMessage(message)
  const urls: string[] = []

  for (const item of items) {
    if (typeof item === 'string') continue
    if (item.type !== 'image') continue

    const data = item.data as { file?: string | Buffer; url?: string }
    const candidates = [data.url, typeof data.file === 'string' ? data.file : undefined]
    for (const candidate of candidates) {
      if (!candidate) continue
      if (
        candidate.startsWith('http://')
        || candidate.startsWith('https://')
        || candidate.startsWith('//')
      ) {
        const normalized = candidate.startsWith('//') ? `https:${candidate}` : candidate
        if (!urls.includes(normalized)) {
          urls.push(normalized)
        }
      }
    }
  }

  return urls
}

function normalizeMessage(message: Sendable): MessageElem[] {
  if (Array.isArray(message)) {
    return message.filter((item): item is MessageElem => typeof item !== 'string')
  }
  if (typeof message === 'string') return []
  return [message as MessageElem]
}
