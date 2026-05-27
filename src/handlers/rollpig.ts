import type { GroupHandler } from '../types/group.js'
import pigList from '../data/rollpig.json'
import { parseCommandArgs } from '../utils/message-parse.js'
import { replyImage, replyText } from '../utils/reply.js'
import { getStorage, setStorage } from '../utils/storage.js'
import { randomIndex } from '../utils/random.js'

interface PigInfo {
  id: string
  name: string
  description: string
  analysis: string
}

const COMMAND_ALIASES = ['今日小猪', '抽小猪', '我的小猪', 'rollpig'] as const

function isRollPigCommand(command: string): boolean {
  return COMMAND_ALIASES.includes(command as (typeof COMMAND_ALIASES)[number])
}

function todayKey(): string {
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function secondsUntilMidnight(): number {
  const now = new Date()
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  return Math.max(1, Math.floor((next.getTime() - now.getTime()) / 1000))
}

function rollPig(): PigInfo {
  const list = pigList as PigInfo[]
  if (!list.length) {
    throw new Error('小猪库为空，请检查 src/data/rollpig.json')
  }
  return list[randomIndex(list.length)]
}

function formatPigText(pig: PigInfo): string {
  return [
    '🐷 今日小猪',
    `名称：${pig.name}`,
    `描述：${pig.description}`,
    `解析：${pig.analysis}`,
  ].join('\n')
}

function pigImageRelativePath(pigId: string): string {
  return `image/rollpig/${pigId}.png`
}

export const rollpigHandle: GroupHandler = async (ctx) => {
  const parsed = parseCommandArgs(ctx.msg)
  if (!parsed) return false

  if (!isRollPigCommand(parsed.command)) return false

  const today = todayKey()
  const cacheKey = `rollpig:${ctx.event.group_id}:${ctx.userId}:${today}`
  const cached = await getStorage(cacheKey)

  let pig: PigInfo
  if (cached) {
    const found = (pigList as PigInfo[]).find((p) => p.id === cached)
    pig = found ?? rollPig()
  } else {
    pig = rollPig()
    await setStorage(cacheKey, pig.id, { ttlSeconds: secondsUntilMidnight() })
  }

  await replyText(ctx.event, formatPigText(pig))

  // 图片：按 id 匹配 assets/image/rollpig/<id>.png（如需 jpg/webp/gif，可自行改为多扩展尝试）
  try {
    await replyImage(ctx.event, pigImageRelativePath(pig.id))
  } catch {
    // 图片缺失时降级为纯文本
  }

  return true
}

