import fs from 'fs'
import { performance } from 'perf_hooks'
import { execSync } from 'child_process'

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

  // Find the CPU profile file
  const files = fs
    .readdirSync('.')
    .filter(f => f.startsWith('CPU.') && f.endsWith('.cpuprofile'))
  if (files.length > 0) {
    const latestFile = files.sort().reverse()[0]
    console.log('')
    console.log('CPU profile saved:', latestFile)
    console.log('')
    console.log('Opening in Speedscope...')
    try {
      execSync(`npx speedscope ${latestFile}`, { stdio: 'inherit' })
    } catch (e) {
      console.log('Speedscope not available. Open Chrome DevTools manually:')
      console.log('  1. Open Chrome DevTools (F12)')
      console.log('  2. Go to Performance tab')
      console.log('  3. Click "Load profile"')
      console.log('  4. Select:', latestFile)
    }
  }
}

main().catch(console.error)
