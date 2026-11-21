/**
 * Mounts every case in fixtures/cases.ts once per browser compiler, each case
 * into its own root (see harness.ts). Imports resolve through the built
 * package exports map (node_modules/markdown-to-jsx -> lib/), so this page
 * verifies the shipped artifacts and, via the exports "browser" condition,
 * the DOM-based entity decoder in lib/src/entities.browser.ts. The Preact
 * build of the React mounts is preact/main.ts.
 *
 * No JSX and no framework Vite plugins on purpose: the mounts stay in plain
 * createElement/createComponent/h so the harness carries zero transform config.
 */

import SolidMarkdown from 'markdown-to-jsx/solid'
import VueMarkdown from 'markdown-to-jsx/vue'
import { createComponent } from 'solid-js'
import { render as solidRender } from 'solid-js/web'
import { createApp, h } from 'vue'
import { BROWSER_CASES, outs } from './harness'
import { mountReact } from './react-mount'

mountReact('react-root')

outs('solid-root').forEach((el, i) => {
  var c = BROWSER_CASES[i]
  solidRender(
    () =>
      createComponent(SolidMarkdown, {
        children: c.md,
        options: c.options,
      }),
    el
  )
})

outs('vue-root').forEach((el, i) => {
  var c = BROWSER_CASES[i]
  createApp({
    render() {
      return h(VueMarkdown, { children: c.md, options: c.options })
    },
  }).mount(el)
})
