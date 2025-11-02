import BenchTable from 'benchtable'
import cliProgress from 'cli-progress'
import * as fs from 'fs'
import MarkdownIt from 'markdown-it'
import { compiler as latestCompiler } from 'markdown-to-jsx-latest'
import path from 'path'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeReact from 'rehype-react'
import { remark } from 'remark'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import SimpleMarkdown from 'simple-markdown'
import { compiler } from './dist/index.module.js'
// @ts-ignore - react/jsx-runtime types may be incomplete
import * as prod from 'react/jsx-runtime'

const { version: latestVersion } = JSON.parse(
  fs.readFileSync(
    path.join(
      import.meta.dirname,
      'node_modules/markdown-to-jsx-latest/package.json'
    ),
    'utf8'
  )
)

const mdIt = new MarkdownIt()
const suite = new BenchTable()

const fixture = fs.readFileSync('./src/fixture.md', 'utf8')

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
// const isHtml = process.argv.includes('--html')

type Test = {
  name: string
  fn: (input: any) => any
}

const parseTests = [
  {
    name: 'markdown-to-jsx (next) [parse]',
    fn: input => compiler(input, { ast: true }),
  },
  {
    name: `markdown-to-jsx (${latestVersion}) [parse]`,
    fn: input => latestCompiler(input, { ast: true }),
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
    fn: input => mdIt.parse(input),
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
].filter(Boolean) as Test[]

const htmlTests = [
  isAll && {
    name: 'markdown-it [html]',
    fn: input => mdIt.render(input),
  },
].filter(Boolean) as Test[]

async function setupBenchmark() {
  let evals = suite

  for (const test of parseTests) {
    evals.addFunction(test.name, test.fn)
  }

  if (isAll || isJsx) {
    for (const test of jsxTests) {
      evals.addFunction(test.name, test.fn)
    }

    // if (isAll || isHtml) {
    //   for (const test of htmlTests) {
    //     evals.addFunction(test.name, test.fn)
    //   }
    // }
  }

  evals
    .addInput('simple markdown string', ['_Hello_ **world**!'])
    .addInput('large markdown string', [fixture])
    .on('start', () => {
      totalCycles = suite._counter
      bar.start(totalCycles, 0)
    })
    .on('cycle', () => bar.update(totalCycles - suite._counter))
    .on('abort error complete', () => bar.stop())
    .on('complete', function () {
      console.log('Fastest is ' + suite.filter('fastest').map('name'))
      console.log(suite.table.toString())
    })
    // run async
    .run({ async: true })
}

setupBenchmark()
