import {
  Bot,
  GroupMessageEvent,
  Intent,
  PrivateMessageEvent,
  ReceiverMode,
} from 'qq-official-bot'
import { config } from './config.js'
import { handleGroupMessage } from './handlers/group-router.js'

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

/** 私聊简单命令 */
function handlePrivateCommand(text: string): string | null {
  const content = text.trim()

  if (content === 'ping') return 'pong'

  if (content === 'help') {
    return [
      '可用命令：',
      'ping - 测试连通性',
      'help - 显示帮助',
      'echo <内容> - 复读消息',
    ].join('\n')
  }

  if (content.startsWith('echo ')) {
    return content.slice(5).trim() || '请提供要复读的内容'
  }

  return null
}

bot.on('message.group', async (event: GroupMessageEvent) => {
  const msg = event.raw_message.trim()
  console.log(
    `[群聊] ${event.group_name}(${event.group_id}) ${event.sender.user_name}: ${msg}`,
  )

  await handleGroupMessage({
    event,
    msg,
    userId: event.user_id,
    userName: event.sender.user_name,
  })
})

bot.on('message.private', async (event: PrivateMessageEvent) => {
  const text = event.raw_message.trim()
  console.log(`[私聊] ${event.sender.user_name}(${event.user_id}): ${text}`)

  const reply = handlePrivateCommand(text)
  if (reply) {
    await event.reply(reply)
  }
})

export async function sendGroupMessage(groupId: string, content: string) {
  return bot.sendGroupMessage(groupId, content)
}

export async function sendPrivateMessage(userId: string, content: string) {
  return bot.sendPrivateMessage(userId, content)
}

async function main() {
  await bot.start()

  if (config.mode === 'webhook') {
    console.log(
      `QQ 机器人 Webhook 已启动：127.0.0.1:${config.webhookPort}${config.webhookPath}`,
    )
    console.log('请确保 nginx 已将公网 HTTPS 地址反代到上述路径')
  } else {
    console.log('QQ 机器人 WebSocket 已连接，正在监听群聊与私聊消息...')
  }
}

main().catch((error: unknown) => {
  console.error('启动失败：', error)
  process.exit(1)
})
