import 'dotenv/config'

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`缺少环境变量 ${name}，请复制 .env.example 为 .env 并填写`)
  }
  return value
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
  /** Webhook 本地监听端口（仅 BOT_MODE=webhook 时生效） */
  webhookPort: Number(process.env.WEBHOOK_PORT ?? '3100'),
  /** Webhook 路径，须与 nginx 反代后的路径一致 */
  webhookPath: process.env.WEBHOOK_PATH ?? '/webhook',
}
