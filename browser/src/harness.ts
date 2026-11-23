import { casesFor, type HarnessCase } from '../../fixtures/cases'

document.documentElement.dataset.viteMode = import.meta.env.DEV
  ? 'development'
  : 'production'

export var BROWSER_CASES: HarnessCase[] = casesFor('browser')

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

export function outs(rootId: string): HTMLElement[] {
  var root = document.getElementById(rootId)
  if (!root) {
    throw new Error(`mount root #${rootId} missing from the page`)
  }
  buildCards(root, BROWSER_CASES)
  return Array.from(root.querySelectorAll<HTMLElement>('[data-out]'))
}
