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
