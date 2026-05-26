import type { ActionNoticeEvent } from 'qq-official-bot'
import { config } from '../config.js'
import { stripSlashPrefix } from './message-parse.js'

/** 从指令面板 / 消息按钮互动中解析出命令文本 */
export function resolveInteractionCommand(event: ActionNoticeEvent): string | null {
  const resolved = event.data?.resolved
  if (!resolved) return null

  const buttonData = resolved.button_data?.trim()
  if (buttonData) {
    return stripSlashPrefix(buttonData)
  }

  const featureId = resolved.feature_id?.trim()
  if (featureId) {
    const mapped = config.commandFeatures[featureId]
    if (mapped) return stripSlashPrefix(mapped)
    // 管理端部分指令直接把名称写入 feature_id
    if (!/^[0-9a-f-]{16,}$/i.test(featureId)) {
      return stripSlashPrefix(featureId)
    }
  }

  const buttonId = resolved.button_id?.trim()
  if (buttonId) {
    const mapped = config.commandFeatures[buttonId]
    if (mapped) return stripSlashPrefix(mapped)
    if (!/^[0-9a-f-]{16,}$/i.test(buttonId)) {
      return stripSlashPrefix(buttonId)
    }
  }

  return null
}
