import { config } from '../config.js'

const QQ_NUMBER_RE = /\b([1-9]\d{4,10})\b/

/** 从消息文本中提取 QQ 号（5–11 位数字） */
export function extractQqNumber(text: string): string | null {
  const match = text.match(QQ_NUMBER_RE)
  return match?.[1] ?? null
}

/** 根据 openid 查配置的 QQ 号映射 */
export function resolveQqByOpenid(openid: string): string | null {
  return config.openidQqMap[openid] ?? null
}

export interface PetpetTarget {
  openid: string
  qq: string
}

export type PetpetTargetResult =
  | { ok: true; target: PetpetTarget }
  | { ok: false; reason: 'multi_at' | 'no_qq' }

/**
 * 解析摸头目标：
 * 1. 消息中的 QQ 号优先
 * 2. 否则用 @ 用户（无 @ 则为自己）的 openid 查 OPENID_QQ_MAP
 */
export function resolvePetpetTarget(
  msg: string,
  senderOpenid: string,
  atOpenids: string[],
): PetpetTargetResult {
  if (atOpenids.length > 1) {
    return { ok: false, reason: 'multi_at' }
  }

  const targetOpenid = atOpenids[0] ?? senderOpenid
  const qqFromMsg = extractQqNumber(msg)
  if (qqFromMsg) {
    return { ok: true, target: { openid: targetOpenid, qq: qqFromMsg } }
  }

  const qq = resolveQqByOpenid(targetOpenid)
  if (qq) {
    return { ok: true, target: { openid: targetOpenid, qq } }
  }

  return { ok: false, reason: 'no_qq' }
}
