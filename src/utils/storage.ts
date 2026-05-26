import Redis from 'ioredis'
import { config } from '../config.js'

const memoryStore = new Map<string, string>()

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (!config.redisUrl) return null
  if (!redis) {
    redis = new Redis(config.redisUrl)
  }
  return redis
}

export async function getStorage(key: string): Promise<string | null> {
  const client = getRedis()
  if (client) {
    return client.get(key)
  }
  return memoryStore.get(key) ?? null
}

export async function setStorage(key: string, value: string): Promise<void> {
  const client = getRedis()
  if (client) {
    await client.set(key, value)
    return
  }
  memoryStore.set(key, value)
}
