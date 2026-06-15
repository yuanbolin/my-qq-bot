import fs from 'node:fs/promises'
import type { PrivateMessageEvent } from 'qq-official-bot'

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

/** 私聊发送 PDF（QQ 官方 API file_type=4，仅 C2C 支持） */
export async function uploadAndReplyPdf(
  event: PrivateMessageEvent,
  pdfPath: string,
  text?: string,
): Promise<void> {
  const bot = event.bot as unknown as BotWithRequest
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
