import * as p from '/Users/quantizor/code/markdown-to-jsx/src/parse.ts'

const input = `<div>
  <p>content</p>
</div>`
console.log(JSON.stringify(p.parser(input), null, 2))
