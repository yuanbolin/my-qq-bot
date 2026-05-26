import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = process.env.ASSETS_DIR
  ? path.resolve(root, process.env.ASSETS_DIR)
  : path.join(root, 'assets')

const required = [
  'image/yunzhen.png',
  'image/djw.png',
  'image/help.png',
  'image/ji1.jpg',
  'image/ji2.jpg',
  'image/ji3.jpg',
  'image/ji4.gif',
  'image/jiaonima.png',
  'image/nijibujidao.jpg',
  'image/jiku.gif',
  'image/jibie.jpg',
  'image/xiaolaji-la.jpg',
  'image/kounijiwa.jpg',
  'image/lanji.jpg',
  'image/jidong.jpg',
  'image/busese.jpg',
  'image/mojiji.png',
  'image/shengqi.gif',
  'image/budui.jpg',
  'image/duide.jpg',
  'image/feia.gif',
  'image/zhenhaowan.png',
  'image/lipu.jpg',
  'image/miaopasi.png',
  'image/dafeini.gif',
  'image/dafeini.jpg',
  ...Array.from({ length: 15 }, (_, i) => `image/lklxj/${i}.jpg`),
  ...Array.from({ length: 3 }, (_, i) => `image/lklxj/hj/${i}.jpg`),
  // 语音：官方支持 mp3/wav/flac/silk（二选一即可）
  'audio/miaopasi.mp3',
  'audio/morning/0.mp3',
  'audio/morning/1.mp3',
  'audio/morning/2.mp3',
  'audio/morning/3.mp3',
  'audio/morning/4.mp3',
]

const missing = required.filter((rel) => !fs.existsSync(path.join(assetsDir, rel)))

if (missing.length === 0) {
  console.log(`[check-assets] 全部 ${required.length} 个必需资源已就绪：${assetsDir}`)
  process.exit(0)
}

console.warn(`[check-assets] 缺少 ${missing.length} 个资源（${assetsDir}）：`)
for (const file of missing) {
  console.warn(`  - ${file}`)
}
console.warn('请从旧项目 node-mirai/image 与 node-mirai/audio 复制到 assets/ 目录')
process.exit(0)
