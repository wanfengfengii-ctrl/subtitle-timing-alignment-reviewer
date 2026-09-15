import { describe, expect, it } from 'vitest'
import { mergeIssues, parseCueFile } from './validation'

function parse(side: 'source' | 'target', text: string) {
  return parseCueFile(text, side)
}

describe('parseCueFile - acceptance', () => {
  it('accepts an empty array', () => {
    const { cues, issues } = parse('source', '[]')
    expect(cues).toEqual([])
    expect(issues).toEqual([])
  })

  it('accepts a well-formed non-empty array', () => {
    const text = JSON.stringify([
      { id: 'a', startMs: 0, endMs: 1000, text: 'hi' },
      { id: 'b', startMs: 1000, endMs: 2000, text: 'there' },
      { id: 'c', startMs: 2500, endMs: 3000, text: '' },
    ])
    const { cues, issues } = parse('target', text)
    expect(issues).toEqual([])
    expect(cues?.map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('accepts adjacent cues that touch (end == next start)', () => {
    const text = JSON.stringify([
      { id: 'a', startMs: 0, endMs: 500, text: 'a' },
      { id: 'b', startMs: 500, endMs: 900, text: 'b' },
    ])
    expect(parse('source', text).issues).toEqual([])
  })
})

describe('parseCueFile - rejection', () => {
  it('rejects malformed JSON', () => {
    const { cues, issues } = parse('source', '{not json')
    expect(cues).toBeNull()
    expect(issues).toHaveLength(1)
    expect(issues[0].index).toBe(-1)
  })

  it('rejects a non-array top level', () => {
    const { issues } = parse('source', '{"a":1}')
    expect(issues[0].message).toContain('数组')
  })

  it('rejects non-object items', () => {
    expect(parse('source', '[42]').issues[0].message).toContain('对象')
    expect(parse('source', '[null]').issues[0].message).toContain('对象')
    expect(parse('source', '[["x"]]').issues[0].message).toContain('对象')
  })

  it('rejects missing/wrong-typed fields', () => {
    expect(parse('source', '[{}]').issues.length).toBeGreaterThanOrEqual(4)
    const wrong = parse(
      'source',
      JSON.stringify([{ id: 1, startMs: '0', endMs: 1.5, text: 9 }]),
    )
    expect(wrong.issues.some((i) => i.message.includes('id'))).toBe(true)
    expect(wrong.issues.some((i) => i.message.includes('startMs'))).toBe(true)
    expect(wrong.issues.some((i) => i.message.includes('endMs'))).toBe(true)
    expect(wrong.issues.some((i) => i.message.includes('text'))).toBe(true)
  })

  it('rejects empty ids (a whitespace-only string is still non-empty)', () => {
    expect(
      parse('source', JSON.stringify([{ id: '', startMs: 0, endMs: 1, text: '' }]))
        .issues[0].message,
    ).toContain('不得为空')
    expect(
      parse('source', JSON.stringify([{ id: '   ', startMs: 0, endMs: 1, text: '' }]))
        .issues,
    ).toEqual([])
  })

  it('rejects duplicate ids and reports both positions', () => {
    const { issues } = parse(
      'source',
      JSON.stringify([
        { id: 'x', startMs: 0, endMs: 100, text: 'a' },
        { id: 'x', startMs: 200, endMs: 300, text: 'b' },
      ]),
    )
    expect(issues.some((i) => i.index === 1 && i.message.includes('重复'))).toBe(true)
  })

  it('rejects negative startMs', () => {
    const issues = parse(
      'source',
      JSON.stringify([{ id: 'a', startMs: -1, endMs: 10, text: '' }]),
    ).issues
    expect(issues.some((i) => i.message.includes('0 ≤ startMs'))).toBe(true)
  })

  it('rejects startMs >= endMs, including equality', () => {
    const eq = parse(
      'source',
      JSON.stringify([{ id: 'a', startMs: 100, endMs: 100, text: '' }]),
    ).issues
    expect(eq.some((i) => i.message.includes('startMs < endMs'))).toBe(true)

    const gt = parse(
      'source',
      JSON.stringify([{ id: 'a', startMs: 200, endMs: 100, text: '' }]),
    ).issues
    expect(gt.some((i) => i.message.includes('startMs < endMs'))).toBe(true)
  })

  it('rejects non-strictly-increasing startMs', () => {
    const issues = parse(
      'source',
      JSON.stringify([
        { id: 'a', startMs: 0, endMs: 100, text: 'a' },
        { id: 'b', startMs: 0, endMs: 300, text: 'b' },
      ]),
    ).issues
    expect(issues.some((i) => i.message.includes('严格大于'))).toBe(true)
  })

  it('rejects overlapping adjacent cues', () => {
    const issues = parse(
      'source',
      JSON.stringify([
        { id: 'a', startMs: 0, endMs: 300, text: 'a' },
        { id: 'b', startMs: 200, endMs: 400, text: 'b' },
      ]),
    ).issues
    expect(issues.some((i) => i.message.includes('重叠'))).toBe(true)
  })
})

describe('parseCueFile - complete error reporting', () => {
  it('reports every invalid item at its array position, not just the first', () => {
    const { issues } = parse(
      'target',
      JSON.stringify([
        { id: 'ok', startMs: 0, endMs: 100, text: 'fine' },
        { id: 'bad1', startMs: 50, endMs: 60, text: 'overlap' },
        null,
        { id: 'ok2', startMs: 200, endMs: 100, text: 'reversed' },
      ]),
    )
    const indices = issues.map((i) => i.index).sort((a, b) => a - b)
    expect(indices).toContain(1)
    expect(indices).toContain(2)
    expect(indices).toContain(3)
  })
})

describe('mergeIssues', () => {
  it('lists source issues before target issues, each stable by position', () => {
    const merged = mergeIssues(
      [
        { side: 'source' as const, index: 2, message: 's2' },
        { side: 'source' as const, index: 0, message: 's0' },
      ],
      [
        { side: 'target' as const, index: 1, message: 't1' },
        { side: 'target' as const, index: 0, message: 't0' },
      ],
    )
    expect(merged.map((i) => `${i.side}:${i.index}`)).toEqual([
      'source:0',
      'source:2',
      'target:0',
      'target:1',
    ])
  })
})
