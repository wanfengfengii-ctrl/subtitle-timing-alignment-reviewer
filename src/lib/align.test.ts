import { describe, expect, it } from 'vitest'
import { alignCues } from './align'
import type { Cue, OpKind } from './types'

function cue(id: string, startMs: number, endMs: number, text = id): Cue {
  return { id, startMs, endMs, text }
}

describe('alignCues - basic contracts', () => {
  it('empty vs empty yields an empty sequence and zero cost', () => {
    const result = alignCues([], [])
    expect(result.ops).toEqual([])
    expect(result.totalCost).toBe(0)
    expect(result.pairs).toEqual([])
    expect(result.unmatchedSource).toEqual([])
    expect(result.unmatchedTarget).toEqual([])
  })

  it('matches identical cues 1:1 with zero cost', () => {
    const s = [cue('a', 0, 1000, 'hello')]
    const t = [cue('x', 0, 1000, '你好')]
    const result = alignCues(s, t)
    expect(result.totalCost).toBe(0)
    expect(result.ops).toHaveLength(1)
    expect(result.ops[0].kind).toBe('match-1-1')
    expect(result.pairs).toHaveLength(1)
    expect(result.unmatchedSource).toEqual([])
    expect(result.unmatchedTarget).toEqual([])
  })

  it('skips every cue when one side is empty and still lists them all', () => {
    const s = [cue('a', 0, 1000), cue('b', 2000, 3500)]
    const result = alignCues(s, [])
    // (1000 - 0 + 1000) + (3500 - 2000 + 1000)
    expect(result.totalCost).toBe(2000 + 2500)
    expect(result.ops.map((op) => op.kind)).toEqual(['skip-source', 'skip-source'])
    expect(result.pairs).toEqual([])
    expect(result.unmatchedSource.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('skips target-only cues using duration + 1000', () => {
    const t = [cue('x', 500, 1500)]
    const result = alignCues([], t)
    expect(result.totalCost).toBe(2000)
    expect(result.ops[0].kind).toBe('skip-target')
    expect(result.unmatchedTarget.map((c) => c.id)).toEqual(['x'])
  })

  it('prefers a 1:2 block over matching one and skipping the other', () => {
    const s = [cue('a', 0, 4000)]
    const t = [cue('x', 0, 2000), cue('y', 2000, 4000)]
    const result = alignCues(s, t)
    // block: 0 start diff + 0 end diff + 500 * |1-2| = 500
    expect(result.ops.map((op) => op.kind)).toEqual(['match-1-2'])
    expect(result.totalCost).toBe(500)
    expect(result.pairs[0]).toMatchObject({
      startMs: 0,
      endMs: 4000,
      cost: 500,
    })
  })

  it('prefers a 2:1 block over matching one and skipping the other', () => {
    const s = [cue('a', 0, 2000), cue('b', 2000, 4000)]
    const t = [cue('x', 0, 4000)]
    const result = alignCues(s, t)
    expect(result.ops.map((op) => op.kind)).toEqual(['match-2-1'])
    expect(result.totalCost).toBe(500)
  })

  it('computes pair cost from block spans: |start diff| + |end diff| + 500*|count diff|', () => {
    const s = [cue('a', 100, 1100), cue('b', 1100, 2100)]
    const t = [cue('x', 400, 3000)]
    const result = alignCues(s, t)
    // |100-400| + |2100-3000| + 500*|2-1| = 300 + 900 + 500
    expect(result.totalCost).toBe(1700)
    expect(result.ops[0].kind).toBe('match-2-1')
  })

  it('reports the cost sum of the operation sequence as total cost', () => {
    const s = [cue('a', 0, 1000), cue('b', 5000, 6000)]
    const t = [cue('x', 0, 1000), cue('y', 9000, 9500)]
    const result = alignCues(s, t)
    const summed = result.ops.reduce((acc, op) => acc + op.cost, 0)
    expect(summed).toBe(result.totalCost)
  })
})

// ---------------------------------------------------------------------------
// Brute-force reference: enumerate every legal operation sequence, pick the
// cheapest, tie-break by lexicographically smallest kind sequence. This is the
// specification made executable; the DP must agree on all small random cases.
// ---------------------------------------------------------------------------

const KIND_RANK: Record<OpKind, number> = {
  'match-1-1': 0,
  'match-1-2': 1,
  'match-2-1': 2,
  'skip-source': 3,
  'skip-target': 4,
}

interface RefMove {
  di: number
  dj: number
  kind: OpKind
}

const REF_MOVES: readonly RefMove[] = [
  { di: 1, dj: 1, kind: 'match-1-1' },
  { di: 1, dj: 2, kind: 'match-1-2' },
  { di: 2, dj: 1, kind: 'match-2-1' },
  { di: 1, dj: 0, kind: 'skip-source' },
  { di: 0, dj: 1, kind: 'skip-target' },
]

function referenceMoveCost(
  source: readonly Cue[],
  target: readonly Cue[],
  i: number,
  j: number,
  move: RefMove,
): number {
  if (move.di === 0) return target[j].endMs - target[j].startMs + 1000
  if (move.dj === 0) return source[i].endMs - source[i].startMs + 1000
  const src = source.slice(i, i + move.di)
  const tgt = target.slice(j, j + move.dj)
  return (
    Math.abs(src[0].startMs - tgt[0].startMs) +
    Math.abs(src[src.length - 1].endMs - tgt[tgt.length - 1].endMs) +
    500 * Math.abs(src.length - tgt.length)
  )
}

/** Returns [cost, lexicographically smallest rank sequence] for the suffix. */
function bruteForce(
  source: readonly Cue[],
  target: readonly Cue[],
  i: number,
  j: number,
  cache = new Map<string, [number, number[]]>(),
): [number, number[]] {
  const key = `${i}:${j}`
  const hit = cache.get(key)
  if (hit) return hit

  if (i === source.length && j === target.length) {
    const done: [number, number[]] = [0, []]
    cache.set(key, done)
    return done
  }

  let bestCost = Number.POSITIVE_INFINITY
  let bestSeq: number[] = []

  for (const move of REF_MOVES) {
    if (i + move.di > source.length || j + move.dj > target.length) continue
    const immediate = referenceMoveCost(source, target, i, j, move)
    const [restCost, restSeq] = bruteForce(source, target, i + move.di, j + move.dj, cache)
    const cost = immediate + restCost
    const seq = [KIND_RANK[move.kind], ...restSeq]
    if (
      cost < bestCost ||
      (cost === bestCost && lexLess(seq, bestSeq))
    ) {
      bestCost = cost
      bestSeq = seq
    }
  }

  cache.set(key, [bestCost, bestSeq])
  return [bestCost, bestSeq]
}

function lexLess(a: number[], b: number[]): boolean {
  for (let k = 0; k < Math.min(a.length, b.length); k++) {
    if (a[k] !== b[k]) return a[k] < b[k]
  }
  return a.length < b.length
}

// Deterministic PRNG so fuzz cases are reproducible.
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296

  }
}

function randomCues(rand: () => number, length: number, prefix: string): Cue[] {
  const cues: Cue[] = []
  let cursor = Math.floor(rand() * 500)
  for (let i = 0; i < length; i++) {
    const startMs = cursor
    const endMs = startMs + 1 + Math.floor(rand() * 3000)
    cues.push(cue(`${prefix}${i}`, startMs, endMs))
    // Non-overlapping, strictly increasing starts (touching is allowed).
    cursor = endMs + Math.floor(rand() * 1500)
  }
  return cues
}

describe('alignCues - DP vs exhaustive brute force', () => {
  const seeds = [1, 2, 3, 7, 11, 42, 99, 123, 777, 2024]

  for (const seed of seeds) {
    it(`agrees on fuzz case seed=${seed}`, () => {
      const rand = mulberry32(seed)
      const n = Math.floor(rand() * 5) // 0..4
      const m = Math.floor(rand() * 5)
      const source = randomCues(rand, n, 's')
      const target = randomCues(rand, m, 't')

      const result = alignCues(source, target)
      const [refCost, refSeq] = bruteForce(source, target, 0, 0)

      expect(result.totalCost).toBe(refCost)
      expect(result.ops.map((op) => KIND_RANK[op.kind])).toEqual(refSeq)

      // Invariants on every reported solution.
      const consumedS = result.ops.reduce((acc, op) => acc + op.source.length, 0)
      const consumedT = result.ops.reduce((acc, op) => acc + op.target.length, 0)
      expect(consumedS).toBe(n)
      expect(consumedT).toBe(m)
      expect(result.unmatchedSource).toHaveLength(
        result.ops.filter((op) => op.kind === 'skip-source').length,
      )
      expect(result.unmatchedTarget).toHaveLength(
        result.ops.filter((op) => op.kind === 'skip-target').length,
      )
    })
  }

  it('never takes a locally-greedy shortcut: cost equals the exhaustive optimum', () => {
    // Genuine greedy trap: the locally cheapest first move (1:1 a<->x costs 0)
    // forces the very long y cue to be skipped (10800 total). Pairing a with
    // both x,y as a 1:2 block costs |100-10000| + 500 = 10400, which is the
    // global optimum a 1:1-first greedy never reaches.
    const source = [cue('a', 0, 100)]
    const target = [cue('x', 0, 100), cue('y', 200, 10_000)]
    const result = alignCues(source, target)
    const [refCost, refSeq] = bruteForce(source, target, 0, 0)
    expect(result.totalCost).toBe(refCost)
    expect(result.totalCost).toBe(10_400)
    expect(result.ops.map((op) => op.kind)).toEqual(['match-1-2'])
    expect(result.ops.map((op) => KIND_RANK[op.kind])).toEqual(refSeq)
  })

  it('tie-breaks toward the lexicographically smallest full sequence', () => {
    // Force an exact tie between a 1:1 start and other openings and verify the
    // brute-forced lexicographic winner is what the DP reconstructs, across many
    // zero/equal-timing inputs where ties are common.
    for (let n = 0; n <= 3; n++) {
      for (let m = 0; m <= 3; m++) {
        const source = Array.from({ length: n }, (_, i) =>
          cue(`s${i}`, i * 2000, i * 2000 + 1000),
        )
        const target = Array.from({ length: m }, (_, i) =>
          cue(`t${i}`, i * 2000, i * 2000 + 1000),
        )
        const result = alignCues(source, target)
        const [refCost, refSeq] = bruteForce(source, target, 0, 0)
        expect(result.totalCost).toBe(refCost)
        expect(result.ops.map((op) => KIND_RANK[op.kind])).toEqual(refSeq)
      }
    }
  })
})
