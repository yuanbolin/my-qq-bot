import type { GroupMessageEvent } from 'qq-official-bot'

export interface GroupContext {
  event: GroupMessageEvent
  msg: string
  userId: string
  userName: string
}

export type GroupHandler = (ctx: GroupContext) => Promise<boolean>
