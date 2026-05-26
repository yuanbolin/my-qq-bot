import type { GroupHandler } from '../types/group.js'
import { randomIndex } from '../utils/random.js'
import { replyText, replyTextImage } from '../utils/reply.js'

export const fangzhangHandle: GroupHandler = async (ctx) => {
  const { msg, event } = ctx

  switch (msg) {
    case '你们看我吊吗':
      await replyTextImage(event, '“不看，晕针”', 'image/yunzhen.png')
      return true
    case '咪':
      await replyText(event, '“介龟不卖，听咪三块”')
      return true
    case '油腻嘎':
      await replyText(event, '“嗷嗷（狐狸叫）”')
      return true
    case '方丈': {
      const arr = ['wtybill', '四级主播', '山岭巨人', '杰尼龟']
      await replyText(event, `${arr[randomIndex(3)]}”`)
      return true
    }
    case 'wtybill': {
      const arr = ['温太医', '温庭筠', '梧桐雨', '我头硬', '我躺赢', '我贴鱼', '舞厅鸭', '武藤游细']
      await replyText(event, `“${arr[randomIndex(7)]}”`)
      return true
    }
    case '杰尼': {
      const arr = ['杰尼，自己人', '杰尼，救我！']
      await replyText(event, `“${arr[randomIndex(1)]}”`)
      return true
    }
    case '四级主播':
      await replyText(event, '“方丈x眼小，说完我就跑~”')
      return true
    case '锁':
      await replyText(event, '“北美锁王我贴鱼bill”')
      return true
    case '小贱人':
      await replyText(event, '来打我啊”')
      return true
    case '无所吊谓':
      await replyText(event, '“下回合我会爆一张牌，不过无所吊谓”')
      return true
    case '我要去了':
      await replyText(event, '“完了，全TM完了”')
      return true
    case '完了':
      await replyText(event, '“口住”')
      return true
    case '谁敢狙我':
      await replyText(event, '“0-3”')
      return true
    case '翻盘':
      await replyText(event, '“被针怼了”')
      return true
    case '贱人':
      await replyText(event, '“尝精阁雅座一位”')
      return true
    case '我卜怕':
      await replyText(event, '“让他生，让他生”')
      return true
    case '我又赚了':
      await replyText(event, '“我更赚了！！！”')
      return true
    case '棋宗':
      await replyText(event, '“酒馆战棋”')
      return true
    case '糖宗':
      await replyText(event, '“糖果缤纷乐”')
      return true
    case '师兄':
      await replyText(event, '“尝精阁有请”')
      return true
    case '炉宗':
      await replyText(event, '“炉石传说观众。最大的宗派之一”')
      return true
    case '锄宗':
      await replyText(event, '“锄宗亡了！”')
      return true
    case '鸽宗':
      await replyText(event, '“今 日 不 播”')
      return true
    case 'bill直播':
      await replyText(event, '“今 日 不 播”')
      return true
    case '竞宗':
      await replyText(event, '“炉宗中的一派，喜欢看方丈打竞技场的观众”')
      return true
    case '盗宗':
      await replyText(event, '“方丈有时转播国外Twitch平台的炉石比赛直播(即为盗播)，其观众即为盗宗”')
      return true
    case '肥宗':
      await replyText(event, '“方丈有时观战加拿大著名炉石选手 Fibonacci(谐音肥波)打炉石，其观众即为肥宗”')
      return true
    case '嫂宗':
      await replyText(event, '“？？？”')
      return true
    case '细':
      await replyText(event, '“细还是方丈细啊”')
      return true
    case '众筹杀鸟':
      await replyText(event, '“掩护,掩护!”')
      return true
    case '北美第一喷':
      await replyText(event, '“比尔盖祠”')
      return true
    case '死亡侧脸':
      await replyText(event, '“掩护，掩护！”')
      return true
    case '题宗':
      await replyText(event, '“针对方丈操作出题的观众。目前题宗被集体打入尝精阁”')
      return true
    case '雷宗':
      await replyText(event, '“希望方丈玩扫雷的观众。也有锄宗观众表示雷宗属于锄宗，因为扫雷是电子版的锄大地”')
      return true
    case '瞎宗':
      await replyText(event, '“众所周知玩《星际争霸》是不需要视力的”')
      return true
    case '宝宗':
      await replyText(event, '“灵宝可梦”')
      return true
    case '舞宗':
      await replyText(event, '“舞宗和题宗一样，被集体打入尝精阁”')
      return true
    case '龟龟':
      await replyText(event, '杰尼，救我”')
      return true
    case '打不过就骂':
      await replyText(event, '“骂不过就跑。你打我呀，小贱人”')
      return true
    case '打爆泳帽':
      await replyText(event, '“修复泳帽”')
      return true
    case '我又卜是SB':
      await replyText(event, '“卜可能！”')
      return true
    case '炉石传说':
      await replyText(event, '“温太医”')
      return true
    default:
      return false
  }
}
