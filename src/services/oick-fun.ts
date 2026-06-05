import { config } from '../config.js'

interface OickJsonResponse {
  code?: number | string
  msg?: string
  content?: string
}

/**
 * 舔狗日记（https://api.oick.cn/doc/dog）
 * 接口需携带 apikey，返回 String / JSON（含 content 字段）
 */
export async function getDogDiary(): Promise<string> {
  const url = new URL(config.oick.dogUrl)
  if (config.oick.apiKey) {
    url.searchParams.set('apikey', config.oick.apiKey)
  }

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(config.oick.timeoutMs),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const data = (await response.json()) as OickJsonResponse
    const code = Number(data.code)
    if (code && code !== 200) {
      throw new Error(data.msg || '舔狗日记接口返回失败')
    }
    const text = (data.content ?? '').trim()
    if (!text) {
      throw new Error(data.msg || '舔狗日记接口未返回内容')
    }
    return text
  }

  const text = (await response.text()).trim()
  if (!text) {
    throw new Error('舔狗日记接口未返回内容')
  }
  return text
}

/**
 * Bing 每日图（https://api.oick.cn/doc/bing）
 * 接口直接 302 重定向到当日 Bing 背景图，返回最终图片直链
 */
export async function getBingDailyImageUrl(): Promise<string> {
  const url = new URL(config.oick.bingUrl)

  const response = await fetch(url.toString(), {
    redirect: 'follow',
    signal: AbortSignal.timeout(config.oick.timeoutMs),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  // 跟随重定向后 response.url 即为真实图片地址，兜底解码 HTML 实体
  const finalUrl = (response.url || config.oick.bingUrl).replace(/&amp;/g, '&')
  return finalUrl
}
