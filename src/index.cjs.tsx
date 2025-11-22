import Markdown, { compiler, RuleType } from './index.tsx'
import { parser } from './parse'

Object.assign(Markdown, { compiler, Markdown, RuleType, parser })

/** @deprecated Use the `markdown-to-jsx/react` import instead */
export default Markdown as typeof Markdown & {
  /** @deprecated Use the `markdown-to-jsx/react` import instead */
  compiler: typeof compiler
  /** @deprecated Use the `markdown-to-jsx/react` import instead */
  Markdown: typeof Markdown
  RuleType: typeof RuleType
  parser: typeof parser
}
