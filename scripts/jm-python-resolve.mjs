import { spawnSync } from 'node:child_process'

const MIN_MAJOR = 3
const MIN_MINOR = 9

const CANDIDATES = [
  process.env.JM_PYTHON_PATH?.trim(),
  'python3.12',
  'python3.11',
  'python3.10',
  'python3.9',
  '/usr/local/bin/python3.12',
  '/usr/local/bin/python3.11',
  '/usr/local/bin/python3',
  'python3',
  'python',
].filter(Boolean)

/** 解析 Python 可执行文件路径，优先 JM_PYTHON_PATH，其次自动探测 >=3.9 */
export function resolveJmPythonPath() {
  const tried = []

  for (const cmd of CANDIDATES) {
    if (tried.includes(cmd)) continue
    tried.push(cmd)

    const version = getPythonVersion(cmd)
    if (!version) continue

    if (
      version.major > MIN_MAJOR
      || (version.major === MIN_MAJOR && version.minor >= MIN_MINOR)
    ) {
      return { python: cmd, version: version.text, tried }
    }
  }

  return { python: null, version: null, tried }
}

function getPythonVersion(cmd) {
  const result = spawnSync(cmd, ['--version'], { encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    return null
  }

  const text = `${result.stdout}${result.stderr}`.trim()
  const match = text.match(/Python (\d+)\.(\d+)/i)
  if (!match) {
    return null
  }

  return {
    text,
    major: Number(match[1]),
    minor: Number(match[2]),
  }
}
