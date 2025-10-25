const fs = require('fs')
const path = require('path')
const { performance } = require('perf_hooks')

// Import the compiler
const { compiler } = require('./dist/index.cjs')

const markdown = fs.readFileSync('fixture.md', 'utf8')
console.log(`Testing with ${markdown.length} byte document`)

const gc = global.gc

// Force GC before test
if (gc) {
  gc()
}

const usageBefore = process.memoryUsage()
const t0 = performance.now()

// Parse the markdown
const result = compiler(markdown)

const t1 = performance.now()

// Force GC after parse to measure retained memory
if (gc) {
  gc()
}

const usageAfter = process.memoryUsage()

console.log('\n=== Memory Allocation Results ===')
console.log({
  parseTime: `${(t1 - t0).toFixed(2)}ms`,
  memoryBefore: {
    heapUsed: `${Math.round(usageBefore.heapUsed / 1024)}KB`,
    heapTotal: `${Math.round(usageBefore.heapTotal / 1024)}KB`
  },
  memoryAfter: {
    heapUsed: `${Math.round(usageAfter.heapUsed / 1024)}KB`,
    heapTotal: `${Math.round(usageAfter.heapTotal / 1024)}KB`
  },
  memoryDelta: {
    heapUsed: `+${Math.round((usageAfter.heapUsed - usageBefore.heapUsed) / 1024)}KB`,
    heapTotal: `+${Math.round((usageAfter.heapTotal - usageBefore.heapTotal) / 1024)}KB`
  }
})

console.log('\nInterpretation:')
console.log(`- If heapUsed grows by more than ~${Math.round(markdown.length * 1.5 / 1024)}KB, there are extra allocations`)
console.log(`- Expected: ~${Math.round(markdown.length / 1024)}KB (document size)`)
console.log(`- Actual: ${Math.round((usageAfter.heapUsed - usageBefore.heapUsed) / 1024)}KB`)

