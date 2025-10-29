import fs from 'fs'
import { performance } from 'perf_hooks'

// ssh mode
console.log = () => {}

async function main() {
  const markdown = fs.readFileSync('./src/stress-test.generated.md', 'utf8')

  const { parser } = await import('../dist/index.js')

  console.info('Starting profile...')
  console.info('Input size:', Math.round(markdown.length / 1024) + 'KB')

  const t0 = performance.now()
  const numberOfIterations = 1000

  // Run compiler multiple times to get good sampling
  for (let i = 0; i < numberOfIterations; i++) {
    parser(markdown)
  }

  const t1 = performance.now()

  console.info(
    `Completed ${numberOfIterations} iterations in`,
    (t1 - t0).toFixed(2) + 'ms'
  )
  console.info('Average per iteration:', ((t1 - t0) / 100).toFixed(2) + 'ms')

  // CPU profile will be written by Bun when this process exits
  // The profile resolution happens automatically in the next step of the pipeline
}

main().catch(console.error)
