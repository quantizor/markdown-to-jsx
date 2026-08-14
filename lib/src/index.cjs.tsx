/**
 * CommonJS entry point for marqdown
 *
 * @deprecated Use ES modules import instead. For React usage, use `marqdown/react`.
 */

import Markdown, { compiler, RuleType } from './index.tsx'
import { parser } from './parse.ts'

Object.assign(Markdown, { compiler, Markdown, RuleType, parser })

/** @deprecated Use the `marqdown/react` import instead */
export default Markdown as typeof Markdown & {
  /** @deprecated Use the `marqdown/react` import instead */
  compiler: typeof compiler
  /** @deprecated Use the `marqdown/react` import instead */
  Markdown: typeof Markdown
  RuleType: typeof RuleType
  parser: typeof parser
}
