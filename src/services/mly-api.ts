import axios from 'axios'
import { segment, type Sendable } from 'qq-official-bot'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

interface MlyReplyItem {
  content: string
  typed: number
}

interface MlyApiResponse {
  code?: string
  message?: string
  data?: MlyReplyItem[]
}

export async function fetchMlyReply(params: {
  from: string
  fromName: string
  to: string
  type: 1 | 2
  content: string
}): Promise<Sendable[] | null> {
  if (!config.mly.apiKey || !config.mly.apiSecret) {
    logger.warn('茉莉云 API 未配置，跳过回复')
    return null
  }

  try {
    const { data } = await axios.post<MlyApiResponse>(
      config.mly.apiUrl,
      {
        from: params.from,
        fromName: params.fromName,
        to: params.to,
        toName: config.mly.botName,
        type: params.type,
        content: params.content,
      },
      {
        headers: {
          'Api-Key': config.mly.apiKey,
          'Api-Secret': config.mly.apiSecret,
          'Content-Type': 'application/json;charset=UTF-8',
        },
        timeout: 15000,
      },
    )

    if (data.code !== '00000' || !data.data?.length) {
      return null
    }

    const segments: Sendable[] = []
    for (const item of data.data) {
      if (item.typed === 1) {
        segments.push(segment.text(item.content))
      } else if (item.typed === 2) {
        segments.push(segment.image(`${config.mly.fileBaseUrl}${item.content}`))
      }
    }

    return segments.length > 0 ? segments : null
  } catch (error) {
    logger.error('茉莉云 API 请求失败', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
