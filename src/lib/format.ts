import type { OpKind } from './types'

/** Format milliseconds as HH:MM:SS.mmm (fixed width, easy to scan). */
export function formatMs(ms: number): string {
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  const millis = ms % 1000
  const pad = (value: number, width = 2) => String(value).padStart(width, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`
}

export const OP_LABELS: Record<OpKind, string> = {
  'match-1-1': '1:1 配对',
  'match-1-2': '1:2 配对',
  'match-2-1': '2:1 配对',
  'skip-source': '跳过源',
  'skip-target': '跳过译',
}

export const OP_SHORT: Record<OpKind, string> = {
  'match-1-1': '1:1',
  'match-1-2': '1:2',
  'match-2-1': '2:1',
  'skip-source': '跳源',
  'skip-target': '跳译',
}
