/** 与原 llonebot 一致：parseInt(Math.random() * n) */
export function randomIndex(n: number): number {
  return parseInt(String(Math.random() * n))
}

export function pickRandom<T>(arr: T[]): T {
  return arr[randomIndex(arr.length)]
}
