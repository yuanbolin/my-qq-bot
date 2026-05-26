import type { GroupHandler } from '../types/group.js'
import { randomIndex } from '../utils/random.js'
import { replyText, replyTextImage } from '../utils/reply.js'
import danmuList from '../data/daijiawei-danmu.json'
import jokesList from '../data/daijiawei-jokes.json'

const INTRO_TEXT = `#蜡笔小新#
LGD•SG•DAI•老干爹•帅哥戴•时代弄潮儿•巴黎时尚周专用男模•异灵法异灵骑超凡德奇迹德偶数宇宙猎顶峰天花板•排位悍将•天梯杀戮之神•无敌上分机器•宇宙术创始人•叶问术快乐术宗师•炉石里程碑传承人•文学鉴赏家•留名千古流芳百世的著名术士学家•世界文学哲学科学数学奖获得者•超费理论创始者提出者•千万少女梦中情人•世界颜值的顶峰人奠基人•旧时代与新时代跨时代标杆人物•衔接世界与世界沟通交流的主导者•时尚流行音乐歌手•游戏全能王蜀山多面手•不可置疑的大师•帅帅帅之无敌帅•天梯26神之戴神•竞技场霸主•异灵术老师戴佳伟`

export const daijiaweiHandle: GroupHandler = async (ctx) => {
  const { msg, event } = ctx

  switch (msg) {
    case '/主播编个弹幕吧': {
      const text = danmuList[randomIndex(55)] as string
      await replyText(event, `#歪比歪比#\n${text}`)
      return true
    }
    case '戴佳伟的自我介绍':
      await replyTextImage(event, INTRO_TEXT, 'image/djw.png')
      return true
    case '/来点戴佳伟笑话': {
      const text = jokesList[randomIndex(15)] as string
      await replyText(event, `#歪比歪比#\n        ${text}`)
      return true
    }
    default:
      return false
  }
}
