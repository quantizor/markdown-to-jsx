import * as fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import type Benchmark from 'benchmark'
import BenchTable from 'benchtable'
import cliProgress from 'cli-progress'
import MarkdownIt from 'markdown-it'
import { compiler as htmlCompiler } from 'markdown-to-jsx/html'
import { compiler, parser } from 'markdown-to-jsx/react'
import { compiler as latestHtmlCompiler } from 'markdown-to-jsx-latest/html'
import {
  compiler as latestCompiler,
  parser as latestParser,
} from 'markdown-to-jsx-latest/react'
import { marked } from 'marked'
import * as prod from 'react/jsx-runtime'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeReact from 'rehype-react'
import { remark } from 'remark'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import SimpleMarkdown from 'simple-markdown'

const { version: latestVersion } = JSON.parse(
  fs.readFileSync(
    require.resolve('markdown-to-jsx-latest/package.json'),
    'utf8'
  )
)

const mdIt = new MarkdownIt()
const suite = new BenchTable('markdown-to-jsx benchmark')

const fixture = fs.readFileSync(
  path.join(import.meta.dirname, '..', 'lib/src/markdown-spec.md'),
  'utf8'
)
const largeFixture = fs.readFileSync(
  path.join(import.meta.dirname, '..', 'lib/src/gfm-spec.md'),
  'utf8'
)

// @ts-expect-error - rehype-react types may be incomplete
const production = { Fragment: prod.Fragment, jsx: prod.jsx, jsxs: prod.jsxs }

const rehypeProcessor = remark()
  .use(remarkGfm)
  .use(remarkDirective)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeReact, production)

const remarkParseProcessor = remark().use(remarkGfm).use(remarkDirective)

const bar = new cliProgress.SingleBar(
  {
    clearOnComplete: true,
  },
  cliProgress.Presets.shades_classic
)
let totalCycles: number

const isAll = process.argv.includes('--all')
const isJsx = process.argv.includes('--jsx')
const shouldUpdateSnapshot = process.argv.includes('-u')
const isHtml = process.argv.includes('--html')

const ANSI_GREEN_FOR_IMPROVEMENT = '\u001b[32m'
const ANSI_RED_FOR_REGRESSION = '\u001b[31m'
const SIGNIFICANT_CHANGE_PERCENT = 2

interface Test {
  name: string
  fn: (input: any) => any
}

const parseTests = [
  {
    name: 'markdown-to-jsx (next) [parse]',
    fn: input => parser(input),
  },
  {
    name: `markdown-to-jsx (${latestVersion}) [parse]`,
    fn: input => latestParser(input),
  },
  isAll && {
    name: 'rehype [parse]',
    fn: input => remarkParseProcessor.processSync(input),
  },
  isAll && {
    name: 'simple-markdown [parse]',
    fn: input => SimpleMarkdown.defaultBlockParse(input),
  },
  isAll && {
    name: 'markdown-it [parse]',
    fn: input => mdIt.parse(input, {}),
  },
  isAll && {
    name: 'marked [parse]',
    fn: input => marked.parse(input, {}),
  },
].filter(Boolean) as Test[]

const jsxTests = [
  {
    name: 'markdown-to-jsx (next) [jsx]',
    fn: input => compiler(input),
  },
  {
    name: `markdown-to-jsx (${latestVersion}) [jsx]`,
    fn: input => latestCompiler(input),
  },
  isAll && {
    name: 'rehype [jsx]',
    fn: input => rehypeProcessor.processSync(input).result,
  },
  isAll && {
    name: 'simple-markdown [jsx]',
    fn: input =>
      SimpleMarkdown.defaultReactOutput(
        SimpleMarkdown.defaultBlockParse(input)
      ),
  },
  isAll && {
    name: 'react-markdown [jsx]',
    fn: input => ReactMarkdown({ children: input }),
  },
  (isAll || isJsx) && {
    name: 'Bun.markdown [jsx]',
    fn: input => Bun.markdown.react(input),
  },
].filter(Boolean) as Test[]

const htmlTests = [
  (isAll || isHtml) && {
    name: 'markdown-to-jsx (next) [html]',
    fn: input => htmlCompiler(input),
  },
  (isAll || isHtml) && {
    name: `markdown-to-jsx (${latestVersion}) [html]`,
    fn: input => latestHtmlCompiler(input),
  },
  (isAll || isHtml) && {
    name: 'Bun.markdown [html]',
    fn: input => Bun.markdown.html(input),
  },
  (isAll || isHtml) && {
    name: 'markdown-it [html]',
    fn: input => mdIt.render(input),
  },
].filter(Boolean) as Test[]

async function setupBenchmark() {
  const evals = suite

  for (const test of parseTests) {
    evals.addFunction(test.name, test.fn, {})
  }

  if (isAll || isJsx) {
    for (const test of jsxTests) {
      evals.addFunction(test.name, test.fn, {})
    }
  }

  if (isAll || isHtml) {
    for (const test of htmlTests) {
      evals.addFunction(test.name, test.fn, {})
    }
  }

  evals
    .addInput('1kB markdown string', ['_Hello_ **world**!'])
    .addInput('27kB markdown string', [fixture])
    .addInput('211kB markdown string', [largeFixture])
    .on('start', () => {
      totalCycles = suite._counter
      bar.start(totalCycles, 0)
      if (typeof global !== 'undefined' && global.gc) {
        global.gc()
      }
    })
    .on('cycle', () => {
      bar.update(totalCycles - (suite._counter ?? 0))
      if (typeof global !== 'undefined' && global.gc) {
        global.gc()
      }
    })
    .on('abort error complete', () => bar.stop())
    .on('complete', () => {
      console.log(`Fastest is ${suite.filter('fastest').map('name')}`)
      console.log(suite.table.toString())

      const filteredResults: Record<string, any[]> = {}
      if (suite._results) {
        Object.entries(suite._results).forEach(([functionName, benchmarks]) => {
          if (functionName.includes('markdown-to-jsx (next)')) {
            filteredResults[functionName] = benchmarks
          }
        })
      }

      const results = {
        timestamp: new Date().toISOString(),
        fastest: suite.filter('fastest').map('name'),
        results: filteredResults,
      }

      if (shouldUpdateSnapshot) {
        fs.writeFileSync(
          path.join(import.meta.dirname, 'bench.baseline.json'),
          JSON.stringify(results, null, 2)
        )
        console.log('Performance baseline updated!')
      }

      const baselinePath = path.join(import.meta.dirname, 'bench.baseline.json')
      if (fs.existsSync(baselinePath) && !shouldUpdateSnapshot) {
        try {
          const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))

          console.log('\n=== Performance vs Baseline ===')

          if (suite._results && baseline.results) {
            var prevGroup = ''
            Object.entries(suite._results).forEach(
              ([functionName, benchmarks]: [string, Benchmark[]]) => {
                if (functionName.includes('markdown-to-jsx (next)')) {
                  var group = functionName.replace(/.*\[(\w+)\].*/, '$1')
                  if (prevGroup && group !== prevGroup) {
                    console.log()
                  }
                  prevGroup = group
                  benchmarks.forEach(benchmark => {
                    if (benchmark?.name && benchmark.hz) {
                      const baselineBenchmarks = baseline.results[functionName]
                      const baselineBenchmark = baselineBenchmarks?.find(
                        (b: any) => b.name === benchmark.name
                      )

                      if (baselineBenchmark?.hz) {
                        const currentHz = benchmark.hz
                        const baselineHz = baselineBenchmark.hz
                        const ratio = currentHz / baselineHz
                        const changePercent = (ratio - 1) * 100
                        const change = changePercent.toFixed(1)
                        const symbol = ratio > 1 ? '↑' : ratio < 1 ? '↓' : '→'

                        const absChange = Math.abs(changePercent)
                        const isSignificant =
                          absChange > SIGNIFICANT_CHANGE_PERCENT
                        const colorCode = isSignificant
                          ? changePercent > 0
                            ? ANSI_GREEN_FOR_IMPROVEMENT
                            : ANSI_RED_FOR_REGRESSION
                          : ''
                        const resetCode = isSignificant ? '\u001b[39m' : ''

                        const displayName = benchmark.name
                          .replace(' for inputs 1kB markdown string', ' (1kB)')
                          .replace(
                            ' for inputs 27kB markdown string',
                            ' (27kB)'
                          )
                          .replace(
                            ' for inputs 211kB markdown string',
                            ' (211kB)'
                          )

                        console.log(
                          `${displayName}: ${Math.round(
                            baselineHz
                          ).toLocaleString()} ops/sec (${symbol}${colorCode}${change}%${resetCode})`
                        )
                      }
                    }
                  })
                }
              }
            )
          }
        } catch {
          console.log('Could not load baseline for comparison')
        }
      }
    })
    .run({ async: true, initCount: 50 })
}

setupBenchmark()
