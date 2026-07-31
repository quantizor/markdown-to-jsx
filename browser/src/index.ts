/**
 * Mounts every case in fixtures/cases.ts once per browser compiler, each case
 * into its own root so one crashing case cannot take down its neighbors and
 * the failure maps straight to a case id. Imports resolve through the built
 * package exports map (node_modules/markdown-to-jsx -> lib/), so this page
 * verifies the shipped artifacts and, via the exports "browser" condition,
 * the DOM-based entity decoder in lib/src/entities.browser.ts.
 *
 * No JSX and no framework Vite plugins on purpose: the mounts stay in plain
 * createElement/createComponent/h so the harness carries zero transform config.
 */
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import ReactMarkdown from 'markdown-to-jsx/react'
import { createComponent } from 'solid-js'
import { render as solidRender } from 'solid-js/web'
import SolidMarkdown from 'markdown-to-jsx/solid'
import { createApp, h } from 'vue'
import VueMarkdown from 'markdown-to-jsx/vue'
import { CASES, type HarnessCase } from '../../fixtures/cases'

// Mode marker for Playwright: production preview vs vite dev. A comment-only
// listener cannot catch React Type 1 array-children warnings; the development
// project must actually load import.meta.env.DEV === true.
document.documentElement.dataset.viteMode = import.meta.env.DEV
  ? 'development'
  : 'production'

var BROWSER_CASES = CASES.filter(function (c) {
  return !c.skip || c.skip.indexOf('browser') === -1
})

function buildCards(root: HTMLElement, cases: HarnessCase[]) {
  cases.forEach(function (c) {
    var card = document.createElement('article')
    card.dataset.case = c.id
    var label = document.createElement('header')
    label.textContent = c.ref ? c.id + ' ' + c.ref : c.id
    var out = document.createElement('div')
    out.setAttribute('data-out', '')
    card.append(label, out)
    root.append(card)
  })
}

function outs(rootId: string): HTMLElement[] {
  var root = document.getElementById(rootId)
  if (!root) throw new Error('mount root #' + rootId + ' missing from index.html')
  buildCards(root, BROWSER_CASES)
  return Array.from(root.querySelectorAll<HTMLElement>('[data-out]'))
}

outs('react-root').forEach(function (el, i) {
  var c = BROWSER_CASES[i]
  createRoot(el).render(
    createElement(ReactMarkdown, { options: c.options }, c.md)
  )
})

outs('solid-root').forEach(function (el, i) {
  var c = BROWSER_CASES[i]
  solidRender(
    function () {
      return createComponent(SolidMarkdown, {
        children: c.md,
        options: c.options,
      })
    },
    el
  )
})

outs('vue-root').forEach(function (el, i) {
  var c = BROWSER_CASES[i]
  createApp({
    render: function () {
      return h(VueMarkdown, { children: c.md, options: c.options })
    },
  }).mount(el)
})
