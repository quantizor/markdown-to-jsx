/**
 * Bun test preload: fail when a test leaks console.warn / console.error.
 *
 * Allowlisted messages are the library's intentional DEV sanitizer warnings.
 * Tests that spy on console.replace the wrapper for that test; restoring the
 * spy puts this wrapper back because preload installed it first.
 */
import { afterEach } from 'bun:test'

/** Exact first-argument prefixes for known DEV sanitizer / style-URL warnings. */
export const ALLOWED_CONSOLE_PREFIXES = [
  'Input contains an unsafe JavaScript/VBScript/data expression, it will not be rendered.',
  'Input could not be decoded due to malformed syntax or characters, it will not be rendered.',
  'Style attribute contains an unsafe URL expression, it will not be rendered.',
] as const

export interface ConsoleLeak {
  args: unknown[]
  level: 'error' | 'warn'
}

var leaks: ConsoleLeak[] = []

var originalWarn = console.warn.bind(console)
var originalError = console.error.bind(console)

export function isAllowedConsoleMessage(args: unknown[]): boolean {
  var first = args[0]
  if (typeof first !== 'string') {
    return false
  }
  for (var i = 0; i < ALLOWED_CONSOLE_PREFIXES.length; i++) {
    if (first === ALLOWED_CONSOLE_PREFIXES[i]) {
      return true
    }
  }
  return false
}

/** Drain recorded leaks (for presence tests). Clears the buffer. */
export function drainConsoleLeaks(): ConsoleLeak[] {
  var out = leaks
  leaks = []
  return out
}

function installLeakWrappers() {
  console.warn = function warnLeak(...args: unknown[]) {
    if (!isAllowedConsoleMessage(args)) {
      leaks.push({ args, level: 'warn' })
    }
    return originalWarn(...(args as Parameters<typeof console.warn>))
  }
  console.error = function errorLeak(...args: unknown[]) {
    leaks.push({ args, level: 'error' })
    return originalError(...(args as Parameters<typeof console.error>))
  }
}

installLeakWrappers()

afterEach(function failOnConsoleLeaks() {
  var found = drainConsoleLeaks()
  // Spies may have replaced the wrapper; put it back for the next test.
  installLeakWrappers()
  if (found.length === 0) {
    return
  }
  var lines: string[] = []
  for (var i = 0; i < found.length; i++) {
    var leak = found[i]
    var rendered: string[] = []
    for (var j = 0; j < leak.args.length; j++) {
      var arg = leak.args[j]
      rendered.push(typeof arg === 'string' ? arg : String(arg))
    }
    lines.push(`console.${leak.level}(${rendered.join(', ')})`)
  }
  throw new Error(
    'Unexpected console.' +
      (found.length === 1 ? found[0].level : 'warn/error') +
      ' during test:\n' +
      lines.join('\n')
  )
})
