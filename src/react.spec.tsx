import * as fs from 'fs'
import { afterEach, expect, it, describe, mock, spyOn } from 'bun:test'
import * as React from 'react'
import { renderToString } from 'react-dom/server'
import theredoc from 'theredoc'
import Markdown, {
  compiler,
  astToJSX,
  parser,
  RuleType,
  sanitizer,
} from './react'

const root = { innerHTML: '' }

function render(jsx) {
  root.innerHTML = renderToString(jsx)
}

afterEach(() => {
  root.innerHTML = ''
  mock.clearAllMocks()
})

it('should throw if not passed a string (first arg)', () => {
  expect(() => compiler('')).not.toThrow()
  // @ts-ignore
  expect(() => compiler()).not.toThrow()
  // @ts-ignore
  expect(() => compiler(1)).toThrow()
  // @ts-ignore
  expect(() => compiler(() => {})).toThrow()
  // @ts-ignore
  expect(() => compiler({})).toThrow()
  // @ts-ignore
  expect(() => compiler([])).toThrow()
  // @ts-ignore
  expect(() => compiler(null)).toThrow()
  // @ts-ignore
  expect(() => compiler(true)).toThrow()
})

it('should handle a basic string', () => {
  render(compiler('Hello.'))

  expect(root.innerHTML).toBe('Hello.')
})

it('wraps multiple block element returns in a div to avoid invalid nesting errors', () => {
  render(compiler('# Boop\n\n## Blep'))

  expect(root.innerHTML).toMatchInlineSnapshot(
    `"<div><h1 id="boop">Boop</h1><h2 id="blep">Blep</h2></div>"`
  )
})

it('wraps solely inline elements in a span, rather than a div', () => {
  render(compiler("Hello. _Beautiful_ day isn't it?"))

  expect(root.innerHTML).toMatchInlineSnapshot(
    `"<span>Hello. <em>Beautiful</em> day isn&#x27;t it?</span>"`
  )
})

describe('inline textual elements', () => {
  it('should handle triple-emphasized text with mixed syntax 1/2', () => {
    render(compiler('**_Hello._**'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<strong><em>Hello.</em></strong>"`
    )
  })

  it('should handle triple-emphasized text with mixed syntax 2/2', () => {
    render(compiler('_**Hello.**_'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<em><strong>Hello.</strong></em>"`
    )
  })

  it('should handle the alternate form of bold/italic', () => {
    render(compiler('___Hello.___'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<em><strong>Hello.</strong></em>"`
    )
  })

  it('should handle deleted text', () => {
    render(compiler('~~Hello.~~'))

    expect(root.innerHTML).toMatchInlineSnapshot(`"<del>Hello.</del>"`)
  })

  it('should handle deleted text containing other syntax with a tilde', () => {
    render(compiler('~~Foo `~~bar` baz.~~'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<del>Foo <code>~~bar</code> baz.</del>"`
    )
  })

  it('should handle consecutive marked text', () => {
    render(compiler('==Hello== ==World=='))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<span><mark>Hello</mark> <mark>World</mark></span>"`
    )
  })

  it('should handle marked text containing other syntax with an equal sign', () => {
    render(compiler('==Foo `==bar` baz.=='))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<mark>Foo <code>==bar</code> baz.</mark>"`
    )
  })

  it('should handle block deleted text containing other syntax with a tilde', () => {
    render(compiler('~~Foo `~~bar` baz.~~\n\nFoo ~~bar~~.'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><p><del>Foo <code>~~bar</code> baz.</del></p><p>Foo <del>bar</del>.</p></div>"`
    )
  })

  it('should handle escaped text', () => {
    render(compiler('Hello.\\_\\_foo\\_\\_'))

    expect(root.innerHTML).toMatchInlineSnapshot(`"Hello.__foo__"`)
  })

  it('regression test for #188, mismatched syntaxes triggered the wrong result', () => {
    render(compiler('*This should render as normal text, not emphasized._'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"*This should render as normal text, not emphasized._"`
    )
  })

  it('ignore similar syntax inside inline syntax', () => {
    render(
      compiler(
        '*This should not misinterpret the asterisk <span>*</span> in the HTML.*'
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<em>This should not misinterpret the asterisk <span>*</span> in the HTML.</em>"`
    )

    render(
      compiler(
        '*This should not misinterpret the asterisk [*](x) in the anchor text.*'
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<em>This should not misinterpret the asterisk <a href="x">*</a> in the anchor text.</em>"`
    )

    render(
      compiler(
        '*This should not misinterpret the asterisk [foo](x*) in the link href.*'
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<em>This should not misinterpret the asterisk <a href="x*">foo</a> in the link href.</em>"`
    )

    render(
      compiler(
        String.raw`*This should not misinterpret the asterisk ~~\*~~ in the strikethrough.*`
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<em>This should not misinterpret the asterisk <del>*</del> in the strikethrough.</em>"`
    )

    render(
      compiler(
        '*This should not misinterpret the asterisk `*` in the backticks.*'
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<em>This should not misinterpret the asterisk <code>*</code> in the backticks.</em>"`
    )

    render(
      compiler(
        `_This should not misinterpret the under\\_score that forms part of a word._`
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<em>This should not misinterpret the under_score that forms part of a word.</em>"`
    )
  })

  it('replaces common HTML character codes with unicode equivalents so React will render correctly', () => {
    render(compiler('Foo &nbsp; bar&amp;baz.'))

    expect(root.innerHTML).toMatchInlineSnapshot(`"Foo   bar&amp;baz."`)
  })

  it('replaces named character codes with unicode equivalents so React will render correctly', () => {
    render(compiler('Apostrophe&#39;s and &le; equal'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"Apostrophe&#x27;s and ≤ equal"`
    )
  })
})

describe('misc block level elements', () => {
  it('should handle blockquotes', () => {
    render(compiler('> Something important, perhaps?'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<blockquote><p>Something important, perhaps?</p></blockquote>"`
    )
  })

  it('should handle lazy continuation lines of blockquotes', () => {
    render(compiler('> Line 1\nLine 2\n>Line 3'))

    expect(root.innerHTML).toMatchInlineSnapshot(`
      "<blockquote><p>Line 1
      Line 2
      Line 3</p></blockquote>"
    `)
  })

  it('should handle consecutive blockquotes', () => {
    render(compiler('> Something important, perhaps?\n\n> Something else'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><blockquote><p>Something important, perhaps?</p></blockquote><blockquote><p>Something else</p></blockquote></div>"`
    )
  })

  it('should handle alert blockquotes', () => {
    render(compiler('> [!NOTE]\n> Something important, perhaps?'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<blockquote class="markdown-alert-note"><header>NOTE</header><p>Something important, perhaps?</p></blockquote>"`
    )
  })
})

describe('headings', () => {
  it('should handle level 1 properly', () => {
    render(compiler('# Hello World'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<h1 id="hello-world">Hello World</h1>"`
    )
  })

  it('should enforce atx when option is passed', () => {
    render(compiler('#Hello World', { enforceAtxHeadings: true }))

    expect(root.innerHTML).toMatchInlineSnapshot(`"<p>#Hello World</p>"`)
  })

  it('should handle level 2 properly', () => {
    render(compiler('## Hello World'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<h2 id="hello-world">Hello World</h2>"`
    )
  })

  it('should handle level 3 properly', () => {
    render(compiler('### Hello World'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<h3 id="hello-world">Hello World</h3>"`
    )
  })

  it('should handle level 4 properly', () => {
    render(compiler('#### Hello World'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<h4 id="hello-world">Hello World</h4>"`
    )
  })

  it('should handle level 5 properly', () => {
    render(compiler('##### Hello World'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<h5 id="hello-world">Hello World</h5>"`
    )
  })

  it('should handle level 6 properly', () => {
    render(compiler('###### Hello World'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<h6 id="hello-world">Hello World</h6>"`
    )
  })

  it('should handle setext level 1 style', () => {
    render(compiler('Hello World\n===========\n\nsomething'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><h1 id="hello-world">Hello World</h1><p>something</p></div>"`
    )
  })

  it('should handle setext level 2 style', () => {
    render(compiler('Hello World\n-----------\n\nsomething'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><h2 id="hello-world">Hello World</h2><p>something</p></div>"`
    )
  })

  it('should handle consecutive headings without a padding newline', () => {
    render(compiler('# Hello World\n## And again'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><h1 id="hello-world">Hello World</h1><h2 id="and-again">And again</h2></div>"`
    )
  })

  it('trims closing hashes in headers', () => {
    render(compiler('# Hello World #########\nHere is the body'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><h1 id="hello-world">Hello World</h1><p>Here is the body</p></div>"`
    )
  })

  it('keeps hashes before closing hashes in headers and hashes without whitespace preceding', () => {
    render(compiler('# Hello World # #\n## Subheader#\nHere is the body'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><h1 id="hello-world-">Hello World #</h1><h2 id="subheader">Subheader#</h2><p>Here is the body</p></div>"`
    )
  })

  it('adds an "id" attribute to headings for deeplinking purposes', () => {
    render(compiler("# This is~ a very' complicated> header!"))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<h1 id="this-is-a-very-complicated-header">This is~ a very&#x27; complicated&gt; header!</h1>"`
    )
  })

  it('#595 regression - handle pipe character inside header', () => {
    render(compiler('# Heading | text'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<h1 id="heading--text">Heading | text</h1>"`
    )
  })
})

describe('images', () => {
  it('should handle a basic image', () => {
    render(compiler('![](/xyz.png)'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<link rel="preload" as="image" href="/xyz.png"/><img src="/xyz.png"/>"`
    )
  })

  it('should handle a base64-encoded image', () => {
    render(
      compiler(
        '![Red Dot](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==)'
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<img alt="Red Dot" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="/>"`
    )
  })

  it('should handle an image with alt text', () => {
    render(compiler('![test](/xyz.png)'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<link rel="preload" as="image" href="/xyz.png"/><img alt="test" src="/xyz.png"/>"`
    )
  })

  it('should handle an image with escaped alt text', () => {
    render(compiler('![\\-\\<stuff](https://somewhere)'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<link rel="preload" as="image" href="https://somewhere"/><img alt="-&lt;stuff" src="https://somewhere"/>"`
    )
  })

  it('should handle an image with title', () => {
    render(compiler('![test](/xyz.png "foo")'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<link rel="preload" as="image" href="/xyz.png"/><img alt="test" title="foo" src="/xyz.png"/>"`
    )
  })

  it('should handle an image reference', () => {
    render(
      compiler(theredoc`
        ![][1]

        [1]: /xyz.png
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<link rel="preload" as="image" href="/xyz.png"/><p><img src="/xyz.png"/></p>"`
    )
  })

  it('should gracefully handle an empty image reference', () => {
    render(
      compiler(theredoc`
        ![][1]

        [2]: /xyz.png
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`"<p>![][1]</p>"`)
  })

  it('should handle an image reference with alt text', () => {
    render(
      compiler(theredoc`
        ![test][1]

        [1]: /xyz.png
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<link rel="preload" as="image" href="/xyz.png"/><p><img alt="test" src="/xyz.png"/></p>"`
    )
  })

  it('should handle an image reference with title', () => {
    render(
      compiler(theredoc`
        ![test][1]

        [1]: /xyz.png "foo"
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<link rel="preload" as="image" href="/xyz.png"/><p><img alt="test" title="foo" src="/xyz.png"/></p>"`
    )
  })

  it('should handle an image inside a link', () => {
    render(
      compiler(
        `[![youtubeImg](https://www.gstatic.com/youtube/img/promos/growth/ytp_lp2_logo_phone_landscape_300x44.png)](https://www.youtube.com/)`
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<link rel="preload" as="image" href="https://www.gstatic.com/youtube/img/promos/growth/ytp_lp2_logo_phone_landscape_300x44.png"/><a href="https://www.youtube.com/"><img alt="youtubeImg" src="https://www.gstatic.com/youtube/img/promos/growth/ytp_lp2_logo_phone_landscape_300x44.png"/></a>"`
    )
  })
})

describe('links', () => {
  it('should handle a link reference', () => {
    render(compiler(`[foo][1]\n\n[1]: /xyz.png`))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<p><a href="/xyz.png">foo</a></p>"`
    )
  })

  it('should handle a link reference with title', () => {
    render(compiler(`[foo][1]\n\n[1]: /xyz.png "bar"`))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<p><a href="/xyz.png" title="bar">foo</a></p>"`
    )
  })

  it('should handle a link reference with angle brackets', () => {
    render(compiler(`[foo][1]\n\n[1]: </xyz.png>`))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<p><a href="/xyz.png">foo</a></p>"`
    )
  })

  it('should handle a link reference with angle brackets and a title', () => {
    render(compiler(`[foo][1]\n\n[1]: </xyz.png> "bar"`))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<p><a href="/xyz.png" title="bar">foo</a></p>"`
    )
  })

  it('should gracefully handle an empty link reference', () => {
    render(
      compiler(theredoc`
        [][1]
        [2]: foo
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`
      "<p>[][1]
      [2]: foo</p>"
    `)
  })

  it('list item should break paragraph', () => {
    render(compiler('foo\n- item'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><p>foo</p><ul><li>item</li></ul></div>"`
    )
  })

  it('#474 link regression test', () => {
    render(
      compiler(
        '[Markdown](https://cdn.vox-cdn.com/thumbor/ZGzvLsLuAaPPVW8yZMGqL77xyY8=/0x0:1917x789/1720x0/filters:focal(0x0:1917x789):format(webp):no_upscale()/cdn.vox-cdn.com/uploads/chorus_asset/file/24148777/cavill6.png)'
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<a href="https://cdn.vox-cdn.com/thumbor/ZGzvLsLuAaPPVW8yZMGqL77xyY8=/0x0:1917x789/1720x0/filters:focal(0x0:1917x789):format(webp):no_upscale()/cdn.vox-cdn.com/uploads/chorus_asset/file/24148777/cavill6.png">Markdown</a>"`
    )
  })

  it('header should break paragraph', () => {
    render(compiler('foo\n# header'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><p>foo</p><h1 id="header">header</h1></div>"`
    )
  })

  it('should handle autolinks after a paragraph (regression)', () => {
    render(
      compiler(theredoc`
        **autolink** style

        <https://google.com>
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><p><strong>autolink</strong> style</p><p><a href="https://google.com">https://google.com</a></p></div>"`
    )
  })

  it('should handle mailto autolinks after a paragraph', () => {
    render(
      compiler(theredoc`
        **autolink** style

        <mailto:probablyup@gmail.com>
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><p><strong>autolink</strong> style</p><p><a href="mailto:probablyup@gmail.com">mailto:probablyup@gmail.com</a></p></div>"`
    )
  })

  it('should handle a mailto autolink', () => {
    render(compiler('<mailto:probablyup@gmail.com>'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<a href="mailto:probablyup@gmail.com">mailto:probablyup@gmail.com</a>"`
    )
  })

  it('should an email autolink and add a mailto: prefix', () => {
    render(compiler('<probablyup@gmail.com>'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<a href="mailto:probablyup@gmail.com">probablyup@gmail.com</a>"`
    )
  })

  it('should still parse angle autolinks when raw HTML parsing is disabled', () => {
    render(
      compiler('<https://example.com>', {
        disableParsingRawHTML: true,
        tagfilter: false,
      })
    )

    expect(root.innerHTML).toBe(
      '<a href="https://example.com">https://example.com</a>'
    )
  })

  it('should preserve mailto autolink labels when raw HTML parsing is disabled', () => {
    render(
      compiler('<mailto:user@example.com>', {
        disableParsingRawHTML: true,
        tagfilter: false,
      })
    )

    expect(root.innerHTML).toBe(
      '<a href="mailto:user@example.com">mailto:user@example.com</a>'
    )
  })

  it('should reject angle autolinks containing newlines', () => {
    render(
      compiler(
        theredoc`
          paragraph

          <https://example.com
          next>
        `,
        {
          disableParsingRawHTML: true,
          tagfilter: false,
        }
      )
    )

    expect(root.innerHTML).toBe(
      '<div><p>paragraph</p><p>&lt;https://example.com\nnext&gt;</p></div>'
    )
  })

  it('should keep bare autolinks disabled when requested alongside raw HTML disable', () => {
    render(
      compiler('https://example.com', {
        disableParsingRawHTML: true,
        disableAutoLink: true,
        tagfilter: false,
      })
    )

    expect(root.innerHTML).toBe('https://example.com')
  })

  it('should automatically link found URLs', () => {
    render(compiler('https://google.com'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<a href="https://google.com">https://google.com</a>"`
    )
  })

  it('should not link bare URLs with invalid domains', () => {
    render(compiler('https://example.invalid_domain'))

    expect(root.innerHTML).toBe('https://example.invalid_domain')
  })

  it('should allow underscores outside the final two domain segments', () => {
    render(compiler('https://a_b.c_d.example.com/path'))

    expect(root.innerHTML).toBe(
      '<a href="https://a_b.c_d.example.com/path">https://a_b.c_d.example.com/path</a>'
    )
  })

  it('should not link bare URL if it is already inside an anchor tag', () => {
    render(compiler('<a href="https://google.com">https://google.com</a>'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<a href="https://google.com">https://google.com</a>"`
    )
  })

  it('should not link URL if it is nested inside an anchor tag', () => {
    render(
      compiler(
        '<a href="https://google.com">some text <span>with a link https://google.com</span></a>'
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<a href="https://google.com">some text <span>with a link https://google.com</span></a>"`
    )

    render(
      compiler(
        '<a href="https://google.com">some text <span>with a nested link <span>https://google.com</span></span></a>'
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<a href="https://google.com">some text <span>with a nested link <span>https://google.com</span></span></a>"`
    )
  })

  it('should not link bare URL if disabled via options', () => {
    render(compiler('https://google.com', { disableAutoLink: true }))

    expect(root.innerHTML).toMatchInlineSnapshot(`"https://google.com"`)
  })

  it('should not sanitize markdown when explicitly disabled', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(compiler('[foo](javascript:doSomethingBad)', { sanitizer: x => x }))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<a href="javascript:throw new Error(&#x27;React has blocked a javascript: URL as a security precaution.&#x27;)">foo</a>"`
    )

    expect(console.warn).not.toHaveBeenCalled()
  })

  it('tag and attribute are provided to allow for conditional override', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(
      compiler(
        '[foo](javascript:doSomethingBad)\n![foo](javascript:doSomethingBad)',
        {
          sanitizer: (value, tag) => (tag === 'a' ? value : sanitizer(value)),
        }
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`
      "<p><a href="javascript:throw new Error(&#x27;React has blocked a javascript: URL as a security precaution.&#x27;)">foo</a>
      <img alt="foo"/></p>"
    `)

    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('should sanitize markdown links containing JS expressions', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(compiler('[foo](javascript:doSomethingBad)'))

    expect(root.innerHTML).toMatchInlineSnapshot(`"<a>foo</a>"`)

    expect(console.warn).toHaveBeenCalled()
  })

  it('should sanitize markdown links containing JS expressions', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(compiler('![foo](javascript:doSomethingBad)'))

    expect(root.innerHTML).toMatchInlineSnapshot(`"<img alt="foo"/>"`)

    expect(console.warn).toHaveBeenCalled()
  })

  it('should sanitize markdown links containing Data expressions', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(compiler('[foo](data:doSomethingBad)'))
    expect(root.innerHTML).toMatchInlineSnapshot(`"<a>foo</a>"`)
    expect(console.warn).toHaveBeenCalled()
  })

  it('should sanitize markdown links containing VBScript expressions', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(compiler('[foo](vbScript:doSomethingBad)'))
    expect(root.innerHTML).toMatchInlineSnapshot(`"<a>foo</a>"`)
    expect(console.warn).toHaveBeenCalled()
  })

  it('should sanitize markdown links containing encoded JS expressions', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(compiler('[foo](javascript%3AdoSomethingBad)'))

    expect(root.innerHTML).toMatchInlineSnapshot(`"<a>foo</a>"`)

    expect(console.warn).toHaveBeenCalled()
  })

  it('should sanitize markdown links containing padded JS expressions', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(compiler('[foo](  javascript%3AdoSomethingBad)'))

    expect(root.innerHTML).toMatchInlineSnapshot(`"<a>foo</a>"`)

    expect(console.warn).toHaveBeenCalled()
  })

  it('should sanitize markdown links containing padded encoded vscript expressions', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(compiler('[foo](  VBScript%3AdoSomethingBad)'))

    expect(root.innerHTML).toMatchInlineSnapshot(`"<a>foo</a>"`)
    expect(console.warn).toHaveBeenCalled()
  })

  it('should sanitize markdown images containing padded encoded vscript expressions', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(compiler('![foo](  VBScript%3AdoSomethingBad)'))
    expect(root.innerHTML).toMatchInlineSnapshot(`"<img alt="foo"/>"`)
    expect(console.warn).toHaveBeenCalled()
  })

  it('should sanitize markdown links containing padded encoded data expressions', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(compiler('[foo](`<data:doSomethingBad)'))
    expect(root.innerHTML).toMatchInlineSnapshot(`"<a>foo</a>"`)
    expect(console.warn).toHaveBeenCalled()
  })

  it('should sanitize markdown images containing padded encoded data expressions', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(compiler('![foo](`<data:doSomethingBad)'))
    expect(root.innerHTML).toMatchInlineSnapshot(`"<img alt="foo"/>"`)
    expect(console.warn).toHaveBeenCalled()
  })

  it('should sanitize markdown links containing invalid characters', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(compiler('[foo](https://google.com/%AF)'))

    expect(root.innerHTML).toMatchInlineSnapshot(`"<a>foo</a>"`)
    expect(console.warn).toHaveBeenCalled()
  })

  it('should sanitize html links containing JS expressions', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(compiler('<a href="javascript:doSomethingBad">foo</a>'))

    expect(root.innerHTML).toMatchInlineSnapshot(`"<a>foo</a>"`)

    expect(console.warn).toHaveBeenCalled()
  })

  it('should sanitize html links containing encoded, prefixed data expressions', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(compiler('<a href="<`data:doSomethingBad">foo</a>'))
    expect(root.innerHTML).toMatchInlineSnapshot(`"<a>foo</a>"`)
    expect(console.warn).toHaveBeenCalled()
  })

  it('should sanitize html images containing encoded, prefixed JS expressions', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(compiler('<img src="`<javascript:alert>`(\'alertstr\')" />'))
    expect(root.innerHTML).toMatchInlineSnapshot(`"<img/>"`)
    expect(console.warn).toHaveBeenCalled()
  })

  it('should sanitize html images containing weird parsing src=s', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(compiler('<img src="<src=\\"javascript:alert(`xss`)">'))
    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<span>&lt;img src=&quot;&lt;src=&quot;javascript:alert(<code>xss</code>)&quot;&gt;</span>"`
    )
  })

  it('should sanitize style attribute containing known XSS payloads', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(
      compiler(
        '<div style="background-image: url(javascript:alert(`xss`)); color: red;">'
      )
    )
    expect(root.innerHTML).toMatchInlineSnapshot(`"<div></div>"`)
    expect(console.warn).toHaveBeenCalled()
  })

  it('should not sanitize style attribute with an acceptable data image payload', () => {
    spyOn(console, 'warn').mockImplementation(() => {})
    spyOn(console, 'error').mockImplementation(() => {})

    render(
      compiler(
        '<div style="background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==); color: red;">'
      )
    )
    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div style="background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==);color:red"></div>"`
    )
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('should handle a link with a URL in the text', () => {
    render(
      compiler('[https://www.google.com *heck yeah*](http://www.google.com)')
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<a href="http://www.google.com">https://www.google.com <em>heck yeah</em></a>"`
    )
  })

  it('regression test for #188, link inside underscore emphasis with underscore', () => {
    render(
      compiler(
        '_This is emphasized text with [a link](https://example.com/asdf_asdf.pdf), and another [link](https://example.com)._'
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<em>This is emphasized text with <a href="https://example.com/asdf_asdf.pdf">a link</a>, and another <a href="https://example.com">link</a>.</em>"`
    )
  })

  it('regression test for #188, link inside underscore bolding with underscore', () => {
    render(
      compiler(
        '__This is emphasized text with [a link](https://example.com/asdf__asdf.pdf), and another [link](https://example.com).__'
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<strong>This is emphasized text with <a href="https://example.com/asdf__asdf.pdf">a link</a>, and another <a href="https://example.com">link</a>.</strong>"`
    )
  })

  it('renders plain links preceded by text', () => {
    render(compiler('Some text http://www.test.com/some-resource/123'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<span>Some text <a href="http://www.test.com/some-resource/123">http://www.test.com/some-resource/123</a></span>"`
    )
  })

  it('should encode backslashes in URLs per CommonMark spec', () => {
    render(compiler('[link](http://example.com/path\\with\\backslashes)'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<a href="http://example.com/path%5Cwith%5Cbackslashes">link</a>"`
    )
  })

  it('should encode backticks in URLs per CommonMark spec', () => {
    render(compiler('[link](http://example.com/path`with`backticks)'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<a href="http://example.com/path%60with%60backticks">link</a>"`
    )
  })

  it('should preserve existing percent-encoded sequences in URLs', () => {
    render(
      compiler(
        '[link](http://example.com/path%20with\\backslashes%60and`backticks)'
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<a href="http://example.com/path%20with%5Cbackslashes%60and%60backticks">link</a>"`
    )
  })

  it('should encode mixed backslashes and backticks in URLs', () => {
    render(compiler('[link](http://example.com/path\\with`mixed`\\chars)'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<a href="http://example.com/path%5Cwith%60mixed%60%5Cchars">link</a>"`
    )
  })

  it('should handle inline HTML with empty content', () => {
    render(compiler('text <span></span> more'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<span>text <span></span> more</span>"`
    )
  })

  it('should handle trailing whitespace in paragraphs', () => {
    render(compiler('paragraph with trailing spaces   \n\nnext paragraph'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><p>paragraph with trailing spaces</p><p>next paragraph</p></div>"`
    )
  })

  it('should handle self-closing HTML tags', () => {
    render(compiler('text <br> more'))

    // normally this would be <br> but react will render it as <br/>
    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<span>text <br/> more</span>"`
    )
  })
})

describe('lists', () => {
  it('should handle a tight list', () => {
    render(compiler(['- xyz', '- abc', '- foo'].join('\n')))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<ul><li>xyz</li><li>abc</li><li>foo</li></ul>"`
    )
  })

  it('should handle a loose list', () => {
    render(compiler(['- xyz', '', '- abc', '', '- foo'].join('\n')))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<ul><li><p>xyz</p></li><li><p>abc</p></li><li><p>foo</p></li></ul>"`
    )
  })

  it('should handle an ordered list', () => {
    render(compiler(['1. xyz', '1. abc', '1. foo'].join('\n')))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<ol start="1"><li>xyz</li><li>abc</li><li>foo</li></ol>"`
    )
  })

  it('should handle an ordered list with a specific start index', () => {
    render(compiler(['2. xyz', '3. abc', '4. foo'].join('\n')))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<ol start="2"><li>xyz</li><li>abc</li><li>foo</li></ol>"`
    )
  })

  it('should handle a nested list', () => {
    render(compiler(['- xyz', '  - abc', '- foo'].join('\n')))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<ul><li>xyz<ul><li>abc</li></ul></li><li>foo</li></ul>"`
    )
  })

  it('should not add an extra wrapper around a list', () => {
    render(
      compiler(theredoc`

        - xyz
          1. abc
            - def
        - foo

      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<ul><li>xyz<ol start="1"><li>abc<ul><li>def</li></ul></li></ol></li><li>foo</li></ul>"`
    )
  })

  it('should handle link trees', () => {
    render(
      compiler(`
- [buttermilk](#buttermilk)
- [installation](#installation)
- [usage](#usage)
    - [configuration](#configuration)
    - [components](#components)
        - [\`<Router>\`](#router)
        - [\`<RoutingState>\`](#routingstate)
        - [\`<Link>\`](#link)
    - [utilities](#utilities)
        - [\`route(url: String, addNewHistoryEntry: Boolean = true)\`](#routeurl-string-addnewhistoryentry-boolean--true)
    - [holistic example](#holistic-example)
- [goals](#goals)
            `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<ul><li><a href="#buttermilk">buttermilk</a></li><li><a href="#installation">installation</a></li><li><a href="#usage">usage</a><ul><li><a href="#configuration">configuration</a></li><li><a href="#components">components</a><ul><li><a href="#router"><code>&lt;Router&gt;</code></a></li><li><a href="#routingstate"><code>&lt;RoutingState&gt;</code></a></li><li><a href="#link"><code>&lt;Link&gt;</code></a></li></ul></li><li><a href="#utilities">utilities</a><ul><li><a href="#routeurl-string-addnewhistoryentry-boolean--true"><code>route(url: String, addNewHistoryEntry: Boolean = true)</code></a></li></ul></li><li><a href="#holistic-example">holistic example</a></li></ul></li><li><a href="#goals">goals</a></li></ul>"`
    )
  })

  it('handles horizontal rules after lists', () => {
    render(
      compiler(`
-   one
-   two

* * *
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><ul><li>one</li><li>two</li></ul><hr/></div>"`
    )
  })

  it('regression #613 - list false detection inside inline syntax', () => {
    render(
      compiler(`
- foo
- bar **+ baz** qux **quux**
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<ul><li>foo</li><li>bar <strong>+ baz</strong> qux <strong>quux</strong></li></ul>"`
    )
  })
})

it('should continue an indented list', () => {
  render(
    compiler(theredoc`
*   An exclamation mark: \`!\`;
*   followed by a set of square brackets, containing the \`alt\`
    attribute text for the image;
*   followed by a set of parentheses, containing the URL or path to
    the image, and an optional \`title\` attribute enclosed in double
    or single quotes.
      `)
  )

  expect(root.innerHTML).toMatchInlineSnapshot(
    `"<ul><li>An exclamation mark: <code>!</code>;</li><li>followed by a set of square brackets, containing the <code>alt</code> attribute text for the image;</li><li>followed by a set of parentheses, containing the URL or path to the image, and an optional <code>title</code> attribute enclosed in double or single quotes.</li></ul>"`
  )
})

describe('GFM task lists', () => {
  it('should handle unchecked items', () => {
    render(compiler('- [ ] foo'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<ul><li><input readOnly="" type="checkbox"/> foo</li></ul>"`
    )
  })

  it('should handle checked items', () => {
    render(compiler('- [x] foo'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<ul><li><input readOnly="" type="checkbox" checked=""/> foo</li></ul>"`
    )
  })

  it('should mark the checkboxes as readonly', () => {
    render(compiler('- [x] foo'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<ul><li><input readOnly="" type="checkbox" checked=""/> foo</li></ul>"`
    )
  })
})

describe('GFM tables', () => {
  it('should handle a basic table', () => {
    render(
      compiler(theredoc`
        |foo|bar|
        ---|---
        1  |2
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><thead><tr><th>foo</th><th>bar</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>"`
    )
  })

  it('should handle a table with aligned columns', () => {
    render(
      compiler(theredoc`
        |foo|bar|baz|
        --:|:---:|:--
        1|2|3
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><thead><tr><th style="text-align:right">foo</th><th style="text-align:center">bar</th><th style="text-align:left">baz</th></tr></thead><tbody><tr><td style="text-align:right">1</td><td style="text-align:center">2</td><td style="text-align:left">3</td></tr></tbody></table>"`
    )
  })

  it('should handle the other syntax for tables', () => {
    render(
      compiler(theredoc`
        | Foo | Bar |
        | --- | --- |
        | 1   | 2   |
        | 3   | 4   |
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><thead><tr><th>Foo</th><th>Bar</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></tbody></table>"`
    )
  })

  it('should handle the other syntax for tables with alignment', () => {
    render(
      compiler(theredoc`
        | Foo | Bar | Baz |
        | --: | :-: | :-- |
        | 1   | 2   | 3   |
        | 4   | 5   | 6   |
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><thead><tr><th style="text-align:right">Foo</th><th style="text-align:center">Bar</th><th style="text-align:left">Baz</th></tr></thead><tbody><tr><td style="text-align:right">1</td><td style="text-align:center">2</td><td style="text-align:left">3</td></tr><tr><td style="text-align:right">4</td><td style="text-align:center">5</td><td style="text-align:left">6</td></tr></tbody></table>"`
    )
  })

  it('#241 should not ignore the first cell when its contents is empty', () => {
    render(
      compiler(theredoc`
        | Foo | Bar | Baz |
        | --- | --- | --- |
        |   | 2   | 3   |
        |   | 5   | 6   |
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><thead><tr><th>Foo</th><th>Bar</th><th>Baz</th></tr></thead><tbody><tr><td></td><td>2</td><td>3</td></tr><tr><td></td><td>5</td><td>6</td></tr></tbody></table>"`
    )
  })

  it('should handle other content after a table', () => {
    render(
      compiler(theredoc`
        | Foo | Bar | Baz |
        | --: | :-: | :-- |
        | 1   | 2   | 3   |
        | 4   | 5   | 6   |

        Foo
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><table><thead><tr><th style="text-align:right">Foo</th><th style="text-align:center">Bar</th><th style="text-align:left">Baz</th></tr></thead><tbody><tr><td style="text-align:right">1</td><td style="text-align:center">2</td><td style="text-align:left">3</td></tr><tr><td style="text-align:right">4</td><td style="text-align:center">5</td><td style="text-align:left">6</td></tr></tbody></table><p>Foo</p></div>"`
    )
  })

  it('should handle escaped pipes inside a table', () => {
    render(
      compiler(theredoc`
        | \\|Attribute\\| | \\|Type\\|         |
        | --------------- | ------------------ |
        | pos\\|position  | "left" \\| "right" |
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><thead><tr><th>|Attribute|</th><th>|Type|</th></tr></thead><tbody><tr><td>pos|position</td><td>&quot;left&quot; | &quot;right&quot;</td></tr></tbody></table>"`
    )
  })

  it('should handle pipes in code inside a table', () => {
    render(
      compiler(theredoc`
        | Attribute    | Type                  |
        | ------------ | --------------------- |
        | \`position\`   | \`"left" | "right"\`    |
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><thead><tr><th>Attribute</th><th>Type</th></tr></thead><tbody><tr><td><code>position</code></td><td><code>&quot;left&quot; | &quot;right&quot;</code></td></tr></tbody></table>"`
    )
  })

  it('processeses HTML inside of a table row', () => {
    render(
      compiler(theredoc`
        | Header                     |
        | -------------------------- |
        | <div>I'm in a "div"!</div> |
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td><div>I&#x27;m in a &quot;div&quot;!</div></td></tr></tbody></table>"`
    )
  })

  it('regression #625 - processes self-closing HTML inside of a table row', () => {
    render(
      compiler(theredoc`
        | col1 | col2 | col3 |
        |------|-----------------|------------------|
        | col1 | <custom-element>col2</custom-element><br> col2 | <custom-element>col3</custom-element><br>col3 |
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><thead><tr><th>col1</th><th>col2</th><th>col3</th></tr></thead><tbody><tr><td>col1</td><td><custom-element>col2</custom-element><br/> col2</td><td><custom-element>col3</custom-element><br/>col3</td></tr></tbody></table>"`
    )
  })

  it('processes markdown inside of a table row when a preceeding column contains HTML', () => {
    render(
      compiler(theredoc`
        | Column A                   | Column B                 |
        | -------------------------- | ------------------------ |
        | <div>I'm in column A</div> | **Hello from column B!** |
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><thead><tr><th>Column A</th><th>Column B</th></tr></thead><tbody><tr><td><div>I&#x27;m in column A</div></td><td><strong>Hello from column B!</strong></td></tr></tbody></table>"`
    )
  })

  it('processes HTML inside of a table row when a preceeding column contains markdown', () => {
    render(
      compiler(theredoc`
        | Markdown         | HTML                          |
        | ---------------- | ----------------------------- |
        | **I'm Markdown** | <strong>And I'm HTML</strong> |
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><thead><tr><th>Markdown</th><th>HTML</th></tr></thead><tbody><tr><td><strong>I&#x27;m Markdown</strong></td><td><strong>And I&#x27;m HTML</strong></td></tr></tbody></table>"`
    )
  })

  it('processes markdown inside of a table row when a preceeding column contains HTML with nested elements', () => {
    render(
      compiler(theredoc`
        | Nested HTML                        | MD                   |
        | ---------------------------------- | -------------------- |
        | <div><strong>Nested</strong></div> | **I should be bold** |
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><thead><tr><th>Nested HTML</th><th>MD</th></tr></thead><tbody><tr><td><div><strong>Nested</strong></div></td><td><strong>I should be bold</strong></td></tr></tbody></table>"`
    )
  })

  it('processes a markdown link inside of a table row when a preceeding column contains HTML with nested elements', () => {
    render(
      compiler(theredoc`
        | Nested HTML                        | Link                         |
        | ---------------------------------- | ---------------------------- |
        | <div><strong>Nested</strong></div> | [I'm a link](www.google.com) |
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><thead><tr><th>Nested HTML</th><th>Link</th></tr></thead><tbody><tr><td><div><strong>Nested</strong></div></td><td><a href="www.google.com">I&#x27;m a link</a></td></tr></tbody></table>"`
    )
  })

  it('#568 handle inline syntax around table separators', () => {
    render(compiler(`|_foo|bar_|\n|-|-|\n|1|2|`))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><thead><tr><th>_foo</th><th>bar_</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>"`
    )
  })

  it('#568 handle inline code syntax around table separators', () => {
    render(compiler(`|\`foo|bar\`|baz|\n|-|-|\n|1|2|`))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><thead><tr><th><code>foo|bar</code></th><th>baz</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>"`
    )
  })

  it('#644 handles nested inlines within table cells', () => {
    render(
      compiler(theredoc`
      | Nested HTML                        | Link                         |
      | ---------------------------------- | ---------------------------- |
      | <div><strong>Nested</strong></div> | [I'm a \`link\`](www.google.com) |
    `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><thead><tr><th>Nested HTML</th><th>Link</th></tr></thead><tbody><tr><td><div><strong>Nested</strong></div></td><td><a href="www.google.com">I&#x27;m a <code>link</code></a></td></tr></tbody></table>"`
    )
  })

  it('#641 handles only a single newline prior to the start of the table', () => {
    render(
      compiler(theredoc`
      Test
      | Nested HTML                        | Link                         |
      | ---------------------------------- | ---------------------------- |
      | <div><strong>Nested</strong></div> | [I'm a \`link\`](www.google.com) |
    `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><p>Test</p><table><thead><tr><th>Nested HTML</th><th>Link</th></tr></thead><tbody><tr><td><div><strong>Nested</strong></div></td><td><a href="www.google.com">I&#x27;m a <code>link</code></a></td></tr></tbody></table></div>"`
    )
  })
})

describe('arbitrary HTML', () => {
  it('preserves the HTML given', () => {
    const ast = compiler('<dd class="foo">Hello</dd>')
    expect(ast).toMatchInlineSnapshot(`
      {
        "$$typeof": Symbol(react.transitional.element),
        "_debugInfo": null,
        "_debugStack": [Error: react-stack-top-frame],
        "_debugTask": null,
        "_owner": null,
        "_store": {
          "validated": 0,
        },
        "key": "0",
        "props": {
          "children": [
            "Hello",
          ],
          "className": "foo",
          "key": [native code],
        },
        "ref": null,
        "type": "dd",
      }
    `)

    render(ast)
    expect(root.innerHTML).toMatchInlineSnapshot(`"<dd class="foo">Hello</dd>"`)
  })

  it('processes markdown within inline HTML', () => {
    render(compiler('<time>**Hello**</time>'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<time><strong>Hello</strong></time>"`
    )
  })

  it('processes markdown within nested inline HTML', () => {
    render(compiler('<time><span>**Hello**</span></time>'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<time><span><strong>Hello</strong></span></time>"`
    )
  })

  it('processes markdown within nested inline HTML where childen appear more than once', () => {
    render(
      compiler('<dl><dt>foo</dt><dd>bar</dd><dt>baz</dt><dd>qux</dd></dl>')
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<dl><dt>foo</dt><dd>bar</dd><dt>baz</dt><dd>qux</dd></dl>"`
    )
  })

  it('processes attributes within inline HTML', () => {
    render(compiler('<time data-foo="bar">Hello</time>'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<time data-foo="bar">Hello</time>"`
    )
  })

  it('processes attributes that need JSX massaging within inline HTML', () => {
    render(compiler('<span tabindex="0">Hello</span>'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<span tabindex="0">Hello</span>"`
    )
  })

  it('processes inline HTML with inline styles', () => {
    render(
      compiler(
        '<span style="color: red; position: top; margin-right: 10px">Hello</span>'
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<span style="color:red;position:top;margin-right:10px">Hello</span>"`
    )
  })

  it('processes markdown within block-level arbitrary HTML', () => {
    render(compiler('<p>**Hello**</p>'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<p><strong>Hello</strong></p>"`
    )
  })

  it('processes markdown within block-level arbitrary HTML (regression)', () => {
    render(compiler('<div style="float: right">\n# Hello\n</div>'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div style="float:right"><h1 id="hello">Hello</h1></div>"`
    )
  })

  it('renders inline <code> tags', () => {
    render(compiler('Text and <code>**code**</code>'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<span>Text and <code><strong>code</strong></code></span>"`
    )
  })

  it('handles self-closing html inside parsable html (regression)', () => {
    render(
      compiler(
        '<a href="https://opencollective.com/react-dropzone/sponsor/0/website" target="_blank"><img src="https://opencollective.com/react-dropzone/sponsor/0/avatar.svg"></a>'
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<link rel="preload" as="image" href="https://opencollective.com/react-dropzone/sponsor/0/avatar.svg"/><a href="https://opencollective.com/react-dropzone/sponsor/0/website" target="_blank"><img src="https://opencollective.com/react-dropzone/sponsor/0/avatar.svg"/></a>"`
    )
  })

  it('throws out HTML comments', () => {
    render(compiler('Foo\n<!-- blah -->'))

    expect(root.innerHTML).toMatchInlineSnapshot(`"<p>Foo</p>"`)
  })

  it('throws out multiline HTML comments', () => {
    render(
      compiler(`Foo\n<!-- this is
a
multiline
comment -->`)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`"<p>Foo</p>"`)
  })

  it('block HTML regression test', () => {
    render(
      compiler(theredoc`
        <ul id="ProjectSubmenu">
          <li><a href="/projects/markdown/" title="Markdown Project Page">Main</a></li>
          <li><a href="/projects/markdown/basics" title="Markdown Basics">Basics</a></li>
          <li><a class="selected" title="Markdown Syntax Documentation">Syntax</a></li>
          <li><a href="/projects/markdown/license" title="Pricing and License Information">License</a></li>
          <li><a href="/projects/markdown/dingus" title="Online Markdown Web Form">Dingus</a></li>
        </ul>
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<ul id="ProjectSubmenu"><li><a href="/projects/markdown/" title="Markdown Project Page">Main</a><li><a href="/projects/markdown/basics" title="Markdown Basics">Basics</a></li><li><a class="selected" title="Markdown Syntax Documentation">Syntax</a></li><li><a href="/projects/markdown/license" title="Pricing and License Information">License</a></li><li><a href="/projects/markdown/dingus" title="Online Markdown Web Form">Dingus</a></li></li></ul>"`
    )
  })

  it('handles svg', () => {
    render(compiler(fs.readFileSync(__dirname + '/../public/icon.svg', 'utf8')))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<svg width="500" height="500" viewbox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M342.717 257.555H346.232C359.025 257.555 367.424 267.516 371.428 287.438C372.99 324.547 374.553 343.102 376.115 343.102C378.947 348.57 382.854 351.305 387.834 351.305C398.088 351.305 406.877 344.469 414.201 330.797C414.982 326.988 415.373 324.84 415.373 324.352C415.373 320.152 410.686 310.387 401.311 295.055C399.748 290.66 398.967 286.559 398.967 282.75C398.967 272.105 406.584 265.66 421.818 263.414C437.639 263.414 448.186 273.18 453.459 292.711V303.258C453.459 322.301 439.787 343.395 412.443 366.539C400.529 374.742 390.373 380.602 381.975 384.117L381.389 388.219C381.389 397.105 393.303 407.848 417.131 420.445C432.365 431.09 439.982 441.441 439.982 451.5C439.982 462.73 433.146 469.176 419.475 470.836H416.545C403.654 470.836 387.248 460.68 367.326 440.367L360.881 436.852C357.561 436.852 352.092 444.469 344.475 459.703C335.588 471.031 326.604 476.695 317.521 476.695H316.35C304.338 476.695 297.307 469.469 295.256 455.016V452.672C295.256 437.535 305.998 418.98 327.482 397.008C339.592 383.824 345.646 372.105 345.646 361.852V360.68C345.646 350.035 338.42 336.559 323.967 320.25C316.154 310.094 312.248 301.5 312.248 294.469V288.609C312.248 276.305 320.061 266.344 335.686 258.727C338.42 257.945 340.764 257.555 342.717 257.555Z" fill="#FF5A00"></path><path d="M257.756 268.102C274.553 268.102 287.248 276.695 295.842 293.883C298.576 300.23 299.943 306.285 299.943 312.047C299.943 329.332 291.74 341.246 275.334 347.789C273.088 348.57 270.549 348.961 267.717 348.961C255.51 348.961 247.111 341.93 242.521 327.867C241.057 315.758 239.689 309.703 238.42 309.703H237.834C234.709 311.559 233.146 315.074 233.146 320.25C233.146 331.188 243.498 348.961 264.201 373.57C274.748 389.391 280.021 405.016 280.021 420.445V421.031C280.021 448.668 267.131 466.637 241.35 474.938C237.639 475.719 234.709 476.109 232.561 476.109H227.287C206.389 476.109 188.42 464.391 173.381 440.953C167.912 428.551 165.178 418.199 165.178 409.898V402.867C165.178 387.438 172.209 375.523 186.271 367.125C191.35 365.172 195.842 364.195 199.748 364.195C214.201 364.195 225.334 372.008 233.146 387.633C233.928 391.246 234.318 394.176 234.318 396.422C234.318 406.578 226.701 415.562 211.467 423.375C209.123 424.938 207.756 426.695 207.365 428.648C207.365 433.141 214.006 436.266 227.287 438.023C245.256 435.973 254.24 428.16 254.24 414.586C254.24 401.988 245.256 383.434 227.287 358.922C217.131 343.004 212.053 328.941 212.053 316.734V315.562C212.053 293.688 223.771 278.258 247.209 269.273C252.971 268.492 256.486 268.102 257.756 268.102Z" fill="#FF5A00"></path><path d="M155.803 268.688H156.389C167.131 268.688 175.725 275.133 182.17 288.023C184.123 292.027 185.1 296.324 185.1 300.914V303.258C185.1 316.734 178.459 326.109 165.178 331.383L158.732 332.555C155.314 332.164 152.385 331.969 149.943 331.969H146.428C145.158 331.969 144.182 333.922 143.498 337.828C148.576 365.953 151.115 382.75 151.115 388.219V396.422C151.115 427.965 138.42 450.816 113.029 464.977C106.291 468.102 99.6504 469.664 93.1074 469.664H87.248C71.8184 469.664 59.709 461.266 50.9199 444.469C48.9668 439 47.9902 434.312 47.9902 430.406V424.547C47.9902 409.02 56.1934 395.738 72.5996 384.703C77.873 382.359 82.1699 381.188 85.4902 381.188H91.3496C97.502 381.188 102.58 384.508 106.584 391.148C107.756 393.004 108.342 395.543 108.342 398.766C108.342 403.355 104.045 412.145 95.4512 425.133C94.6699 427.672 94.2793 429.43 94.2793 430.406V430.992C94.6699 434.117 96.0371 435.68 98.3809 435.68C106.877 435.68 114.299 425.719 120.646 405.797C122.209 397.203 122.99 390.172 122.99 384.703V375.914C122.014 351.598 116.154 336.754 105.412 331.383C101.604 329.918 92.4238 327.965 77.873 325.523C65.7637 319.957 59.709 312.145 59.709 302.086C59.709 292.125 67.3262 285.289 82.5605 281.578C113.908 278.844 135.393 275.133 147.014 270.445C149.846 269.273 152.775 268.688 155.803 268.688Z" fill="#FF5A00"></path><path d="M410.832 31.6172H416.105C426.652 31.6172 436.418 36.3047 445.402 45.6797C453.605 55.6406 457.707 66.5781 457.707 78.4922C457.707 96.4609 446.574 119.117 424.309 146.461C415.324 158.18 410.832 166.969 410.832 172.828V173.414C410.832 174.293 411.809 174.879 413.762 175.172C418.742 175.172 431.633 168.336 452.434 154.664C459.562 150.758 465.617 148.805 470.598 148.805C480.266 148.805 487.102 154.859 491.105 166.969C491.887 169.898 492.277 172.633 492.277 175.172V179.859C492.277 199.781 482.121 215.211 461.809 226.148C455.461 228.492 449.016 229.664 442.473 229.664H441.887C439.152 229.664 427.434 228.492 406.73 226.148L382.707 229.664C373.723 229.664 368.645 223.414 367.473 210.914V209.742C367.473 194.02 381.145 168.434 408.488 132.984C421.77 114.82 428.41 98.4141 428.41 83.7656C428.41 78.5898 427.629 74.293 426.066 70.875C418.449 70.875 412.395 78.6875 407.902 94.3125C399.797 107.984 390.422 114.82 379.777 114.82H376.848C366.301 114.82 358.684 108.18 353.996 94.8984C353.605 90.0156 353.41 87.4766 353.41 87.2812C353.41 67.75 365.91 50.7578 390.91 36.3047C399.406 33.1797 406.047 31.6172 410.832 31.6172Z" fill="#FF5A00"></path><path d="M266.984 32.2031H270.5C295.402 32.2031 315.715 45.0938 331.438 70.875C339.25 86.6953 343.156 104.859 343.156 125.367C343.156 162.867 331.633 191.383 308.586 210.914C295.988 218.727 286.223 222.633 279.289 222.633C258.879 225.758 238.762 230.445 218.938 236.695C216.887 236.695 215.129 236.891 213.664 237.281C201.945 236.207 196.086 230.543 196.086 220.289V219.117C196.086 205.836 206.438 188.258 227.141 166.383C238.078 151.246 243.547 135.816 243.547 120.094C243.547 109.742 241.008 101.539 235.93 95.4844C231.145 98.2188 226.262 99.5859 221.281 99.5859H219.523C207.414 98.3164 201.359 92.2617 201.359 81.4219V80.8359C201.359 64.8203 213.664 50.7578 238.273 38.6484C247.844 34.3516 257.414 32.2031 266.984 32.2031ZM264.055 88.4531C266.398 105.445 267.57 115.992 267.57 120.094V121.266C267.57 128.688 264.836 143.922 259.367 166.969V173.414C260.93 184.742 266.203 190.406 275.188 190.406C302.141 175.758 315.617 155.055 315.617 128.297V123.609C315.617 100.465 307.609 83.082 291.594 71.4609C288.176 69.5078 284.66 68.5312 281.047 68.5312C271.379 68.5312 265.715 75.1719 264.055 88.4531Z" fill="#FF5A00"></path><path d="M149.211 24H149.797C165.91 24 177.629 38.4531 184.953 67.3594C186.516 76.2461 187.297 84.4492 187.297 91.9688C187.297 99.293 184.758 126.051 179.68 172.242V175.172C180.07 193.531 180.266 207.008 180.266 215.602C180.266 224.977 178.312 229.664 174.406 229.664C171.867 229.664 169.523 224.977 167.375 215.602L166.203 215.016C161.223 219.703 156.926 222.047 153.312 222.047C146.672 222.047 142.18 214.43 139.836 199.195C139.445 195.191 139.25 192.066 139.25 189.82C139.25 179.762 143.352 154.176 151.555 113.062C152.336 104.566 152.727 98.1211 152.727 93.7266C152.727 80.0547 150.188 70.875 145.109 66.1875C144.426 65.7969 143.645 65.6016 142.766 65.6016H142.18C138.762 65.6016 135.637 73.6094 132.805 89.625C131.73 97.0469 130.559 121.461 129.289 162.867C127.531 175.367 124.016 181.617 118.742 181.617C111.125 181.617 104.68 157.984 99.4062 110.719C93.0586 83.7656 85.0508 70.2891 75.3828 70.2891C69.6211 70.2891 66.3008 77.3203 65.4219 91.3828V91.9688C65.4219 104.273 70.3047 126.344 80.0703 158.18C82.0234 167.652 83 175.27 83 181.031C83 204.371 72.4531 219.996 51.3594 227.906C48.4297 228.688 45.6953 229.078 43.1562 229.078H41.3984C23.5273 229.078 12.3945 216.383 8 190.992C11.9062 180.934 17.9609 173.707 26.1641 169.312C42.5703 162.379 50.7734 154.371 50.7734 145.289V140.016C50.7734 137.77 47.8438 118.629 41.9844 82.5938V71.4609C41.9844 47.5352 49.4062 33.2773 64.25 28.6875C64.7383 28.2969 66.1055 28.1016 68.3516 28.1016H69.5234C80.0703 28.1016 92.1797 37.6719 105.852 56.8125C108.098 58.8633 110.441 60.6211 112.883 62.0859C115.715 61.6953 120.598 53.8828 127.531 38.6484C133.879 28.8828 141.105 24 149.211 24Z" fill="#FF5A00"></path></svg>"`
    )
  })

  it('handles nested HTML blocks of the same type (regression)', () => {
    render(
      compiler(theredoc`
        <table>
        <tbody>
            <tr>
            <td>Time</td>
            <td>Payment Criteria</td>
            <td>Payment</td>
            </tr>
            <tr>
            <td>Office Visit </td>
            <td>
                <ul>
                <li>
                    Complete full visit and enroll
                    <ul>
                    <li>Enrolling is fun!</li>
                    </ul>
                </li>
                </ul>
            </td>
            <td>$20</td>
            </tr>
        </tbody>
        </table>
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><tbody><tr><td>Time<td>Payment Criteria</td><td>Payment</td><tr><td>Office Visit </td><td><ul><li>             Complete full visit and enroll             <ul><li>Enrolling is fun!</li></ul></li></ul></td><td>$20</td></tr></td></tr></tbody></table>"`
    )
  })

  it('regression test for #136', () => {
    render(
      compiler(theredoc`
        $25
        <br>
        <br>
        <br>$50
        <br>
        <br>
        <br>$50
        <br>
        <br>
        <br>$50
        <br>
        <br>
        <br>
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`
      "<p>$25
      <br/>
      <br/>
      <br/>$50
      <br/>
      <br/>
      <br/>$50
      <br/>
      <br/>
      <br/>$50
      <br/>
      <br/>
      <br/></p>"
    `)
  })

  it('regression test for #170', () => {
    render(
      compiler(theredoc`
        <table>
          <tbody>
            <tr>
              <td>a</td>
              <td>b</td>
              <td>c</td>
            </tr>
            <tr>
              <td>left</td>
              <td>
                <p>Start of table</p>
                <ul>
                  <li>List 1</li>
                  <li>
                    <ul>
                      <li>Nested List 1</li>
                    </ul>
                  </li>
                  <li>
                    <ul>
                      <li>list 2</li>
                    </ul>
                  </li>
                </ul>
              </td>
              <td>right</td>
            </tr>
          </tbody>
        </table>
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<table><tbody><tr><td>a<td>b</td><td>c</td><tr><td>left</td><td><p>Start of table</p><ul><li>List 1</li><li><ul><li>Nested List 1</li></ul></li><li><ul><li>list 2</li></ul></li></ul></td><td>right</td></tr></td></tr></tbody></table>"`
    )
  })

  it('#140 self-closing HTML with indentation', () => {
    function DatePicker() {
      return <div className="datepicker" />
    }

    render(
      compiler(
        theredoc`
          <DatePicker
            biasTowardDateTime="2017-12-05T07:39:36.091Z"
            timezone="UTC+5"
          />
        `,
        { overrides: { DatePicker } }
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div class="datepicker"></div>"`
    )
  })

  it('handles jsx attribute interpolation as a string', () => {
    function DatePicker({ endTime, startTime }) {
      return (
        <div>
          {startTime} to {endTime}
        </div>
      )
    }

    render(
      compiler(
        theredoc`
          <DatePicker
            startTime={1514579720511}
            endTime={"1514579720512"}
          />
        `,
        { overrides: { DatePicker } }
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div>1514579720511<!-- --> to <!-- -->&quot;1514579720512&quot;</div>"`
    )
  })

  it('handles jsx inside jsx interpolations', () => {
    function InterpolationTest({
      component,
      component2,
      component3,
      component4,
    }) {
      return (
        <div>
          {component} and {component2} and {component3} and {component4}
        </div>
      )
    }

    function Inner({ children, ...props }) {
      return (
        <div {...props} className="inner">
          {children}
        </div>
      )
    }

    render(
      compiler(
        theredoc`
          <InterpolationTest
            component={<Inner children="bah" />}
            component2={<Inner>blah</Inner>}
            component3={<Inner disabled />}
            component4={<Inner disabled={false} />}
          />
        `,
        { overrides: { Inner, InterpolationTest } }
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><div class="inner">bah</div> and <div class="inner">blah</div> and <div disabled="" class="inner"></div> and <div class="inner"></div></div>"`
    )
  })

  it('handles malformed HTML', () => {
    render(
      compiler(
        theredoc`
          <g>
          <g>
          <path fill="#ffffff"/>
          </g>
          <path fill="#ffffff"/>
        `
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<g><g><path fill="#ffffff"></path></g><path fill="#ffffff"></path></g>"`
    )
  })

  it('allows whitespace between attribute and value', () => {
    render(
      compiler(
        theredoc`
          <div class = "foo" style= "background:red;" id ="baz">
          Bar
          </div>
        `
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div class="foo" style="background:red" id="baz">Bar </div>"`
    )
  })

  it('handles a raw hashtag inside HTML', () => {
    render(compiler(['"<span>#</span>"'].join('\n')))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<span>&quot;<span>#</span>&quot;</span>"`
    )
  })

  it('handles a heading inside HTML', () => {
    render(compiler('"<span># foo</span>"'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<span>&quot;<span><h1 id="foo">foo</h1></span>&quot;</span>"`
    )
  })

  it('does not parse the inside of <style> blocks', () => {
    render(
      compiler(
        theredoc`
          <style>
            .bar {
              color: red;
            }
          </style>
        `,
        { tagfilter: false }
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`
      "<style>  .bar {
          color: red;
        }</style>"
    `)
  })

  it('does not parse the inside of <script> blocks', () => {
    render(
      compiler(
        theredoc`
          <script>
            new Date();
          </script>
        `,
        { tagfilter: false }
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<script>  new Date();</script>"`
    )
  })

  it('does not parse the inside of <script> blocks with weird capitalization', () => {
    render(
      compiler(['<SCRIPT>', '  new Date();', '</SCRIPT>'].join('\n'), {
        tagfilter: false,
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<SCRIPT>  new Date();</SCRIPT>"`
    )
  })

  it('handles nested tags of the same type with attributes', () => {
    render(
      compiler(theredoc`
        <div id="foo">
          <div id="bar">Baz</div>
        </div>
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div id="foo"><div id="bar">Baz</div></div>"`
    )
  })

  it('#180 handles invalid character error with angle brackets', () => {
    render(compiler('1<2 or 2>1'))

    expect(root.innerHTML).toMatchInlineSnapshot(`"1&lt;2 or 2&gt;1"`)
  })

  it('#181 handling of figure blocks', () => {
    render(
      compiler(
        theredoc`
          <figure>
          ![](//placehold.it/300x200)
          <figcaption>This is a placeholder image</figcaption>
          </figure>
        `
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<link rel="preload" as="image" href="//placehold.it/300x200"/><figure><img src="//placehold.it/300x200"/><figcaption>This is a placeholder image</figcaption></figure>"`
    )
  })

  it('#185 handles block syntax MD + HTML inside HTML', () => {
    render(
      compiler(theredoc`
        <details>
        <summary>Solution</summary>

        \`\`\`jsx
        import styled from 'styled-components';
        \`\`\`
        </details>
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<details><summary>Solution</summary><pre><code class="language-jsx lang-jsx">import styled from &#x27;styled-components&#x27;;</code></pre></details>"`
    )
  })

  it('#207 handles tables inside HTML', () => {
    render(
      compiler(theredoc`
        <details>
        <summary>Click here</summary>

        | Heading 1 | Heading 2 |
        | --------- | --------- |
        | Foo       | Bar       |

        </details>
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<details><summary>Click here</summary><table><thead><tr><th>Heading 1</th><th>Heading 2</th></tr></thead><tbody><tr><td>Foo</td><td>Bar</td></tr></tbody></table></details>"`
    )
  })

  it('#185 misc regression test', () => {
    render(
      compiler(theredoc`
        <details>
        <summary>View collapsed content</summary>

        # Title h1

        ## Title h2

        Text content

        * list 1
        * list 2
        * list 3


        </details>
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<details><summary>View collapsed content</summary><h1 id="title-h1">Title h1</h1><h2 id="title-h2">Title h2</h2><p>Text content</p><ul><li>list 1</li><li>list 2</li><li>list 3</li></ul></details>"`
    )
  })

  it('multiline left-trims by the same amount as the first line', () => {
    render(
      compiler(theredoc`
        <div>
        \`\`\`kotlin
        fun main() {
            print("Hello world")
        }
        \`\`\`
        </div>
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`
      "<div><pre><code class="language-kotlin lang-kotlin">fun main() {
          print(&quot;Hello world&quot;)
      }</code></pre></div>"
    `)
  })

  it('nested lists work inside html', () => {
    render(
      compiler(theredoc`
        <div>
        * hi
        * hello
            * how are you?
        </div>
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><ul><li>hi</li><li>hello<ul><li>how are you?</li></ul></li></ul></div>"`
    )
  })

  it('#214 nested paragraphs work inside html', () => {
    render(
      compiler(theredoc`
        <div>
          Hello

          World
        </div>
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`
      "<div><p>Hello</p><p>World
      </p></div>"
    `)
  })

  it('does not consume trailing whitespace if there is no newline', () => {
    const Foo = () => <span>Hello</span>

    render(compiler('<Foo/> World!', { overrides: { Foo } }))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<span><span>Hello</span> World!</span>"`
    )
  })

  it('should not fail with lots of \\n in the middle of the text', () => {
    render(
      compiler(
        'Text\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\ntext',
        {
          forceBlock: true,
        }
      )
    )
    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><p>Text</p><p>text</p></div>"`
    )
  })

  it('should not render html if disableParsingRawHTML is true', () => {
    render(
      compiler('Text with <span>html</span> inside', {
        disableParsingRawHTML: true,
      })
    )
    expect(root.innerHTML).toMatchInlineSnapshot(
      `"Text with &lt;span&gt;html&lt;/span&gt; inside"`
    )
  })

  it('should render html if disableParsingRawHTML is false', () => {
    render(
      compiler('Text with <span>html</span> inside', {
        disableParsingRawHTML: false,
      })
    )
    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<span>Text with <span>html</span> inside</span>"`
    )
  })

  it('#465 misc regression test', () => {
    render(compiler('hello [h]:m **world**'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<span>hello [h]:m <strong>world</strong></span>"`
    )
  })

  it('#455 fenced code block regression test', () => {
    render(
      compiler(`Hello world example

\`\`\`python data-start="2"
print("hello world")
\`\`\``)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><p>Hello world example</p><pre><code data-start="2" class="language-python lang-python">print(&quot;hello world&quot;)</code></pre></div>"`
    )
  })

  it('#444 switching list formats regression test', () => {
    render(
      compiler(
        `
1.  One
2.  Two
3.  Three

*   Red
*   Green
*   Blue
        `
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><ol start="1"><li>One</li><li>Two</li><li>Three</li></ol><ul><li>Red</li><li>Green</li><li>Blue</li></ul></div>"`
    )
  })

  it('#466 list-like syntax inside link regression test', () => {
    render(
      compiler(
        'Hello, I think that [6. Markdown](http://daringfireball.net/projects/markdown/) lets you write content in a really natural way.'
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<span>Hello, I think that <a href="http://daringfireball.net/projects/markdown/">6. Markdown</a> lets you write content in a really natural way.</span>"`
    )
  })

  it('#540 multiline attributes are supported', () => {
    render(
      compiler(
        `<p>
Item detail
<span
  style="
    color: #fddb67;
    font-size: 11px;
    font-style: normal;
    font-weight: 500;
    line-height: 18px;
    text-decoration-line: underline;
  "
  >debug item 1</span
>
</p>`
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`
      "<p>
      Item detail
      <span style="color:#fddb67;font-size:11px;font-style:normal;font-weight:500;line-height:18px;text-decoration-line:underline">debug item 1</span>
      </p>"
    `)
  })

  it('#686 should not add unnecessary paragraphs', () => {
    render(compiler(`<tag1><tag2>text1</tag2>text2</tag1>`))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<tag1><tag2>text1</tag2>text2</tag1>"`
    )
  })

  it('should not process pre blocks inside of arbitrary HTML', () => {
    render(
      compiler(`<table><tr><td>
<pre>
**Hello**,

_world_.
</pre>
</td></tr></table>`)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`
      "<table><tr><td>
      <pre>
      **Hello**,

      _world_.
      </pre></td></tr></table>"
    `)
  })
})

describe('horizontal rules', () => {
  it('should handle the various syntaxes', () => {
    render(
      compiler(theredoc`
        * * *

        ***

        *****

        - - -

        ---------------------------------------
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><hr/><hr/><hr/><hr/><hr/></div>"`
    )
  })
})

describe('line breaks', () => {
  it('should be added for 2-space sequences', () => {
    render(compiler(['hello  ', 'there'].join('\n')))

    expect(root.innerHTML).toMatchInlineSnapshot(`"<p>hello<br/>there</p>"`)
  })
})

describe('fenced code blocks', () => {
  it('should be handled', () => {
    render(compiler(['```js', 'foo', '```'].join('\n')))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<pre><code class="language-js lang-js">foo</code></pre>"`
    )
  })

  it('should not strip HTML comments inside fenced blocks', () => {
    render(
      compiler(
        `
\`\`\`html
<!-- something -->
Yeah boi
\`\`\`
`.trim()
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`
      "<pre><code class="language-html lang-html">&lt;!-- something --&gt;
      Yeah boi</code></pre>"
    `)
  })

  it('regression 602 - should treat anything following ``` as code until the closing pair', () => {
    render(compiler('```\nfoo'))

    expect(root.innerHTML).toMatchInlineSnapshot(`
      "<pre><code>foo
      </code></pre>"
    `)
  })

  it('regression 670 - fenced code block intentional escape', () => {
    render(compiler('```\n\\%\n```'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<pre><code>\\%</code></pre>"`
    )
  })
})

describe('indented code blocks', () => {
  it('should be handled', () => {
    render(compiler('    foo\n\n'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<pre><code>foo</code></pre>"`
    )
  })
})

describe('inline code blocks', () => {
  it('naked backticks can be used unescaped if there are two or more outer backticks', () => {
    render(compiler('``hi `foo` there``'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<code>hi \`foo\` there</code>"`
    )
  })
})

describe('footnotes', () => {
  it('should handle conversion of references into links', () => {
    render(
      compiler(theredoc`
        foo[^abc] bar

        [^abc]: Baz baz
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><p>foo<a href="#abc"><sup>abc</sup></a> bar</p><footer><div id="abc">abc: <!-- -->Baz baz</div></footer></div>"`
    )
  })

  it('should handle complex references', () => {
    render(
      compiler(theredoc`
        foo[^referencé heré 123] bar

        [^referencé heré 123]: Baz baz
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><p>foo<a href="#reference-here-123"><sup>referencé heré 123</sup></a> bar</p><footer><div id="reference-here-123">referencé heré 123: <!-- -->Baz baz</div></footer></div>"`
    )
  })

  it('should handle conversion of multiple references into links', () => {
    render(
      compiler(theredoc`
        foo[^abc] bar. baz[^def]

        [^abc]: Baz baz
        [^def]: Def
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><p>foo<a href="#abc"><sup>abc</sup></a> bar. baz<a href="#def"><sup>def</sup></a></p><footer><div id="abc">abc: <!-- -->Baz baz</div><div id="def">def: <!-- -->Def</div></footer></div>"`
    )
  })

  it('should inject the definitions in a footer at the end of the root', () => {
    render(
      compiler(theredoc`
        foo[^abc] bar

        [^abc]: Baz baz
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><p>foo<a href="#abc"><sup>abc</sup></a> bar</p><footer><div id="abc">abc: <!-- -->Baz baz</div></footer></div>"`
    )
  })

  it('should handle single word footnote definitions', () => {
    render(
      compiler(theredoc`
        foo[^abc] bar

        [^abc]: Baz
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><p>foo<a href="#abc"><sup>abc</sup></a> bar</p><footer><div id="abc">abc: <!-- -->Baz</div></footer></div>"`
    )
  })

  it('should not blow up if footnote syntax is seen but no matching footnote was found', () => {
    expect(() => render(compiler('[one] [two]'))).not.toThrow()
    expect(root.innerHTML).toMatchInlineSnapshot(`"[one] [two]"`)
  })

  it('should handle multiline footnotes', () => {
    render(
      compiler(theredoc`
        foo[^abc] bar

        [^abc]: Baz
          line2
          line3

        After footnotes content
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`
      "<div><p>foo<a href="#abc"><sup>abc</sup></a> bar</p><p>After footnotes content</p><footer><div id="abc">abc: <!-- -->Baz
        line2
        line3</div></footer></div>"
    `)
  })

  it('should handle mixed multiline and singleline footnotes', () => {
    render(
      compiler(theredoc`
        a[^a] b[^b] c[^c]

        [^a]: single
        [^b]: bbbb
          bbbb
          bbbb
        [^c]: single-c
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`
      "<div><p>a<a href="#a"><sup>a</sup></a> b<a href="#b"><sup>b</sup></a> c<a href="#c"><sup>c</sup></a></p><footer><div id="a">a: <!-- -->single</div><div id="b">b: <!-- -->bbbb
        bbbb
        bbbb</div><div id="c">c: <!-- -->single-c</div></footer></div>"
    `)
  })

  it('should handle indented multiline footnote', () => {
    render(
      compiler(theredoc`
        Here's a simple footnote,[^1] and here's a longer one.[^bignote]

        [^1]: This is the first footnote.

        [^bignote]: Here's one with multiple paragraphs and code.

            Indent paragraphs to include them in the footnote.

            \`{ my code }\`

            Add as many paragraphs as you like.
      `)
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`
      "<div><p>Here&#x27;s a simple footnote,<a href="#1"><sup>1</sup></a> and here&#x27;s a longer one.<a href="#bignote"><sup>bignote</sup></a></p><footer><div id="1">1: <!-- -->This is the first footnote.</div><div id="bignote">bignote: <!-- -->Here&#x27;s one with multiple paragraphs and code.

          Indent paragraphs to include them in the footnote.

          <code>{ my code }</code>

          Add as many paragraphs as you like.</div></footer></div>"
    `)
  })
})

describe('named character entity decoding', () => {
  // All named entities are now supported by default via the full entity list
  const content =
    '&AElig;,&Aacute;,&Acirc;,&Agrave;,&Aring;,&Atilde;,&Auml;,&Ccedil;,&Eacute;,&Ecirc;,&Egrave;,&Euml;,&Iacute;,&Icirc;,&Igrave;,&Iuml;,&Ntilde;,&Oacute;,&Ocirc;,&Ograve;,&Oslash;,&Otilde;,&Ouml;,&Uacute;,&Ucirc;,&Ugrave;,&Uuml;,&Yacute;,&aacute;,&acirc;,&aelig;,&agrave;,&aring;,&atilde;,&auml;,&ccedil;,&coy;,&eacute;,&ecirc;,&egrave;,&euml;,&ge;,&iacute;,&icirc;,&igrave;,&iuml;,&laquo;,&le;,&nbsp;,&ntilde;,&oacute;,&ocirc;,&ograve;,&oslash;,&otilde;,&ouml;,&para;,&quot;,&raquo;,&szlig;,&uacute;,&ucirc;,&ugrave;,&uuml;,&yacute;'

  it('should replace special HTML characters', () => {
    render(compiler(content))
    expect(root.innerHTML).toMatchInlineSnapshot(
      `"Æ,Á,Â,À,Å,Ã,Ä,Ç,É,Ê,È,Ë,Í,Î,Ì,Ï,Ñ,Ó,Ô,Ò,Ø,Õ,Ö,Ú,Û,Ù,Ü,Ý,á,â,Æ,à,å,ã,ä,ç,&amp;coy;,é,ê,è,ë,≥,í,î,ì,ï,«,≤, ,ñ,ó,ô,ò,ø,õ,ö,¶,&quot;,»,ß,ú,û,ù,ü,ý"`
    )
  })
})

describe('options.forceBlock', () => {
  it('treats given markdown as block-context', () => {
    render(
      compiler("Hello. _Beautiful_ day isn't it?", {
        forceBlock: true,
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<p>Hello. <em>Beautiful</em> day isn&#x27;t it?</p>"`
    )
  })
})

describe('options.forceInline', () => {
  it('treats given markdown as inline-context, passing through any block-level markdown syntax', () => {
    render(compiler('# You got it babe!', { forceInline: true }))

    expect(root.innerHTML).toMatchInlineSnapshot(`"# You got it babe!"`)
  })
})

describe('options.wrapper', () => {
  it('is ignored when there is a single child', () => {
    render(compiler('Hello, world!', { wrapper: 'article' }))

    expect(root.innerHTML).toMatchInlineSnapshot(`"Hello, world!"`)
  })

  it('overrides the wrapper element when there are multiple children', () => {
    render(compiler('Hello\n\nworld!', { wrapper: 'article' }))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<article><p>Hello</p><p>world!</p></article>"`
    )
  })

  it('renders an array when `null`', () => {
    expect(compiler('Hello\n\nworld!', { wrapper: null }))
      .toMatchInlineSnapshot(`
      [
        {
          "$$typeof": Symbol(react.transitional.element),
          "_debugInfo": null,
          "_debugStack": [Error: react-stack-top-frame],
          "_debugTask": null,
          "_owner": null,
          "_store": {
            "validated": 0,
          },
          "key": "0",
          "props": {
            "children": [
              "Hello",
            ],
            "className": undefined,
            "key": [native code],
          },
          "ref": null,
          "type": "p",
        },
        {
          "$$typeof": Symbol(react.transitional.element),
          "_debugInfo": null,
          "_debugStack": [Error: react-stack-top-frame],
          "_debugTask": null,
          "_owner": null,
          "_store": {
            "validated": 0,
          },
          "key": "1",
          "props": {
            "children": [
              "world!",
            ],
            "className": undefined,
            "key": [native code],
          },
          "ref": null,
          "type": "p",
        },
      ]
    `)
  })

  it('works with `React.Fragment`', () => {
    render(compiler('Hello\n\nworld!', { wrapper: React.Fragment }))

    expect(root.innerHTML).toMatchInlineSnapshot(`"<p>Hello</p><p>world!</p>"`)
  })
})

describe('options.forceWrapper', () => {
  it('ensures wrapper element is present even with a single child', () => {
    render(compiler('Hi Evan', { wrapper: 'aside', forceWrapper: true }))

    expect(root.innerHTML).toMatchInlineSnapshot(`"<aside>Hi Evan</aside>"`)
  })
})

describe('options.createElement', () => {
  it('should render a <custom> element if render function overrides the element type', () => {
    render(
      compiler('Hello', {
        createElement(tag, props, children) {
          return React.createElement('custom', props, children)
        },
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`"Hello"`)
  })

  it('should render an empty <div> element', () => {
    render(
      compiler('Hello', {
        createElement() {
          return React.createElement('div')
        },
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`"Hello"`)
  })
})

describe('options.renderRule', () => {
  it('should allow arbitrary modification of content', () => {
    render(
      compiler('Hello.\n\n```latex\n$$f(X,n) = X_n + X_{n-1}$$\n```\n', {
        renderRule(next, node, renderChildren, state) {
          if (node.type === RuleType.codeBlock && node.lang === 'latex') {
            return <div key={state.key}>I'm latex.</div>
          }

          return next()
        },
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><p>Hello.</p><div>I&#x27;m latex.</div></div>"`
    )
  })

  it('can be used to handle shortcodes', () => {
    const shortcodeMap = {
      'big-smile': '🙂',
    }

    const detector = /(:[^:]+:)/g

    const replaceEmoji = (text: string): React.ReactNode => {
      return text.split(detector).map((part, index) => {
        if (part.startsWith(':') && part.endsWith(':')) {
          const shortcode = part.slice(1, -1)

          return <span key={index}>{shortcodeMap[shortcode] || part}</span>
        }

        return part
      })
    }

    render(
      compiler('Hey there! :big-smile:', {
        renderRule(next, node) {
          if (node.type === RuleType.text && detector.test(node.text)) {
            return replaceEmoji(node.text)
          }

          return next()
        },
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<span>Hey there! <span>🙂</span></span>"`
    )
  })
})

describe('options.slugify', () => {
  it('should use a custom slugify function rather than the default if set and valid', () => {
    render(compiler('# 中文', { slugify: str => str }))

    expect(root.innerHTML).toMatchInlineSnapshot(`"<h1 id="中文">中文</h1>"`)
  })

  it('should use the default function if unset', () => {
    render(compiler('# 中文'))

    expect(root.innerHTML).toMatchInlineSnapshot(`"<h1 id="">中文</h1>"`)
  })

  it('should throw error if invalid', () => {
    expect(() => {
      // @ts-ignore
      render(compiler('# 中文', { slugify: 'invalid' }))
    }).toThrow()
  })

  it('should throw error if options.overrides is not an object', () => {
    expect(() => {
      // @ts-ignore
      render(compiler('# test', { overrides: 'invalid' }))
    }).toThrow(/options\.overrides/)
  })

  it('should throw error if options.overrides is an array', () => {
    expect(() => {
      // @ts-ignore
      render(compiler('# test', { overrides: [] }))
    }).toThrow(/options\.overrides/)
  })
})

describe('overrides', () => {
  it('should substitute the appropriate JSX tag if given a component', () => {
    class FakeParagraph extends React.Component<React.PropsWithChildren<{}>> {
      render() {
        return <p className="foo">{this.props.children}</p>
      }
    }

    render(
      compiler('Hello.\n\n', {
        overrides: { p: { component: FakeParagraph } },
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`"<p class="foo">Hello.</p>"`)
  })

  it('should substitute custom components when found', () => {
    const CustomButton: React.FC<
      React.JSX.IntrinsicElements['button']
    > = props => <button {...props} />

    render(
      compiler('<CustomButton>Click me!</CustomButton>', {
        overrides: { CustomButton },
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`"<button>Click me!</button>"`)
  })

  it('should allow for particular html tags to be voided by configuration', () => {
    render(
      compiler(
        '<iframe src="https://my-malicious-web-page.ngrok-free.app/"></iframe>',
        {
          tagfilter: false,
          overrides: {
            iframe: () => null,
          },
        }
      )
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`""`)
  })

  it('should accept an override shorthand if props do not need to be overidden', () => {
    class FakeParagraph extends React.Component<React.PropsWithChildren<{}>> {
      render() {
        return <p className="foo">{this.props.children}</p>
      }
    }

    render(compiler('Hello.\n\n', { overrides: { p: FakeParagraph } }))

    expect(root.innerHTML).toMatchInlineSnapshot(`"<p class="foo">Hello.</p>"`)
  })

  it('should add props to the appropriate JSX tag if supplied', () => {
    render(
      compiler('Hello.\n\n', {
        overrides: { p: { props: { className: 'abc', title: 'foo' } } },
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<p class="abc" title="foo">Hello.</p>"`
    )
  })

  it('should override the title property when parsing a link', () => {
    class FakeLink extends React.Component<
      React.PropsWithChildren<{ title: string }>
    > {
      render() {
        const { title, children } = this.props
        return <a title={title}>{children}</a>
      }
    }

    render(
      compiler('[link](https://example.org)', {
        overrides: { a: { component: FakeLink, props: { title: 'foo' } } },
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`"<a title="foo">link</a>"`)
  })

  it('should add props to pre & code tags if supplied', () => {
    render(
      compiler(['```', 'foo', '```'].join('\n'), {
        overrides: {
          code: {
            props: {
              'data-foo': 'bar',
            },
          },

          pre: {
            props: {
              className: 'abc',
            },
          },
        },
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<pre class="abc"><code data-foo="bar">foo</code></pre>"`
    )
  })

  it('should substitute pre & code tags if supplied with an override component', () => {
    class OverridenPre extends React.Component<React.PropsWithChildren<{}>> {
      render() {
        const { children, ...props } = this.props

        return (
          <pre {...props} data-bar="baz">
            {children}
          </pre>
        )
      }
    }

    class OverridenCode extends React.Component<React.PropsWithChildren<{}>> {
      render() {
        const { children, ...props } = this.props

        return (
          <code {...props} data-baz="fizz">
            {children}
          </code>
        )
      }
    }

    render(
      compiler(['```', 'foo', '```'].join('\n'), {
        overrides: {
          code: {
            component: OverridenCode,
            props: {
              'data-foo': 'bar',
            },
          },

          pre: {
            component: OverridenPre,
            props: {
              className: 'abc',
            },
          },
        },
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<pre class="abc" data-bar="baz"><code data-foo="bar" data-baz="fizz">foo</code></pre>"`
    )
  })

  it('should be able to override gfm task list items', () => {
    render(
      compiler('- [ ] foo', {
        overrides: { li: { props: { className: 'foo' } } },
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<ul><li class="foo"><input readOnly="" type="checkbox"/> foo</li></ul>"`
    )
  })

  it('should be able to override gfm task list item checkboxes', () => {
    render(
      compiler('- [ ] foo', {
        overrides: { input: { props: { className: 'foo' } } },
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<ul><li><input readOnly="" type="checkbox" class="foo"/> foo</li></ul>"`
    )
  })

  it('should substitute the appropriate JSX tag if given a component and disableParsingRawHTML is true', () => {
    const FakeParagraph = ({ children }) => <p className="foo">{children}</p>

    render(
      compiler('Hello.\n\n', {
        disableParsingRawHTML: true,
        overrides: { p: { component: FakeParagraph } },
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`"<p class="foo">Hello.</p>"`)
  })

  it('should not substitute the appropriate JSX tag inline if given a component and disableParsingRawHTML is true', () => {
    const FakeSpan = ({ children }) => <span className="foo">{children}</span>

    render(
      compiler('Hello.\n\n<FakeSpan>I am a fake span</FakeSpan>', {
        disableParsingRawHTML: true,
        overrides: { FakeSpan },
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><p>Hello.</p><p>&lt;FakeSpan&gt;I am a fake span&lt;/FakeSpan&gt;</p></div>"`
    )
  })

  it('#530 nested overrides', () => {
    render(
      compiler('<Accordion><AccordionItem>test</AccordionItem></Accordion>', {
        overrides: {
          Accordion: ({ children }) => children,
          AccordionItem: ({ children }) => children,
        },
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`"test"`)
  })

  it('#520 handle deep nesting', () => {
    render(compiler('<div><div><div></div></div></div>'))

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div><div><div></div></div></div>"`
    )
  })

  it('should pass complex data prop to custom CodeBlock component', () => {
    const expectedData = [{ a: [{ b: 1 }] }]
    let receivedData: unknown

    const CodeBlock: React.FC<{ data?: string }> = ({ data }) => {
      receivedData = data ? JSON.parse(data) : null
      return <pre>{data}</pre>
    }

    render(
      compiler(`<CodeBlock data='${JSON.stringify(expectedData)}' />`, {
        overrides: { CodeBlock },
      })
    )

    expect(receivedData).toEqual(expectedData)
  })
})

it('should remove YAML front matter', () => {
  render(
    compiler(theredoc`
      ---
      key: value
      other_key: different value
      ---
      Hello.
    `)
  )

  expect(root.innerHTML).toMatchInlineSnapshot(`"<p>Hello.</p>"`)
})

it('correctly parses YAML front matter inside a code block', () => {
  render(
    compiler(theredoc`
      \`\`\`
      ---
      key: value
      other_key: different value
      ---
      Hello.
      \`\`\`
    `)
  )

  expect(root.innerHTML).toMatchInlineSnapshot(`
    "<pre><code>---
    key: value
    other_key: different value
    ---
    Hello.</code></pre>"
  `)
})

it('handles <code> brackets in link text', () => {
  render(compiler('[`[text]`](https://example.com)'))

  expect(root.innerHTML).toMatchInlineSnapshot(
    `"<a href="https://example.com"><code>[text]</code></a>"`
  )
})

it('handles naked brackets in link text', () => {
  render(compiler('[[text]](https://example.com)'))

  expect(root.innerHTML).toMatchInlineSnapshot(
    `"<a href="https://example.com">[text]</a>"`
  )
})

it('handles multiple nested brackets in link text', () => {
  render(compiler('[title[bracket1][bracket2][3]](https://example.com)'))

  expect(root.innerHTML).toMatchInlineSnapshot(
    `"<a href="https://example.com">title[bracket1][bracket2][3]</a>"`
  )
})

it('#597 handles script tag with empty content', () => {
  render(compiler('<script src="dummy.js"></script>', { tagfilter: false }))

  expect(root.innerHTML).toMatchInlineSnapshot(
    `"<script src="dummy.js"></script>"`
  )
})

it('#678 handles various combinations of inline markup and html', () => {
  render(
    compiler(`
**bold** *italic*

*italic* **bold**

*italic* <u>underline</u>

<u>underline</u> *italic*

~~strikethrough~~ **bold*

*italic* ~~strikethrough~~

**bold** ~~strikethrough~~
  `)
  )

  expect(root.innerHTML).toMatchInlineSnapshot(
    `"<div><p><strong>bold</strong> <em>italic</em></p><p><em>italic</em> <strong>bold</strong></p><p><em>italic</em> <u>underline</u></p><p><u>underline</u> <em>italic</em></p><p><del>strikethrough</del> *<em>bold</em></p><p><em>italic</em> <del>strikethrough</del></p><p><strong>bold</strong> <del>strikethrough</del></p></div>"`
  )
})

it('handles a holistic example', () => {
  const md = fs.readFileSync(__dirname + '/markdown-spec.md', 'utf8')
  render(compiler(md))

  expect(root.innerHTML).toMatchSnapshot()
})

describe('Markdown component', () => {
  it('accepts markdown content', () => {
    render(<Markdown>_Hello._</Markdown>)

    expect(root.innerHTML).toMatchInlineSnapshot(`"<em>Hello.</em>"`)
  })

  it('handles a no-children scenario', () => {
    render(<Markdown>{''}</Markdown>)

    expect(root.innerHTML).toMatchInlineSnapshot(`""`)
  })

  it('handles a null-children scenario', () => {
    render(<Markdown>{null}</Markdown>)
    expect(root.innerHTML).toMatchInlineSnapshot(`""`)
  })

  it('accepts options', () => {
    class FakeParagraph extends React.Component<React.PropsWithChildren<{}>> {
      render() {
        return <p className="foo">{this.props.children}</p>
      }
    }

    render(
      <Markdown options={{ overrides: { p: { component: FakeParagraph } } }}>
        _Hello._
      </Markdown>
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`"<em>Hello.</em>"`)
  })

  it('merges className overrides, rather than overwriting', () => {
    const code = ['```js', 'foo', '```'].join('\n')

    renderToString(
      <Markdown
        options={{
          overrides: { code: { props: { className: 'foo' } } },
        }}
      >
        {code}
      </Markdown>
    )

    expect(root.innerHTML).toMatchInlineSnapshot(`""`)
  })

  it('passes along any additional props to the rendered wrapper element', () => {
    render(<Markdown className="foo"># Hello</Markdown>)

    expect(root.innerHTML).toMatchInlineSnapshot(`"<h1 id="hello">Hello</h1>"`)
  })

  it('can render simple math', () => {
    expect(
      renderToString(
        <Markdown>{`<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><semantics><mrow><mfrac><mrow>a</mrow><mrow>2</mrow></mfrac></mrow><annotation encoding="application/x-tex">\\frac{a}{2}</annotation></semantics></math>`}</Markdown>
      )
    ).toMatchInlineSnapshot(
      `"<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><semantics><mrow><mfrac><mrow>a</mrow><mrow>2</mrow></mfrac></mrow><annotation encoding="application/x-tex">\\frac{a}{2}</annotation></semantics></math>"`
    )
  })

  it('can render complex math', () => {
    expect(
      renderToString(
        <Markdown>{`<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
<semantics>
  <mrow><mfrac><mrow><msqrt><mrow>a</mrow></msqrt></mrow><mrow><mn>2</mn></mrow></mfrac></mrow>
  <annotation encoding="application/x-tex">\\frac{\\sqrt{a}}{2}</annotation>
</semantics>
</math>`}</Markdown>
      )
    ).toMatchInlineSnapshot(
      `"<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><semantics><mrow><mfrac><mrow><msqrt><mrow>a</mrow></msqrt></mrow><mrow><mn>2</mn></mrow></mfrac></mrow><annotation encoding="application/x-tex">\\frac{\\sqrt{a}}{2}</annotation></semantics></math>"`
    )
  })

  it('throws error for non-string input to compiler', () => {
    expect(() => {
      // @ts-ignore
      compiler(123)
    }).toThrow(/must be/)
  })
})

describe('tagfilter option', () => {
  describe('HTML block with tagfilter enabled', () => {
    it('should escape script tags when tagfilter is enabled', () => {
      render(compiler('<script>alert("xss")</script>', { tagfilter: true }))
      expect(root.innerHTML).toBe('<span>&lt;script&gt;</span>')
    })

    it('should escape iframe tags when tagfilter is enabled', () => {
      render(compiler('<iframe src="evil.com"></iframe>', { tagfilter: true }))
      expect(root.innerHTML).toBe(
        '<span>&lt;iframe src=&quot;evil.com&quot;&gt;</span>'
      )
    })

    it('should escape all filtered tags when tagfilter is enabled', () => {
      const filteredTags = [
        'title',
        'textarea',
        'style',
        'xmp',
        'iframe',
        'noembed',
        'noframes',
        'script',
        'plaintext',
      ]

      filteredTags.forEach(tag => {
        render(compiler(`<${tag}>content</${tag}>`, { tagfilter: true }))
        expect(root.innerHTML).toBe(`<span>&lt;${tag}&gt;</span>`)
      })
    })

    it('should not escape non-filtered tags when tagfilter is enabled', () => {
      render(compiler('<div>safe content</div>', { tagfilter: true }))
      expect(root.innerHTML).toBe('<div>safe content</div>')
    })

    it('should handle case-insensitive tag matching', () => {
      render(compiler('<SCRIPT>alert("xss")</SCRIPT>', { tagfilter: true }))
      expect(root.innerHTML).toBe('<span>&lt;SCRIPT&gt;</span>')
    })

    it('should escape filtered tags with attributes', () => {
      render(
        compiler('<script src="evil.js" type="text/javascript"></script>', {
          tagfilter: true,
        })
      )
      expect(root.innerHTML).toBe(
        '<span>&lt;script src=&quot;evil.js&quot; type=&quot;text/javascript&quot;&gt;</span>'
      )
    })
  })

  describe('HTML block with tagfilter disabled', () => {
    it('should not escape script tags when tagfilter is false', () => {
      render(compiler('<script>alert("xss")</script>', { tagfilter: false }))
      expect(root.innerHTML).toBe('<script></script>')
    })

    it('should not escape iframe tags when tagfilter is false', () => {
      render(compiler('<iframe src="evil.com"></iframe>', { tagfilter: false }))
      expect(root.innerHTML).toBe('<iframe src="evil.com"></iframe>')
    })
  })

  describe('HTML block with default tagfilter', () => {
    it('should escape script tags by default (tagfilter default is true)', () => {
      render(compiler('<script>alert("xss")</script>'))
      expect(root.innerHTML).toBe('<span>&lt;script&gt;</span>')
    })

    it('should escape iframe tags by default (tagfilter default is true)', () => {
      render(compiler('<iframe src="evil.com"></iframe>'))
      expect(root.innerHTML).toBe(
        '<span>&lt;iframe src=&quot;evil.com&quot;&gt;</span>'
      )
    })
  })

  describe('HTML self-closing with tagfilter', () => {
    it('should escape self-closing script tags when tagfilter is enabled', () => {
      render(compiler('<script src="evil.js" />', { tagfilter: true }))
      expect(root.innerHTML).toBe(
        '<span>&lt;script src=&quot;evil.js&quot; /&gt;</span>'
      )
    })

    it('should escape self-closing iframe tags when tagfilter is enabled', () => {
      render(compiler('<iframe src="evil.com" />', { tagfilter: true }))
      expect(root.innerHTML).toBe(
        '<span>&lt;iframe src=&quot;evil.com&quot; /&gt;</span>'
      )
    })

    it('should not escape self-closing non-filtered tags when tagfilter is enabled', () => {
      render(compiler('<img src="safe.png" />', { tagfilter: true }))
      expect(root.innerHTML).toBe(
        '<link rel="preload" as="image" href="safe.png"/><img src="safe.png"/>'
      )
    })
  })

  describe('HTML block text content with tagfilter', () => {
    it('should escape dangerous tags within HTML block text content', () => {
      render(
        compiler(
          '<div>Content with <script>alert("xss")</script> inside</div>',
          { tagfilter: true }
        )
      )
      expect(root.innerHTML).toContain('<span>&lt;script&gt;</span>')
      expect(root.innerHTML).not.toContain('<script>')
    })

    it('should escape multiple dangerous tags within HTML block text content', () => {
      render(
        compiler(
          '<div>Content with <script>alert("xss")</script> and <iframe src="evil.com"></iframe> inside</div>',
          { tagfilter: true }
        )
      )
      expect(root.innerHTML).toContain('<span>&lt;script&gt;</span>')
      expect(root.innerHTML).toContain(
        '<span>&lt;iframe src=&quot;evil.com&quot;&gt;</span>'
      )
      expect(root.innerHTML).not.toContain('<script>')
      expect(root.innerHTML).not.toContain('<iframe>')
    })
  })
})

it('should handle list item continuation properly without indentation', () => {
  render(
    compiler(theredoc`
    1. **A**
    explanation about a
    2. **B**
    explanation about b
    ### h3 title
  `)
  )
  expect(root.innerHTML).toMatchInlineSnapshot(
    `"<div><ol start="1"><li><strong>A</strong>explanation about a</li><li><strong>B</strong>explanation about b</li></ol><h3 id="h3-title">h3 title</h3></div>"`
  )
})

describe('frontmatter', () => {
  it('should not render frontmatter by default', () => {
    render(compiler('---\ntitle: Test\n---\n\n# Content'))

    expect(root.innerHTML).toBe('<h1 id="content">Content</h1>')
  })

  it('should render frontmatter when preserveFrontmatter is true', () => {
    render(
      compiler('---\ntitle: Test\n---\n\n# Content', {
        preserveFrontmatter: true,
      })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `
        "<div><pre>---
        title: Test
        ---</pre><h1 id="content">Content</h1></div>"
      `
    )
  })

  it('should render frontmatter correctly with multiline content', () => {
    const frontmatter = `---
title: My Document
author: John Doe
date: 2023-11-22
tags:
  - test
  - example
---`

    render(
      compiler(`${frontmatter}\n\n# Content`, { preserveFrontmatter: true })
    )

    expect(root.innerHTML).toMatchInlineSnapshot(
      `
        "<div><pre>---
        title: My Document
        author: John Doe
        date: 2023-11-22
        tags:
          - test
          - example
        ---</pre><h1 id="content">Content</h1></div>"
      `
    )
  })
})

describe('options immutability', () => {
  it('should not mutate options object when calling astToJSX multiple times', () => {
    // Test that astToJSX doesn't mutate the options object when called multiple times
    // This is important for memoization - if the same options object is reused,
    // mutations could cause unexpected side effects
    const markdown = '# Hello world'
    const ast = parser(markdown)
    const options: Parameters<typeof astToJSX>[1] = {
      slugify: (input: string) => input.toLowerCase(),
    }
    const originalOverrides = options.overrides

    // First call
    astToJSX(ast, options)

    // Verify options object wasn't mutated
    expect(options.overrides).toBe(originalOverrides)

    // Second call with same options
    astToJSX(ast, options)

    // Options should still be unchanged
    expect(options.overrides).toBe(originalOverrides)
  })

  it('should not mutate options object when calling compiler multiple times', () => {
    // Test that compiler doesn't mutate the options object when called multiple times
    const markdown = '# Hello world'
    const options: Parameters<typeof compiler>[1] = {
      slugify: (input: string) => input.toLowerCase(),
    }
    const originalOverrides = options.overrides

    // First call
    compiler(markdown, options)

    // Verify options object wasn't mutated
    expect(options.overrides).toBe(originalOverrides)

    // Second call with same options
    compiler(markdown, options)

    // Options should still be unchanged
    expect(options.overrides).toBe(originalOverrides)
  })
})

describe('MarkdownProvider and MarkdownContext', () => {
  it('should provide context options to nested Markdown components', () => {
    const { MarkdownProvider } = require('./react')
    const contextOptions = {
      overrides: {
        h1: { props: { className: 'from-context' } },
      },
    }

    render(
      React.createElement(
        MarkdownProvider,
        { options: contextOptions },
        React.createElement(Markdown, null, '# Hello')
      )
    )

    expect(root.innerHTML).toContain('class="from-context"')
  })

  it('should merge component options with context options', () => {
    const { MarkdownProvider } = require('./react')
    const contextOptions = {
      overrides: {
        h1: { props: { className: 'from-context' } },
      },
    }
    const componentOptions = {
      overrides: {
        p: { props: { className: 'from-component' } },
      },
    }

    render(
      React.createElement(
        MarkdownProvider,
        { options: contextOptions },
        React.createElement(
          Markdown,
          { options: componentOptions },
          '# Hello\n\nWorld'
        )
      )
    )

    expect(root.innerHTML).toContain('class="from-context"')
    expect(root.innerHTML).toContain('class="from-component"')
  })

  it('should work without provider (backwards compatible)', () => {
    render(React.createElement(Markdown, null, '# Hello'))
    expect(root.innerHTML).toContain('<h1')
  })

  it('should allow component options to override context options', () => {
    const { MarkdownProvider } = require('./react')
    const contextOptions = {
      wrapper: 'section',
    }
    const componentOptions = {
      wrapper: 'article',
    }

    render(
      React.createElement(
        MarkdownProvider,
        { options: contextOptions },
        React.createElement(
          Markdown,
          { options: componentOptions },
          '# One\n\n# Two'
        )
      )
    )

    expect(root.innerHTML).toContain('<article')
    expect(root.innerHTML).not.toContain('<section')
  })
})

describe('Markdown component memoization', () => {
  it('should produce same output for same content (memoization working)', () => {
    const result1 = renderToString(
      React.createElement(Markdown, null, '# Static Content')
    )
    const result2 = renderToString(
      React.createElement(Markdown, null, '# Static Content')
    )

    expect(result1).toBe(result2)
    expect(result1).toContain('<h1')
  })

  it('should produce different output for different content', () => {
    const result1 = renderToString(
      React.createElement(Markdown, null, '# Content 1')
    )
    const result2 = renderToString(
      React.createElement(Markdown, null, '# Content 2')
    )

    expect(result1).not.toBe(result2)
    expect(result1).toContain('Content 1')
    expect(result2).toContain('Content 2')
  })

  it('should produce different output for different options', () => {
    const result1 = renderToString(
      React.createElement(
        Markdown,
        { options: { wrapper: 'section' } },
        '# One\n\n# Two'
      )
    )
    const result2 = renderToString(
      React.createElement(
        Markdown,
        { options: { wrapper: 'article' } },
        '# One\n\n# Two'
      )
    )

    expect(result1).toContain('<section')
    expect(result2).toContain('<article')
  })
})
