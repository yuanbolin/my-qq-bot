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

/** 指令面板 feature_id / button_id -> 命令名，如 abc123:早安,def456:帮助 */
function parseCommandFeatures(value: string | undefined): Record<string, string> {
  const map: Record<string, string> = {}
  if (!value?.trim()) return map
  for (const part of value.split(',')) {
    const colon = part.indexOf(':')
    if (colon <= 0) continue
    const id = part.slice(0, colon).trim()
    const cmd = part.slice(colon + 1).trim()
    if (id && cmd) map[id] = cmd
  }
  return map
}

function parseOpenidQqMap(value: string | undefined): Record<string, string> {
  const map: Record<string, string> = {}
  if (!value?.trim()) return map
  for (const part of value.split(',')) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const openid = part.slice(0, eq).trim()
    const qq = part.slice(eq + 1).trim()
    if (openid && /^\d{5,11}$/.test(qq)) {
      map[openid] = qq
    }
  }
  return map
}

/** websocket：机器人主动连 QQ；webhook：QQ 向服务器 POST（需 nginx 反代） */
export type BotMode = 'websocket' | 'webhook'
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export const config = {
  appid: requireEnv('QQ_APPID'),
  secret: requireEnv('QQ_SECRET'),
  sandbox: process.env.QQ_SANDBOX !== 'false',
  logLevel: (process.env.LOG_LEVEL ?? 'info') as LogLevel,
  mode: (process.env.BOT_MODE ?? 'websocket') as BotMode,
  webhookPort: Number(process.env.WEBHOOK_PORT ?? '3100'),
  webhookPath: process.env.WEBHOOK_PATH ?? '/webhook',
  assetsDir: path.resolve(process.env.ASSETS_DIR ?? './assets'),
  /** 应用日志目录，默认 ./logs；设为空字符串可关闭文件日志 */
  logDir: process.env.LOG_DIR === '' ? undefined : path.resolve(process.env.LOG_DIR ?? './logs'),
  /** 应用自身日志级别（与 qq-official-bot 的 LOG_LEVEL 独立） */
  appLogLevel: (process.env.APP_LOG_LEVEL ?? process.env.LOG_LEVEL ?? 'info') as LogLevel,
  redisUrl: process.env.REDIS_URL?.trim() || undefined,
  /** 管理端指令面板 feature_id 映射，见 .env.example */
  commandFeatures: parseCommandFeatures(process.env.COMMAND_FEATURES),
  /** openid -> QQ 号，用于摸头等需要数字 QQ 的功能 */
  openidQqMap: parseOpenidQqMap(process.env.OPENID_QQ_MAP),
  oick: {
    apiUrl: process.env.OICK_QQTX_URL?.trim() || 'https://api.oick.cn/api/qqtx',
    apiKey: process.env.OICK_API_KEY?.trim() || '',
    timeoutMs: Number(process.env.OICK_API_TIMEOUT_MS ?? '10000'),
  },
  userIds: {
    wulala: parseUserIds(process.env.USER_WULALA),
    /** 原 QQ 1252432332 */
    boss: parseUserIds(process.env.USER_BOSS),
    /** 原 QQ 1684043489，机器人账号 */
    botAccounts: parseUserIds(process.env.USER_BOT),
    /** 打飞你时受保护用户 openid（含 boss、bot 及原 487827081、2721553664） */
    protected: parseUserIds(process.env.USER_PROTECTED),
  },
  /** 60s API：https://docs.60s-api.viki.moe */
  sixtyApi: {
    baseUrl: process.env.SIXTY_API_BASE_URL?.trim() || 'https://60s.viki.moe',
    timeoutMs: Number(process.env.SIXTY_API_TIMEOUT_MS ?? '15000'),
    maxTextLength: Number(process.env.SIXTY_API_MAX_TEXT_LENGTH ?? '3500'),
  },
}
