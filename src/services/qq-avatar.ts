import { config } from '../config.js'
import { logger } from '../utils/logger.js'

interface OickQqtxResponse {
  code?: number | string
  imgurl?: string
  name?: string
  msg?: string
}

function qlogoUrl(qq: string): string {
  return `https://q.qlogo.cn/headimg_dl?dst_uin=${qq}&spec=640`
}

/** 通过 oick.cn 获取 QQ 头像，失败时降级为 qlogo 直链 */
export async function fetchQqAvatar(qq: string): Promise<{ imgUrl: string; name?: string }> {
  try {
    const url = new URL(config.oick.apiUrl)
    url.searchParams.set('qq', qq)
    if (config.oick.apiKey) {
      url.searchParams.set('apikey', config.oick.apiKey)
    }

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(config.oick.timeoutMs),
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = (await response.json()) as OickQqtxResponse
    const code = Number(data.code)
    if (code === 200 && data.imgurl) {
      return { imgUrl: data.imgurl, name: data.name }
    }

    logger.warn('oick QQ 头像 API 未返回 imgurl，降级 qlogo', {
      qq,
      code: data.code,
      msg: data.msg,
    })
  } catch (error) {
    logger.warn('oick QQ 头像 API 请求失败，降级 qlogo', {
      qq,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return { imgUrl: qlogoUrl(qq) }
}
