import Markdown, { compiler } from './'
Object.assign(Markdown, { compiler })
export default Markdown as typeof Markdown & { compiler: typeof compiler }
