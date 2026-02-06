import BenchTable from 'benchtable'
import cliProgress from 'cli-progress'
import * as fs from 'fs'
import MarkdownIt from 'markdown-it'
import {
  compiler as latestCompiler,
  parser as latestParser,
} from 'markdown-to-jsx-latest/react'
import {
  compiler as latestHtmlCompiler,
} from 'markdown-to-jsx-latest/html'
import path from 'path'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeReact from 'rehype-react'
import { remark } from 'remark'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import SimpleMarkdown from 'simple-markdown'
// @ts-ignore - react/jsx-runtime types may be incomplete
import Benchmark from 'benchmark'
import { marked } from 'marked'
import * as prod from 'react/jsx-runtime'
import { compiler, parser } from 'markdown-to-jsx/react'
import { compiler as htmlCompiler } from 'markdown-to-jsx/html'

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

// Set up rehype processor with all plugins to match markdown-to-jsx features
// @ts-ignore - rehype-react types may be incomplete
const production = { Fragment: prod.Fragment, jsx: prod.jsx, jsxs: prod.jsxs }

const rehypeProcessor = remark()
  .use(remarkGfm) // GFM tables, task lists, autolinks, strikethrough, footnotes
  .use(remarkDirective) // Directives like [!NOTE] (though may not match exactly)
  .use(remarkRehype, { allowDangerousHtml: true }) // Convert mdast to hast
  .use(rehypeRaw) // Process HTML in markdown
  .use(rehypeReact, production) // Convert hast to React

// Create a parse-only processor for AST benchmarks
const remarkParseProcessor = remark()
  .use(remarkGfm) // GFM tables, task lists, autolinks, strikethrough, footnotes
  .use(remarkDirective)

const bar = new cliProgress.SingleBar(
  {
    clearOnComplete: true,
  },
  cliProgress.Presets.shades_classic
)
let totalCycles

const isAll = process.argv.includes('--all')
const isJsx = process.argv.includes('--jsx')
const shouldUpdateSnapshot = process.argv.includes('-u')
const isHtml = process.argv.includes('--html')

type Test = {
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
  let evals = suite

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
      // Memory cleanup between cycles
      if (typeof global !== 'undefined' && global.gc) {
        global.gc()
      }
    })
    .on('cycle', () => {
      bar.update(totalCycles - (suite._counter ?? 0))
      // Memory cleanup between cycles
      if (typeof global !== 'undefined' && global.gc) {
        global.gc()
      }
    })
    .on('abort error complete', () => bar.stop())
    .on('complete', function () {
      console.log('Fastest is ' + suite.filter('fastest').map('name'))
      console.log(suite.table.toString())

      // Filter to only store markdown-to-jsx (next) results for baseline comparison
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

      // Load and compare against baseline (only when not updating)
      const baselinePath = path.join(import.meta.dirname, 'bench.baseline.json')
      if (fs.existsSync(baselinePath) && !shouldUpdateSnapshot) {
        try {
          const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))

          console.log('\n=== Performance vs Baseline ===')

          // Compare results - only show markdown-to-jsx (next) comparisons
          if (suite._results && baseline.results) {
            Object.entries(suite._results).forEach(
              ([functionName, benchmarks]: [string, Benchmark[]]) => {
                // Only compare markdown-to-jsx (next) results
                if (functionName.includes('markdown-to-jsx (next)')) {
                  benchmarks.forEach(benchmark => {
                    if (benchmark && benchmark.name && benchmark.hz) {
                      // Find corresponding benchmark in baseline
                      const baselineBenchmarks = baseline.results[functionName]
                      const baselineBenchmark = baselineBenchmarks?.find(
                        (b: any) => b.name === benchmark.name
                      )

                      if (baselineBenchmark && baselineBenchmark.hz) {
                        const currentHz = benchmark.hz
                        const baselineHz = baselineBenchmark.hz
                        const ratio = currentHz / baselineHz
                        const changePercent = (ratio - 1) * 100
                        const change = changePercent.toFixed(1)
                        const symbol = ratio > 1 ? '↑' : ratio < 1 ? '↓' : '→'

                        // Colorize only for statistically meaningful changes (>2% absolute)
                        const absChange = Math.abs(changePercent)
                        const isSignificant = absChange > 2
                        const colorCode = isSignificant
                          ? changePercent > 0
                            ? '\u001b[32m'
                            : '\u001b[31m' // green for improvement, red for regression
                          : ''
                        const resetCode = isSignificant ? '\u001b[39m' : ''

                        // Clean up the test name for display
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
        } catch (e) {
          console.log('Could not load baseline for comparison')
        }
      }
    })
    // run async
    .run({ async: true, initCount: 50 })
}

setupBenchmark()
