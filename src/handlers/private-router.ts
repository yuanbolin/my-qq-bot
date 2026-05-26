import type { PrivateContext } from '../types/private.js'
import { logger } from '../utils/logger.js'
import { mlyPrivateHandle } from './mly.js'

function handleBasicCommand(text: string): string | null {
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

const handlers = [{ name: 'mly', handle: mlyPrivateHandle }]

export async function handlePrivateMessage(ctx: PrivateContext): Promise<boolean> {
  const basic = handleBasicCommand(ctx.msg)
  if (basic) {
    await ctx.event.reply(basic)
    logger.info('私聊已回复', { handler: 'basic', userId: ctx.userId, msg: ctx.msg })
    return true
  }

  for (const { name, handle } of handlers) {
    try {
      if (await handle(ctx)) {
        logger.info('私聊已回复', {
          handler: name,
          userId: ctx.userId,
          msg: ctx.msg,
        })
        return true
      }
    } catch (error) {
      logger.error('私聊处理异常', {
        handler: name,
        userId: ctx.userId,
        msg: ctx.msg,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  logger.debug('私聊未匹配', { userId: ctx.userId, msg: ctx.msg })
  return false
}
