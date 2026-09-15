/** One subtitle cue. Arrays of cues must be sorted by startMs with no overlap. */
export interface Cue {
  /** Unique non-empty identifier within its file. */
  id: string
  /** Start time in milliseconds (>= 0). */
  startMs: number
  /** End time in milliseconds, strictly greater than startMs. */
  endMs: number
  /** Subtitle text. */
  text: string
}

export type Side = 'source' | 'target'

/** Kind of an alignment operation, in the order used for lexicographic tie-breaking. */
export type OpKind =
  | 'match-1-1'
  | 'match-1-2'
  | 'match-2-1'
  | 'skip-source'
  | 'skip-target'

/** A single operation in an alignment sequence. */
export interface AlignOp {
  kind: OpKind
  /** Source cues consumed by this operation (length 0, 1 or 2). */
  source: Cue[]
  /** Target cues consumed by this operation (length 0, 1 or 2). */
  target: Cue[]
  /** Cost contributed by this operation. */
  cost: number
}

/** Result of aligning two valid cue arrays. */
export interface AlignResult {
  ops: AlignOp[]
  /** Sum of every operation's cost. */
  totalCost: number
  /** Paired blocks, in operation order. */
  pairs: PairBlock[]
  /** Unmatched source cues, in source-array order. */
  unmatchedSource: Cue[]
  /** Unmatched target cues, in target-array order. */
  unmatchedTarget: Cue[]
}

/** A matched block: one or two source cues aligned with one or two target cues. */
export interface PairBlock {
  source: Cue[]
  target: Cue[]
  /** First source cue's startMs. */
  startMs: number
  /** Last target cue's endMs. */
  endMs: number
  cost: number
  /** Index of the operation that produced this block, for highlighting. */
  opIndex: number
}

/** One validation error. `index` is the array position of the offending item. */
export interface ValidationIssue {
  side: Side
  index: number
  message: string
}
