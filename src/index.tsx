// Re-export parser from parse.ts
export { parser } from './parse'

// Re-export types
export { RuleType, type MarkdownToJSX } from './types'

// Re-export utilities
export { sanitizer, slugify } from './utils'

// Re-export compiler and Markdown from react.tsx for backward compatibility
export {
  /** @deprecated Use the `markdown-to-jsx/react` import instead */
  default,
  /** @deprecated Use the `markdown-to-jsx/react` import instead */
  Markdown,
  /** @deprecated Use the `markdown-to-jsx/react` import instead */
  compiler,
} from './react'
