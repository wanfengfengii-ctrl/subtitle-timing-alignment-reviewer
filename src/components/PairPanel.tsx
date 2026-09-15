import type { PairBlock } from '../lib/types'
import { formatMs } from '../lib/format'

interface PairPanelProps {
  pairs: readonly PairBlock[]
  selectedOpIndex: number | null
  onSelect: (opIndex: number | null) => void
}

export function PairPanel({ pairs, selectedOpIndex, onSelect }: PairPanelProps) {
  return (
    <section className="result-panel" data-testid="pair-panel">
      <h3 className="panel-title">
        配对块
        <span className="panel-count">{pairs.length} 块</span>
      </h3>
      {pairs.length === 0 ? (
        <p className="empty-note">（无配对块，最优解全部跳过）</p>
      ) : (
        <ol className="pair-list">
          {pairs.map((pair) => {
            const active = pair.opIndex === selectedOpIndex
            return (
              <li key={pair.opIndex}>
                <button
                  type="button"
                  className={`pair-block ${active ? 'pair-active' : ''}`}
                  data-testid="pair-block"
                  data-op-index={pair.opIndex}
                  aria-pressed={active}
                  onClick={() => onSelect(active ? null : pair.opIndex)}
                >
                  <div className="pair-head">
                    <span className="pair-kind">
                      {pair.source.length}:{pair.target.length}
                    </span>
                    <span className="pair-time">
                      {formatMs(pair.startMs)} → {formatMs(pair.endMs)}
                    </span>
                    <span className="pair-cost" title="块成本">
                      {pair.cost}
                    </span>
                  </div>
                  <div className="pair-body">
                    <div className="pair-side">
                      {pair.source.map((cue) => (
                        <span key={cue.id} className="pair-cue">
                          <em>{cue.id}</em>
                          {cue.text}
                        </span>
                      ))}
                    </div>
                    <div className="pair-arrow">⇄</div>
                    <div className="pair-side">
                      {pair.target.map((cue) => (
                        <span key={cue.id} className="pair-cue">
                          <em>{cue.id}</em>
                          {cue.text}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
