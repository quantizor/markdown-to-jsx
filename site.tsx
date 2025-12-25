import TeX from '@matejmazur/react-katex'
import * as React from 'react'
import { createRoot } from 'react-dom/client'

import Markdown, { MarkdownToJSX, RuleType } from './src/react'
import { presets, type Preset } from './src/site/presets'
import { LANGUAGES, SUPPORTED_LANGUAGES } from './src/i18n/languages'
import { UI_STRINGS } from './src/i18n/ui-strings'

const LavaLamp = React.lazy(() => import('./src/site/lava-lamp').then(m => ({ default: m.LavaLamp })))

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

  const browserLang = (navigator.language || navigator.languages?.[0])?.split('-')[0]
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
  const displayNames = React.useMemo(() => {
    try {
      return new Intl.DisplayNames([lang], { type: 'language' })
    } catch {
      return null
    }
  }, [lang])

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

function TryItLive() {
  const [lang, setLang] = React.useState(detectLanguage)
  const [markdown, setMarkdown] = React.useState('')
  const [selectedPresetId, setSelectedPresetId] = React.useState<string | null>(
    null
  )
  const [readmeContent, setReadmeContent] = React.useState('')

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

  const t = React.useCallback(
    (key: string) => UI_STRINGS[lang]?.[key] || UI_STRINGS.en[key],
    [lang]
  )

  React.useLayoutEffect(() => {
    document.documentElement.lang = lang
    const title = lang === 'en' ? 'markdown-to-jsx' : `markdown-to-jsx | ${LANGUAGES[lang].nativeName}`
    document.title = title
  }, [lang])

  React.useEffect(() => {
    const loadDefaultTemplate = async () => {
      try {
        const module = await import(`./src/i18n/${lang}/default-template.md?raw`)
        setMarkdown(module.default)
      } catch (error) {
        // Fallback to English
        const module = await import(`./src/i18n/en/default-template.md?raw`)
        setMarkdown(module.default)
      }
    }
    loadDefaultTemplate()
  }, [lang])

  React.useEffect(() => {
    const loadReadme = async () => {
      try {
        const module = await import(`./src/i18n/${lang}/README.md?raw`)
        setReadmeContent(module.default)
      } catch (error) {
        // Fallback to English
        const module = await import(`./src/i18n/en/README.md?raw`)
        setReadmeContent(module.default)
      }
    }
    loadReadme()
  }, [lang])

  const handleLangChange = (newLang: string) => {
    setLang(newLang)
    localStorage.setItem('markdown-to-jsx-lang', newLang)
    // Update URL without reload
    const url = new URL(window.location.href)
    url.searchParams.set('lang', newLang)
    window.history.pushState({}, '', url)
  }

  React.useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      setMarkdown(customEvent.detail)
    }
    window.addEventListener('preset-loaded', handler)
    return () => window.removeEventListener('preset-loaded', handler)
  }, [])

  React.useEffect(() => {
    const handleHashLink = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a') as HTMLAnchorElement
      if (anchor?.hash) {
        const element = document.getElementById(anchor.hash.slice(1))
        if (element) {
          e.preventDefault()
          element.scrollIntoView({ behavior: 'smooth' })
        }
      }
    }

    document.addEventListener('click', handleHashLink)
    return () => document.removeEventListener('click', handleHashLink)
  }, [])

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

      <div className="relative group max-w-full lg:max-w-2xl w-full">
        {lang !== 'en' && (
          <a
            href={`https://github.com/quantizor/markdown-to-jsx/edit/main/src/i18n/${lang}/README.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute -top-8 right-0 text-[10px] text-accent/50 hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity no-underline"
          >
            {t('editTranslation')}
          </a>
        )}
        <Markdown
          className="prose prose-invert prose-sm center"
          id="docs"
          options={options}
        >
          {readmeContent}
        </Markdown>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<TryItLive />)
