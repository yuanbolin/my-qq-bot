import type { Bot, GroupActionNoticeEvent, GroupMessageEvent, Sendable } from 'qq-official-bot'

/** 将指令面板互动事件包装为群消息事件，供现有 handler 复用 reply 能力 */
export function createGroupReplyEvent(
  bot: Bot,
  interaction: GroupActionNoticeEvent,
): GroupMessageEvent {
  return {
    group_id: interaction.group_id,
    user_id: interaction.operator_id,
    group_name: '',
    message_id: interaction.notice_id,
    raw_message: '',
    async reply(message: Sendable) {
      return bot.sendGroupMessage(interaction.group_id, message, interaction)
    },
  } as GroupMessageEvent
}
