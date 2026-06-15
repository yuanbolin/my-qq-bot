import type { PrivateContext } from '../types/private.js'
import { stripSlashPrefix } from '../utils/message-parse.js'
import { logger } from '../utils/logger.js'
import { memePrivateHandle } from './meme.js'
import { oickFunPrivateHandle } from './oick-fun.js'
import { sixtyApiPrivateHandle } from './sixty-api.js'
import { sorryPrivateHandle } from './sorry.js'
import { jmPrivateHandle } from './jm.js'

function handleBasicCommand(text: string): string | null {
  const content = text.trim()

  if (content === 'ping') return 'pong'

  if (content === '帮助') {
    return [
      '可用命令：',
      'ping - 测试连通性',
      'echo <内容> - 复读消息',
      '/60s - 每天 60 秒读懂世界',
      '/ai资讯 - AI 资讯快报',
      '/历史上的今天 - 历史上的今天',
      '/摸鱼日报 - 摸鱼日报',
      '/歌词 <歌名> - 歌词搜索',
      '/epic - Epic 免费游戏',
      '/必应壁纸 - 必应每日壁纸',
      '/抖音热搜 - 抖音热搜榜',
      '/微博热搜 - 微博热搜榜',
      '/懂车帝热搜 - 懂车帝热搜榜',
      '/kfc - 随机 KFC 文案',
      '/运势 - 随机运势',
      '/发病文学 [名字] - 随机发病文学',
      '舔狗日记 - 随机舔狗日记',
      'Bing每日图 - Bing 每日背景图',
      '随机梗图 - 随机 reddit 梗图（多张预览）',
      '/sorry 或 /为所欲为 - 生成「有钱真的可以为所欲为」GIF',
      '/王境泽 或 /真香 - 王境泽表情包',
      '/sorry帮助 - 表情包命令说明',
      '/jm <车号> - 下载本子（群聊长图，私聊 PDF）',
      '/jm帮助 - JM 命令说明',
    ].join('\n')
  }

  if (content.startsWith('echo ')) {
    return content.slice(5).trim() || '请提供要复读的内容'
  }

  return null
}

const handlers = [
  { name: 'sixty-api', handle: sixtyApiPrivateHandle },
  { name: 'oick-fun', handle: oickFunPrivateHandle },
  { name: 'meme', handle: memePrivateHandle },
  { name: 'sorry', handle: sorryPrivateHandle },
  { name: 'jm', handle: jmPrivateHandle },
]

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
