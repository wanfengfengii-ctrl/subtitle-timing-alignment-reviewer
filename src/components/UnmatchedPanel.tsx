import type { Cue } from '../lib/types'
import { formatMs } from '../lib/format'

interface UnmatchedPanelProps {
  source: readonly Cue[]
  target: readonly Cue[]
  selectedOpIndex: number | null
  onSelect: (opIndex: number | null) => void
  /** opIndex of each unmatched source cue, keyed by cue id. */
  sourceOpIndex: ReadonlyMap<string, number>
  targetOpIndex: ReadonlyMap<string, number>
}

export function UnmatchedPanel({
  source,
  target,
  selectedOpIndex,
  onSelect,
  sourceOpIndex,
  targetOpIndex,
}: UnmatchedPanelProps) {
  const empty = source.length === 0 && target.length === 0
  return (
    <section className="result-panel" data-testid="unmatched-panel">
      <h3 className="panel-title">
        未匹配项
        <span className="panel-count">
          源 {source.length} · 译 {target.length}
        </span>
      </h3>
      {empty ? (
        <p className="empty-note">（无未匹配项）</p>
      ) : (
        <div className="unmatched-cols">
          <UnmatchedColumn
            title="跳过的源"
            cues={source}
            opIndexById={sourceOpIndex}
            selectedOpIndex={selectedOpIndex}
            onSelect={onSelect}
            testid="unmatched-source"
          />
          <UnmatchedColumn
            title="跳过的译"
            cues={target}
            opIndexById={targetOpIndex}
            selectedOpIndex={selectedOpIndex}
            onSelect={onSelect}
            testid="unmatched-target"
          />
        </div>
      )}
    </section>
  )
}

function UnmatchedColumn({
  title,
  cues,
  opIndexById,
  selectedOpIndex,
  onSelect,
  testid,
}: {
  title: string
  cues: readonly Cue[]
  opIndexById: ReadonlyMap<string, number>
  selectedOpIndex: number | null
  onSelect: (opIndex: number | null) => void
  testid: string
}) {
  return (
    <div className="unmatched-col">
      <h4>{title}</h4>
      {cues.length === 0 ? (
        <p className="empty-note">（无）</p>
      ) : (
        <ol className="unmatched-list" data-testid={testid}>
          {cues.map((cue) => {
            const opIndex = opIndexById.get(cue.id) ?? null
            const active = opIndex !== null && opIndex === selectedOpIndex
            return (
              <li key={cue.id}>
                <button
                  type="button"
                  className={`unmatched-item ${active ? 'pair-active' : ''}`}
                  data-op-index={opIndex ?? undefined}
                  aria-pressed={active}
                  onClick={() => onSelect(active ? null : opIndex)}
                >
                  <span className="cue-id">{cue.id}</span>
                  <span className="cue-time">
                    {formatMs(cue.startMs)} → {formatMs(cue.endMs)}
                  </span>
                  <span className="cue-text">{cue.text}</span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
