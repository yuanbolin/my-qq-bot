/** node-sorry 模板定义：https://github.com/q809198545/node-sorry */
export type SorryTemplateDef = {
  /** 模板目录名，对应 assets/sorry/templates/{id} */
  id: string
  /** 触发命令别名（不含 /，大小写不敏感） */
  aliases: string[]
  /** 字幕句数 */
  sentenceCount: number
  /** 未传参时的默认文案 */
  defaults: string[]
  /** 帮助说明 */
  description: string
}

export const SORRY_TEMPLATES: SorryTemplateDef[] = [
  {
    id: 'sorry',
    aliases: ['sorry', '为所欲为', '有钱'],
    sentenceCount: 9,
    defaults: [
      '有钱真的可以为所欲为',
      '我觉得有钱真的可以为所欲为',
      'Sorry 有钱真的可以为所欲为',
      '对 有钱真的可以为所欲为',
      'Sorry 我们就是这么有钱',
      '为所欲为',
      '为所欲为',
      '为所欲为',
      '为所欲为',
    ],
    description: '「有钱真的可以为所欲为」经典梗',
  },
  {
    id: 'wangjingze',
    aliases: ['王境泽', 'wangjingze', '真香'],
    sentenceCount: 4,
    defaults: [
      '我就是饿死',
      '死外边',
      '从这儿跳下去',
      '也不吃你们一点东西',
    ],
    description: '王境泽「真香」梗',
  },
]

/** 按命令名查找模板 */
export function findSorryTemplate(command: string): SorryTemplateDef | undefined {
  const key = command.trim().toLowerCase()
  return SORRY_TEMPLATES.find((tpl) =>
    tpl.aliases.some((alias) => alias.toLowerCase() === key),
  )
}

/** 解析用户输入为固定句数的字幕数组 */
export function buildSentences(template: SorryTemplateDef, rawArgs: string): string[] {
  const trimmed = rawArgs.trim()
  if (!trimmed) {
    return [...template.defaults]
  }

  const parts = trimmed.includes('|')
    ? trimmed.split('|').map((s) => s.trim()).filter(Boolean)
    : trimmed.split(/\n+/).map((s) => s.trim()).filter(Boolean)

  const result = [...template.defaults]
  for (let i = 0; i < template.sentenceCount; i++) {
    if (parts[i]) {
      result[i] = parts[i]
    }
  }
  return result.slice(0, template.sentenceCount)
}
