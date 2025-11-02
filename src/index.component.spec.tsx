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
    <em>
      Hello.
    </em>
  `)
})

it('handles a no-children scenario', () => {
  render(<Markdown>{''}</Markdown>)

  expect(root.innerHTML).toMatchInlineSnapshot(`""`)
})

it('handles a null-children scenario', () => {
  render(<Markdown>{null}</Markdown>)
  expect(root.innerHTML).toMatchInlineSnapshot(`""`)
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

  renderToString(
    <Markdown
      options={{
        overrides: { code: { props: { className: 'foo' } } },
      }}
    >
      {code}
    </Markdown>
  )

  expect(root.innerHTML).toMatchInlineSnapshot(`""`)
})

it('passes along any additional props to the rendered wrapper element', () => {
  render(<Markdown className="foo"># Hello</Markdown>)

  expect(root.innerHTML).toMatchInlineSnapshot(`
    <h1 id="hello">
      Hello
    </h1>
  `)
})

it('can render simple math', () => {
  expect(
    renderToString(
      <Markdown>{`<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><semantics><mrow><mfrac><mrow>a</mrow><mrow>2</mrow></mfrac></mrow><annotation encoding="application/x-tex">\\frac{a}{2}</annotation></semantics></math>`}</Markdown>
    )
  ).toMatchInlineSnapshot(`
    <math xmlns="http://www.w3.org/1998/Math/MathML"
          display="block"
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
  expect(
    renderToString(
      <Markdown>{`<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
<semantics>
  <mrow><mfrac><mrow><msqrt><mrow>a</mrow></msqrt></mrow><mrow><mn>2</mn></mrow></mfrac></mrow>
  <annotation encoding="application/x-tex">\\frac{\\sqrt{a}}{2}</annotation>
</semantics>
</math>`}</Markdown>
    )
  ).toMatchInlineSnapshot(`
    <math xmlns="http://www.w3.org/1998/Math/MathML"
          display="block"
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
