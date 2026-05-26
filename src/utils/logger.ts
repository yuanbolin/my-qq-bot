import fs from 'node:fs'
import path from 'node:path'
import { config, type LogLevel } from '../config.js'

type AppLogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_WEIGHT: Record<AppLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function normalizeLevel(level: LogLevel): AppLogLevel {
  if (level === 'trace' || level === 'debug') return 'debug'
  if (level === 'fatal') return 'error'
  return level
}

function shouldLog(level: AppLogLevel): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[normalizeLevel(config.appLogLevel)]
}

function ensureLogDir(): void {
  if (!config.logDir) return
  if (!fs.existsSync(config.logDir)) {
    fs.mkdirSync(config.logDir, { recursive: true })
  }
}

function logFilePath(): string {
  const date = new Date().toISOString().slice(0, 10)
  return path.join(config.logDir!, `my-bot-${date}.log`)
}

function formatLine(level: AppLogLevel, message: string, meta?: Record<string, unknown>): string {
  const metaText = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${metaText}`
}

function write(level: AppLogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return

  const line = formatLine(level, message, meta)

  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }

  if (config.logDir) {
    ensureLogDir()
    fs.appendFileSync(logFilePath(), `${line}\n`)
  }
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    write('debug', message, meta)
  },
  info(message: string, meta?: Record<string, unknown>) {
    write('info', message, meta)
  },
  warn(message: string, meta?: Record<string, unknown>) {
    write('warn', message, meta)
  },
  error(message: string, meta?: Record<string, unknown>) {
    write('error', message, meta)
  },
}
