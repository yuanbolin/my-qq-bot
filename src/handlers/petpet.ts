import type { GroupHandler } from '../types/group.js'
import { fetchQqAvatar } from '../services/qq-avatar.js'
import { generatePetpetGif } from '../services/petpet.js'
import { isOnCooldown } from '../utils/cooldown.js'
import { extractAtUserIds, stripSlashPrefix } from '../utils/message-parse.js'
import { resolvePetpetTarget } from '../utils/qq-resolve.js'
import { replyAtGif, replyText } from '../utils/reply.js'

export const petpetHandle: GroupHandler = async (ctx) => {
  const plain = stripSlashPrefix(ctx.msg)
  if (!plain.includes('摸头')) return false

  if (await isOnCooldown(ctx.userId, 'petpet')) {
    await replyText(ctx.event, '冷却中，请稍后再摸~')
    return true
  }

  const atIds = extractAtUserIds(ctx.event.message)
  const resolved = resolvePetpetTarget(plain, ctx.userId, atIds)

  if (!resolved.ok) {
    if (resolved.reason === 'multi_at') {
      await replyText(ctx.event, '一次只能摸一个目标哦！')
      return true
    }
    await replyText(
      ctx.event,
      [
        '无法获取目标 QQ 号。',
        'QQ 官方机器人事件通常只有 openid，不含数字 QQ。',
        '请任选其一：',
        '1) 在 .env 配置 OPENID_QQ_MAP=openid=123456789',
        '2) 消息中带 QQ 号，例如：摸头 123456789',
        '3) @ 对方且其 openid 已在映射中',
      ].join('\n'),
    )
    return true
  }

  const { openid, qq } = resolved.target

  try {
    const { imgUrl, name } = await fetchQqAvatar(qq)
    const gif = await generatePetpetGif(imgUrl)
    const caption = name ? `摸了一下 ${name}` : '摸了一下~'
    await replyAtGif(ctx.event, openid, gif, caption)
  } catch (error) {
    await replyText(
      ctx.event,
      `摸头失败：${error instanceof Error ? error.message : String(error)}`,
    )
  }

  return true
}
