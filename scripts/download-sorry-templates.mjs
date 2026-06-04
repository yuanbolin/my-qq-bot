/**
 * 从 node-sorry 仓库下载 template.mp4（若本地缺失）
 * https://github.com/q809198545/node-sorry
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = process.env.ASSETS_DIR
  ? path.resolve(root, process.env.ASSETS_DIR)
  : path.join(root, 'assets')

const templates = [
  {
    id: 'sorry',
    url: 'https://github.com/q809198545/node-sorry/raw/master/public/templates/sorry/template.mp4',
  },
  {
    id: 'wangjingze',
    url: 'https://github.com/q809198545/node-sorry/raw/master/public/templates/wangjingze/template.mp4',
  },
]

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`下载失败 ${url}: ${res.status}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, buf)
  console.log(`[download-sorry] 已保存 ${dest} (${buf.length} bytes)`)
}

for (const tpl of templates) {
  const dest = path.join(assetsDir, 'sorry/templates', tpl.id, 'template.mp4')
  if (fs.existsSync(dest)) {
    console.log(`[download-sorry] 已存在，跳过 ${dest}`)
    continue
  }
  await download(tpl.url, dest)
}

console.log('[download-sorry] 完成')
