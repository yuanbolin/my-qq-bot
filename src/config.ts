import 'dotenv/config'
import path from 'node:path'

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`缺少环境变量 ${name}，请复制 .env.example 为 .env 并填写`)
  }
  return value
}

function parseUserIds(value: string | undefined): string[] {
  if (!value?.trim()) return []
  return value.split(',').map((id) => id.trim()).filter(Boolean)
}

/** websocket：机器人主动连 QQ；webhook：QQ 向服务器 POST（需 nginx 反代） */
export type BotMode = 'websocket' | 'webhook'

export const config = {
  appid: requireEnv('QQ_APPID'),
  secret: requireEnv('QQ_SECRET'),
  sandbox: process.env.QQ_SANDBOX !== 'false',
  logLevel: (process.env.LOG_LEVEL ?? 'info') as
    | 'trace'
    | 'debug'
    | 'info'
    | 'warn'
    | 'error'
    | 'fatal',
  mode: (process.env.BOT_MODE ?? 'websocket') as BotMode,
  webhookPort: Number(process.env.WEBHOOK_PORT ?? '3100'),
  webhookPath: process.env.WEBHOOK_PATH ?? '/webhook',
  assetsDir: path.resolve(process.env.ASSETS_DIR ?? './assets'),
  redisUrl: process.env.REDIS_URL?.trim() || undefined,
  userIds: {
    wulala: parseUserIds(process.env.USER_WULALA),
    boss: parseUserIds(process.env.USER_BOSS),
  },
}
