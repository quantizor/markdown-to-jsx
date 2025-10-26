import fs from 'fs'
import { performance } from 'perf_hooks'

async function main() {
  const markdown = fs.readFileSync('fixture.md', 'utf8')

  console.log('Importing markdown-to-jsx...')
  const { compiler } = await import('./dist/debug.module.js')

  const gc = global.gc
  if (gc) {
    console.log('Taking baseline memory snapshot...')
    gc()
  }

  console.log('Starting profile...')
  console.log('Input size:', Math.round(markdown.length / 1024) + 'KB')

  const t0 = performance.now()

  // Run compiler multiple times to get good sampling
  for (let i = 0; i < 100; i++) {
    compiler(markdown)
  }

  const t1 = performance.now()

  console.log('Completed 100 iterations in', (t1 - t0).toFixed(2) + 'ms')
  console.log('Average per iteration:', ((t1 - t0) / 100).toFixed(2) + 'ms')
}

main().catch(console.error)
