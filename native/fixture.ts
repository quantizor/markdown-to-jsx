import type { NativeOptions } from 'markdown-to-jsx/native'
import { casesFor } from '../fixtures/cases'

export interface NativeCase {
  id: string
  md: string
  ref?: string
}

export var CASES: NativeCase[] = casesFor('native').map(c => ({
  id: c.id,
  md: c.md,
  ref: c.ref,
}))

export var MARKDOWN_OPTIONS: NativeOptions = {
  styles: {
    image: { height: 48, width: 48 },
  },
}
