import { segment } from 'qq-official-bot'
import { config } from '../config.js'
import type { GroupHandler } from '../types/group.js'
import { isOnCooldown } from '../utils/cooldown.js'
import { extractAtUserIds } from '../utils/message-parse.js'
import { resolveAsset } from '../utils/assets.js'
import { randomIndex } from '../utils/random.js'
import { replyAtTextImage, replySendable, replyText } from '../utils/reply.js'

const TRIGGERS = ['/放大招', '/打飞你'] as const

function includesTrigger(msg: string): (typeof TRIGGERS)[number] | null {
  for (const trigger of TRIGGERS) {
    if (msg.includes(trigger)) return trigger
  }
  return null
}

function isProtectedTarget(userId: string): boolean {
  return config.userIds.protected.includes(userId)
}

function isBoss(userId: string): boolean {
  return config.userIds.boss.includes(userId)
}

function isBotAccount(userId: string): boolean {
  return config.userIds.botAccounts.includes(userId)
}

async function handleFangDaZhao(
  ctx: Parameters<GroupHandler>[0],
  atUserIds: string[],
): Promise<void> {
  const { event } = ctx
  const flag = randomIndex(15)

  if (flag > 11) {
    const flag2 = randomIndex(3)
    await replyAtTextImage(
      event,
      atUserIds,
      '触发合击技！！！，敌人已被打飞，效果拔群',
      `image/lklxj/hj/${flag2}.jpg`,
    )
    return
  }

  await replyAtTextImage(event, atUserIds, '一招解决你！！', `image/lklxj/${flag}.jpg`)
}

async function handleDaFeiNi(ctx: Parameters<GroupHandler>[0], atUserIds: string[]): Promise<void> {
  const { event, userId } = ctx
  const protectedAtIds = atUserIds.filter(isProtectedTarget)

  if (protectedAtIds.length > 0) {
    const bossTarget = protectedAtIds.find(isBoss)
    if (bossTarget) {
      const flag = randomIndex(7)
      if (flag > 3) {
        await replyAtTextImage(
          event,
          [userId],
          '捏吗，敢打我老大。先把你送上去！',
          'image/dafeini.gif',
        )
      } else {
        await replyAtTextImage(event, atUserIds, '打飞老大我就自由啦！！', 'image/dafeini.gif')
      }
      return
    }

    if (protectedAtIds.some(isBotAccount)) {
      await replyText(event, '？！  怎么能会有🐔蠢到自己打自己！！')
      return
    }
  }

  if (isBoss(userId)) {
    await replyAtTextImage(event, atUserIds, '走你！', 'image/dafeini.gif')
    return
  }

  const flag = randomIndex(7)
  if (flag > 3) {
    await replySendable(event, [
      segment.text('喂，你谁啊！敢命令本拉🐔！'),
      ...atUserIds.map((id) => segment.at(id)),
      segment.image(resolveAsset('image/dafeini.jpg')),
    ])
    return
  }

  await replyAtTextImage(event, atUserIds, '这就帮你打飞！', 'image/dafeini.gif')
}

export const jiaohuHandle: GroupHandler = async (ctx) => {
  const trigger = includesTrigger(ctx.msg)
  if (!trigger) return false

  const atUserIds = extractAtUserIds(ctx.event.message)
  if (atUserIds.length === 0) return false

  if (await isOnCooldown(ctx.userId)) {
    await replyText(ctx.event, '冷却中,请稍后在发送哦')
    return true
  }

  if (trigger === '放大招') {
    await handleFangDaZhao(ctx, atUserIds)
    return true
  }

  await handleDaFeiNi(ctx, atUserIds)
  return true
}
