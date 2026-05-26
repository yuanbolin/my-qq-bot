import type { GroupContext } from '../types/group.js'
import { daijiaweiHandle } from './daijiawei.js'
import { fangzhangHandle } from './fangzhang.js'
import { messageMiscHandle } from './message-misc.js'
import { xiaolajiHandle } from './xiaolaji.js'

const handlers = [
  fangzhangHandle,
  daijiaweiHandle,
  xiaolajiHandle,
  messageMiscHandle,
]

export async function handleGroupMessage(ctx: GroupContext): Promise<boolean> {
  for (const handler of handlers) {
    if (await handler(ctx)) {
      return true
    }
  }
  return false
}
