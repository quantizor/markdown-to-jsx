/**
 * CommonJS entry point for markdown-to-jsx
 * @lang zh markdown-to-jsx 的 CommonJS 入口点
 * @lang hi markdown-to-jsx का CommonJS प्रवेश बिंदु
 *
 * @deprecated Use ES modules import instead. For React usage, use `markdown-to-jsx/react`.
 * @lang zh @deprecated 请改用 ES 模块导入。对于 React 用法，请使用 `markdown-to-jsx/react`。
 * @lang hi @deprecated कृपया इसके बजाय ES मॉड्यूल इम्पोर्ट का उपयोग करें। React उपयोग के लिए, `markdown-to-jsx/react` का उपयोग करें।
 */

import Markdown, { compiler, RuleType } from './index.tsx'
import { parser } from './parse-compact'

Object.assign(Markdown, { compiler, Markdown, RuleType, parser })

/** @deprecated Use the `markdown-to-jsx/react` import instead */
/** @lang zh @deprecated 请改用 `markdown-to-jsx/react` 导入 */
/** @lang hi @deprecated कृपया इसके बजाय `markdown-to-jsx/react` इम्पोर्ट का उपयोग करें */
export default Markdown as typeof Markdown & {
  /** @deprecated Use the `markdown-to-jsx/react` import instead */
  /** @lang zh @deprecated 请改用 `markdown-to-jsx/react` 导入 */
  /** @lang hi @deprecated कृपया इसके बजाय `markdown-to-jsx/react` इम्पोर्ट का उपयोग करें */
  compiler: typeof compiler
  /** @deprecated Use the `markdown-to-jsx/react` import instead */
  /** @lang zh @deprecated 请改用 `markdown-to-jsx/react` 导入 */
  /** @lang hi @deprecated कृपया इसके बजाय `markdown-to-jsx/react` इम्पोर्ट का उपयोग करें */
  Markdown: typeof Markdown
  RuleType: typeof RuleType
  parser: typeof parser
}
