import type { PrivateContext } from '../types/private.js'
import { stripSlashPrefix } from '../utils/message-parse.js'
import { logger } from '../utils/logger.js'
import { sixtyApiPrivateHandle } from './sixty-api.js'

function handleBasicCommand(text: string): string | null {
  const content = text.trim()

  if (content === 'ping') return 'pong'

  if (content === 'help') {
    return [
      '可用命令：',
      'ping - 测试连通性',
      'help - 显示帮助',
      'echo <内容> - 复读消息',
      '/60s - 每天 60 秒读懂世界',
      '/ai资讯 - AI 资讯快报',
      '/历史上的今天 - 历史上的今天',
      '/摸鱼日报 - 摸鱼日报',
      '/歌词 <歌名> - 歌词搜索',
    ].join('\n')
  }

  if (content.startsWith('echo ')) {
    return content.slice(5).trim() || '请提供要复读的内容'
  }

  return null
}

const handlers = [{ name: 'sixty-api', handle: sixtyApiPrivateHandle }]

export async function handlePrivateMessage(ctx: PrivateContext): Promise<boolean> {
  const msg = stripSlashPrefix(ctx.msg.trim())
  const basic = handleBasicCommand(msg)
  if (basic) {
    await ctx.event.reply(basic)
    logger.info('私聊已回复', { handler: 'basic', userId: ctx.userId, msg })
    return true
  }

  const normalizedCtx = { ...ctx, msg }

  for (const { name, handle } of handlers) {
    try {
      if (await handle(normalizedCtx)) {
        logger.info('私聊已回复', { handler: name, userId: ctx.userId, msg })
        return true
      }
    } catch (error) {
      logger.error('私聊处理异常', {
        handler: name,
        userId: ctx.userId,
        msg,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  logger.debug('私聊未匹配', { userId: ctx.userId, msg })
  return false
}
