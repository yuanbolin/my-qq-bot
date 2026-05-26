import type { PrivateMessageEvent } from 'qq-official-bot'

export interface PrivateContext {
  event: PrivateMessageEvent
  msg: string
  userId: string
  userName: string
}
