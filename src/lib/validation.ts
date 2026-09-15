import type { Cue, Side, ValidationIssue } from './types'

const FILE_LEVEL = -1

/**
 * Parse and fully validate one uploaded subtitle JSON file.
 *
 * Every problem is reported (the batch is rejected as a whole): the returned
 * cue array is only non-null when there are zero issues.
 */
export function parseCueFile(rawText: string, side: Side): {
  cues: Cue[] | null
  issues: ValidationIssue[]
} {
  let data: unknown
  try {
    data = JSON.parse(rawText)
  } catch (err) {
    return {
      cues: null,
      issues: [
        {
          side,
          index: FILE_LEVEL,
          message: `不是合法的 JSON：${(err as Error).message}`,
        },
      ],
    }
  }

  if (!Array.isArray(data)) {
    return {
      cues: null,
      issues: [
        {
          side,
          index: FILE_LEVEL,
          message: '顶层必须是数组',
        },
      ],
    }
  }

  const issues: ValidationIssue[] = []
  const seenIds = new Map<string, number>()
  let prev: Cue | null = null
  const cues: Cue[] = []

  data.forEach((rawItem, index) => {
    const label = `第 ${index} 项`

    if (typeof rawItem !== 'object' || rawItem === null || Array.isArray(rawItem)) {
      issues.push({ side, index, message: `${label}：必须是对象` })
      return
    }

    const item = rawItem as Record<string, unknown>
    let valid = true

    // id ----------------------------------------------------------------
    const id = item.id
    if (typeof id !== 'string') {
      issues.push({ side, index, message: `${label}：id 必须是字符串` })
      valid = false
    } else if (id.length === 0) {
      issues.push({ side, index, message: `${label}：id 不得为空` })
      valid = false
    } else if (seenIds.has(id)) {
      issues.push({
        side,
        index,
        message: `${label}：id "${id}" 与第 ${seenIds.get(id)} 项重复`,
      })
      valid = false
    } else {
      seenIds.set(id, index)
    }

    // startMs -----------------------------------------------------------
    const startMs = item.startMs
    if (typeof startMs !== 'number' || !Number.isInteger(startMs)) {
      issues.push({ side, index, message: `${label}：startMs 必须是整数` })
      valid = false
    } else if (startMs < 0) {
      issues.push({ side, index, message: `${label}：startMs 必须满足 0 ≤ startMs` })
      valid = false
    }

    // endMs -------------------------------------------------------------
    const endMs = item.endMs
    if (typeof endMs !== 'number' || !Number.isInteger(endMs)) {
      issues.push({ side, index, message: `${label}：endMs 必须是整数` })
      valid = false
    } else if (
      typeof startMs === 'number' &&
      Number.isInteger(startMs) &&
      startMs >= 0 &&
      !(startMs < endMs)
    ) {
      issues.push({ side, index, message: `${label}：必须满足 startMs < endMs` })
      valid = false
    }

    // text --------------------------------------------------------------
    if (typeof item.text !== 'string') {
      issues.push({ side, index, message: `${label}：text 必须是字符串` })
      valid = false
    }

    if (!valid) {
      // Ordering/overlap checks reference well-formed previous items only.
      return
    }

    const cue: Cue = { id: id as string, startMs: startMs as number, endMs: endMs as number, text: item.text as string }

    if (prev !== null) {
      if (!(prev.startMs < cue.startMs)) {
        issues.push({
          side,
          index,
          message: `${label}：startMs(${cue.startMs}) 必须严格大于前一项 startMs(${prev.startMs})`,
        })
      } else if (prev.endMs > cue.startMs) {
        issues.push({
          side,
          index,
          message: `${label}：与前一项时间重叠（前一项 endMs=${prev.endMs} > 当前 startMs=${cue.startMs}）`,
        })
      }
    }

    prev = cue
    cues.push(cue)
  })

  return { cues: issues.length === 0 ? cues : null, issues }
}

/** Merge two sides' issues, source first then target, stable by array position. */
export function mergeIssues(
  source: ValidationIssue[],
  target: ValidationIssue[],
): ValidationIssue[] {
  const byIndex = (issues: ValidationIssue[]) =>
    [...issues].sort((a, b) => a.index - b.index)
  return [...byIndex(source), ...byIndex(target)]
}
