/**
 * Mounts every browser case through markdown-to-jsx/react into `#rootId`.
 * The imports are bare `react` and `react-dom/client`, so the build decides
 * the runtime: vite.config.ts bundles real React, vite.preact.config.ts
 * aliases the same specifiers to preact/compat. No JSX, no framework plugin.
 */

import ReactMarkdown from 'markdown-to-jsx/react'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { BROWSER_CASES, outs } from './harness'

export function mountReact(rootId: string) {
  outs(rootId).forEach((el, i) => {
    var c = BROWSER_CASES[i]
    createRoot(el).render(
      createElement(ReactMarkdown, { options: c.options }, c.md)
    )
  })
}
