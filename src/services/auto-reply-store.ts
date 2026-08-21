import fs from 'node:fs/promises'
import path from 'node:path'

export interface AutoReplyRule {
  keyword: string
  text: string
  /** assets 相对路径，可选 */
  image?: string
  updatedAt: number
  updatedBy: string
}

interface AutoReplyStoreFile {
  rules: AutoReplyRule[]
}

const STORE_PATH = path.resolve('data/auto-reply.json')

let cache: AutoReplyStoreFile | null = null

async function loadStore(): Promise<AutoReplyStoreFile> {
  if (cache) return cache

  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as AutoReplyStoreFile
    cache = {
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
    }
  } catch {
    cache = { rules: [] }
  }

  return cache
}

async function saveStore(store: AutoReplyStoreFile): Promise<void> {
  cache = store
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
}

/** 列出全部规则 */
export async function listAutoReplyRules(): Promise<AutoReplyRule[]> {
  const store = await loadStore()
  return [...store.rules]
}

/** 按关键词查找（大小写不敏感） */
export async function findAutoReplyRule(keyword: string): Promise<AutoReplyRule | undefined> {
  const key = keyword.trim().toLowerCase()
  const store = await loadStore()
  return store.rules.find((rule) => rule.keyword.toLowerCase() === key)
}

/**
 * 新增或覆盖规则（同关键词覆盖）。
 * keyword 原样保存，匹配时忽略大小写。
 */
export async function upsertAutoReplyRule(input: {
  keyword: string
  text: string
  image?: string
  updatedBy: string
}): Promise<AutoReplyRule> {
  const keyword = input.keyword.trim()
  if (!keyword) {
    throw new Error('关键词不能为空')
  }

  const store = await loadStore()
  const next: AutoReplyRule = {
    keyword,
    text: input.text.trim(),
    image: input.image?.trim() || undefined,
    updatedAt: Date.now(),
    updatedBy: input.updatedBy,
  }

  const index = store.rules.findIndex(
    (rule) => rule.keyword.toLowerCase() === keyword.toLowerCase(),
  )
  if (index >= 0) {
    store.rules[index] = next
  } else {
    store.rules.push(next)
  }

  await saveStore(store)
  return next
}

/** 删除规则，返回是否删除成功 */
export async function deleteAutoReplyRule(keyword: string): Promise<boolean> {
  const key = keyword.trim().toLowerCase()
  const store = await loadStore()
  const before = store.rules.length
  store.rules = store.rules.filter((rule) => rule.keyword.toLowerCase() !== key)
  if (store.rules.length === before) {
    return false
  }
  await saveStore(store)
  return true
}

/**
 * 在文本中找命中的规则：包含匹配，多命中取关键词最长的一条。
 */
export async function matchAutoReplyRule(text: string): Promise<AutoReplyRule | undefined> {
  const haystack = text.toLowerCase()
  if (!haystack) return undefined

  const store = await loadStore()
  let best: AutoReplyRule | undefined

  for (const rule of store.rules) {
    const needle = rule.keyword.toLowerCase()
    if (!needle || !haystack.includes(needle)) continue
    if (!best || rule.keyword.length > best.keyword.length) {
      best = rule
    }
  }

  return best
}
