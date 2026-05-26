import Redis from 'ioredis'
import { config } from '../config.js'
import { logger } from './logger.js'

const memoryStore = new Map<string, string>()

let redis: Redis | null = null
let useRedis = false

function maskRedisUrl(url: string): string {
  return url.replace(/:([^:@/]+)@/, ':****@')
}

function getRedisClient(): Redis | null {
  if (!config.redisUrl) return null
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5_000,
      lazyConnect: true,
    })
    redis.on('error', (error) => {
      logger.error('Redis 连接异常', {
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }
  return redis
}

/** 启动时校验 Redis，并明确当前使用的存储后端 */
export async function initStorage(): Promise<void> {
  if (!config.redisUrl) {
    useRedis = false
    logger.warn('未配置 REDIS_URL，人品/冷却使用进程内存（重启后丢失，多实例不共享）')
    return
  }

  const client = getRedisClient()
  if (!client) return

  try {
    await client.connect()
    const pong = await client.ping()
    if (pong !== 'PONG') {
      throw new Error(`Redis PING 返回异常: ${pong}`)
    }
    useRedis = true
    logger.info('Redis 存储已就绪', { url: maskRedisUrl(config.redisUrl) })
  } catch (error) {
    useRedis = false
    logger.error('Redis 连接失败，人品/冷却将回退到进程内存', {
      url: maskRedisUrl(config.redisUrl),
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export function getStorageBackend(): 'redis' | 'memory' {
  return useRedis ? 'redis' : 'memory'
}

export async function getStorage(key: string): Promise<string | null> {
  if (useRedis) {
    const client = getRedisClient()
    if (client) {
      return client.get(key)
    }
  }
  return memoryStore.get(key) ?? null
}

export async function setStorage(
  key: string,
  value: string,
  options?: { ttlSeconds?: number },
): Promise<void> {
  if (useRedis) {
    const client = getRedisClient()
    if (client) {
      const ttl = options?.ttlSeconds
      if (ttl && ttl > 0) {
        await client.set(key, value, 'EX', ttl)
      } else {
        await client.set(key, value)
      }
      return
    }
  }
  memoryStore.set(key, value)
}
