import { expect, type Locator, type Page, test } from '@playwright/test'
import {
  casesFor,
  type DomExpect,
  type HarnessCase,
} from '../../fixtures/cases'

var RENDERERS = ['react', 'solid', 'vue', 'preact'] as const

var BROWSER_CASES: HarnessCase[] = casesFor('browser')

var PREACT_CASES_WITH_CASE_PRESERVED_TAGS = [
  'jsx-blank-line-nesting',
  'nested-same-component-thrice',
]

function isBenignReactCustomTagWarning(text: string): boolean {
  return (
    text.indexOf('incorrect casing') !== -1 ||
    text.indexOf('unrecognized in this browser') !== -1
  )
}

function collectErrors(page: Page): string[] {
  var errors: string[] = []
  page.on('pageerror', err => {
    errors.push(`pageerror: ${err.message}`)
  })
  page.on('console', msg => {
    if (msg.type() !== 'error') {
      return
    }
    var text = msg.text()
    if (isBenignReactCustomTagWarning(text)) {
      return
    }
    errors.push(`console.error: ${text}`)
  })
  return errors
}

async function applyExpect(out: Locator, e: DomExpect) {
  var target = e.sel === '' ? out : out.locator(e.sel)
  if ('absent' in e) {
    await expect.soft(target).toHaveCount(0)
  } else if ('count' in e) {
    await expect.soft(target).toHaveCount(e.count)
  } else if ('attr' in e) {
    await expect.soft(target.first()).toHaveAttribute(e.attr[0], e.attr[1])
  } else {
    var first = target.first()
    var tag = await first.evaluate(el => el.tagName)
    var bodyHiddenFromToHaveText = tag === 'SCRIPT' || tag === 'STYLE'
    if (bodyHiddenFromToHaveText) {
      await expect.soft(first).toHaveJSProperty('textContent', e.text)
    } else {
      await expect.soft(first).toHaveText(e.text)
    }
  }
}

for (const renderer of RENDERERS) {
  test(`${renderer} renders every case to contract`, async ({
    page,
  }, testInfo) => {
    var errors = collectErrors(page)
    await page.goto('/')

    var expectedMode = testInfo.project.name.endsWith('development')
      ? 'development'
      : 'production'
    await expect(page.locator('html')).toHaveAttribute(
      'data-vite-mode',
      expectedMode
    )

    var root = page.locator(`#${renderer}-root`)

    await expect(
      root.locator('[data-out]'),
      'cards mounted vs fixtures/cases.ts; a short count in production means the harness bundle predates the corpus: run `bun test:browser` to rebuild it'
    ).toHaveCount(BROWSER_CASES.length)

    for (const c of BROWSER_CASES) {
      if (
        renderer === 'preact' &&
        PREACT_CASES_WITH_CASE_PRESERVED_TAGS.indexOf(c.id) !== -1
      ) {
        continue
      }
      await test.step(c.id, async () => {
        var out = root.locator(`[data-case="${c.id}"] [data-out]`)
        for (const e of c.dom) {
          await applyExpect(out, e)
        }
      })
    }

    expect(errors).toEqual([])
  })
}
