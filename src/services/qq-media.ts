import path from 'node:path'
import type { GroupMessageEvent, PrivateMessageEvent } from 'qq-official-bot'
import { chunkedUploadFile, type ChunkedUploadTarget } from './qq-chunked-upload.js'

interface BotRequest {
  post: (
    url: string,
    data: Record<string, unknown>,
    config?: { timeout?: number },
  ) => Promise<{ data: Record<string, unknown> }>
}

interface BotWithRequest {
  request: BotRequest
}

type MessageEvent = GroupMessageEvent | PrivateMessageEvent

function getUploadTarget(event: MessageEvent): ChunkedUploadTarget {
  if (event.message_type === 'group') {
    if (!event.group_id) {
      throw new Error('群聊事件缺少 group_id')
    }
    return { type: 'group', id: event.group_id }
  }
  return { type: 'user', id: event.user_id }
}

function getMessagesPath(event: MessageEvent): string {
  const target = getUploadTarget(event)
  return target.type === 'group'
    ? `/v2/groups/${target.id}/messages`
    : `/v2/users/${target.id}/messages`
}

/** 分片上传并回复富媒体消息（图片 file_type=1） */
export async function uploadAndReplyImage(
  event: MessageEvent,
  imagePath: string,
  text?: string,
  msgSeq = 1,
): Promise<void> {
  const bot = event.bot as unknown as BotWithRequest
  const fileName = path.basename(imagePath).replace(/[^\w.\-]/g, '_') || 'image.jpg'

  const uploadResult = await chunkedUploadFile(
    bot.request,
    getUploadTarget(event),
    1,
    imagePath,
    fileName,
  )

  await bot.request.post(
    getMessagesPath(event),
    {
      msg_type: 7,
      media: uploadResult,
      msg_id: event.id,
      msg_seq: msgSeq,
      content: text ?? '',
    },
    { timeout: 120_000 },
  )
}

/** 私聊发送 PDF（QQ 官方 API file_type=4，仅 C2C 支持） */
export async function uploadAndReplyPdf(
  event: PrivateMessageEvent,
  pdfPath: string,
  text?: string,
): Promise<void> {
  const bot = event.bot as unknown as BotWithRequest
  const { default: fs } = await import('node:fs/promises')
  const buffer = await fs.readFile(pdfPath)
  const fileData = buffer.toString('base64')

  const { data: uploadResult } = await bot.request.post(
    `/v2/users/${event.user_id}/files`,
    {
      file_type: 4,
      file_data: fileData,
      srv_send_msg: false,
    },
    { timeout: 120_000 },
  )

  await bot.request.post(
    `/v2/users/${event.user_id}/messages`,
    {
      msg_type: 7,
      media: uploadResult,
      msg_id: event.id,
      content: text ?? '',
    },
    { timeout: 60_000 },
  )
}

/** 依次发送多张本地图片（分片上传，适配大长图） */
export async function uploadAndReplyImages(
  event: MessageEvent,
  imagePaths: string[],
  text?: string,
): Promise<void> {
  for (let i = 0; i < imagePaths.length; i++) {
    const partText = i === 0
      ? [
        text,
        imagePaths.length > 1 ? `（共 ${imagePaths.length} 张，第 1 张）` : undefined,
      ].filter(Boolean).join('\n')
      : `（第 ${i + 1}/${imagePaths.length} 张）`

    await uploadAndReplyImage(event, imagePaths[i], partText, i + 1)
  }
}
