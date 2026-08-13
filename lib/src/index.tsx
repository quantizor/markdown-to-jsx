/**
 * Main entry point for marqdown
 *
 * @deprecated The React exports from this entry point are deprecated.
 * Use `marqdown/react` import instead for React-specific usage.
 */

// Re-export parser
export { parser } from './parse.ts'

// Re-export types
export { type MarkdownToJSX, RuleType } from './types.ts'

// Re-export utilities
export { sanitizer, slugify } from './utils.ts'

// Import then re-export from react.tsx to work around Bun bundler bug
// where `export { x } from './peer-entry'` emits dangling symbol references
import _default, {
  compiler as _compiler,
  Markdown as _Markdown,
} from './react.tsx'

/** @deprecated Use the `marqdown/react` import instead */
var Markdown: typeof _Markdown = _Markdown

/** @deprecated Use the `marqdown/react` import instead */
var compiler: typeof _compiler = _compiler

export default _default
export { compiler, Markdown }
