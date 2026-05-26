import { getStorage, setStorage } from './storage.js'

const COOLDOWN_MS = 30_000

/** 30 秒内重复调用返回 true（应跳过） */
export async function isOnCooldown(userId: string, prefix = 'lengque'): Promise<boolean> {
  const key = `${userId}${prefix}`
  const oldTime = await getStorage(key)
  const now = Date.now()

  if (oldTime) {
    const diff = now - Number(oldTime)
    if (diff < COOLDOWN_MS) {
      return true
    }
    await setStorage(key, String(now))
    return false
  }

  await setStorage(key, String(now))
  return false
}
