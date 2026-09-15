import type { ValidationIssue } from '../lib/types'

interface ErrorPanelProps {
  issues: readonly ValidationIssue[]
}

const SIDE_LABELS = {
  source: '源字幕',
  target: '译字幕',
} as const

export function ErrorPanel({ issues }: ErrorPanelProps) {
  if (issues.length === 0) return null
  return (
    <section className="error-panel" data-testid="error-panel">
      <h3 className="panel-title">
        文件校验失败（整批拒绝，已清除旧结果）
        <span className="panel-count">{issues.length} 个错误</span>
      </h3>
      <ol className="error-list" data-testid="error-list">
        {issues.map((issue, i) => (
          <li key={i} className="error-item" data-side={issue.side}>
            <span className={`error-side error-side-${issue.side}`} data-side={issue.side}>
              {SIDE_LABELS[issue.side]}
            </span>
            {issue.index >= 0 && <span className="error-index">[{issue.index}]</span>}
            <span className="error-message">{issue.message}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
