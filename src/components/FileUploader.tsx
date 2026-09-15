import { useRef } from 'react'
import type { LoadedFile } from '../lib/useAlignment'
import type { Side, ValidationIssue } from '../lib/types'

interface FileUploaderProps {
  side: Side
  file: LoadedFile | null
  issues: ValidationIssue[]
  cueCount: number | null
  onLoad: (file: LoadedFile) => void
  onClear: () => void
}

const TITLES: Record<Side, string> = {
  source: '源字幕',
  target: '译字幕',
}

export function FileUploader({ side, file, issues, cueCount, onLoad, onClear }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = `${side}-file`
  const hasIssues = issues.length > 0
  const status = !file
    ? { cls: 'status-pending', text: '未选择文件' }
    : hasIssues
      ? { cls: 'status-error', text: `非法（${issues.length} 个错误）` }
      : cueCount === 0
        ? { cls: 'status-ok', text: '合法 · 空数组（0 条）' }
        : { cls: 'status-ok', text: `合法 · ${cueCount} 条` }

  const pickFile = async (picked: File | null | undefined) => {
    if (!picked) return
    const text = await picked.text()
    onLoad({ name: picked.name, text })
  }

  return (
    <section className={`uploader ${hasIssues ? 'uploader-invalid' : ''}`}>
      <header className="uploader-head">
        <h2>{TITLES[side]}</h2>
        <span className={`status ${status.cls}`} data-testid={`${side}-status`}>
          {status.text}
        </span>
      </header>
      <div className="uploader-body">
        <input
          ref={inputRef}
          id={inputId}
          data-testid={inputId}
          type="file"
          accept=".json,application/json"
          className="file-input"
          onChange={(e) => {
            void pickFile(e.target.files?.[0])
            // Allow re-selecting the same file name after edits.
            e.target.value = ''
          }}
        />
        <label htmlFor={inputId} className="file-button">
          选择 JSON 文件
        </label>
        {file && (
          <div className="file-meta">
            <span className="file-name" title={file.name}>
              {file.name}
            </span>
            <button type="button" className="clear-button" onClick={onClear}>
              清除
            </button>
          </div>
        )}
      </div>
      <p className="uploader-hint">
        数组，每项含 id（唯一非空字符串）、startMs、endMs（整数，0≤startMs&lt;endMs）、text（字符串）；按 startMs 严格递增且相邻不重叠。
      </p>
    </section>
  )
}
