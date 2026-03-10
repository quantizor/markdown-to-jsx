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

// Re-export parser
export { parser } from './parse'

// Re-export types
export { RuleType, type MarkdownToJSX } from './types'

// Re-export utilities
export { sanitizer, slugify } from './utils'

// Import then re-export from react.tsx to work around Bun bundler bug
// where `export { x } from './peer-entry'` emits dangling symbol references
import _default, { Markdown as _Markdown, compiler as _compiler } from './react'

/** @deprecated Use the `markdown-to-jsx/react` import instead */
/** @lang zh @deprecated 请改用 `markdown-to-jsx/react` 导入 */
/** @lang hi @deprecated कृपया इसके बजाय `markdown-to-jsx/react` इम्पोर्ट का उपयोग करें */
var Markdown: typeof _Markdown = _Markdown

/** @deprecated Use the `markdown-to-jsx/react` import instead */
/** @lang zh @deprecated 请改用 `markdown-to-jsx/react` 导入 */
/** @lang hi @deprecated कृपया इसके बजाय `markdown-to-jsx/react` इम्पोर्ट का उपयोग करें */
var compiler: typeof _compiler = _compiler

export default _default
export { Markdown, compiler }
