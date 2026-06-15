import { spawnSync } from 'node:child_process'

const MIN_MAJOR = 3
const MIN_MINOR = 9

/** 解析 JM 使用的 Python 路径，优先 .env 中的 JM_PYTHON_PATH */
export function resolveJmPythonPath(): string {
  const explicit = process.env.JM_PYTHON_PATH?.trim()
  if (explicit) {
    return explicit
  }

  const candidates = [
    'python3.12',
    'python3.11',
    'python3.10',
    'python3.9',
    '/usr/local/bin/python3.12',
    '/usr/local/bin/python3.11',
    '/usr/local/bin/python3',
    'python3',
    'python',
  ]

  for (const cmd of candidates) {
    const version = getPythonVersion(cmd)
    if (!version) continue

    if (
      version.major > MIN_MAJOR
      || (version.major === MIN_MAJOR && version.minor >= MIN_MINOR)
    ) {
      return cmd
    }
  }

  return 'python'
}

function getPythonVersion(cmd: string): { major: number; minor: number } | null {
  try {
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
      major: Number(match[1]),
      minor: Number(match[2]),
    }
  } catch {
    return null
  }
}
