import Markdown, { createMarkdown } from './'

Object.assign(Markdown, { createMarkdown })
export default Markdown as typeof Markdown & {
  createMarkdown: typeof createMarkdown
}
