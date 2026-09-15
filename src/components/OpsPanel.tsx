import type { AlignOp } from '../lib/types'
import { OP_SHORT } from '../lib/format'

interface OpsPanelProps {
  ops: readonly AlignOp[]
  totalCost: number
  selectedOpIndex: number | null
  onSelect: (opIndex: number | null) => void
}

export function OpsPanel({ ops, totalCost, selectedOpIndex, onSelect }: OpsPanelProps) {
  return (
    <section className="result-panel" data-testid="ops-panel">
      <h3 className="panel-title">
        操作序列
        <span className="panel-count">{ops.length} 步</span>
      </h3>
      {ops.length === 0 ? (
        <p className="empty-note" data-testid="ops-empty">
          （空序列）
        </p>
      ) : (
        <ol className="ops-list" data-testid="ops-list">
          {ops.map((op, index) => {
            const active = index === selectedOpIndex
            const ids = [...op.source, ...op.target].map((cue) => cue.id)
            return (
              <li key={index}>
                <button
                  type="button"
                  className={`op-row op-${op.kind} ${active ? 'pair-active' : ''}`}
                  data-testid="op-row"
                  data-op-index={index}
                  data-op-kind={op.kind}
                  aria-pressed={active}
                  onClick={() => onSelect(active ? null : index)}
                  title={ids.join(', ')}
                >
                  <span className="op-index">{index + 1}</span>
                  <span className="op-kind">{OP_SHORT[op.kind]}</span>
                  <span className="op-ids">[{ids.join(', ')}]</span>
                  <span className="op-cost">+{op.cost}</span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
      <div className="total-cost" data-testid="total-cost">
        总成本：<strong>{totalCost}</strong>
      </div>
    </section>
  )
}
