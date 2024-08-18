import Markdown, { compiler, RuleType } from './index.tsx'

Object.assign(Markdown, { compiler, RuleType })

export default Markdown as typeof Markdown & {
  compiler: typeof compiler
  RuleType: typeof RuleType
}
