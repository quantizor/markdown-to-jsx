/**
 * Main entry point for markdown-to-jsx
 * @lang zh markdown-to-jsx 的主入口点
 * @lang hi markdown-to-jsx का मुख्य प्रवेश बिंदु
 *
 * @deprecated The React exports from this entry point are deprecated.
 * Use `markdown-to-jsx/react` import instead for React-specific usage.
 * @lang zh @deprecated 此入口点的 React 导出已弃用。对于 React 特定用法，请改用 `markdown-to-jsx/react` 导入。
 * @lang hi @deprecated इस प्रवेश बिंदु से React exports अप्रचलित हैं। React-विशिष्ट उपयोग के लिए इसके बजाय `markdown-to-jsx/react` इम्पोर्ट का उपयोग करें।
 */

// Re-export parser from parse.ts
export { parser } from './parse'

// Re-export types
export { RuleType, type MarkdownToJSX } from './types'

// Re-export utilities
export { sanitizer, slugify } from './utils'

// Re-export compiler and Markdown from react.tsx for backward compatibility
export {
  /** @deprecated Use the `markdown-to-jsx/react` import instead */
  /** @lang zh @deprecated 请改用 `markdown-to-jsx/react` 导入 */
  /** @lang hi @deprecated कृपया इसके बजाय `markdown-to-jsx/react` इम्पोर्ट का उपयोग करें */
  default,
  /** @deprecated Use the `markdown-to-jsx/react` import instead */
  /** @lang zh @deprecated 请改用 `markdown-to-jsx/react` 导入 */
  /** @lang hi @deprecated कृपया इसके बजाय `markdown-to-jsx/react` इम्पोर्ट का उपयोग करें */
  Markdown,
  /** @deprecated Use the `markdown-to-jsx/react` import instead */
  /** @lang zh @deprecated 请改用 `markdown-to-jsx/react` 导入 */
  /** @lang hi @deprecated कृपया इसके बजाय `markdown-to-jsx/react` इम्पोर्ट का उपयोग करें */
  compiler,
} from './react'
