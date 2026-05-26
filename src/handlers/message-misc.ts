import moment from 'moment'
import type { GroupHandler } from '../types/group.js'
import { isOnCooldown } from '../utils/cooldown.js'
import { randomIndex } from '../utils/random.js'
import {
  replyAtText,
  replyAudioImage,
  replyImage,
  replyText,
  replyTextImage,
} from '../utils/reply.js'
import { getStorage, setStorage } from '../utils/storage.js'

const GANTAN_ARR = ['哈哈', '唉呀', '啊', '哼', '呸', '哎哟', '咳', '哦', '喂', '嗯', '哎']

function renpinFlag(num: number): string {
  if (num < 6) return '寄'
  if (num <= 20) return '危'
  if (num <= 50) return '小吉'
  if (num <= 70) return '中吉'
  if (num <= 90) return '大吉'
  if (num < 100) return '大吉'
  if (num === 100) return '人品爆炸！'
  return '人品丢了~'
}

function rollRenpinNum(): number {
  const num2 = randomIndex(11)
  let num = randomIndex(101)
  if (num2 > 4) {
    num = randomIndex(51) + 50
  } else if (num2 < 5 && num > 2) {
    num = randomIndex(81) + 20
  }
  return num
}

async function handleRenpin(
  ctx: Parameters<GroupHandler>[0],
  gantan: string,
): Promise<boolean> {
  const { event, userId } = ctx
  const stored = await getStorage(`${userId}renpin`)

  if (stored) {
    const obj = JSON.parse(stored) as { num: number; date: string }
    const date = moment().format('YYYY-MM-DD')
    if (obj.date === date) {
      const flag = renpinFlag(obj.num)
      await replyText(event, `${gantan},你今天的人品是${obj.num}(${flag})`)
      if (flag === '寄') {
        await replyImage(event, 'image/ji1.jpg')
      }
      return true
    }
  }

  const num = rollRenpinNum()
  const flag = renpinFlag(num)
  const date = moment().format('YYYY-MM-DD')
  await replyText(event, `${gantan},你今天的人品是${num}(${flag})`)
  if (flag === '寄') {
    await replyImage(event, 'image/ji1.jpg')
  }
  await setStorage(`${userId}renpin`, JSON.stringify({ num, date }))
  return true
}

export const messageMiscHandle: GroupHandler = async (ctx) => {
  const { msg, event, userId } = ctx

  switch (msg) {
    case 'ping':
      await replyText(event, 'pong')
      return true
    case 'echo': {
      await replyText(event, '请提供要复读的内容，格式：echo <内容>')
      return true
    }
    case '午安':
      await replyText(event, '午安，睡个好觉哦')
      return true
    case '元旦快乐':
      await replyText(event, '小拉🐔也祝你快乐哦')
      return true
    case '新年快乐':
      await replyText(event, '小拉🐔也祝你快乐哦')
      return true
    case '我要进群':
      await replyText(event, '欢迎加入小拉🐔实验室, 群号为: 1082588318')
      return true
    case '我饿了':
      await replyAtText(event, userId, '可以吃小包子呀😋')
      return true
    case '我不饿':
      await replyAtText(event, userId, '不饿，你也得吃小包子！')
      return true
    case '对吗':
      await replyTextImage(event, '不对', 'image/budui.jpg')
      return true
    case '不对吧':
      await replyTextImage(event, '对的', 'image/duide.jpg')
      return true
    case '飞啊':
      await replyImage(event, 'image/feia.gif')
      return true
    case '炉石传说':
      await replyTextImage(event, '炉石传说真尼玛好玩!', 'image/zhenhaowan.png')
      return true
    case 'bug传说':
      await replyText(event, '我们认为这是正常的!')
      return true
    case '离谱':
      await replyImage(event, 'image/lipu.jpg')
      return true
    case '人品': {
      if (await isOnCooldown(userId)) return true
      const gantan = GANTAN_ARR[randomIndex(GANTAN_ARR.length - 1)]
      return handleRenpin(ctx, gantan)
    }
    case '/rp': {
      if (await isOnCooldown(userId)) return true
      const gantan = GANTAN_ARR[randomIndex(GANTAN_ARR.length - 1)]
      return handleRenpin(ctx, gantan)
    }
    case '喵帕斯':
    case '喵帕斯～':
    case '喵帕斯~':
      try {
        // 优先使用 mp3/wav；官方不支持 aac，见 resolveAudioAsset
        await replyAudioImage(event, 'audio/miaopasi.mp3', 'image/miaopasi.png')
      } catch (error) {
        console.error('[喵帕斯] 语音发送失败，降级为图文:', error)
        await replyTextImage(event, '喵帕斯~', 'image/miaopasi.png')
      }
      return true
    default:
      if (msg.startsWith('echo ')) {
        const content = msg.slice(5).trim()
        await replyText(event, content || '请提供要复读的内容')
        return true
      }
      return false
  }
}
