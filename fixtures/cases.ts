/**
 * Canonical harness case list, consumed by both live harnesses:
 * - browser/ mounts every case once per browser compiler (React, Solid, Vue)
 *   and the Playwright suite asserts each case's `dom` expectations per root.
 * - native/ renders every case in the Expo showcase and the jest smoke suite.
 *
 * One fact, one home: a markdown feature or issue regression lives here once.
 * Cases marked `ref` trace to a GitHub issue.
 *
 * Keep `dom` expectations renderer-agnostic and semantic: tag names, counts,
 * ids, hrefs, and exact text. Never classes, inline styles, or whitespace.
 * `sel: ''` targets the case output container itself (bare inline output).
 *
 * Every expectation here was written against observed compiler output, not
 * assumed shapes. A red expectation is a parser/compiler bug until proven
 * otherwise; do not edit expectations to green without that investigation.
 */

export type DomExpect =
  | { absent: true; sel: string }
  | { attr: [string, string]; sel: string }
  | { count: number; sel: string }
  | { sel: string; text: string }

export interface HarnessOptions {
  optimizeForStreaming?: boolean
  tagfilter?: boolean
}

export interface HarnessCase {
  dom: DomExpect[]
  id: string
  md: string
  /** Compiler options for this case only. Omitted means library defaults. */
  options?: HarnessOptions
  ref?: string
  /** Skip mounting/asserting this case in the named harness. */
  skip?: Array<'browser' | 'native'>
}

var FENCE = '```'

// 1x1 transparent PNG. data: is the only image scheme besides http(s) the
// sanitizer allows, and React Native needs a loadable source to lay out.
var PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

export var CASES: HarnessCase[] = [
  {
    id: 'paragraph',
    md: 'hello world',
    dom: [{ sel: '', text: 'hello world' }],
  },
  {
    id: 'heading-atx',
    md: '# Top\n\n#### Deep',
    dom: [
      { sel: 'h1', text: 'Top' },
      { sel: 'h1', attr: ['id', 'top'] },
      { sel: 'h4', text: 'Deep' },
      { sel: 'h4', attr: ['id', 'deep'] },
    ],
  },
  {
    id: 'heading-setext',
    md: 'Title\n=====\n\nSub\n---',
    dom: [
      { sel: 'h1', text: 'Title' },
      { sel: 'h1', attr: ['id', 'title'] },
      { sel: 'h2', text: 'Sub' },
      { sel: 'h2', attr: ['id', 'sub'] },
    ],
  },
  {
    id: 'heading-dedupe',
    ref: '#857',
    md: '## Dup\n\n## Dup',
    dom: [
      { sel: 'h2', count: 2 },
      { sel: '#dup', count: 1 },
      { sel: '#dup-1', count: 1 },
    ],
  },
  {
    id: 'heading-inline-format',
    md: '## **bold** `code` plain',
    dom: [
      { sel: 'h2', attr: ['id', 'bold-code-plain'] },
      { sel: 'h2 strong', text: 'bold' },
      { sel: 'h2 code', text: 'code' },
    ],
  },
  {
    id: 'heading-link',
    md: '## [text](https://e.com)',
    dom: [
      { sel: 'h2', attr: ['id', 'text'] },
      { sel: 'h2 a', text: 'text' },
      { sel: 'h2 a', attr: ['href', 'https://e.com'] },
    ],
  },
  {
    id: 'paragraph-interrupt-heading',
    md: 'text\n# h',
    dom: [
      { sel: 'p', text: 'text' },
      { sel: 'h1', text: 'h' },
    ],
  },
  {
    id: 'blockquote-basic',
    md: '> quoted\n>\n> second',
    dom: [
      { sel: 'blockquote', count: 1 },
      { sel: 'blockquote p', count: 2 },
    ],
  },
  {
    id: 'blockquote-nested',
    md: '> outer\n> > inner\n>\n> tail',
    dom: [
      { sel: 'blockquote', count: 2 },
      { sel: 'blockquote blockquote p', text: 'inner' },
    ],
  },
  {
    id: 'blockquote-lazy',
    md: '> a\ncontinued\n> b',
    dom: [
      { sel: 'blockquote', count: 1 },
      { sel: 'blockquote p', count: 1 },
      // DOM text joins the lines with \n; toHaveText collapses whitespace.
      { sel: 'blockquote p', text: 'a continued b' },
    ],
  },
  {
    id: 'blockquote-list',
    md: '> - a\n> - b',
    dom: [{ sel: 'blockquote ul li', count: 2 }],
  },
  {
    id: 'list-ul-nested',
    md: '- a\n  - b\n    - c',
    dom: [
      { sel: 'ul', count: 3 },
      { sel: 'li', count: 3 },
    ],
  },
  {
    id: 'list-ol-start',
    md: '3. three\n4. four',
    dom: [
      { sel: 'ol', attr: ['start', '3'] },
      { sel: 'li', count: 2 },
    ],
  },
  {
    id: 'list-ol-in-ul',
    md: '- a\n  1. one\n  2. two\n- b',
    dom: [
      { sel: 'ul', count: 1 },
      { sel: 'ol', count: 1 },
      { sel: 'li', count: 4 },
    ],
  },
  {
    id: 'list-loose',
    md: '- a\n\n- b',
    dom: [{ sel: 'li p', count: 2 }],
  },
  {
    id: 'list-formatted-nested',
    ref: '#400',
    md: '- **Item**\n  - nested\n- *second*',
    dom: [
      { sel: 'ul', count: 2 },
      { sel: 'li strong', text: 'Item' },
      { sel: 'li em', text: 'second' },
    ],
  },
  {
    id: 'list-fence',
    md: `- item\n\n  ${FENCE}\n  code\n  ${FENCE}`,
    dom: [
      { sel: 'li p', text: 'item' },
      { sel: 'li pre code', text: 'code' },
    ],
  },
  {
    id: 'task-list',
    md: '- [x] done\n- [ ] todo',
    dom: [
      { sel: 'input[type="checkbox"]', count: 2 },
      { sel: 'input[type="checkbox"]:checked', count: 1 },
    ],
  },
  {
    id: 'code-fence-lang',
    md: `${FENCE}js\nconst x = 1\n${FENCE}`,
    dom: [
      { sel: 'pre', count: 1 },
      { sel: 'pre code', text: 'const x = 1' },
    ],
  },
  {
    id: 'code-fence-tilde',
    md: '~~~\ncode\n~~~',
    dom: [{ sel: 'pre code', text: 'code' }],
  },
  {
    id: 'code-indented',
    md: '    const x = 1',
    dom: [{ sel: 'pre code', text: 'const x = 1' }],
  },
  {
    id: 'code-inline',
    md: 'before `const x = 1` after',
    dom: [{ sel: 'code', text: 'const x = 1' }],
  },
  {
    id: 'code-inline-backticks',
    md: '``a`b``',
    dom: [{ sel: 'code', text: 'a`b' }],
  },
  {
    id: 'thematic-break-dashes',
    md: 'a\n\n---\n\nb',
    dom: [
      { sel: 'hr', count: 1 },
      { sel: 'p', count: 2 },
    ],
  },
  {
    id: 'thematic-break-stars',
    md: 'a\n\n***\n\nb',
    dom: [
      { sel: 'hr', count: 1 },
      { sel: 'p', count: 2 },
    ],
  },
  {
    id: 'table-basic',
    md: '| a | b |\n| --- | --- |\n| 1 | 2 |',
    dom: [
      { sel: 'table', count: 1 },
      { sel: 'th', count: 2 },
      { sel: 'td', count: 2 },
    ],
  },
  {
    id: 'table-align',
    // Alignment lands in inline styles, which the harness never asserts.
    md: '| a | b |\n| :- | -: |\n| 1 | 2 |',
    dom: [
      { sel: 'table', count: 1 },
      { sel: 'th', count: 2 },
      { sel: 'td', count: 2 },
    ],
  },
  {
    id: 'table-inline-format',
    md: '| `c` | ~~d~~ |\n| --- | --- |\n| [l](https://e.com) | **b** |',
    dom: [
      { sel: 'th code', text: 'c' },
      { sel: 'th del', text: 'd' },
      { sel: 'td a', attr: ['href', 'https://e.com'] },
      { sel: 'td strong', text: 'b' },
    ],
  },
  {
    id: 'footnote',
    md: 'note[^1]\n\n[^1]: body',
    dom: [
      { sel: 'sup', text: '1' },
      { sel: 'a[href="#1"]', count: 1 },
      { sel: 'footer', count: 1 },
    ],
  },
  {
    id: 'footnote-nonnumeric',
    md: 'a[^n]\n\n[^n]: b',
    dom: [
      { sel: 'sup', text: 'n' },
      { sel: 'a[href="#n"]', count: 1 },
      { sel: 'footer', count: 1 },
    ],
  },
  {
    id: 'frontmatter',
    // Frontmatter parses to its own node and renderers skip it.
    md: '---\ntitle: x\n---\n\nbody',
    dom: [
      { sel: 'p', count: 1 },
      { sel: 'p', text: 'body' },
    ],
  },
  {
    id: 'html-block',
    md: '<section>raw</section>',
    dom: [{ sel: 'section', text: 'raw' }],
  },
  {
    id: 'html-block-attrs',
    md: '<div class="x" data-n="1">c</div>',
    dom: [
      { sel: 'div[data-n]', attr: ['data-n', '1'] },
      { sel: 'div[data-n]', text: 'c' },
    ],
  },
  {
    id: 'jsx-blank-line-nesting',
    ref: '#870',
    md: '<MyComponent>\n## My header\n\nSome paragraph\n</MyComponent>',
    dom: [
      { sel: 'mycomponent h2', attr: ['id', 'my-header'] },
      { sel: 'mycomponent p', text: 'Some paragraph' },
    ],
  },
  {
    id: 'html-self-closing',
    md: `<img src="${PIXEL}" alt="z" />`,
    dom: [
      { sel: 'img[src^="data:"]', count: 1 },
      { sel: 'img', attr: ['alt', 'z'] },
    ],
  },
  {
    id: 'html-comment',
    md: '<!-- note -->\n\ntext',
    dom: [
      { sel: 'p', count: 1 },
      { sel: 'p', text: 'text' },
    ],
  },
  {
    id: 'tagfilter-script',
    md: '<script>alert(1)</script>',
    dom: [
      { sel: 'script', absent: true },
      { sel: 'span', text: '<script>alert(1)</script>' },
    ],
  },
  {
    id: 'tagfilter-off-script-plain',
    md: '<script type="text/plain">hello</script>',
    options: { tagfilter: false },
    // Native has no DOM script element; browser asserts the live inert tag.
    skip: ['native'],
    dom: [
      { sel: 'script', attr: ['type', 'text/plain'] },
      { sel: 'script', text: 'hello' },
    ],
  },
  {
    id: 'link-inline',
    md: '[t](https://e.com)',
    dom: [
      { sel: 'a', text: 't' },
      { sel: 'a', attr: ['href', 'https://e.com'] },
    ],
  },
  {
    id: 'link-title',
    md: '[t](https://e.com "ti")',
    dom: [
      { sel: 'a', attr: ['href', 'https://e.com'] },
      { sel: 'a', attr: ['title', 'ti'] },
    ],
  },
  {
    id: 'link-angle-dest',
    md: '[t](<https://e.com/a b>)',
    dom: [{ sel: 'a', attr: ['href', 'https://e.com/a%20b'] }],
  },
  {
    id: 'link-reference',
    md: '[t][r]\n\n[r]: https://e.com',
    dom: [
      { sel: 'a', text: 't' },
      { sel: 'a', attr: ['href', 'https://e.com'] },
    ],
  },
  {
    id: 'link-reference-shortcut',
    md: '[r]\n\n[r]: https://e.com',
    dom: [
      { sel: 'a', text: 'r' },
      { sel: 'a', attr: ['href', 'https://e.com'] },
    ],
  },
  {
    id: 'link-autolink-angle',
    md: '<https://example.com>',
    dom: [
      { sel: 'a', text: 'https://example.com' },
      { sel: 'a', attr: ['href', 'https://example.com'] },
    ],
  },
  {
    id: 'link-autolink-email',
    md: '<a@b.com>',
    dom: [{ sel: 'a', attr: ['href', 'mailto:a@b.com'] }],
  },
  {
    id: 'link-autolink-bare',
    md: 'see www.example.com and https://example.com',
    dom: [
      { sel: 'a', count: 2 },
      { sel: 'a[href="http://www.example.com"]', count: 1 },
      { sel: 'a[href="https://example.com"]', count: 1 },
    ],
  },
  {
    id: 'link-sanitize-javascript',
    md: '[x](javascript:alert(1))',
    dom: [
      { sel: 'a', text: 'x' },
      { sel: 'a[href]', absent: true },
    ],
  },
  {
    id: 'link-sanitize-entity-encoded',
    // Destinations are entity-decoded at parse time, so this is rejected the
    // same way as a literal javascript: URL: the href attribute is omitted.
    md: '[x](&#106;avascript:alert(1))',
    dom: [
      { sel: 'a', text: 'x' },
      { sel: 'a[href]', absent: true },
    ],
  },
  {
    id: 'link-sanitize-percent-encoded',
    md: '[x](%6Aavascript:alert(1))',
    dom: [
      { sel: 'a', text: 'x' },
      { sel: 'a[href*="javascript:" i]', absent: true },
    ],
  },
  {
    id: 'link-image-nested',
    md: `[![alt](${PIXEL})](https://e.com)`,
    dom: [
      { sel: 'a', attr: ['href', 'https://e.com'] },
      { sel: 'a img', attr: ['alt', 'alt'] },
    ],
  },
  {
    id: 'image-basic',
    // Every image source in this corpus is a data URI: the harness must be
    // hermetic, and any remote URL here becomes a real fetch in the browser.
    md: `![alt](${PIXEL} "ti")`,
    dom: [
      { sel: 'img[src^="data:"]', count: 1 },
      { sel: 'img', attr: ['alt', 'alt'] },
      { sel: 'img', attr: ['title', 'ti'] },
    ],
  },
  {
    id: 'image-data-uri',
    md: `![p](${PIXEL})`,
    dom: [
      { sel: 'img', attr: ['alt', 'p'] },
      { sel: 'img[src^="data:"]', count: 1 },
    ],
  },
  {
    id: 'format-strong-em',
    md: '**b** and *i*',
    dom: [
      { sel: 'strong', text: 'b' },
      { sel: 'em', text: 'i' },
    ],
  },
  {
    id: 'format-nested',
    md: '***both***',
    dom: [{ sel: 'em strong', text: 'both' }],
  },
  {
    id: 'format-del',
    md: '~~gone~~',
    dom: [{ sel: 'del', text: 'gone' }],
  },
  {
    id: 'format-mark',
    md: '==hi==',
    dom: [{ sel: 'mark', text: 'hi' }],
  },
  {
    id: 'format-in-link',
    md: '[**b**](https://e.com)',
    dom: [{ sel: 'a strong', text: 'b' }],
  },
  {
    id: 'hard-break',
    md: 'a  \nb',
    dom: [{ sel: 'br', count: 1 }],
  },
  {
    id: 'entity-mixed',
    md: '&amp; &copy; &#169; &#xA9;',
    dom: [{ sel: '', text: '& © © ©' }],
  },
  {
    id: 'entity-in-code-not-decoded',
    md: '`&amp;` and &amp;',
    dom: [
      { sel: 'code', text: '&amp;' },
      { sel: '', text: '&amp; and &' },
    ],
  },
  {
    id: 'entity-literal-symbols',
    md: 'AT&T < 5 > 3',
    dom: [{ sel: '', text: 'AT&T < 5 > 3' }],
  },

  // --- Issue regressions (open + closed). Dom expectations pin observed
  // green output so a parser/compiler drift fails the harness. ---

  {
    id: 'ordered-list-bold-title-hyphen',
    ref: '#652',
    md: '1. **Intro** - some text\n2. **1440 Results** - some text\n3. **4K Results** - some text',
    dom: [
      { sel: 'ol', count: 1 },
      { sel: 'li', count: 3 },
      { sel: 'li strong', count: 3 },
      { sel: 'ul', absent: true },
    ],
  },
  {
    id: 'list-then-heading-no-blank',
    ref: '#726',
    md: '1. **A**\nexplanation about a\n2. **B**\nexplanation about b\n### h3 title',
    dom: [
      { sel: 'ol li', count: 2 },
      { sel: 'h3', attr: ['id', 'h3-title'] },
    ],
  },
  {
    id: 'bold-plus-adjacent-in-list',
    ref: '#675',
    md: '- foo\n- bar **+ baz****+ baz** qux **quux**',
    dom: [
      { sel: 'ul', count: 1 },
      { sel: 'li', count: 2 },
      { sel: 'li ul', absent: true },
    ],
  },
  {
    id: 'hard-break-in-list-item',
    ref: '#766',
    // Trailing double spaces on the `a` and `c` lines are load-bearing.
    md: 'a  \nb\n\n- c  \n d',
    dom: [
      { sel: 'br', count: 2 },
      { sel: 'li br', count: 1 },
    ],
  },
  {
    id: 'paragraph-after-nested-list',
    ref: '#776',
    md: '- Unordered list\n - Unordered nested list\n\nThis is paragraph after the unordered nested list.',
    dom: [
      { sel: 'ul', count: 1 },
      { sel: 'p', text: 'This is paragraph after the unordered nested list.' },
    ],
  },
  {
    id: 'table-empty-first-cell',
    ref: '#241',
    md: '|a|b|c|d|\n| --- | --- | --- | --- |\n|| bbb | ccc | ddd |\n|| bbb | ccc | ddd |',
    dom: [
      { sel: 'tbody tr', count: 2 },
      { sel: 'tbody td', count: 8 },
    ],
  },
  {
    id: 'code-in-link-in-table-cell',
    ref: '#644',
    md: '| Column 1 | Column 2 |\n|---------------------------------------|----------|\n| [`example` (text `highlighted`)](relative/link) | Value |',
    dom: [
      { sel: 'td a', attr: ['href', 'relative/link'] },
      { sel: 'td a code', count: 2 },
    ],
  },
  {
    id: 'markdown-list-in-html-table',
    ref: '#862',
    md: '<table>\n <tbody>\n <tr>\n <td>Foo 1</td>\n <td>Bar 1</td>\n </tr>\n <tr>\n <td>Foo 2</td>\n <td>A list:\n\n- one\n- two\n- three\n </td>\n </tr>\n </tbody>\n</table>',
    dom: [
      { sel: 'table tr', count: 2 },
      { sel: 'td ul li', count: 3 },
    ],
  },
  {
    id: 'triple-nested-divs',
    ref: '#520',
    // React keeps all three empty levels; solid/vue collapse the innermost
    // empty div. The #520 bug emitted a stray "</div>" text sibling; assert
    // the case container has no text content.
    md: '<div><div><div></div></div></div>',
    dom: [{ sel: '', text: '' }],
  },
  {
    id: 'nested-html-blocks-blank-lines',
    ref: '#829',
    md: '<div>\n\n### Inside\n\n<div>\nInner\n</div>\n\n#### Also\n\nMore.\n\n</div>',
    dom: [
      { sel: 'div > h3', attr: ['id', 'inside'] },
      { sel: 'div > h4', attr: ['id', 'also'] },
      { sel: 'div > p', text: 'More.' },
    ],
  },
  {
    id: 'details-summary-no-blank-line',
    ref: '#881',
    md: '<details>\n<summary>a</summary>\nx\n</details>',
    dom: [
      { sel: 'details summary', text: 'a' },
      { sel: 'details', text: 'a x' },
    ],
  },
  {
    id: 'container-leading-inline-tag',
    ref: '#871',
    md: '<ul><li><strong>bold</strong> text</li></ul>',
    dom: [
      { sel: 'ul li strong', text: 'bold' },
      { sel: 'ul li', text: 'bold text' },
      { sel: 'p', absent: true },
    ],
  },
  {
    id: 'unknown-elements-inline',
    ref: '#686',
    md: '<tag1><tag2>text</tag2>text</tag1>',
    dom: [
      { sel: 'tag1 tag2', text: 'text' },
      { sel: 'tag1', text: 'texttext' },
    ],
  },
  {
    id: 'html-block-emphasis-literal',
    ref: '#860',
    // Without a blank line after the opener this library leaves emphasis
    // markers literal inside the HTML block (documented divergence from the
    // blank-line path that does parse markdown).
    md: '<div>\n*Emphasized* text.\n</div>',
    dom: [{ sel: 'div', text: '*Emphasized* text.' }],
  },
  {
    id: 'nested-same-component-thrice',
    ref: '#665',
    md: '<MyComponent>\nA\n<MyComponent>\nB\n<MyComponent>\nC\n</MyComponent>\n</MyComponent>\n</MyComponent>',
    dom: [{ sel: 'mycomponent mycomponent mycomponent', text: 'C' }],
  },
  {
    id: 'link-with-url-as-text',
    ref: '#163',
    md: '[http://foo](http://bar)',
    dom: [
      { sel: 'a', text: 'http://foo' },
      { sel: 'a', attr: ['href', 'http://bar'] },
      { sel: 'a a', absent: true },
    ],
  },
  {
    id: 'link-label-square-brackets',
    ref: '#514',
    md: 'You can find it on [Google [1]](https://google.com).',
    dom: [
      { sel: 'a', text: 'Google [1]' },
      { sel: 'a', attr: ['href', 'https://google.com'] },
    ],
  },
  {
    id: 'image-alt-escaped-chars',
    ref: '#688',
    md: `![\\-\\<stuff](${PIXEL})`,
    dom: [{ sel: 'img', attr: ['alt', '-<stuff'] }],
  },
  {
    id: 'bare-email-autolink',
    ref: '#877',
    md: 'Please contact Support at 1-111-111-1111 or email technicalsupport@example.com for further assistance.',
    dom: [
      {
        sel: 'a',
        attr: ['href', 'mailto:technicalsupport@example.com'],
      },
      { sel: 'a', text: 'technicalsupport@example.com' },
    ],
  },
  {
    id: 'bold-wrapped-autolink',
    ref: '#839',
    md: 'Visit **www.acme.com/training** or **https://acme.com/foo** for more.',
    dom: [
      { sel: 'strong a', count: 2 },
      { sel: 'a[href="http://www.acme.com/training"]', count: 1 },
      { sel: 'a[href="https://acme.com/foo"]', count: 1 },
    ],
  },
  {
    id: 'raw-html-javascript-href',
    ref: '#239',
    md: '<a href="javascript:alert(\'You have been hacked\');">Hack Me</a>',
    dom: [
      { sel: 'a', text: 'Hack Me' },
      { sel: 'a[href]', absent: true },
    ],
  },
  {
    id: 'code-span-shortcut-refs',
    ref: '#656',
    md: '[`test`] [`test`]',
    dom: [
      { sel: 'code', count: 2 },
      { sel: 'a', absent: true },
    ],
  },
  {
    id: 'intraword-underscore',
    ref: '#292',
    md: 'this_is_a test',
    dom: [
      { sel: '', text: 'this_is_a test' },
      { sel: 'em', absent: true },
    ],
  },
  {
    id: 'adjacent-nested-bold-italic',
    ref: '#660',
    md: '***test**test*\n\n**test***test*',
    dom: [
      { sel: 'p', count: 2 },
      { sel: 'em strong', text: 'test' },
      { sel: 'strong', count: 2 },
      { sel: 'em', count: 2 },
    ],
  },
  {
    id: 'thematic-break-frontmatter-collision',
    ref: '#861',
    md: '---\n\n**Subject: Hello World**\n\nSome content here.\n\n---\n\n> Final section',
    dom: [
      { sel: 'hr', count: 2 },
      { sel: 'p strong', text: 'Subject: Hello World' },
      { sel: 'blockquote p', text: 'Final section' },
    ],
  },
  {
    id: 'frontmatter-inside-code-fence',
    ref: '#706',
    md:
      '# Markdown Test\n\nTest Text\n\n' +
      FENCE +
      'js\n---\ntitle: "Hello"\n---\nconsole.log("Hello, world!");\n' +
      FENCE +
      '\n\nTest Text',
    dom: [
      { sel: 'h1', attr: ['id', 'markdown-test'] },
      { sel: 'pre code', count: 1 },
      { sel: 'p', count: 2 },
    ],
  },
  {
    id: 'crlf-line-endings-list',
    ref: '#773',
    md: 'Para\r\n\r\n- one\r\n- two',
    dom: [
      { sel: 'p', text: 'Para' },
      { sel: 'ul li', count: 2 },
    ],
  },
  {
    id: 'escaped-ordered-list-marker',
    ref: 'BACKLOG',
    // Trailing double space on line 1 is the hard break.
    md: '1\\. First item  \n2\\. Second item',
    dom: [
      { sel: 'p', count: 1 },
      { sel: 'ol', absent: true },
      { sel: 'br', count: 1 },
    ],
  },
  {
    id: 'native-list-inline-formatting',
    ref: '#884',
    md: '1. First item\n2. Second item with **bold text**\n3. Third item with a [link](https://example.com)',
    dom: [
      { sel: 'ol li', count: 3 },
      { sel: 'li strong', text: 'bold text' },
      { sel: 'li a', attr: ['href', 'https://example.com'] },
    ],
  },
  {
    id: 'setext-vs-list-streaming',
    ref: '#827',
    // Incomplete setext/list ambiguity must not commit under streaming.
    options: { optimizeForStreaming: true },
    md: 'Some Text\n-',
    dom: [{ sel: 'h2', absent: true }],
    skip: ['native'],
  },
  {
    id: 'literal-less-than-streaming',
    // Prose comparisons must not be truncated by streaming HTML deferral.
    // Single-line input auto-inlines in some compilers, so assert on the card
    // root text rather than a paragraph wrapper.
    options: { optimizeForStreaming: true },
    md: '5 < 3 is false',
    dom: [{ sel: '', text: '5 < 3 is false' }],
    skip: ['native'],
  },
]
