import { config } from '../config.js'
import { logger } from '../utils/logger.js'

interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

interface SixtyNewsData {
  date: string
  news: string[]
  image?: string
  tip?: string
  day_of_week?: string
  lunar_date?: string
}

interface AiNewsItem {
  title: string
  detail: string
  link: string
  source: string
  date: string
}

interface AiNewsData {
  date: string
  news: AiNewsItem[]
}

interface HistoryItem {
  title: string
  year: string
  description: string
  event_type: string
}

interface HistoryData {
  date: string
  items: HistoryItem[]
}

interface LyricData {
  title: string
  artists: string[]
  album: string
  formatted: string
}

interface HotItem {
  title: string
  hot_value?: number
  link?: string
}

interface EpicGameItem {
  title: string
  cover?: string
  original_price_desc: string
  description?: string
  seller?: string
  is_free_now?: boolean
  free_start?: string
  free_end?: string
  link?: string
}

interface BingWallpaperData {
  title?: string
  headline?: string
  description?: string
  main_text?: string
  cover: string
  cover_4k?: string
  copyright?: string
  update_date?: string
}

interface KfcData {
  index: number
  kfc: string
}

interface LuckData {
  luck_desc: string
  luck_rank: number
  luck_tip: string
}

interface FabingData {
  index: number
  saying: string
}

const HOT_LIST_LIMIT = 15

const EVENT_TYPE_LABEL: Record<string, string> = {
  birth: '出生',
  death: '逝世',
  event: '事件',
}

function buildUrl(path: string, params: Record<string, string | undefined>): string {
  const url = new URL(path, config.sixtyApi.baseUrl)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}

async function fetchText(path: string, params: Record<string, string | undefined> = {}): Promise<string> {
  const url = buildUrl(path, { ...params, encoding: 'text' })
  const response = await fetch(url, { signal: AbortSignal.timeout(config.sixtyApi.timeoutMs) })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const json = (await response.json()) as ApiEnvelope<string | Record<string, unknown>>
    if (json.code !== 200) {
      throw new Error(json.message || '接口返回失败')
    }
    if (typeof json.data === 'string') return json.data
    return JSON.stringify(json.data, null, 2)
  }

  return response.text()
}

async function fetchJson<T>(path: string, params: Record<string, string | undefined> = {}): Promise<T> {
  const url = buildUrl(path, { ...params, encoding: 'json' })
  const response = await fetch(url, { signal: AbortSignal.timeout(config.sixtyApi.timeoutMs) })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const json = (await response.json()) as ApiEnvelope<T>
  if (json.code !== 200) {
    throw new Error(json.message || '接口返回失败')
  }
  return json.data
}

function truncateText(text: string, max = config.sixtyApi.maxTextLength): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 3)}...`
}

function formatSixtyNews(data: SixtyNewsData): string {
  const header = [
    `📰 每天 60 秒读懂世界`,
    `📅 ${data.date} ${data.day_of_week ?? ''} ${data.lunar_date ?? ''}`.trim(),
  ].join('\n')

  const body = data.news.map((item, index) => `${index + 1}. ${item}`).join('\n')
  const footer = data.tip ? `\n\n💡 ${data.tip}` : ''
  return truncateText(`${header}\n\n${body}${footer}`)
}

function formatAiNews(data: AiNewsData): string {
  if (!data.news?.length) {
    return `🤖 AI 资讯快报（${data.date}）\n\n今日暂无重大 AI 资讯，建议傍晚后再试。`
  }

  const body = data.news
    .map((item, index) => {
      const detail = item.detail.length > 120 ? `${item.detail.slice(0, 120)}...` : item.detail
      return `${index + 1}. ${item.title}\n${detail}\n来源：${item.source}`
    })
    .join('\n\n')

  return truncateText(`🤖 AI 资讯快报（${data.date}）\n\n${body}`)
}

function formatHistory(data: HistoryData): string {
  const body = data.items
    .slice(0, 12)
    .map((item) => {
      const type = EVENT_TYPE_LABEL[item.event_type] ?? item.event_type
      return `【${item.year}·${type}】${item.title}`
    })
    .join('\n')

  return truncateText(`📅 历史上的今天（${data.date}）\n\n${body}`)
}

function formatLyric(data: LyricData): string {
  const artists = data.artists.join(' / ')
  const header = `🎵 ${data.title}\n👤 ${artists}\n💿 ${data.album}\n`
  return truncateText(`${header}\n${data.formatted}`)
}

function formatHotList(title: string, items: HotItem[], limit = HOT_LIST_LIMIT): string {
  const body = items
    .slice(0, limit)
    .map((item, index) => {
      const heat =
        item.hot_value !== undefined ? ` (${item.hot_value.toLocaleString()})` : ''
      return `${index + 1}. ${item.title}${heat}`
    })
    .join('\n')
  return truncateText(`${title}\n\n${body}`)
}

async function fetchHotList(path: string, title: string): Promise<string> {
  try {
    const data = await fetchJson<HotItem[]>(path)
    return formatHotList(title, data)
  } catch (error) {
    logger.warn(`${title} JSON 获取失败，降级 text`, {
      error: error instanceof Error ? error.message : String(error),
    })
    return truncateText(await fetchText(path))
  }
}

function formatEpicGames(games: EpicGameItem[]): string {
  const body = games
    .map((game, index) => {
      const period =
        game.free_start && game.free_end
          ? `\n免费：${game.free_start} ~ ${game.free_end}`
          : ''
      const link = game.link ? `\n${game.link}` : ''
      return `${index + 1}. ${game.title}\n原价：${game.original_price_desc}${period}${link}`
    })
    .join('\n\n')
  return truncateText(`🎮 Epic 每周免费游戏\n\n${body}`)
}

function formatBingWallpaper(data: BingWallpaperData): { text: string; imageUrl?: string } {
  const lines = [
    '🖼️ 必应每日壁纸',
    data.headline || data.title,
    data.description,
    data.copyright ? `© ${data.copyright}` : undefined,
    data.update_date ? `更新：${data.update_date}` : undefined,
  ].filter(Boolean)

  return {
    text: truncateText(lines.join('\n')),
    imageUrl: data.cover_4k || data.cover,
  }
}

export async function getSixtyNews(): Promise<{ text: string; imageUrl?: string }> {
  try {
    const data = await fetchJson<SixtyNewsData>('/v2/60s')
    return { text: formatSixtyNews(data), imageUrl: data.image }
  } catch (error) {
    logger.warn('60s JSON 获取失败，降级 text', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { text: await fetchText('/v2/60s') }
  }
}

export async function getAiNews(): Promise<string> {
  try {
    const data = await fetchJson<AiNewsData>('/v2/ai-news')
    return formatAiNews(data)
  } catch (error) {
    logger.warn('AI 资讯 JSON 获取失败，降级 text', {
      error: error instanceof Error ? error.message : String(error),
    })
    return truncateText(await fetchText('/v2/ai-news'))
  }
}

export async function getTodayInHistory(): Promise<string> {
  try {
    const data = await fetchJson<HistoryData>('/v2/today-in-history')
    return formatHistory(data)
  } catch (error) {
    logger.warn('历史上的今天 JSON 获取失败，降级 text', {
      error: error instanceof Error ? error.message : String(error),
    })
    return truncateText(await fetchText('/v2/today-in-history'))
  }
}

export async function getMoyuDaily(): Promise<string> {
  return truncateText(await fetchText('/v2/moyu'))
}

export async function searchLyric(query: string): Promise<string> {
  const keyword = query.trim()
  if (!keyword) {
    throw new Error('请提供歌曲名称，例如：/歌词 小宇')
  }

  try {
    const data = await fetchJson<LyricData>('/v2/lyric', { query: keyword, clean: 'false' })
    return formatLyric(data)
  } catch (error) {
    logger.warn('歌词 JSON 获取失败，降级 text', {
      error: error instanceof Error ? error.message : String(error),
    })
    return truncateText(await fetchText('/v2/lyric', { query: keyword, clean: 'false' }))
  }
}

export async function getEpicGames(): Promise<string> {
  try {
    const data = await fetchJson<EpicGameItem[]>('/v2/epic')
    if (!data.length) {
      return '🎮 Epic 每周免费游戏\n\n本周暂无免费游戏信息。'
    }
    return formatEpicGames(data)
  } catch (error) {
    logger.warn('Epic JSON 获取失败，降级 text', {
      error: error instanceof Error ? error.message : String(error),
    })
    return truncateText(await fetchText('/v2/epic'))
  }
}

export async function getBingWallpaper(): Promise<{ text: string; imageUrl?: string }> {
  try {
    const data = await fetchJson<BingWallpaperData>('/v2/bing')
    return formatBingWallpaper(data)
  } catch (error) {
    logger.warn('必应壁纸 JSON 获取失败，降级 text', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { text: truncateText(await fetchText('/v2/bing')) }
  }
}

export async function getDouyinHot(): Promise<string> {
  return fetchHotList('/v2/douyin', '🔥 抖音热搜')
}

export async function getWeiboHot(): Promise<string> {
  return fetchHotList('/v2/weibo', '🔥 微博热搜')
}

export async function getDongchediHot(): Promise<string> {
  return fetchHotList('/v2/dongchedi', '🔥 懂车帝热搜')
}

export async function getKfcCopy(): Promise<string> {
  try {
    const data = await fetchJson<KfcData>('/v2/kfc')
    return truncateText(`🍗 随机 KFC 文案\n\n${data.kfc}`)
  } catch (error) {
    logger.warn('KFC JSON 获取失败，降级 text', {
      error: error instanceof Error ? error.message : String(error),
    })
    return truncateText(await fetchText('/v2/kfc'))
  }
}

export async function getRandomLuck(): Promise<string> {
  try {
    const data = await fetchJson<LuckData>('/v2/luck')
    return truncateText(
      `🔮 随机运势\n\n${data.luck_desc}\n运势指数：${data.luck_rank}\n\n💡 ${data.luck_tip}`,
    )
  } catch (error) {
    logger.warn('运势 JSON 获取失败，降级 text', {
      error: error instanceof Error ? error.message : String(error),
    })
    return truncateText(await fetchText('/v2/luck'))
  }
}

export async function getFabingText(name?: string): Promise<string> {
  const params = name ? { name } : {}
  try {
    const data = await fetchJson<FabingData>('/v2/fabing', params)
    return truncateText(`📝 随机发病文学\n\n${data.saying}`)
  } catch (error) {
    logger.warn('发病文学 JSON 获取失败，降级 text', {
      error: error instanceof Error ? error.message : String(error),
    })
    return truncateText(await fetchText('/v2/fabing', params))
  }
}
