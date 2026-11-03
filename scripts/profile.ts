import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { loadCompiler, REPO_ROOT } from './metrics-targets.ts'

/** Calls per run: enough for the sampling profiler to see the hot paths. */
const ITERATIONS = 1000

// Mute console.log so only the console.info lines below reach the output.
console.log = () => undefined

async function main() {
  const fileArg = process.argv.indexOf('--file')
  const filePath =
    fileArg === -1
      ? path.join(import.meta.dirname, '../lib/src/gfm-spec.md')
      : process.argv[fileArg + 1]
  const markdown = fs.readFileSync(filePath, 'utf8')

  // Parse flags
  const isStreaming = process.argv.includes('--streaming')
  const targetIndex = process.argv.indexOf('--target')
  const targetName =
    targetIndex === -1 ? 'parser' : process.argv[targetIndex + 1]
  const compiler = await loadCompiler(REPO_ROOT, targetName)

  const compilerOpts = isStreaming ? { optimizeForStreaming: true } : undefined

  console.info('Starting profile...')
  console.info('Target:', targetName + (isStreaming ? ' (streaming)' : ''))
  console.info('Input size:', `${Math.round(markdown.length / 1024)}KB`)

  const t0 = performance.now()

  for (let i = 0; i < ITERATIONS; i++) {
    compiler(markdown, compilerOpts)
  }

  const t1 = performance.now()

  console.info(
    `Completed ${ITERATIONS} iterations in`,
    `${(t1 - t0).toFixed(2)}ms`
  )
  console.info(
    'Average per iteration:',
    `${((t1 - t0) / ITERATIONS).toFixed(2)}ms`
  )
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
