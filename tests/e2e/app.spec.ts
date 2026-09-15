import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const fixtures = (name: string) => path.join(here, 'fixtures', name)

async function upload(page: Page, side: 'source' | 'target', fixture: string) {
  await page.setInputFiles(`[data-testid="${side}-file"]`, fixtures(fixture))
}

test.describe('subtitle aligner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shows the two upload entries and no result initially', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '源字幕', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: '译字幕', exact: true })).toBeVisible()
    await expect(page.getByTestId('placeholder')).toBeVisible()
    await expect(page.getByTestId('pair-panel')).toHaveCount(0)
  })

  test('aligns identical files with three 1:1 pairs and zero cost', async ({ page }) => {
    await upload(page, 'source', 'source-good.json')
    await upload(page, 'target', 'target-good.json')

    await expect(page.getByTestId('source-status')).toHaveText(/合法 · 3 条/)
    await expect(page.getByTestId('target-status')).toHaveText(/合法 · 3 条/)

    await expect(page.getByTestId('pair-block')).toHaveCount(3)
    await expect(page.getByTestId('op-row')).toHaveCount(3)
    for (const kind of await page.getByTestId('op-row').evaluateAll((rows) =>
      rows.map((r) => r.getAttribute('data-op-kind')),
    )) {
      expect(kind).toBe('match-1-1')
    }
    await expect(page.getByTestId('total-cost')).toHaveText(/0/)
    await expect(page.getByTestId('unmatched-panel')).toContainText('源 0 · 译 0')
    await expect(page.getByTestId('placeholder')).toHaveCount(0)
  })

  test('clicking a pair block highlights all cues it contains', async ({ page }) => {
    await upload(page, 'source', 'source-split.json')
    await upload(page, 'target', 'target-split.json')

    // First block should be 1:2 (s0 vs t0,t1).
    const firstBlock = page.getByTestId('pair-block').first()
    await expect(firstBlock).toContainText('1:2')
    await firstBlock.click()

    const sourceHighlighted = page.locator(
      "[data-testid='source-cue-list'] .cue-highlighted[data-cue-id='s0']",
    )
    const targetT0 = page.locator(
      "[data-testid='target-cue-list'] .cue-highlighted[data-cue-id='t0']",
    )
    const targetT1 = page.locator(
      "[data-testid='target-cue-list'] .cue-highlighted[data-cue-id='t1']",
    )
    const targetT2 = page.locator(
      "[data-testid='target-cue-list'] .cue-highlighted[data-cue-id='t2']",
    )
    await expect(sourceHighlighted).toHaveCount(1)
    await expect(targetT0).toHaveCount(1)
    await expect(targetT1).toHaveCount(1)
    await expect(targetT2).toHaveCount(0)

    // Click again clears the selection.
    await firstBlock.click()
    await expect(page.locator('.cue-highlighted')).toHaveCount(0)
  })

  test('operation sequence and ops panel sync selection with pair blocks', async ({
    page,
  }) => {
    await upload(page, 'source', 'source-split.json')
    await upload(page, 'target', 'target-split.json')

    const kinds = await page
      .getByTestId('op-row')
      .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-op-kind')))
    expect(kinds).toEqual(['match-1-2', 'match-1-1'])

    // Clicking the op row highlights the same cues as its pair block.
    await page.getByTestId('op-row').first().click()
    await expect(
      page.locator(
        "[data-testid='source-cue-list'] .cue-highlighted[data-cue-id='s0']",
      ),
    ).toHaveCount(1)
    await expect(
      page.locator(
        "[data-testid='target-cue-list'] .cue-highlighted[data-cue-id='t0']",
      ),
    ).toHaveCount(1)
    await expect(firstPairActive(page)).toHaveClass(/pair-active/)
  })

  test('empty vs empty produces an empty sequence and total cost 0', async ({ page }) => {
    await upload(page, 'source', 'empty.json')
    await upload(page, 'target', 'empty.json')
    await expect(page.getByTestId('source-status')).toHaveText(/空数组/)
    await expect(page.getByTestId('target-status')).toHaveText(/空数组/)
    await expect(page.getByTestId('ops-empty')).toBeVisible()
    await expect(page.getByTestId('total-cost')).toHaveText(/0/)
    await expect(page.getByTestId('pair-panel')).toContainText('0 块')
  })

  test('all-skip optimum still lists every cue as unmatched', async ({ page }) => {
    // Source only; target empty: optimum skips every source cue.
    await upload(page, 'source', 'source-good.json')
    await upload(page, 'target', 'empty.json')

    await expect(page.getByTestId('pair-panel')).toContainText('0 块')
    await expect(page.getByTestId('unmatched-panel')).toContainText('源 3 · 译 0')
    await expect(page.getByTestId('unmatched-source').locator('li')).toHaveCount(3)
    for (const id of ['s0', 's1', 's2']) {
      await expect(
        page.locator(`[data-testid='source-cue-list'] .cue-unmatched[data-cue-id="${id}"]`),
      ).toHaveCount(1)
    }
    const skipOps = await page
      .getByTestId('op-row')
      .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-op-kind')))
    expect(skipOps).toEqual(['skip-source', 'skip-source', 'skip-source'])
  })

  test('invalid file rejects the batch, shows errors, and clears old results', async ({
    page,
  }) => {
    // Start from a good alignment.
    await upload(page, 'source', 'source-good.json')
    await upload(page, 'target', 'target-good.json')
    await expect(page.getByTestId('pair-block')).toHaveCount(3)

    // Replace source with an invalid file: batch rejected, old result gone.
    await upload(page, 'source', 'source-invalid.json')
    await expect(page.getByTestId('error-panel')).toBeVisible()
    await expect(page.getByTestId('pair-panel')).toHaveCount(0)
    await expect(page.getByTestId('total-cost')).toHaveCount(0)

    const messages = await page.getByTestId('error-list').locator('li').allInnerTexts()
    // Both problems on item 1 are reported (duplicate id + reversed times).
    expect(messages.some((m) => m.includes('重复'))).toBe(true)
    expect(messages.some((m) => m.includes('startMs < endMs'))).toBe(true)
  })

  test('source errors are listed before target errors', async ({ page }) => {
    await upload(page, 'source', 'source-invalid.json')
    await upload(page, 'target', 'target-invalid.json')

    const sides = await page
      .getByTestId('error-list')
      .locator('.error-side')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-side')))
    // All source entries precede all target entries.
    const lastSource = sides.lastIndexOf('source')
    const firstTarget = sides.indexOf('target')
    expect(lastSource).toBeGreaterThanOrEqual(0)
    expect(firstTarget).toBeGreaterThan(lastSource)
    expect(sides).toContain('target')
  })

  test('restoring a valid file recomputes immediately without re-uploading the other', async ({
    page,
  }) => {
    await upload(page, 'source', 'source-good.json')
    await upload(page, 'target', 'target-invalid.json')
    await expect(page.getByTestId('error-panel')).toBeVisible()

    await upload(page, 'target', 'target-good.json')
    await expect(page.getByTestId('error-panel')).toHaveCount(0)
    await expect(page.getByTestId('pair-block')).toHaveCount(3)
    await expect(page.getByTestId('total-cost')).toHaveText(/0/)
  })

  test('clearing one side removes results and waits for both files again', async ({
    page,
  }) => {
    await upload(page, 'source', 'source-good.json')
    await upload(page, 'target', 'target-good.json')
    await expect(page.getByTestId('pair-block')).toHaveCount(3)

    await page.getByRole('button', { name: '清除' }).first().click()
    await expect(page.getByTestId('placeholder')).toBeVisible()
    await expect(page.getByTestId('pair-panel')).toHaveCount(0)
  })
})

function firstPairActive(page: Page) {
  return page.getByTestId('pair-block').first()
}
