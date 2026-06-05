import { config } from '../config.js'

interface MemeApiResponse {
  postLink?: string
  subreddit?: string
  title?: string
  url?: string
  nsfw?: boolean
  spoiler?: boolean
  author?: string
  ups?: number
  preview?: string[]
  code?: number
  message?: string
}

export interface RandomMeme {
  title: string
  subreddit: string
  author: string
  ups: number
  url: string
  /** 由低到高画质的预览图，已按 previewLimit 截取 */
  previews: string[]
  postLink: string
}

/**
 * 随机梗图（https://meme-api.com/gimme）
 * 返回 reddit 随机梗图，preview 为由低到高画质的多张预览图
 */
export async function getRandomMeme(): Promise<RandomMeme> {
  const response = await fetch(config.meme.apiUrl, {
    signal: AbortSignal.timeout(config.meme.timeoutMs),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = (await response.json()) as MemeApiResponse
  if (data.code && data.code !== 200) {
    throw new Error(data.message || '随机梗图接口返回失败')
  }

  const previews = Array.isArray(data.preview) ? data.preview.filter(Boolean) : []
  // 优先输出高画质：preview 末尾画质最高，按上限取最后 N 张
  const limit = Math.max(1, config.meme.previewLimit)
  const picked = previews.length > limit ? previews.slice(-limit) : previews

  return {
    title: data.title?.trim() || '随机梗图',
    subreddit: data.subreddit?.trim() || '',
    author: data.author?.trim() || '',
    ups: typeof data.ups === 'number' ? data.ups : 0,
    url: data.url?.trim() || '',
    previews: picked.length > 0 ? picked : data.url ? [data.url] : [],
    postLink: data.postLink?.trim() || '',
  }
}
