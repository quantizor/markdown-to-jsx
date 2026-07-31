import { expect, type Locator, type Page, test } from '@playwright/test'
import { CASES, type DomExpect, type HarnessCase } from '../../fixtures/cases'

/**
 * One test per mounted renderer per Vite mode (production preview / development),
 * one step per shared case. Each case asserts the `dom` contract declared in
 * fixtures/cases.ts against that renderer's isolated card. Error listeners
 * attach before navigation so a throw during module evaluation or any case
 * mount is captured at the end. The development project is what surfaces
 * React/Solid/Vue DEV warnings; production alone cannot.
 *
 * Expectations are renderer-agnostic by design: a failure in exactly one
 * renderer is compiler drift, a failure in all three is a parser bug.
 */
var RENDERERS = ['react', 'solid', 'vue'] as const

var BROWSER_CASES: HarnessCase[] = CASES.filter(
  c => !c.skip || c.skip.indexOf('browser') === -1
)

/**
 * React DEV warns about unknown custom tags (MyComponent, tag1) that the
 * corpus mounts on purpose without overrides. Those are not regressions.
 * Keep every other console.error and every pageerror, including the Type 1
 * array-children class the development project exists to catch.
 */
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
    // Chromium hides <script>/<style> body from toHaveText; textContent still holds it.
    var tag = await first.evaluate(el => el.tagName)
    if (tag === 'SCRIPT' || tag === 'STYLE') {
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

    var expectedMode =
      testInfo.project.name === 'development' ? 'development' : 'production'
    await expect(page.locator('html')).toHaveAttribute(
      'data-vite-mode',
      expectedMode
    )

    var root = page.locator(`#${renderer}-root`)

    // Every case mounted its card before any assertion runs.
    await expect(root.locator('[data-out]')).toHaveCount(BROWSER_CASES.length)

    for (const c of BROWSER_CASES) {
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
