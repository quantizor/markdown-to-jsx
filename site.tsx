/* @jsx React.createElement */
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import styled, { createGlobalStyle, css, CSSProp } from 'styled-components'
import Markdown from './'

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
          href="https://github.com/probablyup/markdown-to-jsx"
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
            href="https://github.com/probablyup/markdown-to-jsx/blob/main/README.md"
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

const COLOR_ACCENT = 'rgba(255, 255, 255, 0.5)'
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
		background: #222;
		color: ${COLOR_BODY};
		font-family: 'Source Sans Pro', Helvetica Neue, Helvetica, sans-serif;
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

	code {
		background: color-mix(in srgb, ${COLOR_ACCENT} 5%, transparent);
		display: inline-block;
		padding: 0 2px;
	}

	pre code {
		background: transparent;
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
  font-size: 18px;
  margin-left: auto;
  margin-right: auto;
  max-width: 60vw;

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
  font-family: 'Source Code Pro', Consolas, Monaco, monospace;
  font-size: inherit;
  max-height: 100vh;

  @media all and (max-width: 500px) {
    height: 300px;
    position: relative;
  }
`

const Compiled = styled.div`
  ${sharedCss};
  padding-left: 2rem;
  padding-right: 1rem;
  overflow: auto;
  overflow-x: hidden;
`

const ShinyButton = styled.button`
  background: #444;
  color: #ddd;
  cursor: pointer;
  font: inherit;
  transition: background 200ms ease;

  &:hover,
  &:focus {
    background: #222;
  }

  &:active {
    background: #000;
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

const options = {
  overrides: {
    MyComponent: {
      component: MyComponent,
    },
  },
}

ReactDOM.render(<TryItLive />, document.getElementById('root'))
