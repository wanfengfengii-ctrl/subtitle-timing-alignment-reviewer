import { useCallback, useMemo, useState } from 'react'
import { alignCues } from './align'
import type { AlignResult, Cue, Side, ValidationIssue } from './types'
import { mergeIssues, parseCueFile } from './validation'

export interface LoadedFile {
  name: string
  text: string
}

export interface AlignmentController {
  sourceFile: LoadedFile | null
  targetFile: LoadedFile | null
  /** Parsed cues per side; null when the file is missing or invalid. */
  sourceCues: Cue[] | null
  targetCues: Cue[] | null
  issues: ValidationIssue[]
  result: AlignResult | null
  loadFile: (side: Side, file: LoadedFile) => void
  clearFile: (side: Side) => void
}

export function useAlignment(): AlignmentController {
  const [sourceFile, setSourceFile] = useState<LoadedFile | null>(null)
  const [targetFile, setTargetFile] = useState<LoadedFile | null>(null)

  const loadFile = useCallback((side: Side, file: LoadedFile) => {
    if (side === 'source') setSourceFile(file)
    else setTargetFile(file)
  }, [])

  const clearFile = useCallback((side: Side) => {
    if (side === 'source') setSourceFile(null)
    else setTargetFile(null)
  }, [])

  const state = useMemo<{
    sourceCues: Cue[] | null
    targetCues: Cue[] | null
    issues: ValidationIssue[]
    result: AlignResult | null
  }>(() => {
    // Until a file for a side has been provided there is nothing to validate.
    const parsedSource = sourceFile
      ? parseCueFile(sourceFile.text, 'source')
      : { cues: null as Cue[] | null, issues: [] as ValidationIssue[] }
    const parsedTarget = targetFile
      ? parseCueFile(targetFile.text, 'target')
      : { cues: null as Cue[] | null, issues: [] as ValidationIssue[] }

    // Any invalid file rejects the whole batch: old results are cleared and
    // every issue (source first, then target, stable by position) is shown.
    const allIssues = mergeIssues(parsedSource.issues, parsedTarget.issues)
    if (allIssues.length > 0) {
      return {
        sourceCues: parsedSource.cues,
        targetCues: parsedTarget.cues,
        issues: allIssues,
        result: null,
      }
    }

    // Both files are valid (possibly empty arrays). Recompute immediately.
    if (parsedSource.cues !== null && parsedTarget.cues !== null) {
      return {
        sourceCues: parsedSource.cues,
        targetCues: parsedTarget.cues,
        issues: [],
        result: alignCues(parsedSource.cues, parsedTarget.cues),
      }
    }

    // Waiting for one or both files: no stale results are ever kept.
    return {
      sourceCues: parsedSource.cues,
      targetCues: parsedTarget.cues,
      issues: [],
      result: null,
    }
  }, [sourceFile, targetFile])

  return { sourceFile, targetFile, ...state, loadFile, clearFile }
}
