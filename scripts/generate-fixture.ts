/**
 * Script to generate a comprehensive markdown fixture file for testing markdown-to-jsx
 *
 * This script creates a fixture file with all supported markdown syntax elements,
 * each tested with 5 different input sizes: tiny, short, medium, long, and veryLong.
 *
 * Usage:
 *   bun scripts/generate-fixture.ts
 *   npm run fixture
 *
 * Output: lib/src/stress-test.generated.md
 * The generated file will be over 100KB and contain systematic variations
 * of all markdown syntax elements for comprehensive parser testing.
 */

import fs from 'fs'

// Define types for content sizes
interface ContentSizes {
  tiny: string
  short: string
  medium: string
  long: string
  veryLong: string
}

// Content size variations with explicit typing
const sizes: ContentSizes = {
  tiny: 'A',
  short: 'Short content',
  medium:
    'This is medium length content with typical structure and punctuation.',
  long: 'This is a longer piece of content designed to test parsing with substantial text blocks that include multiple sentences and varied character combinations.',
  veryLong:
    'This is an extremely long piece of content designed to test parsing performance with very large input strings containing extensive lorem ipsum text and multiple complex elements. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor. Ut ullamcorper, ligula eu tempor congue, eros est euismod turpis, id tincidunt sapien risus a quam. Maecenas fermentum consequat mi. Donec fermentum. Pellentesque malesuada nulla a mi. Duis sapien sem, aliquet nec, commodo eget, consequat quis, neque. Aliquam faucibus, elit ut dictum aliquet, felis nisl adipiscing sapien, sed malesuada diam lacus eget erat. Cras mollis scelerisque nunc. Nullam arcu. Aliquam consequat. Curabitur augue lorem, dapibus quis, laoreet et, pretium ac, nisi. Aenean magna nisl, mollis quis, molestie eu, feugiat in, orci. In hac habitasse platea dictumst.',
}

// Type for the template function
type TemplateFunction = (content: string) => string

// Generate content for each size with proper typing
function generateForSizes(templateFn: TemplateFunction): string {
  let result = ''
  for (const [sizeName, content] of Object.entries(sizes) as [
    keyof ContentSizes,
    string,
  ][]) {
    result += `### ${sizeName.charAt(0).toUpperCase() + sizeName.slice(1)} Content\n\n`
    result += templateFn(content) + '\n\n'
  }
  return result
}

// Main output generation
let output: string = `---
title: Comprehensive Markdown Syntax Fixture
description: A comprehensive test fixture for markdown-to-jsx parser with all syntax elements and various input sizes
version: 1.0.0
tags:
  - markdown
  - test
  - fixture
  - comprehensive
  - performance
date: 2025-01-15
author: markdown-to-jsx test suite
---

# Comprehensive Markdown Syntax Fixture

This fixture file is designed to test every markdown syntax element supported by markdown-to-jsx, with a variety of input string sizes to ensure comprehensive coverage.

---

# Headings

## ATX Style Headings

${generateForSizes(
  (content: string) => `# ${content}
## ${content}
### ${content}
#### ${content}
##### ${content}
###### ${content}`
)}

## Closed ATX Headings

${generateForSizes(
  (content: string) => `# ${content} #
## ${content} ##
### ${content} ###
#### ${content} ####
##### ${content} #####
###### ${content} ######`
)}

## Setext Style Headings

${generateForSizes(
  (content: string) => `${content}
${'='.repeat(Math.min(content.length, 50))}

${content}
${'-'.repeat(Math.min(content.length, 50))}`
)}

## Mixed Content Headings

${generateForSizes(
  (content: string) => `# ${content} with **bold** and *italic* text

### ${content} with \`inline code\` and [links](https://example.com)

#### ${content} with ~~strikethrough~~ and ==highlight==`
)}

---

# Paragraphs and Line Breaks

## Normal Paragraphs

${generateForSizes(
  (content: string) => `${content}

Another paragraph. ${content}`
)}

## Line Breaks

${generateForSizes(
  (content: string) => `${content}
with two spaces at the end.

${content}\\
with a backslash at the end.`
)}

---

# Blockquotes

## Simple Blockquotes

${generateForSizes((content: string) => `> ${content}`)}

## Multi-line Blockquotes

${generateForSizes(
  (content: string) => `> ${content}
> with multiple lines
> that are all prefixed with >.

> ${content}
multiple lines without prefixing
each line with >.`
)}

## Nested Blockquotes

${generateForSizes(
  (content: string) => `> ${content}
>
> > This is nested.
> >
> > > And this is deeply nested.`
)}

## Blockquotes with Other Elements

${generateForSizes(
  (content: string) => `> # Heading in Blockquote
>
> ${content}
>
> - List item 1
> - List item 2
>
> \`\`\`
> Code block in blockquote
> \`\`\`
>
> Blockquote with **bold** and *italic* text, plus \`inline code\`.`
)}

---

# Lists

## Unordered Lists

### Asterisk Markers

${generateForSizes(
  (content: string) => `* ${content}
* Another item
* Third item`
)}

### Plus Markers

${generateForSizes(
  (content: string) => `+ ${content}
+ Another item
+ Third item`
)}

### Dash Markers

${generateForSizes(
  (content: string) => `- ${content}
- Another item
- Third item`
)}

## Ordered Lists

${generateForSizes(
  (content: string) => `1. ${content}
2. Second item
3. Third item`
)}

### Starting with Different Numbers

${generateForSizes(
  (content: string) => `5. ${content}
6. Sixth item
7. Seventh item`
)}

## Nested Lists

### Unordered Nested

${generateForSizes(
  (content: string) => `* ${content}
  * Level 2
    * Level 3
  * Back to level 2
* Back to level 1`
)}

### Ordered Nested

${generateForSizes(
  (content: string) => `1. ${content}
   1. Level 2
      1. Level 3
   2. Back to level 2
2. Back to level 1`
)}

### Mixed Nested

${generateForSizes(
  (content: string) => `1. ${content}
   * Unordered level 2
     1. Ordered level 3
   * Another unordered
2. Back to ordered level 1`
)}

## Lists with Paragraphs

${generateForSizes(
  (content: string) => `* ${content}

  This is the second paragraph of the list item.

* Another list item
  with continuation.`
)}

## Lists with Code Blocks

${generateForSizes(
  (content: string) => `* ${content}

      Indented code block
      in a list item

* Another item

      \`\`\`
      Fenced code block
      in a list item
      \`\`\``
)}

## Task Lists (GFM Extension)

${generateForSizes(
  (content: string) => `- [ ] ${content}
- [x] Checked task
- [ ] Task with **formatting**
- [x] Completed task with \`code\``
)}

---

# Code

## Inline Code

${generateForSizes(
  (content: string) => `This is \`inline code\` within a paragraph.

Here is \`${content}\` and \`code-with-dashes\`.`
)}

## Indented Code Blocks

${generateForSizes(
  (content: string) => `    This is an indented code block.
    ${content}
        Deeper indentation
        is also preserved.`
)}

## Fenced Code Blocks

${generateForSizes(
  (content: string) => `\`\`\`
This is a fenced code block
${content}
\`\`\``
)}

### With Language Specification

${generateForSizes(
  (content: string) => `\`\`\`javascript
// This is a fenced code block with language
function hello() {
    console.log('${content}');
}
\`\`\`

\`\`\`python
# Python code
def greet(name):
    return f"${content}: {name}!"
\`\`\`

\`\`\`html
<!-- HTML code -->
<div class="container">
    <h1>${content}</h1>
    <p>Content</p>
</div>
\`\`\``
)}

---

# Thematic Breaks

## Thematic Breaks with Different Syntax

---

***

___

* * *

- - -

_ _ _

## Thematic Breaks with Spaces

- - - -

* * * *

---

# Emphasis and Text Formatting

## Bold

${generateForSizes(
  (content: string) => `**${content}**

__${content}__`
)}

## Italic

${generateForSizes(
  (content: string) => `*${content}*

_${content}_`
)}

## Combined

${generateForSizes(
  (content: string) => `**${content} and *italic* combined**

*Italic with **bold** inside*

***${content}***`
)}

## Strikethrough

${generateForSizes((content: string) => `~~${content}~~`)}

## Highlight/Mark

${generateForSizes((content: string) => `==${content}==`)}

## Nested Formatting

${generateForSizes(
  (content: string) => `**${content} with ~~strikethrough~~ inside**

*Italic with ==highlight== inside*

\`Code with **bold** inside\` (should not format)

~~Strikethrough with \`code\` inside~~`
)}

## Complex Nesting

${generateForSizes(
  (content: string) => `**${content} with *italic* and ~~strikethrough~~**

***${content} with ==highlight==***

**${content} ~~strikethrough *italic*~~ end**`
)}

---

# Links

## Inline Links

${generateForSizes(
  (content: string) => `[${content}](https://example.com)

[${content} with title](https://example.com "Link title")

[${content} with **formatting**](https://example.com)`
)}

## Reference Links

${generateForSizes(
  (content: string) => `[${content}][ref1]

[Another reference link][ref2]

[${content.toLowerCase().replace(/\s+/g, '-')} implicit link]`
)}

## Autolinks

${generateForSizes(
  (content: string) => `<https://example.com>

<user@example.com>

www.example.com

https://example.com/path`
)}

## Link Variations

${generateForSizes(
  (
    content: string
  ) => `[${content} with spaces](https://example.com/path with spaces)

[${content} with special chars](https://example.com/path?query=value&other=123)

Visit https://bare-url-example.com for more info.

Contact user@bare-email-example.com for support.

Check out www.bare-www-example.com as well.`
)}

---

# Images

## Inline Images

${generateForSizes(
  (content: string) => `![${content}](https://example.com/image.jpg)

![${content} with title](https://example.com/image.png "Image title")

![${content} with **formatting** in alt](https://example.com/image.gif)`
)}

## Reference Images

${generateForSizes(
  (content: string) => `![${content}][img1]

![${content}][img2]

![${content.toLowerCase().replace(/\s+/g, '-')}]

![${content.slice(0, 10)}]`
)}

---

# Tables

## Basic Table

${generateForSizes(
  (content: string) => `| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| ${content.slice(0, 20)} | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`
)}

## Table with Alignment

${generateForSizes(
  (content: string) => `| Left | Center | Right |
|:-----|:------:|------:|
| ${content.slice(0, 15)} | C1     | R1    |
| L2   | C2     | R2    |`
)}

## Table with Formatting

${generateForSizes(
  (content: string) => `| **Bold** | *Italic* | \`Code\` |
|----------|----------|--------|
| ~~${content.slice(0, 10)}~~ | ==Highlight== | Normal |
| Cell 1 | Cell 2 | Cell 3 |`
)}

## Large Table

${generateForSizes(
  (content: string) => `| Column A | Column B | Column C | Column D | Column E |
|----------|----------|----------|----------|----------|
| ${content.slice(0, 10)}A  | ${content.slice(0, 10)}B  | ${content.slice(0, 10)}C  | ${content.slice(0, 10)}D  | ${content.slice(0, 10)}E  |
| Data 2A  | Data 2B  | Data 2C  | Data 2D  | Data 2E  |
| Data 3A  | Data 3B  | Data 3C  | Data 3D  | Data 3E  |
| Data 4A  | Data 4B  | Data 4C  | Data 4D  | Data 4E  |
| Data 5A  | Data 5B  | Data 5C  | Data 5D  | Data 5E  |`
)}

---

# HTML Elements

## HTML Blocks

${generateForSizes(
  (content: string) => `<div>
    <h1>${content}</h1>
    <p>This is HTML content that should be preserved.</p>
</div>

<table>
    <tr>
        <td>${content}</td>
        <td>Cell 2</td>
    </tr>
</table>`
)}

## Self-Closing Tags

<img src="image.jpg" alt="${sizes.tiny}" />

<br />

<hr />

<input type="text" name="field" />

<meta charset="utf-8" />

<link rel="stylesheet" href="style.css" />

## HTML Comments

<!-- ${sizes.tiny} -->

<!-- ${sizes.medium} -->

<!-- ${sizes.long} -->

## Inline HTML

${generateForSizes(
  (
    content: string
  ) => `This paragraph contains <span style="color: red;">${content}</span> elements.

Another paragraph with <em>${content}</em> and <strong>strong</strong> HTML tags.

Here's some text with <!-- inline HTML comment --> in the middle of a sentence.

This paragraph has <!-- ${content} --> an inline comment with content.`
)}

---

# Frontmatter

---
title: Comprehensive Fixture
description: ${sizes.long}
version: 1.0.0
tags:
  - markdown
  - fixture
  - test
  - comprehensive
date: 2025-01-15
---

Content after frontmatter.

---

# Footnotes

${generateForSizes(
  (content: string) => `This is a paragraph with a footnote reference[^1].

Another paragraph with multiple footnotes[^2][^3].

[^1]: ${content}
[^2]: This is the second footnote with **formatting**.
[^3]: Third footnote with \`code\` and [links](https://example.com).`
)}

---

# Reference Definitions

[ref1]: https://example.com/reference1
[ref2]: https://example.com/reference2 "Reference title"
[Implicit reference link]: https://example.com/implicit

[img1]: https://example.com/image1.jpg "Image alt"
[img2]: https://example.com/image2.png

---

# Escaped Characters

## Backslash Escapes

${generateForSizes(
  (content: string) => `\*Not bold\*

\_Not italic\_

\`Not code\`

\[Not a link\](${content})

\\\\Backslash`
)}

## HTML Entities

&copy; Copyright symbol

&amp; Ampersand

&lt; Less than

&gt; Greater than

&quot; Quote

&apos; Apostrophe

&frac34; Fraction

&hellip; Ellipsis

---

# Edge Cases and Special Content

## Empty Elements

#

##

### Valid heading

*

-

1.

## Very Long Content Blocks

### Long Code Block

\`\`\`javascript
// Extremely long JavaScript code block to test parsing performance
function generateLargeContent() {
    const content: string[] = [];
    for (let i = 0; i < 1000; i++) {
        content.push(\`Line \${i}: ${sizes.long.slice(0, 50)}\`);
        content.push(\`  // Comment on line \${i}\`);
        content.push(\`  const variable\${i} = "\${'x'.repeat(50)}";\`);
        content.push(\`  console.log(variable\${i});\`);
        content.push('');
    }
    return content.join('\\n');
}

const largeContent: string = generateLargeContent();
console.log('Generated content length:', largeContent.length);
\`\`\`

### Long Text Content

${sizes.veryLong}

---

# Additional Content to Reach Size Requirements

## Repetitive Content for Size

### Section 1

${sizes.veryLong}

### Section 2

${sizes.veryLong}

### Section 3

${sizes.veryLong}

### Section 4

${sizes.veryLong}

### Section 5

${sizes.veryLong}

### Section 6

${sizes.veryLong}

### Section 7

${sizes.veryLong}

### Section 8

${sizes.veryLong}

---

# END OF COMPREHENSIVE FIXTURE FILE

This file has been designed to comprehensively test all markdown syntax elements supported by markdown-to-jsx, with a focus on various input sizes and edge cases to ensure robust parsing performance. The file contains extensive content in multiple large blocks to exceed the 100KB size requirement while maintaining diverse markdown syntax coverage.
`

// Write the output to file
fs.writeFileSync('lib/src/stress-test.generated.md', output)
console.log('Fixture file generated successfully!')
