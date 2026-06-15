import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { resolveJmPythonPath } from './jm-python-resolve.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// 加载 .env，使 JM_PYTHON_PATH 在 npm run check-jm 时生效
dotenv.config({ path: path.join(root, '.env') })

const optionPath = process.env.JM_OPTION_PATH?.trim()
  ? path.resolve(root, process.env.JM_OPTION_PATH)
  : path.join(root, 'config/jmcomic.option.yml')
const scriptPath = path.join(root, 'scripts/jm_export.py')

function fail(msg) {
  console.warn(`[check-jm] ${msg}`)
  process.exit(1)
}

const { python, version, tried } = resolveJmPythonPath()

if (!python) {
  fail(
    [
      '未找到 Python 3.9+',
      `已尝试: ${tried.join(', ')}`,
      '请在 .env 中设置: JM_PYTHON_PATH=/usr/local/bin/python3.12',
    ].join('\n'),
  )
}

console.log(`[check-jm] 使用 Python: ${python}`)
console.log(`[check-jm] ${version}`)

if (process.env.JM_PYTHON_PATH?.trim()) {
  console.log('[check-jm] 来源: .env JM_PYTHON_PATH')
} else if (python !== 'python' && python !== 'python3') {
  console.log('[check-jm] 来源: 自动探测（系统默认 python 可能过旧，已跳过）')
}

const importCheck = spawnSync(
  python,
  ['-c', 'import jmcomic; print(jmcomic.__version__)'],
  { encoding: 'utf8' },
)
if (importCheck.error || importCheck.status !== 0) {
  fail(
    [
      '未安装 jmcomic，请对该 Python 执行:',
      `${python} -m pip install jmcomic -U`,
    ].join('\n'),
  )
}
console.log(`[check-jm] jmcomic ${importCheck.stdout.trim()}`)

if (!fs.existsSync(optionPath)) {
  fail(`缺少配置文件: ${optionPath}`)
}
if (!fs.existsSync(scriptPath)) {
  fail(`缺少脚本: ${scriptPath}`)
}

console.log('[check-jm] 环境检查通过')
