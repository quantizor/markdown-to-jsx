import { describe, it, expect } from 'bun:test'
import { parser } from './parse.ts'
import { parseHTMLTag } from './parse.ts'

describe('Issue #781 regression: multi-line HTML tags', () => {
  it('should parse tag with multiline attributes correctly', () => {
    const tagMd = `<dl-custom
  data-variant='horizontalTable'
>`
    const result = parseHTMLTag(tagMd, 0)
    console.log('parseHTMLTag result:', result)
    
    expect(result).not.toBeNull()
    expect(result?.tagName).toBe('dl-custom')
    expect(result?.attrs).toContain("data-variant='horizontalTable'")
  })

  it('should handle custom elements with multi-line attributes in parser', () => {
    const testMd = `<dl-custom
  data-variant='horizontalTable'
>
  <dt>title 1</dt>
  <dd>description 1</dd>
</dl-custom>`

    const ast = parser(testMd)
    console.log('AST:', JSON.stringify(ast, null, 2))
    
    // Check we have exactly one htmlBlock node for dl-custom
    const htmlBlocks = ast.filter((n: any) => n.type === 'htmlBlock' && n.tag === 'dl-custom')
    console.log('dl-custom HTML blocks:', htmlBlocks.length)
    expect(htmlBlocks.length).toBe(1)
    
    // The rawText should include the attributes
    expect((htmlBlocks[0] as any).rawText).toContain("data-variant='horizontalTable'")
    
    // The attrs should be parsed
    console.log('attrs:', (htmlBlocks[0] as any).attrs)
    expect((htmlBlocks[0] as any).attrs['data-variant']).toBe('horizontalTable')
  })
})
