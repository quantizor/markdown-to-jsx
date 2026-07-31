import type { NativeOptions } from 'markdown-to-jsx/native'
import { type HarnessCase, CASES as SHARED_CASES } from '../fixtures/cases'

/**
 * Native showcase/jest surface over the shared harness corpus. Case markdown
 * lives in fixtures/cases.ts; this file only carries native-specific options
 * (image layout) and the filtered case list for the Expo app and jest suite.
 */
export interface NativeCase {
  id: string
  md: string
  ref?: string
}

export var CASES: NativeCase[] = SHARED_CASES.filter(
  (c: HarnessCase) => !c.skip || c.skip.indexOf('native') === -1
).map(c => ({ id: c.id, md: c.md, ref: c.ref }))

export var FIXTURE = CASES.map(c => c.md).join('\n\n')

export var MARKDOWN_OPTIONS: NativeOptions = {
  styles: {
    image: { height: 48, width: 48 },
  },
}
