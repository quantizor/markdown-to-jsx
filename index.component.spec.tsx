import Markdown from './index'
import * as React from 'react'
import { renderToString } from 'react-dom/server'

const root = { innerHTML: '' }

function render(jsx: React.ReactElement) {
  root.innerHTML = renderToString(jsx)
}

afterEach(() => {
  root.innerHTML = ''
})

it('accepts markdown content', () => {
  render(<Markdown>_Hello._</Markdown>)

  expect(root.innerHTML).toMatchInlineSnapshot(`
    <em data-reactroot>
      Hello.
    </em>
  `)
})

it('handles a no-children scenario', () => {
  render(<Markdown>{''}</Markdown>)

  expect(root.innerHTML).toMatchInlineSnapshot(`
    <span data-reactroot>
    </span>
  `)
})

it('handles a null-children scenario', () => {
  const previousEnv = process.env.NODE_ENV

  // Only reproducible in production mode
  process.env.NODE_ENV = 'production'

  render(<Markdown>{null}</Markdown>)

  try {
    expect(root.innerHTML).toMatchInlineSnapshot(`
      <span data-reactroot>
      </span>
    `)
  } catch (error) {
    throw error
  } finally {
    process.env.NODE_ENV = previousEnv
  }
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
    <em data-reactroot>
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
    <pre data-reactroot>
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
        data-reactroot
    >
      Hello
    </h1>
  `)
})

it('can render simple math', () => {
  render(
    <Markdown>{`<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><semantics><mrow><mfrac><mrow>a</mrow><mrow>2</mrow></mfrac></mrow><annotation encoding="application/x-tex">\\frac{a}{2}</annotation></semantics></math>`}</Markdown>
  )

  expect(root.innerHTML).toMatchInlineSnapshot(`
    <math xmlns="http://www.w3.org/1998/Math/MathML"
          display="block"
          data-reactroot
    >
      <semantics>
        <mrow>
          <mfrac>
            <mrow>
              a
            </mrow>
            <mrow>
              2
            </mrow>
          </mfrac>
        </mrow>
        <annotation encoding="application/x-tex">
          \\frac{a}{2}
        </annotation>
      </semantics>
    </math>
  `)
})

it('can render complex math', () => {
  render(
    <Markdown>{`<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
<semantics>
  <mrow><mfrac><mrow><msqrt><mrow>a</mrow></msqrt></mrow><mrow><mn>2</mn></mrow></mfrac></mrow>
  <annotation encoding="application/x-tex">\\frac{\\sqrt{a}}{2}</annotation>
</semantics>
</math>`}</Markdown>
  )

  expect(root.innerHTML).toMatchInlineSnapshot(`
    <math xmlns="http://www.w3.org/1998/Math/MathML"
          display="block"
          data-reactroot
    >
      <semantics>
        <mrow>
          <mfrac>
            <mrow>
              <msqrt>
                <mrow>
                  a
                </mrow>
              </msqrt>
            </mrow>
            <mrow>
              <mn>
                2
              </mn>
            </mrow>
          </mfrac>
        </mrow>
        <annotation encoding="application/x-tex">
          \\frac{\\sqrt{a}}{2}
        </annotation>
      </semantics>
    </math>
  `)
})
