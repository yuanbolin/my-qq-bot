import {
  Bot,
  GroupMessageEvent,
  Intent,
  PrivateMessageEvent,
  ReceiverMode,
} from 'qq-official-bot'
import { config } from './config.js'
import { handleGroupMessage } from './handlers/group-router.js'
import { handlePrivateMessage } from './handlers/private-router.js'
import { logger } from './utils/logger.js'

const INTENTS: Intent[] = ['GROUP_AND_C2C_EVENT']

function createBot() {
  const base = {
    appid: config.appid,
    secret: config.secret,
    sandbox: config.sandbox,
    removeAt: true,
    logLevel: config.logLevel,
    maxRetry: 10,
    intents: INTENTS,
  }

  if (config.mode === 'webhook') {
    return new Bot({
      ...base,
      mode: ReceiverMode.WEBHOOK,
      port: config.webhookPort,
      path: config.webhookPath,
    })
  }

  return new Bot({
    ...base,
    mode: ReceiverMode.WEBSOCKET,
  })
}

const bot = createBot() as Bot

bot.on('message.group', async (event: GroupMessageEvent) => {
  const msg = event.raw_message.trim()
  logger.info('收到群聊消息', {
    groupId: event.group_id,
    groupName: event.group_name,
    userId: event.user_id,
    userName: event.sender.user_name,
    msg,
  })

  try {
    await handleGroupMessage({
      event,
      msg,
      userId: event.user_id,
      userName: event.sender.user_name,
    })
  } catch (error) {
    logger.error('群聊消息处理失败', {
      groupId: event.group_id,
      msg,
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

bot.on('message.private', async (event: PrivateMessageEvent) => {
  const text = event.raw_message.trim()
  logger.info('收到私聊消息', {
    userId: event.user_id,
    userName: event.sender.user_name,
    msg: text,
  })

  try {
    await handlePrivateMessage({
      event,
      msg: text,
      userId: event.user_id,
      userName: event.sender.user_name,
    })
  } catch (error) {
    logger.error('私聊消息处理失败', {
      userId: event.user_id,
      msg: text,
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

export async function sendGroupMessage(groupId: string, content: string) {
  return bot.sendGroupMessage(groupId, content)
}

export async function sendPrivateMessage(userId: string, content: string) {
  return bot.sendPrivateMessage(userId, content)
}

async function main() {
  logger.info('正在启动 QQ 机器人', {
    mode: config.mode,
    sandbox: config.sandbox,
    logDir: config.logDir ?? '(仅控制台)',
    appLogLevel: config.appLogLevel,
  })

  await bot.start()

  if (config.mode === 'webhook') {
    logger.info('Webhook 模式已启动', {
      url: `127.0.0.1:${config.webhookPort}${config.webhookPath}`,
    })
  } else {
    logger.info('WebSocket 模式已连接，正在监听群聊与私聊消息')
  }
}

main().catch((error: unknown) => {
  logger.error('启动失败', {
    error: error instanceof Error ? error.message : String(error),
  })
  process.exit(1)
})
