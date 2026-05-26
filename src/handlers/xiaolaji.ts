import { config } from "../config.js";
import type { GroupContext, GroupHandler } from "../types/group.js";
import { matchCommand, stripSlashPrefix } from "../utils/message-parse.js";
import { randomIndex } from "../utils/random.js";
import {
  replyAudio,
  replyImage,
  replyText,
  replyTextImage,
} from "../utils/reply.js";
const JI_YONG_TEXT = `《🐔勇者》
爱你黑色吊带装
却敢走上篮球场
爱你Rap那么强
唱跳也很棒
打吗打啊
鸡也要有梦想
唱吗跳啊
两年半的时长
谁说打篮球🏀的不是英雄`;

/** 随机图片 case：1~3 用 imageName，4 用 jiaonima.png */
async function replyRandomImageCase(
  ctx: GroupContext,
  imageName: string,
  text: string,
) {
  const flag = 1 + randomIndex(4);
  const imagePath = flag === 4 ? "image/jiaonima.png" : `image/${imageName}`;
  await replyTextImage(ctx.event, text, imagePath);
}

export const xiaolajiHandle: GroupHandler = async (ctx) => {
  const { event, userId } = ctx;
  const msg = stripSlashPrefix(ctx.msg);

  if (matchCommand(msg, "早安")) {
    const flag = randomIndex(5);
    try {
      await replyAudio(event, `audio/morning/${flag}.mp3`);
    } catch {
      await replyText(event, "早安，小拉🐔也要起床了哦");
    }
    return true;
  }

  if (msg === "寄" || msg.includes("寄了")) {
    const flag = 1 + randomIndex(4);
    const ext = flag === 4 ? "gif" : "jpg";
    await replyImage(event, `image/ji${flag}.${ext}`);
    return true;
  }

  switch (msg) {
    case "小臭鸡":
      await replyRandomImageCase(
        ctx,
        "nijibujidao.jpg",
        "本🐔这么乖，你不可以这样说咱哦。",
      );
      return true;
    case "小垃圾":
      await replyRandomImageCase(ctx, "jiku.gif", "呜呜呜，你凶本🐔。");
      return true;
    case "鸡憋":
      await replyRandomImageCase(
        ctx,
        "jibie.jpg",
        "额 麻烦让一下下，憋不住了。",
      );
      return true;
    case "小辣鸡":
      await replyRandomImageCase(ctx, "xiaolaji-la.jpg", "嗯？？？  run！！！");
      return true;
    case "小拉机":
      await replyRandomImageCase(ctx, "kounijiwa.jpg", "你好哦，我是小拉机");
      return true;
    case "小蓝鸡":
      await replyRandomImageCase(ctx, "lanji.jpg", "咕咕咕，变色了");
      return true;
    case "小拉🐔":
      await replyRandomImageCase(ctx, "jidong.jpg", "嗨！！！ 咱来了！");
      return true;
    case "小拉鸡":
      await replyRandomImageCase(ctx, "jidong.jpg", "嗨！！！ 咱来了！");
      return true;
    case "小垃鸡":
      await replyRandomImageCase(ctx, "jidong.jpg", "咱叫小拉🐔哦");
      return true;
    case "小鸡鸡":
      await replyRandomImageCase(ctx, "busese.jpg", "？？？");
      return true;
    case "小机机":
      await replyRandomImageCase(ctx, "mojiji.png", "要摸摸咱吗？");
      return true;
    case "ruarua":
      await replyText(event, "乌拉拉现在是个机器人了");
      return true;
    case "鸡勇者":
      await replyText(event, JI_YONG_TEXT);
      return true;
    case "孤勇者":
      await replyText(event, JI_YONG_TEXT);
      return true;
    case "帮助":
      await replyImage(event, "image/help.png");
      return true;
    case "help":
      await replyImage(event, "image/help.png");
      return true;
    case "小垃机都能干啥子哦":
      await replyText(
        event,
        '乌拉拉是咱的铲屎官哦~ 回复"查战旗xxx"可查询战旗英雄和随从 , 回复"查炉石卡牌xxx"可查询狂野卡牌信息',
      );
      return true;
    case "运气差":
      if (config.userIds.wulala.includes(userId)) {
        await replyTextImage(
          event,
          "今晚就把你做出歹子馅的小包子！！",
          "image/shengqi.gif",
        );
        return true;
      }
      return false;
    case "Who's boss":
      await replyText(event, "乌拉拉是咱的老大哦");
      return true;
    case "下午好哦":
      if (config.userIds.boss.includes(userId)) {
        await replyText(event, "老大下午好哦");
        return true;
      }
      return false;
    case "乌拉拉是可食用的应急食材。": {
      const random = randomIndex(5);
      if (random < 2) {
        await replyText(event, "咱馋很久了，我老大确实可以食用呢，一起动手？");
      } else {
        await replyText(event, "一派胡言！");
      }
      return true;
    }
    case "嘤嘤嘤":
      await replyText(event, "嘤嘤怪快爬！");
      return true;
    case "晚安":
      await replyText(event, "晚安，小拉🐔也要睡觉去了哦");
      return true;
    default:
      return false;
  }
};
