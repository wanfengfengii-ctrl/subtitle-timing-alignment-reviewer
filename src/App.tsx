import { useEffect, useMemo, useState } from 'react'
import { FileUploader } from './components/FileUploader'
import { CueList } from './components/CueList'
import { PairPanel } from './components/PairPanel'
import { UnmatchedPanel } from './components/UnmatchedPanel'
import { OpsPanel } from './components/OpsPanel'
import { ErrorPanel } from './components/ErrorPanel'
import { useAlignment } from './lib/useAlignment'

export default function App() {
  const alignment = useAlignment()
  const { result, issues } = alignment
  const [selectedOpIndex, setSelectedOpIndex] = useState<number | null>(null)

  // A new result (file change / invalid batch) invalidates the old selection.
  useEffect(() => {
    setSelectedOpIndex(null)
  }, [result])

  const selection = useMemo(() => {
    const sourceIds = new Set<string>()
    const targetIds = new Set<string>()
    const sourceOpIndex = new Map<string, number>()
    const targetOpIndex = new Map<string, number>()

    if (result) {
      result.ops.forEach((op, opIndex) => {
        if (opIndex === selectedOpIndex) {
          op.source.forEach((cue) => sourceIds.add(cue.id))
          op.target.forEach((cue) => targetIds.add(cue.id))
        }
        if (op.source.length === 0) {
          op.target.forEach((cue) => targetOpIndex.set(cue.id, opIndex))
        } else if (op.target.length === 0) {
          op.source.forEach((cue) => sourceOpIndex.set(cue.id, opIndex))
        }
      })
    }
    return { sourceIds, targetIds, sourceOpIndex, targetOpIndex }
  }, [result, selectedOpIndex])

  const sourceUnmatchedIds = useMemo(
    () => new Set(result?.unmatchedSource.map((cue) => cue.id) ?? []),
    [result],
  )
  const targetUnmatchedIds = useMemo(
    () => new Set(result?.unmatchedTarget.map((cue) => cue.id) ?? []),
    [result],
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>字幕对齐审校台</h1>
        <p className="subtitle">
          纯本地运行，不上传任何服务。动态规划全局最优对齐：1:1 / 1:2 / 2:1 / 跳源 / 跳译。
        </p>
      </header>

      <div className="uploader-grid">
        <FileUploader
          side="source"
          file={alignment.sourceFile}
          issues={issues.filter((issue) => issue.side === 'source')}
          cueCount={alignment.sourceCues?.length ?? null}
          onLoad={(file) => alignment.loadFile('source', file)}
          onClear={() => alignment.clearFile('source')}
        />
        <FileUploader
          side="target"
          file={alignment.targetFile}
          issues={issues.filter((issue) => issue.side === 'target')}
          cueCount={alignment.targetCues?.length ?? null}
          onLoad={(file) => alignment.loadFile('target', file)}
          onClear={() => alignment.clearFile('target')}
        />
      </div>

      {issues.length > 0 && <ErrorPanel issues={issues} />}

      {result ? (
        <main className="workspace">
          <div className="cue-columns">
            <CueList
              side="source"
              cues={alignment.sourceCues ?? []}
              highlightedIds={selection.sourceIds}
              unmatchedIds={sourceUnmatchedIds}
            />
            <CueList
              side="target"
              cues={alignment.targetCues ?? []}
              highlightedIds={selection.targetIds}
              unmatchedIds={targetUnmatchedIds}
            />
          </div>

          <div className="result-columns">
            <PairPanel
              pairs={result.pairs}
              selectedOpIndex={selectedOpIndex}
              onSelect={setSelectedOpIndex}
            />
            <UnmatchedPanel
              source={result.unmatchedSource}
              target={result.unmatchedTarget}
              sourceOpIndex={selection.sourceOpIndex}
              targetOpIndex={selection.targetOpIndex}
              selectedOpIndex={selectedOpIndex}
              onSelect={setSelectedOpIndex}
            />
            <OpsPanel
              ops={result.ops}
              totalCost={result.totalCost}
              selectedOpIndex={selectedOpIndex}
              onSelect={setSelectedOpIndex}
            />
          </div>
        </main>
      ) : (
        <main className="placeholder" data-testid="placeholder">
          {issues.length === 0 && (
            <p>
              请分别选择源字幕与译字幕 JSON 文件；两份均合法后立即计算对齐结果。空数组也是合法输入。
            </p>
          )}
        </main>
      )}

      <footer className="app-footer">
        成本：配对 = |起点差| + |终点差| + 500×|条数差|；跳过单条 = 时长 + 1000。同成本按 1:1 → 1:2 → 2:1 → 跳源 → 跳译 取字典序最小。
      </footer>
    </div>
  )
}
