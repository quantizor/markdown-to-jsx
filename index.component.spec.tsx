import {createMarkdown, type MarkdownToJSX} from './index'
import * as React from 'react'
import * as ReactDOM from 'react-dom'

const root = document.body.appendChild(document.createElement('div'))

function render(jsx) {
  return ReactDOM.render(jsx, root)
}

let Markdown: ReturnType<typeof createMarkdown>['Markdown']

function configure(options: MarkdownToJSX.Options) {
  Markdown = createMarkdown(options).Markdown
}

beforeEach(() => {
  Markdown = createMarkdown().Markdown
})

afterEach(() => ReactDOM.unmountComponentAtNode(root))

it('accepts markdown content', () => {
  render(<Markdown>_Hello._</Markdown>)

  expect(root.innerHTML).toMatchInlineSnapshot(`
    <em>
      Hello.
    </em>
  `)
})

it('handles a no-children scenario', () => {
  render(<Markdown>{''}</Markdown>)

  expect(root.innerHTML).toMatchInlineSnapshot(`""`)
})

it('accepts options', () => {
  class FakeParagraph extends React.Component<React.PropsWithChildren<{}>> {
    render() {
      return <p className="foo">{this.props.children}</p>
    }
  }

  configure({ overrides: { p: { component: FakeParagraph } } })

  render(
    <Markdown >
      _Hello._
    </Markdown>
  )

  expect(root.innerHTML).toMatchInlineSnapshot(`
    <em>
      Hello.
    </em>
  `)
})

it('merges className overrides, rather than overwriting', () => {
  const code = ['```js', 'foo', '```'].join('\n')

  configure({ overrides: { code: { props: { className: 'foo' } } } })

  render(
    <Markdown
    >
      {code}
    </Markdown>
  )

  expect(root.innerHTML).toMatchInlineSnapshot(`
    <pre>
      <code class="lang-js foo">
        foo
      </code>
    </pre>
  `)
})

