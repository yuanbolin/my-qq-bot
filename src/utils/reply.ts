import { segment } from 'qq-official-bot'
import type { GroupMessageEvent } from 'qq-official-bot'
import {
  MEDIA_CONTENT_PLACEHOLDER,
  resolveAsset,
  resolveAudioAsset,
} from './assets.js'

export async function replyText(event: GroupMessageEvent, text: string) {
  await event.reply(segment.text(text))
}

export async function replyImage(event: GroupMessageEvent, imageRelativePath: string) {
  await event.reply(segment.image(resolveAsset(imageRelativePath)))
}

export async function replyTextImage(
  event: GroupMessageEvent,
  text: string,
  imageRelativePath: string,
) {
  await event.reply([
    segment.text(text),
    segment.image(resolveAsset(imageRelativePath)),
  ])
}

export async function replyAtText(
  event: GroupMessageEvent,
  userId: string,
  text: string,
) {
  await event.reply([segment.at(userId), segment.text(text)])
}

/**
 * 发送群聊语音（富媒体 msg_type=7，file_type=3）
 * 注意：AudioControl 仅用于频道语音子频道播放，群聊应使用富媒体接口
 * @see https://bot.q.qq.com/wiki/develop/api-v2/server-inter/message/send-receive/rich-media.html
 */
export async function replyAudio(
  event: GroupMessageEvent,
  audioRelativePath: string,
) {
  const file = resolveAudioAsset(audioRelativePath)
  // 群聊发送富媒体时 content 必填，且每条消息只能携带一个媒体文件
  await event.reply([
    segment.text(MEDIA_CONTENT_PLACEHOLDER),
    segment.audio(file),
  ])
}

/** 先发语音再发图片（与原 llonebot 两次 reply 行为一致） */
export async function replyAudioImage(
  event: GroupMessageEvent,
  audioRelativePath: string,
  imageRelativePath: string,
) {
  await replyAudio(event, audioRelativePath)
  await replyImage(event, imageRelativePath)
}
