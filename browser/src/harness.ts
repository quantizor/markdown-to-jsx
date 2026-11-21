/**
 * Case-card plumbing shared by every harness page: the browser-eligible slice
 * of fixtures/cases.ts, the mode marker Playwright reads, and one card (with
 * its own mount target) per case so a crashing case cannot take down its
 * neighbors and a failure maps straight to a case id.
 */

import { CASES, type HarnessCase } from '../../fixtures/cases'

// Mode marker for Playwright: production preview vs vite dev. A comment-only
// listener cannot catch React Type 1 array-children warnings; the development
// project must actually load import.meta.env.DEV === true.
document.documentElement.dataset.viteMode = import.meta.env.DEV
  ? 'development'
  : 'production'

export var BROWSER_CASES: HarnessCase[] = CASES.filter(
  c => !c.skip || c.skip.indexOf('browser') === -1
)

function buildCards(root: HTMLElement, cases: HarnessCase[]) {
  cases.forEach(c => {
    var card = document.createElement('article')
    card.dataset.case = c.id
    var label = document.createElement('header')
    label.textContent = c.ref ? `${c.id} ${c.ref}` : c.id
    var out = document.createElement('div')
    out.setAttribute('data-out', '')
    card.append(label, out)
    root.append(card)
  })
}

/** Builds one card per browser case under `#rootId`; returns the mount targets in case order. */
export function outs(rootId: string): HTMLElement[] {
  var root = document.getElementById(rootId)
  if (!root) {
    throw new Error(`mount root #${rootId} missing from the page`)
  }
  buildCards(root, BROWSER_CASES)
  return Array.from(root.querySelectorAll<HTMLElement>('[data-out]'))
}
