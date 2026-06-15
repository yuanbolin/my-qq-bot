import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const python = process.env.JM_PYTHON_PATH?.trim() || 'python'
const optionPath = process.env.JM_OPTION_PATH?.trim()
  ? path.resolve(root, process.env.JM_OPTION_PATH)
  : path.join(root, 'config/jmcomic.option.yml')
const scriptPath = path.join(root, 'scripts/jm_export.py')

function fail(msg) {
  console.warn(`[check-jm] ${msg}`)
  process.exit(1)
}

const pyCheck = spawnSync(python, ['--version'], { encoding: 'utf8' })
if (pyCheck.error || pyCheck.status !== 0) {
  fail(`未找到 Python: ${python}`)
}
console.log(`[check-jm] ${(pyCheck.stdout || pyCheck.stderr).trim()}`)

const importCheck = spawnSync(
  python,
  ['-c', 'import jmcomic; print(jmcomic.__version__)'],
  { encoding: 'utf8' },
)
if (importCheck.error || importCheck.status !== 0) {
  fail('未安装 jmcomic，请执行: pip install jmcomic -U')
}
console.log(`[check-jm] jmcomic ${importCheck.stdout.trim()}`)

if (!fs.existsSync(optionPath)) {
  fail(`缺少配置文件: ${optionPath}`)
}
if (!fs.existsSync(scriptPath)) {
  fail(`缺少脚本: ${scriptPath}`)
}

console.log('[check-jm] 环境检查通过')
