import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import MarkdownIt from 'markdown-it'
import { marked } from 'marked'
import { micromark } from 'micromark'
import { gfm, gfmHtml } from 'micromark-extension-gfm'
import { parseFragment, serialize } from 'parse5'
import * as html from '../lib/src/html.ts'
import { extractLib } from './checkout-ref.ts'
import { REPO_ROOT } from './metrics-targets.ts'
import { createRandom } from './random.ts'

const OPTION_NAMES = ['breaks'] as const

type OptionName = (typeof OPTION_NAMES)[number]
type Settings = Partial<Record<OptionName, boolean>>
type Renderer = (markdown: string) => string
type Factory = (settings: Settings) => Renderer
type RendererName = keyof typeof RENDERERS
type HtmlModule = Pick<typeof html, 'astToHTML' | 'parser'>

interface Case {
  label: string
  markdown: string
}

interface Side {
  base: RendererName
  name: string
  rev: string | undefined
  settings: Settings
}

const USAGE =
  'usage: bun differential --a <renderer> --b <renderer> [--corpus spec|fuzz] [--count N] [--seed N] [--option <name>] [--limit N]\nRenderers: ours, ours@<rev>, markdown-it, marked, micromark, each with optional +<option> suffixes. Options: breaks. Details: specs/tooling.md, "Differential".'

const BLOCK_TAG_R =
  /\s*(<\/?(?:blockquote|div|h[1-6]|hr|li|ol|p|table|tbody|td|tfoot|th|thead|tr|ul)(?=[\s/>])[^>]*>)\s*/gi
const CODE_FINAL_NEWLINE_R = /\n<\/code><\/pre>/g
const MAX_FUZZ_TOKENS = 24
const MAX_SEED = 2 ** 32 - 1
const OURS_AT = 'ours@'

const FUZZ_TOKENS = [
  '\n',
  '\n\n',
  '\t',
  ' ',
  '  ',
  '    ',
  '!',
  '#',
  '&amp;',
  '(',
  ')',
  '*',
  '**',
  '-',
  '1.',
  '<',
  '</em>',
  '<em>',
  '>',
  '[',
  '\\',
  ']',
  '_',
  '`',
  '```',
  'a',
  'b',
  '|',
  '~~',
]

function oursFrom(mod: HtmlModule): Factory {
  return settings => markdown =>
    mod.astToHTML(mod.parser(markdown, { ...settings, slugify: () => '' }))
}

const RENDERERS = {
  'markdown-it': settings => {
    const md = new MarkdownIt({ html: true, linkify: true, ...settings })
    return markdown => md.render(markdown)
  },
  marked: settings => markdown =>
    marked.parse(markdown, { ...settings, async: false }),
  micromark: () => markdown =>
    micromark(markdown, {
      allowDangerousHtml: true,
      allowDangerousProtocol: true,
      extensions: [gfm()],
      htmlExtensions: [gfmHtml()],
    }),
  ours: oursFrom(html),
} satisfies Record<string, Factory>

const OPTION_RENDERERS = {
  breaks: ['markdown-it', 'marked', 'ours'],
} satisfies Record<OptionName, RendererName[]>

export function normalize(output: string): string {
  return serialize(
    parseFragment(output.replace(BLOCK_TAG_R, '$1').trim())
  ).replace(CODE_FINAL_NEWLINE_R, '</code></pre>')
}

function fail(message: string): never {
  console.error(`${message}\n${USAGE}`)
  process.exit(2)
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isRendererName(name: string): name is RendererName {
  return Object.hasOwn(RENDERERS, name)
}

function isOptionName(name: string): name is OptionName {
  return Object.hasOwn(OPTION_RENDERERS, name)
}

function isHtmlModule(mod: unknown): mod is HtmlModule {
  return (
    typeof mod === 'object' &&
    mod !== null &&
    'astToHTML' in mod &&
    typeof mod.astToHTML === 'function' &&
    'parser' in mod &&
    typeof mod.parser === 'function'
  )
}

function readOption(
  base: RendererName,
  value: string,
  source: string
): OptionName {
  if (!isOptionName(value)) {
    fail(`${source} names an unknown option "${value}".`)
  }
  const supported: readonly RendererName[] = OPTION_RENDERERS[value]
  if (!supported.includes(base)) {
    fail(`${source} names ${value}, which ${base} does not take.`)
  }
  return value
}

function readSide(flag: string, value: string | undefined): Side {
  if (!value) {
    fail(`--${flag} is missing.`)
  }
  const [baseName, ...optionNames] = value.split('+')
  const rev = baseName.startsWith(OURS_AT)
    ? baseName.slice(OURS_AT.length)
    : undefined
  const base = rev === undefined ? baseName : 'ours'
  if (rev === '') {
    fail(`--${flag} names no commit after "${OURS_AT}".`)
  }
  if (!isRendererName(base)) {
    fail(`--${flag} names an unknown renderer "${baseName}".`)
  }
  return {
    base,
    name: value,
    rev,
    settings: Object.fromEntries(
      optionNames.map(option => [readOption(base, option, `--${flag}`), true])
    ),
  }
}

function readCount(flag: string, value: string, max: number): number {
  const count = Number(value)
  if (!Number.isInteger(count) || count < 0 || count > max) {
    fail(`--${flag} must be a whole number from 0 to ${max}, got "${value}".`)
  }
  return count
}

function specCases(): Case[] {
  const examples: { example: number; markdown: string; section: string }[] =
    JSON.parse(
      fs.readFileSync(
        path.join(REPO_ROOT, 'lib/src/commonmark-spec.json'),
        'utf8'
      )
    )
  return examples.map(({ example, markdown, section }) => ({
    label: `example ${example} (${section})`,
    markdown,
  }))
}

function fuzzCases(count: number, seed: number): Case[] {
  const random = createRandom(seed)
  return Array.from({ length: count }, (_, index) => {
    const tokenCount = 1 + Math.floor(random() * MAX_FUZZ_TOKENS)
    let markdown = ''
    for (let t = 0; t < tokenCount; t++) {
      markdown += FUZZ_TOKENS[Math.floor(random() * FUZZ_TOKENS.length)]
    }
    return { label: `seed ${seed} document ${index}`, markdown }
  })
}

function readCases(corpus: string, count: string, seed: string): Case[] {
  if (corpus === 'spec') {
    return specCases()
  }
  if (corpus === 'fuzz') {
    return fuzzCases(
      readCount('count', count, Number.MAX_SAFE_INTEGER),
      readCount('seed', seed, MAX_SEED)
    )
  }
  fail(`--corpus must be spec or fuzz, got "${corpus}".`)
}

function readFlags() {
  try {
    return parseArgs({
      options: {
        a: { type: 'string' },
        b: { type: 'string' },
        corpus: { default: 'spec', type: 'string' },
        count: { default: '2000', type: 'string' },
        limit: { default: '10', type: 'string' },
        option: { type: 'string' },
        seed: { default: '1', type: 'string' },
      },
      strict: true,
    }).values
  } catch (error) {
    fail(messageOf(error))
  }
}

async function loadFactory(side: Side): Promise<Factory> {
  if (side.rev === undefined) {
    return RENDERERS[side.base]
  }
  let root: string
  try {
    root = extractLib(side.rev).root
  } catch (error) {
    fail(messageOf(error))
  }
  const mod: unknown = await import(path.join(root, 'lib/src/html.ts'))
  if (!isHtmlModule(mod)) {
    fail(
      `${side.name}: lib/src/html.ts at ${side.rev} does not export parser and astToHTML, so it cannot render here.`
    )
  }
  return oursFrom(mod)
}

function renderRaw(render: Renderer, markdown: string): string {
  try {
    return render(markdown)
  } catch (error) {
    return `threw: ${messageOf(error)}`
  }
}

async function main() {
  const flags = readFlags()
  const sides = [readSide('a', flags.a), readSide('b', flags.b)]
  const limit = readCount('limit', flags.limit, Number.MAX_SAFE_INTEGER)
  const option = flags.option
  const cases = readCases(flags.corpus, flags.count, flags.seed)

  for (const side of sides) {
    if (option !== undefined) {
      readOption(side.base, option, '--option')
    }
  }

  const factories = [await loadFactory(sides[0]), await loadFactory(sides[1])]
  const without = [
    factories[0](sides[0].settings),
    factories[1](sides[1].settings),
  ]
  const withOption =
    option === undefined
      ? undefined
      : [
          factories[0]({ ...sides[0].settings, [option]: true }),
          factories[1]({ ...sides[1].settings, [option]: true }),
        ]
  const listed: { item: Case; raw: string[] }[] = []
  let differWithout = 0
  let differWith = 0

  for (const item of cases) {
    const rawWithout = [
      renderRaw(without[0], item.markdown),
      renderRaw(without[1], item.markdown),
    ]
    const agreeWithout = normalize(rawWithout[0]) === normalize(rawWithout[1])
    if (!agreeWithout) {
      differWithout++
    }
    if (withOption === undefined) {
      if (!agreeWithout) {
        listed.push({ item, raw: rawWithout })
      }
      continue
    }

    const rawWith = [
      renderRaw(withOption[0], item.markdown),
      renderRaw(withOption[1], item.markdown),
    ]
    if (normalize(rawWith[0]) !== normalize(rawWith[1])) {
      differWith++
      if (agreeWithout) {
        listed.push({ item, raw: rawWith })
      }
    }
  }

  const suffix = option === undefined ? '' : `+${option}`
  console.info(
    option === undefined
      ? `cases=${cases.length} agree=${cases.length - differWithout} differ=${differWithout}`
      : `cases=${cases.length} option=${option} differ_without=${differWithout} differ_with=${differWith} listed=${listed.length}`
  )
  for (const { item, raw } of listed.slice(0, limit)) {
    console.info(
      `\n${item.label}\n  markdown: ${JSON.stringify(item.markdown)}\n  ${sides[0].name}${suffix}: ${JSON.stringify(raw[0])}\n  ${sides[1].name}${suffix}: ${JSON.stringify(raw[1])}`
    )
  }
}

if (import.meta.main) {
  console.warn = () => {}
  await main()
}
