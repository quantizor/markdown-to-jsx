import { describe, expect, it } from 'bun:test'
import * as React from 'react'
import { renderToString } from 'react-dom/server'

import { compiler, Markdown, parser, RuleType } from './index'

describe('index.tsx exports', () => {
  it('should export parser and it should work', () => {
    const ast = parser('# Hello')
    expect(ast).toMatchInlineSnapshot(`
      [
        {
          "children": [
            {
              "text": "Hello",
              "type": "text",
            },
          ],
          "endPos": 7,
          "id": "hello",
          "level": 1,
          "type": "heading",
        },
      ]
    `)
  })

  it('should export compiler and it should work', () => {
    const result = compiler('# Hello')
    expect(result).toMatchInlineSnapshot(`
      {
        "$$typeof": Symbol(react.transitional.element),
        "_debugInfo": null,
        "_debugStack": [Error: react-stack-top-frame],
        "_debugTask": null,
        "_owner": null,
        "_store": {
          "validated": 0,
        },
        "key": "0",
        "props": {
          "children": [
            "Hello",
          ],
          "className": undefined,
          "id": "hello",
          "key": [native code],
        },
        "ref": null,
        "type": "h1",
      }
    `)
  })

  it('should export RuleType', () => {
    expect(RuleType).toBeDefined()
    expect(typeof RuleType).toBe('object')
  })

  it('should export Markdown component', () => {
    const html = renderToString(
      React.createElement(Markdown, { children: '# Test' })
    )
    expect(html).toMatchInlineSnapshot(`"<h1 id="test">Test</h1>"`)
  })
})
