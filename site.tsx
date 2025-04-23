/* @jsx React.createElement */
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import styled, { createGlobalStyle, css, CSSProp } from 'styled-components'
import TeX from '@matejmazur/react-katex'
import Markdown, { MarkdownToJSX, RuleType } from './index'

declare global {
  interface Window {
    hljs: {
      highlightElement: (element: HTMLElement) => void
    }
  }
}

declare module 'react' {
  interface Attributes {
    css?: CSSProp
  }
}

function TryItLive() {
  const [markdown, setMarkdown] = React.useState(
    document.getElementById('sample-content')!.textContent!.trim()
  )

  const handleInput = React.useCallback(e => setMarkdown(e.target.value), [])

  return (
    <main>
      <GlobalStyles />

      <Header>
        <a
          target="_blank"
          href="https://github.com/quantizor/markdown-to-jsx"
          title="Check out the markdown-to-jsx source code"
          rel="noopener noreferrer"
        >
          <img src="./images/logo.svg" alt="markdown-to-jsx logo" />
        </a>

        <Description>
          <h1>
            <code>markdown-to-jsx</code> is an easy-to-use markdown component
            that takes Github-flavored Markdown (GFM) and makes native JSX
            without dangerous hacks.&nbsp;
          </h1>
          <h2>
            It&apos;s lightweight, customizable, and happily supports React-like
            libraries.
          </h2>
        </Description>

        <LearnMore>
          See the{' '}
          <a
            target="_blank"
            href="https://github.com/quantizor/markdown-to-jsx/blob/main/README.md"
            rel="noopener noreferrer"
          >
            project README
          </a>{' '}
          for detailed installation &amp; usage instructions.
        </LearnMore>
      </Header>

      <Demo>
        <Textarea onInput={handleInput} value={markdown} />

        <Compiled>
          <Markdown options={options}>{markdown}</Markdown>
        </Compiled>
      </Demo>
    </main>
  )
}

const COLOR_ACCENT = 'wheat'
const COLOR_BODY = '#fefefe'

const GlobalStyles = createGlobalStyle`
	*,
	*::before,
	*::after {
		box-sizing: border-box;
		outline-color: ${COLOR_ACCENT};
	}

	html,
	body,
	#root,
	main {
		margin: 0;
		min-height: 100vh;
	}

	html {
		background: #1a1c23;
		color: ${COLOR_BODY};
		font-family: Inter, Helvetica Neue, Helvetica, sans-serif;
		font-size: 14px;
		line-height: 1.5;
	}

	h1,
	h2,
	h3,
	h4,
	h5,
	h6 {
		margin: 0 0 1rem;
    text-wrap: balance;
	}

	h1 {
		font-size: 2rem;
	}

	h2 {
		font-size: 1.8rem;
	}

	h3 {
		font-size: 1.6rem;
	}

	h4 {
		font-size: 1.4rem;
	}

	h5 {
		font-size: 1.2rem;
	}

	h6 {
		font-size: 1rem;
	}

	a {
		color: ${COLOR_ACCENT};
		transition: color 200ms ease;

		&:hover,
		&:focus {
			color: color-mix(in srgb, ${COLOR_ACCENT} 75%, transparent);
		}
	}

  :root {
    --code-bg: color-mix(in srgb, ${COLOR_ACCENT} 15%, transparent);
  }

	code {
    background: var(--code-bg) !important;
    border-radius: 2px;
		display: inline-block;
    font-family: 'Jetbrains Mono', Consolas, Monaco, monospace;
    font-size: 0.9em;
		padding: 0 4px;
    text-decoration: inherit;
	}

	pre code {
		border: 0;
		display: block;
		padding: 1em;
	}

	main {
		display: flex;
		flex-direction: column;
		padding: 3rem 1.5rem 0;
		margin: 0;

		@media all and (min-width: 1024px) {
			padding: 3rem;
		}
	}

  p {
    text-wrap: balance;
  }

  blockquote {
    border-left: 1px solid #333;
    margin: 1.5em 0;
    padding-left: 1em;

    &.markdown-alert-tip header {
      color: limegreen;

      &::before {
        content: '★';
        margin-right: 4px;
      }
    }

    &.markdown-alert-note header {
      color: cornflowerblue;

      &::before {
        content: 'ⓘ';
        margin-right: 4px;
      }
    }

    &.markdown-alert-important header {
      color: darkorchid;

      &::before {
        content: '❕';
        margin-right: 4px;
      }
    }

    &.markdown-alert-warning header {
      color: gold;

      &::before {
        content: '⚠️';
        margin-right: 4px;
      }
    }

    &.markdown-alert-caution header {
      color: red;

      &::before {
        content: '🛑';
        margin-right: 4px;
      }
    }

    header + * {
      margin-top: 0.25em;
    }
  }
`

const Header = styled.header`
  flex-shrink: 0;
  margin-bottom: 2em;
  text-align: center;

  img {
    height: 100px;
  }
`

const Description = styled.p`
  font-size: 16px;
  margin-left: auto;
  margin-right: auto;
  max-width: 100ch;

  h1,
  h2 {
    font: inherit;
  }

  @media all and (max-width: 500px) {
    max-width: none;
  }

  @media all and (max-width: 1023px) {
    h1,
    h2 {
      display: block;
      margin-bottom: 1.5rem;
    }
  }
`

const LearnMore = styled.p`
  color: color-mix(in srgb, ${COLOR_BODY} 20%, white);
`

const sharedCss = css`
  flex: 0 0 50%;
  padding: 1em;
`

const Demo = styled.section`
  display: flex;
  flex-grow: 1;
  margin-left: -1.5rem;
  margin-right: -1.5rem;

  @media all and (min-width: 1024px) {
    margin-left: 0;
    margin-right: 0;
  }

  @media all and (max-width: 500px) {
    flex-direction: column;
  }
`

const Textarea = styled.textarea`
  ${sharedCss};
  background: color-mix(in srgb, ${COLOR_ACCENT} 10%, transparent);
  border: 0;
  color: inherit;
  position: sticky;
  top: 0;
  flex-shrink: 0;
  font-family: 'Jetbrains Mono', Consolas, Monaco, monospace;
  font-size: inherit;
  max-height: 100vh;
  resize: vertical;

  @media all and (max-width: 500px) {
    field-sizing: content;
    max-height: 300px;
    position: relative;
  }
`

const Compiled = styled.div`
  ${sharedCss};
  padding-left: 2rem;
  padding-right: 1rem;
  padding-top: 2rem;
  padding-bottom: 2rem;
  overflow: auto;
  overflow-x: hidden;
`

const ShinyButton = styled.button`
  background: color-mix(in srgb, ${COLOR_ACCENT} 50%, black);
  border: 1px solid color-mix(in srgb, ${COLOR_ACCENT} 50%, transparent);
  border-radius: 2px;
  color: #fff;
  cursor: pointer;
  padding: 0.25em 0.75em;
  font: inherit;
  transition: background 200ms ease;

  &:hover,
  &:focus {
    background: ${COLOR_ACCENT};
  }

  &:active {
    background: color-mix(in srgb, ${COLOR_ACCENT} 80%, black);
  }
`

function MyComponent(props) {
  return (
    <ShinyButton
      {...props}
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
