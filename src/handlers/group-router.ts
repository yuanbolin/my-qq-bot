import type { GroupContext } from '../types/group.js'
import { logger } from '../utils/logger.js'
import { daijiaweiHandle } from './daijiawei.js'
import { fangzhangHandle } from './fangzhang.js'
import { messageMiscHandle } from './message-misc.js'
import { jiaohuHandle } from './jiaohu.js'
import { sixtyApiGroupHandle } from './sixty-api.js'
import { xiaolajiHandle } from './xiaolaji.js'
import { petpetHandle } from './petpet.js'
import { rollpigHandle } from './rollpig.js'

const handlers = [
  { name: 'fangzhang', handle: fangzhangHandle },
  { name: 'daijiawei', handle: daijiaweiHandle },
  { name: 'xiaolaji', handle: xiaolajiHandle },
  { name: 'message-misc', handle: messageMiscHandle },
  { name: 'jiaohu', handle: jiaohuHandle },
  { name: 'petpet', handle: petpetHandle },
  { name: 'sixty-api', handle: sixtyApiGroupHandle },
  { name: 'rollpig', handle: rollpigHandle },
]

export async function handleGroupMessage(ctx: GroupContext): Promise<boolean> {
  for (const { name, handle } of handlers) {
    try {
      if (await handle(ctx)) {
        logger.info('群聊已回复', {
          handler: name,
          msg: ctx.msg,
          groupId: ctx.event.group_id,
          userId: ctx.userId,
          userName: ctx.userName,
        })
        return true
      }
    } catch (error) {
      logger.error('群聊处理异常', {
        handler: name,
        msg: ctx.msg,
        groupId: ctx.event.group_id,
        userId: ctx.userId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  logger.debug('群聊未匹配关键词', {
    msg: ctx.msg,
    groupId: ctx.event.group_id,
    userId: ctx.userId,
  })
  return false
}
