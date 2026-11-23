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
