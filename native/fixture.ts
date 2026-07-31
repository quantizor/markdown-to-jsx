import type { NativeOptions } from 'markdown-to-jsx/native'
import { CASES as SHARED_CASES, type HarnessCase } from '../fixtures/cases'

/**
 * Native showcase/jest surface over the shared harness corpus. Case markdown
 * lives in fixtures/cases.ts; this file only carries native-specific options
 * (image layout) and the filtered case list for the Expo app and jest suite.
 */
export type NativeCase = {
  id: string
  md: string
  ref?: string
}

export var CASES: NativeCase[] = SHARED_CASES.filter(function (c: HarnessCase) {
  return !c.skip || c.skip.indexOf('native') === -1
}).map(function (c) {
  return { id: c.id, md: c.md, ref: c.ref }
})

export var FIXTURE = CASES.map(function (c) {
  return c.md
}).join('\n\n')

export var MARKDOWN_OPTIONS: NativeOptions = {
  styles: {
    image: { height: 48, width: 48 },
  },
}
