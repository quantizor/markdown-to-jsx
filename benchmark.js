import BenchTable from 'benchtable'
import cliProgress from 'cli-progress'
import * as fs from 'fs'
import MarkdownIt from 'markdown-it'
import { compiler as latestCompiler } from 'markdown-to-jsx-latest'
import path from 'path'
import SimpleMarkdown from 'simple-markdown'
import { compiler } from './dist/index.module.js'

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

const bar = new cliProgress.SingleBar(
  {
    clearOnComplete: true,
  },
  cliProgress.Presets.shades_classic
)
let totalCycles

// add tests
const evals = suite
  .addFunction('markdown-to-jsx (next)', input => compiler(input))
  .addFunction(`markdown-to-jsx (${latestVersion})`, input =>
    latestCompiler(input)
  )

if (process.argv.includes('--all')) {
  evals
    .addFunction('simple-markdown', input =>
      SimpleMarkdown.defaultReactOutput(SimpleMarkdown.defaultBlockParse(input))
    )
    .addFunction('markdown-it', input => mdIt.render(input))
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
