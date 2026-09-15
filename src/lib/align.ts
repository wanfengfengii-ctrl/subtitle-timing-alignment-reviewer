import type { AlignOp, AlignResult, Cue, OpKind, PairBlock } from './types'

/**
 * Operation catalogue, in EXACTLY the tie-breaking order:
 *   1:1, 1:2, 2:1, skip source, skip target.
 *
 * The dynamic program scans source/target cues left to right. At every state
 * (i, j) the five moves below are considered in this order. When two moves have
 * equal total cost, the earlier move is kept, which yields the lexicographically
 * smallest complete operation sequence (no local greedy: every move's cost is
 * compared against the optimal cost of the suffix state, computed first by the
 * backward recurrence).
 */
interface Move {
  kind: OpKind
  di: 0 | 1 | 2
  dj: 0 | 1 | 2
}

const MOVES: readonly Move[] = [
  { kind: 'match-1-1', di: 1, dj: 1 },
  { kind: 'match-1-2', di: 1, dj: 2 },
  { kind: 'match-2-1', di: 2, dj: 1 },
  { kind: 'skip-source', di: 1, dj: 0 },
  { kind: 'skip-target', di: 0, dj: 1 },
]

function matchCost(source: readonly Cue[], target: readonly Cue[]): number {
  // Paired block spans: first item's start, last item's end.
  const srcStart = source[0].startMs
  const srcEnd = source[source.length - 1].endMs
  const tgtStart = target[0].startMs
  const tgtEnd = target[target.length - 1].endMs
  return (
    Math.abs(srcStart - tgtStart) +
    Math.abs(srcEnd - tgtEnd) +
    500 * Math.abs(source.length - target.length)
  )
}

function skipCost(cue: Cue): number {
  return cue.endMs - cue.startMs + 1000
}

/** Immediate cost of applying `move` at state (i, j). */
function immediateCost(
  source: readonly Cue[],
  target: readonly Cue[],
  i: number,
  j: number,
  move: Move,
): number {
  if (move.di === 0) return skipCost(target[j])
  if (move.dj === 0) return skipCost(source[i])
  return matchCost(source.slice(i, i + move.di), target.slice(j, j + move.dj))
}

/**
 * Align two already-validated cue arrays by dynamic programming.
 *
 * Returns the globally cheapest alignment; on equal total cost it returns the
 * lexicographically smallest operation sequence in the move order above.
 */
export function alignCues(source: readonly Cue[], target: readonly Cue[]): AlignResult {
  const n = source.length
  const m = target.length

  // dp[i][j] = optimal cost of aligning source[i..] with target[j..].
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  )
  // Index into MOVES of the winning move at each state.
  const choice: Int16Array[] = Array.from({ length: n + 1 }, () =>
    new Int16Array(m + 1).fill(-1),
  )

  // Boundary: only one kind of skip is possible.
  for (let i = n - 1; i >= 0; i--) {
    dp[i][m] = dp[i + 1][m] + skipCost(source[i])
    choice[i][m] = MOVES.findIndex((mv) => mv.kind === 'skip-source')
  }
  for (let j = m - 1; j >= 0; j--) {
    dp[n][j] = dp[n][j + 1] + skipCost(target[j])
    choice[n][j] = MOVES.findIndex((mv) => mv.kind === 'skip-target')
  }

  // Backward recurrence. Traversal order guarantees every suffix state
  // (i+di, j+dj) is already final when (i, j) is evaluated.
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      let best = Number.POSITIVE_INFINITY
      let bestMove = -1

      MOVES.forEach((move, moveIndex) => {
        if (i + move.di > n || j + move.dj > m) return
        const total =
          immediateCost(source, target, i, j, move) +
          dp[i + move.di][j + move.dj]
        // Strict comparison: the first (lexicographically smallest) move wins
        // ties because MOVES is scanned in tie-breaking order.
        if (total < best) {
          best = total
          bestMove = moveIndex
        }
      })

      dp[i][j] = best
      choice[i][j] = bestMove
    }
  }

  // Reconstruct the chosen sequence by following the recorded choices.
  const ops: AlignOp[] = []
  const pairs: PairBlock[] = []
  const unmatchedSource: Cue[] = []
  const unmatchedTarget: Cue[] = []

  let i = 0
  let j = 0
  while (i < n || j < m) {
    const move = MOVES[choice[i][j]]
    const cost = immediateCost(source, target, i, j, move)
    const opSource = source.slice(i, i + move.di)
    const opTarget = target.slice(j, j + move.dj)

    ops.push({ kind: move.kind, source: opSource, target: opTarget, cost })

    if (move.di > 0 && move.dj > 0) {
      pairs.push({
        source: opSource,
        target: opTarget,
        startMs: opSource[0].startMs,
        endMs: opTarget[opTarget.length - 1].endMs,
        cost,
        opIndex: ops.length - 1,
      })
    } else if (move.di > 0) {
      unmatchedSource.push(...opSource)
    } else {
      unmatchedTarget.push(...opTarget)
    }

    i += move.di
    j += move.dj
  }

  return {
    ops,
    totalCost: dp[0][0],
    pairs,
    unmatchedSource,
    unmatchedTarget,
  }
}
