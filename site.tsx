/* @jsx React.createElement */
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import TeX from '@matejmazur/react-katex'
import Markdown, { MarkdownToJSX, RuleType } from './index'
import './site.css'

declare global {
  interface Window {
    hljs: {
      highlightElement: (element: HTMLElement) => void
    }
  }
}

function TryItLive() {
  const [markdown, setMarkdown] = React.useState(
    document.getElementById('sample-content')!.textContent!.trim()
  )

  const handleInput = React.useCallback(e => setMarkdown(e.target.value), [])

  return (
    <main className="flex flex-col px-6 lg:p-12 py-12 min-h-screen">
      <header className="flex-shrink-0 mb-8 text-center space-y-8">
        <a
          className="inline-block"
          target="_blank"
          href="https://github.com/quantizor/markdown-to-jsx"
          title="Check out the markdown-to-jsx source code"
          rel="noopener noreferrer"
        >
          <img
            src="./images/logo.svg"
            alt="markdown-to-jsx logo"
            className="h-24"
          />
        </a>

        <div className="mx-auto max-w-[100ch] sm:max-w-none lg:max-w-[100ch]">
          <h1 className="text-base block lg:inline lg:mb-0 mb-6">
            <code>markdown-to-jsx</code> is an easy-to-use markdown component
            that takes Github-flavored Markdown (GFM) and makes native JSX
            without dangerous hacks.&nbsp;
          </h1>
          <h2 className="text-base block lg:inline lg:mb-0 mb-6">
            It&apos;s lightweight, customizable, and happily supports React-like
            libraries.
          </h2>
        </div>

        <p className="text-accent/80">
          See the{' '}
          <a
            target="_blank"
            href="https://github.com/quantizor/markdown-to-jsx/blob/main/README.md"
            rel="noopener noreferrer"
          >
            project README
          </a>{' '}
          for detailed installation &amp; usage instructions.
        </p>
      </header>

      <section className="flex flex-1 -ml-6 -mr-6 lg:m-0 flex-col sm:flex-row">
        <textarea
          className="flex-[0_0_50%] p-4 border-0 text-inherit flex-shrink-0 font-mono text-sm max-h-screen resize-vertical field-sizing-content md:sticky md:top-0 bg-accent/10"
          onInput={handleInput}
          value={markdown}
        />

        <div className="flex-[0_0_50%] p-4 pl-8 pr-4 pt-8 pb-8 overflow-auto overflow-x-hidden">
          <Markdown className="space-y-6 *:block" options={options}>
            {markdown}
          </Markdown>
        </div>
      </section>
    </main>
  )
}

function MyComponent(props) {
  return (
    <button
      {...props}
      className="rounded text-white cursor-pointer py-1 px-3 font-inherit transition-colors duration-200"
      style={{
        backgroundColor: 'rgb(123, 111, 90)',
        border: '1px solid rgba(245, 222, 179, 0.5)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = 'rgb(245, 222, 179)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'rgb(123, 111, 90)'
      }}
      onMouseDown={e => {
        e.currentTarget.style.backgroundColor = 'rgb(196, 178, 143)'
      }}
      onMouseUp={e => {
        e.currentTarget.style.backgroundColor = 'rgb(123, 111, 90)'
      }}
      onClick={function () {
        alert("Look ma, I'm a real component!")
      }}
    />
  )
}

function SyntaxHighlightedCode(props) {
  const ref = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (ref.current && props.className?.includes('lang-') && window.hljs) {
      window.hljs.highlightElement(ref.current)

      // hljs won't reprocess the element unless this attribute is removed
      ref.current.removeAttribute('data-highlighted')
    }
  }, [props.className, props.children])

  return <code {...props} ref={ref} />
}

const options = {
  overrides: {
    code: SyntaxHighlightedCode,
    MyComponent: {
      component: MyComponent,
    },
  },
  renderRule(defaultOutput, node, renderChildren, state) {
    if (node.type === RuleType.codeBlock) {
      if (node.lang === 'latex') {
        return (
          <TeX as="div" key={state.key} style={{ margin: '1.5em 0' }}>
            {String.raw`${node.text}`}
          </TeX>
        )
      }
    }

    return defaultOutput()
  },
} as MarkdownToJSX.Options

ReactDOM.render(<TryItLive />, document.getElementById('root'))
