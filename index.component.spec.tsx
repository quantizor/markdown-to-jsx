import Markdown from './index'
import * as React from 'react'
import * as ReactDOM from 'react-dom'

const root = document.body.appendChild(document.createElement('div'))

function render(jsx) {
  return ReactDOM.render(jsx, root)
}

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

  expect(root.innerHTML).toMatchInlineSnapshot(`
    <span>
    </span>
  `)
})

it('accepts options', () => {
  class FakeParagraph extends React.Component<React.PropsWithChildren<{}>> {
    render() {
      return <p className="foo">{this.props.children}</p>
    }
  }

  render(
    <Markdown options={{ overrides: { p: { component: FakeParagraph } } }}>
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

  render(
    <Markdown
      options={{
        overrides: { code: { props: { className: 'foo' } } },
      }}
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

it('passes along any additional props to the rendered wrapper element', () => {
  render(<Markdown className="foo"># Hello</Markdown>)

  expect(root.innerHTML).toMatchInlineSnapshot(`
    <h1 id="hello"
        class="foo"
    >
      Hello
    </h1>
  `)
})
