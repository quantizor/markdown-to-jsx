export { parser } from './parse.ts'

export { type MarkdownToJSX, RuleType } from './types.ts'

export { sanitizer, slugify } from './utils.ts'

import _default, {
  compiler as _compiler,
  Markdown as _Markdown,
} from './react.tsx'

/** @deprecated Use the `markdown-to-jsx/react` import instead */
var Markdown: typeof _Markdown = _Markdown

/** @deprecated Use the `markdown-to-jsx/react` import instead */
var compiler: typeof _compiler = _compiler

export default _default
export { compiler, Markdown }
