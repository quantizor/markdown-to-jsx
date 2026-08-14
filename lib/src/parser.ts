/**
 * Standalone parser entry for `@marqdown/parser`: the CommonMark + GFM parser
 * and its renderer-agnostic utilities, with no output compiler attached. The
 * scoped renderer packages bundle this same source rather than depend on it.
 */

// Bun's bundler drops the bodies of an entry module that is nothing but
// `export { x } from '…'` re-exports (see index.tsx). Bind the imports to
// locals so their implementations are pulled into the bundle, then re-export.
import { parser as _parser } from './parse.ts'
import { RuleType as _RuleType, type MarkdownToJSX } from './types.ts'
import { sanitizer as _sanitizer, slugify as _slugify } from './utils.ts'

export type { MarkdownToJSX }

var parser: typeof _parser = _parser
var RuleType: typeof _RuleType = _RuleType
var sanitizer: typeof _sanitizer = _sanitizer
var slugify: typeof _slugify = _slugify

export { parser, RuleType, sanitizer, slugify }
