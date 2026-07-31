import { describe, expect, it } from 'bun:test'
import {
  ALLOWED_CONSOLE_PREFIXES,
  drainConsoleLeaks,
  isAllowedConsoleMessage,
} from './__mocks__/console-leak.ts'

describe('console-leak preload', () => {
  it('records an unexpected console.warn', () => {
    console.warn('unexpected leak from test')
    var found = drainConsoleLeaks()
    expect(found).toEqual([
      { args: ['unexpected leak from test'], level: 'warn' },
    ])
  })

  it('does not record an allowlisted sanitizer warn', () => {
    console.warn(ALLOWED_CONSOLE_PREFIXES[0], 'javascript:alert(1)')
    expect(drainConsoleLeaks()).toEqual([])
  })

  it('does not record the style-URL allowlisted warn', () => {
    console.warn(ALLOWED_CONSOLE_PREFIXES[2], 'url(javascript:1)')
    expect(drainConsoleLeaks()).toEqual([])
  })

  it('treats only exact allowlisted first args as allowed', () => {
    expect(isAllowedConsoleMessage([ALLOWED_CONSOLE_PREFIXES[1]])).toBe(true)
    expect(isAllowedConsoleMessage(['unexpected'])).toBe(false)
    expect(isAllowedConsoleMessage([42])).toBe(false)
  })

  it('records console.error unconditionally', () => {
    console.error('unexpected error leak')
    var found = drainConsoleLeaks()
    expect(found).toEqual([{ args: ['unexpected error leak'], level: 'error' }])
  })
})
