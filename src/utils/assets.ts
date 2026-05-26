import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'

/** 解析 assets 目录下的相对路径为绝对路径 */
export function resolveAsset(relativePath: string): string {
  return path.join(config.assetsDir, relativePath)
}

/** 官方群聊语音支持 silk / wav / mp3 / flac，不支持 aac */
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.silk', '.aac'] as const

/**
 * 解析语音文件路径，按官方支持格式依次尝试同 basename 的其它扩展名
 * @see https://bot.q.qq.com/wiki/develop/api-v2/server-inter/message/send-receive/rich-media.html
 */
export function resolveAudioAsset(relativePath: string): string {
  const primary = resolveAsset(relativePath)
  if (fs.existsSync(primary)) {
    return primary
  }

  const ext = path.extname(relativePath)
  const baseName = relativePath.slice(0, -ext.length)

  for (const altExt of AUDIO_EXTENSIONS) {
    const candidate = path.join(config.assetsDir, `${baseName}${altExt}`)
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `语音文件不存在: ${relativePath}（请将 aac 转为 mp3/wav/flac 后放入 assets/audio/）`,
  )
}

/** 群聊富媒体消息 content 字段必填，纯媒体时使用零宽空格占位 */
export const MEDIA_CONTENT_PLACEHOLDER = '\u200b'
