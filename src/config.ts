import 'dotenv/config'
import path from 'node:path'
import { resolveJmPythonPath } from './utils/jm-python-path.js'

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
    /** 舔狗日记 API（https://api.oick.cn/doc/dog，需 apikey） */
    dogUrl: process.env.OICK_DOG_URL?.trim() || 'https://api.oick.cn/api/dog',
    /** Bing 每日图 API（https://api.oick.cn/doc/bing，重定向到图片） */
    bingUrl: process.env.OICK_BING_URL?.trim() || 'https://api.oick.cn/api/bing',
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
  /** 随机梗图 API：https://meme-api.com/gimme */
  meme: {
    apiUrl: process.env.MEME_API_URL?.trim() || 'https://meme-api.com/gimme',
    timeoutMs: Number(process.env.MEME_API_TIMEOUT_MS ?? '10000'),
    /** 输出的 preview 图片数量上限 */
    previewLimit: Number(process.env.MEME_PREVIEW_LIMIT ?? '3'),
  },
  /** node-sorry 表情包：https://github.com/q809198545/node-sorry */
  sorry: {
    ffmpegPath: process.env.SORRY_FFMPEG_PATH?.trim() || 'ffmpeg',
    templatesDir: path.join(
      path.resolve(process.env.ASSETS_DIR ?? './assets'),
      'sorry/templates',
    ),
    cacheDir: process.env.SORRY_CACHE_DIR?.trim()
      ? path.resolve(process.env.SORRY_CACHE_DIR)
      : path.join(path.resolve(process.env.ASSETS_DIR ?? './assets'), 'sorry/cache'),
    scaleWidth: Number(process.env.SORRY_SCALE_WIDTH ?? '300'),
    fps: Number(process.env.SORRY_FFMPEG_FPS ?? '8'),
    timeoutMs: Number(process.env.SORRY_FFMPEG_TIMEOUT_MS ?? '60000'),
  },
  /** JM 本子下载：https://github.com/hect0x7/JMComic-Crawler-Python */
  jm: {
    pythonPath: resolveJmPythonPath(),
    scriptPath: process.env.JM_SCRIPT_PATH?.trim()
      ? path.resolve(process.env.JM_SCRIPT_PATH)
      : path.resolve('scripts/jm_export.py'),
    optionPath: process.env.JM_OPTION_PATH?.trim()
      ? path.resolve(process.env.JM_OPTION_PATH)
      : path.resolve('config/jmcomic.option.yml'),
    jobsDir: process.env.JM_JOBS_DIR?.trim()
      ? path.resolve(process.env.JM_JOBS_DIR)
      : path.resolve('data/jm/jobs'),
    timeoutMs: Number(process.env.JM_TIMEOUT_MS ?? '600000'),
    cooldownMs: Number(process.env.JM_COOLDOWN_MS ?? '300000'),
    maxPages: Number(process.env.JM_MAX_PAGES ?? '200'),
    /** 留空表示不限制；逗号分隔 openid */
    allowedUsers: parseUserIds(process.env.JM_ALLOWED_USERS),
    /** nginx 对外 URL 前缀，如 https://jtgy.gemstonecn.com/jm_img */
    publicBaseUrl: (
      process.env.JM_PUBLIC_BASE_URL
      ?? process.env.JM_DOWNLOAD_BASE_URL
      ?? 'https://jtgy.gemstonecn.com/jm_img'
    ).trim().replace(/\/$/, ''),
    /** 本机缓存目录，需与 nginx alias 指向同一目录 */
    cacheDir: process.env.JM_CACHE_DIR?.trim()
      ? path.resolve(process.env.JM_CACHE_DIR)
      : path.resolve('data/jm/cache'),
    /** 缓存有效期（毫秒），默认 24 小时 */
    cacheTtlMs: Number(process.env.JM_CACHE_TTL_MS ?? String(24 * 60 * 60 * 1000)),
    /** 使用 nginx 静态映射时保持 false；仅无 nginx 时可设为 true */
    useBuiltinDownloadServer: process.env.JM_USE_BUILTIN_DOWNLOAD_SERVER === 'true',
    /** 内置 HTTP 下载服务端口（仅 useBuiltinDownloadServer=true 时生效） */
    downloadPort: Number(process.env.JM_DOWNLOAD_PORT ?? '8080'),
    /** 单张长图最大字节数，默认 50MB（整图不切分） */
    longImgMaxBytes: Number(process.env.JM_LONGIMG_MAX_BYTES ?? String(500 * 1024 * 1024)),
    /** 长图 JPEG 起始质量（1-100） */
    longImgJpegQuality: Number(process.env.JM_LONGIMG_JPEG_QUALITY ?? '90'),
    /** Pillow 像素上限，none 表示不限制（服务端拼接长图） */
    longImgMaxPixels: process.env.JM_LONGIMG_MAX_PIXELS?.trim() || 'none',
  },
  /** 自定义关键词应答：空 admins = 全员可设置/删除 */
  autoReply: {
    admins: parseUserIds(process.env.AUTO_REPLY_ADMINS),
  },
}
