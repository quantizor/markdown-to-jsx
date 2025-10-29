import { execFileSync } from 'child_process'
import fs from 'fs'

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
    execFileSync('npx', ['speedscope', latestFile], { stdio: 'inherit' })
  } catch (e) {
    console.log('Speedscope not available. Open Chrome DevTools manually:')
    console.log('  1. Open Chrome DevTools (F12)')
    console.log('  2. Go to Performance tab')
    console.log('  3. Click "Load profile"')
    console.log('  4. Select:', latestFile)
  }
}
