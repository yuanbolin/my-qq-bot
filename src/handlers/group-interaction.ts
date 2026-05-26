import type { Bot, GroupActionNoticeEvent } from 'qq-official-bot'
import { handleGroupMessage } from './group-router.js'
import { createGroupReplyEvent } from '../utils/group-event-proxy.js'
import { resolveInteractionCommand } from '../utils/interaction-command.js'
import { stripSlashPrefix } from '../utils/message-parse.js'
import { logger } from '../utils/logger.js'

/** 群聊指令面板 / 消息按钮点击（INTERACTION_CREATE） */
export async function handleGroupInteraction(
  bot: Bot,
  event: GroupActionNoticeEvent,
): Promise<void> {
  const rawCmd = resolveInteractionCommand(event)
  if (!rawCmd) {
    logger.info('群聊互动未解析出命令', {
      groupId: event.group_id,
      userId: event.operator_id,
      resolved: event.data?.resolved,
    })
    await event.reply(0)
    return
  }

  const msg = stripSlashPrefix(rawCmd)
  logger.info('收到群聊指令互动', {
    groupId: event.group_id,
    userId: event.operator_id,
    msg,
  })

  await event.reply(0)

  try {
    const replied = await handleGroupMessage({
      event: createGroupReplyEvent(bot, event),
      msg,
      userId: event.operator_id,
      userName: '',
    })
    if (!replied) {
      logger.debug('群聊指令互动未匹配 handler', { msg, groupId: event.group_id })
    }
  } catch (error) {
    logger.error('群聊指令互动处理失败', {
      groupId: event.group_id,
      msg,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
