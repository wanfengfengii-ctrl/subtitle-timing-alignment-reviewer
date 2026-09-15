import type { Cue, Side } from '../lib/types'
import { formatMs } from '../lib/format'

interface CueListProps {
  side: Side
  cues: readonly Cue[]
  highlightedIds: ReadonlySet<string>
  unmatchedIds: ReadonlySet<string>
}

const TITLES: Record<Side, string> = {
  source: '源字幕（原字幕）',
  target: '译字幕（原字幕）',
}

export function CueList({ side, cues, highlightedIds, unmatchedIds }: CueListProps) {
  return (
    <section className="cue-panel" data-testid={`${side}-cue-panel`}>
      <h3 className="panel-title">
        {TITLES[side]}
        <span className="panel-count">{cues.length} 条</span>
      </h3>
      {cues.length === 0 ? (
        <p className="empty-note">（空数组）</p>
      ) : (
        <ol className="cue-list" data-testid={`${side}-cue-list`}>
          {cues.map((cue, position) => {
            const highlighted = highlightedIds.has(cue.id)
            const unmatched = unmatchedIds.has(cue.id)
            return (
              <li
                key={cue.id}
                className={[
                  'cue-item',
                  highlighted ? 'cue-highlighted' : '',
                  unmatched ? 'cue-unmatched' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-cue-id={cue.id}
                data-side={side}
              >
                <div className="cue-meta">
                  <span className="cue-position">#{position}</span>
                  <span className="cue-id" title="id">
                    {cue.id}
                  </span>
                  <span className="cue-time">
                    {formatMs(cue.startMs)} → {formatMs(cue.endMs)}
                  </span>
                  {unmatched && <span className="cue-badge">未匹配</span>}
                </div>
                <p className="cue-text">{cue.text}</p>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
