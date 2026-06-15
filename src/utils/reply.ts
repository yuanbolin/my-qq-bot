import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { segment, type Sendable } from 'qq-official-bot'
import type { GroupMessageEvent, PrivateMessageEvent } from 'qq-official-bot'
import {
  MEDIA_CONTENT_PLACEHOLDER,
  resolveAsset,
  resolveAudioAsset,
} from './assets.js'

export async function replySendable(
  event: GroupMessageEvent | PrivateMessageEvent,
  message: Sendable,
) {
  await event.reply(message)
}

export async function replyText(
  event: GroupMessageEvent | PrivateMessageEvent,
  text: string,
) {
  await event.reply(segment.text(text))
}

export async function replyImage(
  event: GroupMessageEvent | PrivateMessageEvent,
  imageRelativePath: string,
) {
  await event.reply(segment.image(resolveAsset(imageRelativePath)))
}

export async function replyTextImage(
  event: GroupMessageEvent | PrivateMessageEvent,
  text: string,
  imageRelativePath: string,
) {
  await event.reply([
    segment.text(text),
    segment.image(resolveAsset(imageRelativePath)),
  ])
}

export async function replyAtText(
  event: GroupMessageEvent | PrivateMessageEvent,
  userId: string,
  text: string,
) {
  await event.reply([segment.at(userId), segment.text(text)])
}

export async function replyAudio(
  event: GroupMessageEvent | PrivateMessageEvent,
  audioRelativePath: string,
) {
  const file = resolveAudioAsset(audioRelativePath)
  await event.reply([
    segment.text(MEDIA_CONTENT_PLACEHOLDER),
    segment.audio(file),
  ])
}

export async function replyAudioImage(
  event: GroupMessageEvent | PrivateMessageEvent,
  audioRelativePath: string,
  imageRelativePath: string,
) {
  await replyAudio(event, audioRelativePath)
  await replyImage(event, imageRelativePath)
}

/** 按顺序拼接 @、文本、本地图片并发送 */
export async function replyAtTextImage(
  event: GroupMessageEvent | PrivateMessageEvent,
  atUserIds: string[],
  text: string,
  imageRelativePath: string,
) {
  const parts: Sendable[] = []
  for (const id of atUserIds) {
    parts.push(segment.at(id))
  }
  parts.push(segment.text(text), segment.image(resolveAsset(imageRelativePath)))
  await event.reply(parts)
}

/** 按顺序拼接 @、文本并发送 */
export async function replyAtListText(
  event: GroupMessageEvent | PrivateMessageEvent,
  atUserIds: string[],
  text: string,
) {
  const parts: Sendable[] = []
  for (const id of atUserIds) {
    parts.push(segment.at(id))
  }
  parts.push(segment.text(text))
  await event.reply(parts)
}

/** 回复网络图片 URL */
export async function replyImageUrl(
  event: GroupMessageEvent | PrivateMessageEvent,
  imageUrl: string,
) {
  await event.reply(segment.image(imageUrl))
}

/** 发送 GIF（写入临时文件后发送） */
export async function replyGif(
  event: GroupMessageEvent | PrivateMessageEvent,
  gifBuffer: Buffer,
  text?: string,
) {
  const tmpPath = path.join(
    os.tmpdir(),
    `gif-${Date.now()}-${Math.random().toString(36).slice(2)}.gif`,
  )
  await fs.writeFile(tmpPath, gifBuffer)

  try {
    const parts: Sendable[] = []
    if (text) {
      parts.push(segment.text(text))
    }
    parts.push(segment.image(tmpPath))
    await event.reply(parts)
  } finally {
    await fs.unlink(tmpPath).catch(() => undefined)
  }
}

/** 发送本地图片文件（绝对路径） */
export async function replyLocalImage(
  event: GroupMessageEvent | PrivateMessageEvent,
  imagePath: string,
  text?: string,
) {
  const parts: Sendable[] = []
  if (text) {
    parts.push(segment.text(text))
  }
  parts.push(segment.image(imagePath))
  await event.reply(parts)
}

/** 私聊发送 PDF 文件 */
export async function replyPdfFile(
  event: PrivateMessageEvent,
  pdfPath: string,
  text?: string,
) {
  const { uploadAndReplyPdf } = await import('../services/qq-media.js')
  await uploadAndReplyPdf(event, pdfPath, text)
}

/** @ 用户并发送 GIF（写入临时文件后发送） */
export async function replyAtGif(
  event: GroupMessageEvent | PrivateMessageEvent,
  atUserId: string,
  gifBuffer: Buffer,
  text?: string,
) {
  const tmpPath = path.join(os.tmpdir(), `petpet-${Date.now()}-${Math.random().toString(36).slice(2)}.gif`)
  await fs.writeFile(tmpPath, gifBuffer)

  try {
    const parts: Sendable[] = [segment.at(atUserId)]
    if (text) {
      parts.push(segment.text(text))
    }
    parts.push(segment.image(tmpPath))
    await event.reply(parts)
  } finally {
    await fs.unlink(tmpPath).catch(() => undefined)
  }
}
