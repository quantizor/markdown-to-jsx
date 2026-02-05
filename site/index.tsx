import TeX from '@matejmazur/react-katex'
import * as React from 'react'
import { createRoot } from 'react-dom/client'

import Markdown, { MarkdownToJSX, RuleType } from '../lib/src/react'
import { presets, type Preset } from './presets'
import { LANGUAGES, SUPPORTED_LANGUAGES } from '../lib/src/i18n/languages'
import { UI_STRINGS } from '../lib/src/i18n/ui-strings'

const LavaLamp = React.lazy(() =>
  import('./lava-lamp').then(m => ({ default: m.LavaLamp }))
)

declare global {
  interface Window {
    hljs: {
      highlightElement: (element: HTMLElement) => void
    }
  }

  const VERSION: string
}

const detectLanguage = (): string => {
  if (typeof window === 'undefined') return 'en'
  const urlParams = new URLSearchParams(window.location.search)
  const langParam = urlParams.get('lang')
  if (langParam && SUPPORTED_LANGUAGES.includes(langParam)) return langParam

  const stored = localStorage.getItem('markdown-to-jsx-lang')
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored

  const browserLang = (navigator.language || navigator.languages?.[0])?.split(
    '-'
  )[0]
  return SUPPORTED_LANGUAGES.includes(browserLang) ? browserLang : 'en'
}

function SyntaxHighlightedCode(props: any) {
  const ref = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (ref.current && window.hljs) {
      const className = props.className
      if (className && className.indexOf('lang-') !== -1) {
        window.hljs.highlightElement(ref.current)
        ref.current.removeAttribute('data-highlighted')
      }
    }
  }, [props.className, props.children])

  return <code {...props} ref={ref} />
}

function MyComponent({ lang, ...props }: any) {
  const t = (key: string) => UI_STRINGS[lang]?.[key] || UI_STRINGS.en[key]
  return (
    <button
      {...props}
      className="px-3 py-1 rounded bg-accent/50 border border-accent/50 text-white cursor-pointer transition-colors hover:bg-accent active:bg-accent/80"
      onClick={() => {
        alert(t('demoAlert'))
      }}
    />
  )
}

const gradient =
  'font-semibold rounded-lg from-0% from-accent to-100% to-green-300 bg-linear-120/increasing bg-size-[200%_200%] animate-gradient text-black hover:bg-none hover:animate-none hover:bg-accent'

const buttonBase =
  'font-semibold rounded-lg text-black hover:bg-none hover:animate-none hover:bg-accent'

function PresetSelector({
  onSelect,
  selectedId,
  lang,
}: {
  onSelect: (id: string) => void
  selectedId: string | null
  lang: string
}) {
  const [loading, setLoading] = React.useState<string | null>(null)
  const t = React.useCallback(
    (key: string) => UI_STRINGS[lang]?.[key] || UI_STRINGS.en[key],
    [lang]
  )

  const handleSelect = React.useCallback(
    async (preset: Preset) => {
      setLoading(preset.id)
      try {
        const content = await preset.load(lang)
        onSelect(preset.id)
        window.dispatchEvent(
          new CustomEvent('preset-loaded', { detail: content })
        )
      } catch (error) {
        console.error('Failed to load preset:', error)
      } finally {
        setLoading(null)
      }
    },
    [onSelect, lang]
  )

  return (
    <div className="hidden md:flex flex-wrap gap-2 justify-center mb-6 text-sm items-center">
      {t('otherExamples')} →
      <div className="flex flex-wrap gap-2">
        {presets.map(preset => (
          <button
            key={preset.id}
            onClick={() => handleSelect(preset)}
            disabled={loading === preset.id}
            className={`py-1 px-2 text-xs ${buttonBase} ${
              selectedId === preset.id || loading === preset.id
                ? 'bg-accent'
                : 'from-0% from-accent to-100% to-green-300 bg-linear-120/increasing bg-size-[200%_200%] animate-gradient'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading === preset.id ? t('loading') : t(preset.nameKey)}
          </button>
        ))}
      </div>
    </div>
  )
}

function FloatingText({ text }: { text: string }) {
  const letters = text.split('').map((char, index) => {
    const maxOffset = 3
    const duration = 6 + Math.random() * 4
    const delay = Math.random() * 2
    const r1 = Math.random() - 0.5
    const r2 = Math.random() - 0.5
    const r3 = Math.random() - 0.5
    const r4 = Math.random() - 0.5
    const r5 = Math.random() - 0.5
    const r6 = Math.random() - 0.5

    return (
      <span
        key={index}
        className="float-letter"
        style={
          {
            '--offset-x-1': `${r1 * maxOffset * 2}px`,
            '--offset-y-1': `${r2 * maxOffset * 2}px`,
            '--offset-x-2': `${r3 * maxOffset * 2}px`,
            '--offset-y-2': `${r4 * maxOffset * 2}px`,
            '--offset-x-3': `${r5 * maxOffset * 2}px`,
            '--offset-y-3': `${r6 * maxOffset * 2}px`,
            '--duration': `${duration}s`,
            '--delay': `${delay}s`,
          } as React.CSSProperties
        }
      >
        {char === ' ' ? '\u00A0' : char}
      </span>
    )
  })

  return <>{letters}</>
}

function LanguageSwitcher({
  lang,
  onChange,
}: {
  lang: string
  onChange: (lang: string) => void
}) {
  return (
    <div className="flex gap-4 items-center">
      {SUPPORTED_LANGUAGES.map(code => (
        <button
          key={code}
          onClick={() => onChange(code)}
          className={`text-xs transition-colors cursor-pointer ${
            lang === code ? 'text-accent font-bold' : 'text-fg/60 hover:text-fg'
          }`}
        >
          {LANGUAGES[code].nativeName}
        </button>
      ))}
    </div>
  )
}

function StreamingSlider({
  value,
  max,
  onChange,
  isPlaying,
  onPlayToggle,
  optimizeEnabled,
  onOptimizeToggle,
  isInteracted,
  onInteract,
}: {
  value: number
  max: number
  onChange: (value: number) => void
  isPlaying: boolean
  onPlayToggle: () => void
  optimizeEnabled: boolean
  onOptimizeToggle: (enabled: boolean) => void
  isInteracted: boolean
  onInteract: () => void
}) {
  const progress = max > 0 ? (value / max) * 100 : 0

  return (
    <div
      className={`hidden md:flex streaming-slider-container fixed -bottom-px left-0 right-0 flex-row items-center gap-4 px-6 py-3 backdrop-blur-md border-t border-white/10 z-50 ${isInteracted ? ' slider-interacted' : ''}`}
    >
      <button
        onClick={() => {
          onInteract()
          onPlayToggle()
        }}
        className="w-8 h-8 rounded-full bg-accent/80 hover:bg-accent flex items-center justify-center text-black transition-colors shrink-0"
        title={isPlaying ? 'Pause' : 'Play streaming demo'}
      >
        {isPlaying ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <rect x="1" y="1" width="3" height="10" />
            <rect x="8" y="1" width="3" height="10" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <polygon points="2,0 12,6 2,12" />
          </svg>
        )}
      </button>
      <input
        type="range"
        min="0"
        max={max}
        value={value}
        onChange={e => {
          onInteract()
          onChange(parseInt(e.target.value, 10))
        }}
        className="streaming-slider flex-1"
        style={
          {
            '--progress': `${progress}%`,
          } as React.CSSProperties
        }
      />
      <span className="text-xs text-fg/60 font-mono whitespace-nowrap shrink-0">
        {value}/{max}
      </span>
      <label
        className="flex items-center gap-1.5 cursor-pointer shrink-0"
        title="When enabled, suppresses incomplete markdown syntax (bold, italic, links, etc.) during streaming to prevent visual flickering. Disable to see the raw incomplete syntax."
      >
        <input
          type="checkbox"
          checked={optimizeEnabled}
          onChange={e => {
            onInteract()
            onOptimizeToggle(e.target.checked)
          }}
          className="w-4 h-4 accent-accent cursor-pointer"
        />
        <span className="text-xs text-fg/60 whitespace-nowrap">optimize</span>
      </label>
    </div>
  )
}

type StreamingState = {
  charCount: number | null
  isPlaying: boolean
  optimizeEnabled: boolean
  interacted: boolean
}

type StreamingAction =
  | { type: 'RESET' }
  | { type: 'SET_CHAR_COUNT'; payload: number | null }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'TOGGLE_OPTIMIZE' }
  | { type: 'SET_INTERACTED' }
  | { type: 'INCREMENT_CHAR'; maxLength: number }

function streamingReducer(
  state: StreamingState,
  action: StreamingAction
): StreamingState {
  switch (action.type) {
    case 'RESET':
      return {
        charCount: null,
        isPlaying: false,
        optimizeEnabled: true,
        interacted: state.interacted,
      }
    case 'SET_CHAR_COUNT':
      return { ...state, charCount: action.payload, isPlaying: false }
    case 'PLAY':
      return { ...state, isPlaying: true }
    case 'PAUSE':
      return { ...state, isPlaying: false }
    case 'TOGGLE_PLAY':
      return { ...state, isPlaying: !state.isPlaying }
    case 'TOGGLE_OPTIMIZE':
      return { ...state, optimizeEnabled: !state.optimizeEnabled }
    case 'SET_INTERACTED':
      return { ...state, interacted: true }
    case 'INCREMENT_CHAR': {
      const next = (state.charCount ?? 0) + 1
      if (next >= action.maxLength) {
        return { ...state, charCount: action.maxLength, isPlaying: false }
      }
      return { ...state, charCount: next }
    }
    default:
      return state
  }
}

function TryItLive() {
  const [lang, setLang] = React.useState(detectLanguage)
  const [markdown, setMarkdown] = React.useState('')
  const [selectedPresetId, setSelectedPresetId] = React.useState<string | null>(
    null
  )
  const [readmeContent, setReadmeContent] = React.useState('')

  const [streaming, dispatchStreaming] = React.useReducer(streamingReducer, {
    charCount: null,
    isPlaying: false,
    optimizeEnabled: true,
    interacted: false,
  })
  const playIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null
  )

  const options = React.useMemo(
    () =>
      ({
        overrides: {
          code: SyntaxHighlightedCode,
          MyComponent: {
            component: MyComponent,
            props: { lang },
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
      }) as MarkdownToJSX.Options,
    [lang]
  )

  const streamingOptions = React.useMemo(
    () =>
      ({
        ...options,
        optimizeForStreaming:
          streaming.charCount !== null && streaming.optimizeEnabled,
      }) as MarkdownToJSX.Options,
    [options, streaming.charCount, streaming.optimizeEnabled]
  )

  const t = React.useCallback(
    (key: string) => UI_STRINGS[lang]?.[key] || UI_STRINGS.en[key],
    [lang]
  )

  React.useLayoutEffect(() => {
    document.documentElement.lang = lang
    const title =
      lang === 'en'
        ? 'markdown-to-jsx'
        : `markdown-to-jsx | ${LANGUAGES[lang].nativeName}`
    document.title = title
  }, [lang])

  React.useEffect(() => {
    const loadI18nFiles = async () => {
      try {
        const module = await import(
          `../lib/src/i18n/${lang}/default-template.md?raw`
        )
        setMarkdown(module.default)
      } catch (error) {
        const module = await import(`../lib/src/i18n/en/default-template.md?raw`)
        setMarkdown(module.default)
      }

      try {
        const module = await import(`../lib/src/i18n/${lang}/README.md?raw`)
        setReadmeContent(module.default)
        dispatchStreaming({ type: 'RESET' })
      } catch (error) {
        const module = await import(`../lib/src/i18n/en/README.md?raw`)
        setReadmeContent(module.default)
        dispatchStreaming({ type: 'RESET' })
      }
    }
    loadI18nFiles()
  }, [lang])

  const handleLangChange = React.useCallback((newLang: string) => {
    setLang(newLang)
    localStorage.setItem('markdown-to-jsx-lang', newLang)
    const url = new URL(window.location.href)
    url.searchParams.set('lang', newLang)
    window.history.pushState({}, '', url)
  }, [])

  const handlePresetLoaded = React.useCallback((e: Event) => {
    const customEvent = e as CustomEvent<string>
    setMarkdown(customEvent.detail)
  }, [])

  React.useEffect(() => {
    window.addEventListener('preset-loaded', handlePresetLoaded)
    return () => window.removeEventListener('preset-loaded', handlePresetLoaded)
  }, [handlePresetLoaded])

  const handleHashLink = React.useCallback((e: MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest('a') as HTMLAnchorElement
    if (anchor?.hash) {
      const element = document.getElementById(anchor.hash.slice(1))
      if (element) {
        e.preventDefault()
        element.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [])

  React.useEffect(() => {
    document.addEventListener('click', handleHashLink)
    return () => document.removeEventListener('click', handleHashLink)
  }, [handleHashLink])

  React.useEffect(() => {
    if (streaming.isPlaying && readmeContent) {
      playIntervalRef.current = setInterval(() => {
        dispatchStreaming({
          type: 'INCREMENT_CHAR',
          maxLength: readmeContent.length,
        })
      }, 5)
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current)
      playIntervalRef.current = null
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current)
      }
    }
  }, [streaming.isPlaying, readmeContent])

  React.useEffect(() => {
    if (
      streaming.isPlaying &&
      streaming.charCount !== null &&
      streaming.charCount > 0
    ) {
      const docsElement = document.getElementById('docs')
      if (docsElement) {
        const rect = docsElement.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const sliderHeight = 60
        const bottomThreshold = viewportHeight - sliderHeight - 100

        if (rect.bottom > bottomThreshold) {
          window.scrollBy({ top: 2, behavior: 'instant' })
        }
      }
    }
  }, [streaming.isPlaying, streaming.charCount])

  const handlePlayToggle = React.useCallback(() => {
    if (streaming.isPlaying) {
      dispatchStreaming({ type: 'PAUSE' })
    } else {
      if (
        streaming.charCount === null ||
        streaming.charCount >= readmeContent.length
      ) {
        dispatchStreaming({ type: 'SET_CHAR_COUNT', payload: 0 })
      }
      dispatchStreaming({ type: 'PLAY' })
    }
  }, [streaming.isPlaying, streaming.charCount, readmeContent.length])

  const handleSliderChange = React.useCallback((value: number) => {
    dispatchStreaming({ type: 'SET_CHAR_COUNT', payload: value })
  }, [])

  const handleOptimizeToggle = React.useCallback(
    (enabled: boolean) => {
      if (streaming.optimizeEnabled !== enabled) {
        dispatchStreaming({ type: 'TOGGLE_OPTIMIZE' })
      }
    },
    [streaming.optimizeEnabled]
  )

  const handleInteract = React.useCallback(() => {
    if (!streaming.interacted) {
      dispatchStreaming({ type: 'SET_INTERACTED' })
    }
  }, [streaming.interacted])

  const displayedReadmeContent = React.useMemo(
    () =>
      streaming.charCount !== null
        ? readmeContent.slice(0, streaming.charCount)
        : readmeContent,
    [streaming.charCount, readmeContent]
  )

  return (
    <main className="flex flex-col items-center justify-center gap-7 pb-20 px-6 lg:px-0">
      <header className="text-center pt-20 pb-4">
        <div className=" mx-auto text-base space-y-6">
          <h1 className="text-accent leading-tight">
            <span className="font-display tracking-widest text-[15vw] lg:text-[9vw]">
              <FloatingText text="markdown-to-jsx" />
              <span className="text-[max(1vw,16px)] font-sans tracking-wider">
                v{VERSION}
              </span>
            </span>
          </h1>
          <p className="text-lg text-fg/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)] max-w-3xl mx-auto leading-relaxed">
            {t('siteDesc')}
          </p>

          <div className="flex gap-4 justify-center items-center">
            <a
              className={`hidden md:inline-block no-underline py-1 px-3 backdrop-blur-xs rounded-xl text-sm ${gradient}`}
              href="#docs"
            >
              {t('jumpToDocs')}
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
            <LanguageSwitcher lang={lang} onChange={handleLangChange} />
          </div>
        </div>
      </header>

      {/* Full screen lava lamp background */}
      <React.Suspense fallback={null}>
        <LavaLamp className="w-full h-full" />
      </React.Suspense>

      {/* Editor and Preview positioned over canvas */}
      <section className="hidden md:flex justify-center gap-0 w-[95%] items-start min-h-[400px] max-h-[80vh]">
        <div className="w-1/2 flex flex-col gap-6 self-stretch">
          <div className="text-[13px] text-black font-bold uppercase text-center bg-accent px-3 pt-1.25 pb-1 rounded-xl leading-none self-center sticky top-2 z-10">
            {t('input')}
          </div>
          <textarea
            onInput={e => setMarkdown(e.currentTarget.value)}
            value={markdown}
            className="flex-1 p-4 backdrop-blur-md rounded-l-2xl border-2 border-accent/20 text-fg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-xl h-full border-r-0 selection:bg-accent/40 selection:text-inherit"
          />
        </div>

        <div className="w-1/2 flex flex-col gap-6 self-stretch">
          <div className="text-[13px] text-black font-bold uppercase text-center bg-accent px-3 pt-1.25 pb-1 rounded-xl leading-none self-center w-auto sticky top-2 z-10">
            {t('output')}
          </div>
          <div className="prose prose-invert prose-sm p-4 backdrop-blur-md rounded-r-2xl border-2 border-accent/20 border-l-0 h-full overflow-auto w-full max-w-none">
            <Markdown options={options}>{markdown}</Markdown>
          </div>
        </div>
      </section>

      <PresetSelector
        onSelect={setSelectedPresetId}
        selectedId={selectedPresetId}
        lang={lang}
      />

      {readmeContent && (
        <StreamingSlider
          value={streaming.charCount ?? readmeContent.length}
          max={readmeContent.length}
          onChange={handleSliderChange}
          isPlaying={streaming.isPlaying}
          onPlayToggle={handlePlayToggle}
          optimizeEnabled={streaming.optimizeEnabled}
          onOptimizeToggle={handleOptimizeToggle}
          isInteracted={streaming.interacted}
          onInteract={handleInteract}
        />
      )}

      <div className="relative w-screen -mx-6 lg:mx-0 lg:w-full backdrop-blur-md bg-transparent">
        <div className="group max-w-full lg:max-w-2xl w-full mx-auto px-6 lg:px-8 py-8">
          {lang !== 'en' && (
            <a
              href={`https://github.com/quantizor/markdown-to-jsx/edit/main/lib/src/i18n/${lang}/README.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute -top-8 right-6 lg:right-8 text-[10px] text-accent/50 hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity no-underline"
            >
              {t('editTranslation')}
            </a>
          )}

          <Markdown
            className="prose prose-invert prose-sm center mx-auto"
            id="docs"
            options={streamingOptions}
          >
            {displayedReadmeContent}
          </Markdown>
        </div>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<TryItLive />)
