import TeX from '@matejmazur/react-katex'
import * as React from 'react'
import { createRoot } from 'react-dom/client'

import Markdown, { MarkdownToJSX, RuleType } from './src/react'
import { LavaLamp } from './src/site/lava-lamp'
import { presets, type Preset } from './src/site/presets'
// @ts-ignore
import readmeContentRaw from './README.md?raw'

declare global {
  interface Window {
    hljs: {
      highlightElement: (element: HTMLElement) => void
    }
  }

  const VERSION: string
}

function SyntaxHighlightedCode(props: any) {
  const ref = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (ref.current && props.className?.includes('lang-') && window.hljs) {
      window.hljs.highlightElement(ref.current)
      ref.current.removeAttribute('data-highlighted')
    }
  }, [props.className, props.children])

  return <code {...props} ref={ref} />
}

function MyComponent(props: any) {
  return (
    <button
      {...props}
      className="px-3 py-1 rounded bg-accent/50 border border-accent/50 text-white cursor-pointer transition-colors hover:bg-accent active:bg-accent/80"
      onClick={() => {
        alert("Look ma, I'm a real component!")
      }}
    />
  )
}

const gradient =
  'font-semibold rounded-lg from-0% from-accent to-100% to-green-300 bg-linear-120/increasing bg-size-[200%_200%] animate-gradient text-black hover:bg-none hover:animate-none hover:bg-accent'

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

function PresetSelector({
  onSelect,
  selectedId,
}: {
  onSelect: (preset: Preset) => void
  selectedId: string | null
}) {
  const [loading, setLoading] = React.useState<string | null>(null)

  const handleSelect = React.useCallback(
    async (preset: Preset) => {
      setLoading(preset.id)
      try {
        const content = await preset.load()
        onSelect(preset)
        const event = new CustomEvent('preset-loaded', { detail: content })
        window.dispatchEvent(event)
      } catch (error) {
        console.error('Failed to load preset:', error)
      } finally {
        setLoading(null)
      }
    },
    [onSelect]
  )

  return (
    <div className="flex flex-wrap gap-2 justify-center mb-6 text-sm items-center">
      Other examples →
      <div className="flex flex-wrap gap-2">
        {presets.map(preset => (
          <button
            key={preset.id}
            onClick={() => handleSelect(preset)}
            disabled={loading === preset.id}
            className={`py-1 px-2 text-xs ${
              selectedId === preset.id || loading === preset.id
                ? 'bg-accent text-black'
                : `${gradient}`
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading === preset.id ? 'Loading...' : preset.name}
          </button>
        ))}
      </div>
    </div>
  )
}

function FloatingText({ text }: { text: string }) {
  const letters = React.useMemo(() => {
    return text.split('').map((char, index) => {
      const maxOffset = 3
      const duration = 6 + Math.random() * 4
      const delay = Math.random() * 2

      const offsets = [
        {
          x: (Math.random() - 0.5) * maxOffset * 2,
          y: (Math.random() - 0.5) * maxOffset * 2,
        },
        {
          x: (Math.random() - 0.5) * maxOffset * 2,
          y: (Math.random() - 0.5) * maxOffset * 2,
        },
        {
          x: (Math.random() - 0.5) * maxOffset * 2,
          y: (Math.random() - 0.5) * maxOffset * 2,
        },
      ]

      return {
        char,
        key: index,
        style: {
          '--offset-x-1': `${offsets[0].x}px`,
          '--offset-y-1': `${offsets[0].y}px`,
          '--offset-x-2': `${offsets[1].x}px`,
          '--offset-y-2': `${offsets[1].y}px`,
          '--offset-x-3': `${offsets[2].x}px`,
          '--offset-y-3': `${offsets[2].y}px`,
          '--duration': `${duration}s`,
          '--delay': `${delay}s`,
        } as React.CSSProperties,
      }
    })
  }, [text])

  return (
    <>
      {letters.map(({ char, key, style }) => (
        <span key={key} className="float-letter" style={style}>
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </>
  )
}

function TryItLive() {
  const [markdown, setMarkdown] = React.useState(
    document.getElementById('sample-content')?.textContent?.trim() || ''
  )
  const [selectedPresetId, setSelectedPresetId] = React.useState<string | null>(
    null
  )
  const readmeContent = readmeContentRaw

  React.useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      setMarkdown(customEvent.detail)
    }
    window.addEventListener('preset-loaded', handler)
    return () => window.removeEventListener('preset-loaded', handler)
  }, [])

  const handleInput = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setMarkdown(e.target.value),
    []
  )

  return (
    <main className="flex flex-col items-center justify-center gap-7 pb-20">
      <header className="text-center px-6 pt-20 pb-4">
        <div className=" mx-auto text-base space-y-6">
          <h1 className="text-accent leading-tight">
            <span className="font-display tracking-widest text-[9vw]">
              <FloatingText text="markdown-to-jsx" />
              <span className="text-[max(1vw,16px)] font-sans tracking-wider">
                v{VERSION}
              </span>
            </span>
            <div className="text-base mt-2">
              (now also to html, ast, and markdown)
            </div>
          </h1>
          <p className="text-lg text-fg/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)] max-w-3xl mx-auto leading-relaxed">
            A fast and versatile markdown toolchain, 100% GFM-CommonMark
            compliant.
          </p>

          <div className="flex gap-2 justify-center">
            <a
              className={`no-underline py-1 px-3 backdrop-blur-xs rounded-xl text-sm ${gradient}`}
              href="#docs"
              onClick={e => {
                e.preventDefault()
                const element = document.getElementById('docs')
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' })
                }
              }}
            >
              Jump to docs
            </a>
            <a
              className={`no-underline  py-1 px-3 backdrop-blur-xs rounded-xl text-sm bg-[#2b3137] hover:bg-accent transition-colors`}
              href="https://github.com/quantizor/markdown-to-jsx"
            >
              <img
                src="/images/github.svg"
                alt="GitHub"
                className="h-4 inline-block align-middle -translate-y-0.25"
              />
            </a>
          </div>
        </div>
      </header>

      {/* Full screen lava lamp background */}
      <LavaLamp className="w-full h-full" />

      {/* Editor and Preview positioned over canvas */}
      <section className="flex justify-center gap-0 w-[95%] items-start max-h-[80vh]">
        <div className="flex-1 flex flex-col gap-6 max-w-2xl self-stretch">
          <div className="text-[13px] text-black font-bold uppercase text-center bg-accent px-3 pt-1.5 pb-1 rounded-xl leading-none self-center sticky top-2 z-10">
            Input
          </div>
          <textarea
            onInput={handleInput}
            value={markdown}
            className="flex-1 p-4 backdrop-blur-md rounded-l-2xl border-2 border-accent/20 text-fg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-xl h-full min-h-[400px] border-r-0 selection:bg-accent/40 selection:text-inherit"
          />
        </div>

        <div className="flex-1 flex flex-col gap-6 max-w-2xl self-stretch">
          <div className="text-[13px] text-black font-bold uppercase text-center bg-accent px-3 pt-1.5 pb-1 rounded-xl leading-none self-center w-auto sticky top-2 z-10">
            Output
          </div>
          <div className="prose prose-invert prose-sm p-4 backdrop-blur-md rounded-r-2xl border-2 border-accent/20 border-l-0 h-full overflow-auto w-full max-w-none">
            <Markdown options={options}>{markdown}</Markdown>
          </div>
        </div>
      </section>

      <PresetSelector
        onSelect={preset => setSelectedPresetId(preset.id)}
        selectedId={selectedPresetId}
      />

      <Markdown
        className="max-w-2xl prose prose-invert prose-sm center"
        id="docs"
        options={options}
      >
        {readmeContent}
      </Markdown>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<TryItLive />)
