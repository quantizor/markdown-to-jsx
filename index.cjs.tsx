import Markdown, { compiler, RuleType } from './'
Object.assign(Markdown, { compiler, RuleType })
export default Markdown as typeof Markdown & {
  compiler: typeof compiler
  RuleType: typeof RuleType
}
