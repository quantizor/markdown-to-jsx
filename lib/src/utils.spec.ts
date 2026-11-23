import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import { RuleType } from './types.ts'
import * as u from './utils.ts'

describe('parseFrontmatterBounds', () => {
  it('should return null for invalid or missing opening markers', () => {
    expect(u.parseFrontmatterBounds('')).toBeNull()
    expect(u.parseFrontmatterBounds('no frontmatter')).toBeNull()
    expect(u.parseFrontmatterBounds('---')).toBeNull()
    expect(u.parseFrontmatterBounds('---content')).toBeNull()
    expect(u.parseFrontmatterBounds('--\ncontent\n---\n')).toBeNull()
    expect(u.parseFrontmatterBounds('----\ncontent\n---\n')).toBeNull()
  })

  it('should return null for unclosed frontmatter', () => {
    expect(u.parseFrontmatterBounds('---\nkey: value\n')).toBeNull()
  })

  it('should parse valid frontmatter with key-value pairs', () => {
    expect(u.parseFrontmatterBounds('---\nkey: value\n---\n')).toEqual({
      endPos: 19,
      hasValidYaml: true,
    })
    expect(
      u.parseFrontmatterBounds('---\nkey1: value1\nkey2: value2\n---\n')
    ).toEqual({ endPos: 34, hasValidYaml: true })
    expect(
      u.parseFrontmatterBounds('---\nkey: value\n---\nextra')?.hasValidYaml
    ).toBe(true)
  })

  it('should accept whitespace variations in opening marker and keys', () => {
    expect(u.parseFrontmatterBounds('---   \nkey: value\n---\n')).toEqual({
      endPos: 22,
      hasValidYaml: true,
    })
    expect(
      u.parseFrontmatterBounds('---\t \n\tkey: value\n---\n')?.hasValidYaml
    ).toBe(true)
    expect(
      u.parseFrontmatterBounds('---\n  indented: value\n---\n')?.hasValidYaml
    ).toBe(true)
  })

  it('should accept YAML key variations (digits, hyphens, dots, underscore)', () => {
    expect(
      u.parseFrontmatterBounds('---\n3d-model: foo\n---\n')?.hasValidYaml
    ).toBe(true)
    expect(
      u.parseFrontmatterBounds('---\ncontent-type: text\n---\n')?.hasValidYaml
    ).toBe(true)
    expect(
      u.parseFrontmatterBounds('---\nmeta.title: Hello\n---\n')?.hasValidYaml
    ).toBe(true)
    expect(
      u.parseFrontmatterBounds('---\n_private: val\n---\n')?.hasValidYaml
    ).toBe(true)
  })

  it('should accept colon at EOL (multi-line YAML value)', () => {
    expect(u.parseFrontmatterBounds('---\ndescription:\n---\n')).toEqual({
      endPos: 21,
      hasValidYaml: true,
    })
  })

  it('should accept valid YAML with empty lines between keys', () => {
    expect(
      u.parseFrontmatterBounds('---\ntitle: Hello\n\nauthor: World\n---\n')
        ?.hasValidYaml
    ).toBe(true)
  })

  it('should detect YAML when valid key exists among non-YAML lines', () => {
    expect(
      u.parseFrontmatterBounds(
        '---\nnot yaml\ntitle: value\nalso not yaml\n---\n'
      )?.hasValidYaml
    ).toBe(true)
  })

  it('should handle edge cases (empty, whitespace-only, nested markers, long keys)', () => {
    expect(u.parseFrontmatterBounds('---\n---\n')).toEqual({
      endPos: 8,
      hasValidYaml: false,
    })
    expect(u.parseFrontmatterBounds('---\n   \t   \n---\n')?.hasValidYaml).toBe(
      false
    )
    expect(
      u.parseFrontmatterBounds('---\ncontent: ---\n---\n')?.hasValidYaml
    ).toBe(true)
    expect(
      u.parseFrontmatterBounds(`---\n${'a'.repeat(10_000)}: value\n---\n`)
        ?.hasValidYaml
    ).toBe(true)
  })

  it('should accept a null character in a value but reject a control character in a key', () => {
    expect(
      u.parseFrontmatterBounds('---\nkey: val\x00ue\n---\n')?.hasValidYaml
    ).toBe(true)
    expect(
      u.parseFrontmatterBounds('---\nkey\x01: value\n---\n')?.hasValidYaml
    ).toBe(false)
  })

  it('should validate YAML keys correctly with CRLF line endings', () => {
    expect(
      u.parseFrontmatterBounds('---\r\ntitle: Hello\r\n---\r\n')?.hasValidYaml
    ).toBe(true)
    expect(
      u.parseFrontmatterBounds('---\r\ndescription:\r\n---\r\n')?.hasValidYaml
    ).toBe(true)
    expect(
      u.parseFrontmatterBounds('---\r\n**Subject: Hello**\r\n---\r\n')
        ?.hasValidYaml
    ).toBe(false)
  })

  it('should reject malformed YAML keys', () => {
    expect(u.parseFrontmatterBounds('---\n:invalid\n---\n')?.hasValidYaml).toBe(
      false
    )
    expect(
      u.parseFrontmatterBounds('---\nkey:value\n---\n')?.hasValidYaml
    ).toBe(false)
    expect(
      u.parseFrontmatterBounds('---\n   : value\n---\n')?.hasValidYaml
    ).toBe(false)
    expect(
      u.parseFrontmatterBounds('---\n...: value\n---\n')?.hasValidYaml
    ).toBe(false)
    expect(
      u.parseFrontmatterBounds('---\n--key: value\n---\n')?.hasValidYaml
    ).toBe(false)
  })

  it('should reject non-ASCII keys', () => {
    expect(
      u.parseFrontmatterBounds('---\nтитул: value\n---\n')?.hasValidYaml
    ).toBe(false)
    expect(
      u.parseFrontmatterBounds('---\n标题: value\n---\n')?.hasValidYaml
    ).toBe(false)
  })

  it('should reject markdown content with colons (false positives)', () => {
    expect(
      u.parseFrontmatterBounds('---\n**Subject: Hello**\n---\n')?.hasValidYaml
    ).toBe(false)
    expect(
      u.parseFrontmatterBounds('---\nSome text with: colons\n---\n')
        ?.hasValidYaml
    ).toBe(false)
    expect(
      u.parseFrontmatterBounds('---\n- list: item\n---\n')?.hasValidYaml
    ).toBe(false)
    expect(
      u.parseFrontmatterBounds('---\n[link](http://example.com)\n---\n')
        ?.hasValidYaml
    ).toBe(false)
    expect(
      u.parseFrontmatterBounds('---\n# comment: not yaml\n---\n')?.hasValidYaml
    ).toBe(false)
    expect(
      u.parseFrontmatterBounds('---\n| Name | Value |\n|:---|:---|\n---\n')
        ?.hasValidYaml
    ).toBe(false)
  })

  it('should reject LLM-style output with decorative dividers (issue #861)', () => {
    expect(
      u.parseFrontmatterBounds(
        '---\n\n**Status:** Complete\n**Priority:** High\n\n---\n'
      )?.hasValidYaml
    ).toBe(false)
    expect(
      u.parseFrontmatterBounds(
        '---\n\nHere is the answer:\n\n1. First: do this\n2. Second: do that\n\n---\n'
      )?.hasValidYaml
    ).toBe(false)
  })
})

describe('decodeEntityReferences', () => {
  it('should return text unchanged if no & present', () => {
    expect(u.decodeEntityReferences('plain text')).toBe('plain text')
  })

  it('should decode named HTML entities', () => {
    expect(u.decodeEntityReferences('&amp;')).toBe('&')
    expect(u.decodeEntityReferences('&lt;')).toBe('<')
    expect(u.decodeEntityReferences('&gt;')).toBe('>')
    expect(u.decodeEntityReferences('&quot;')).toBe('"')
    expect(u.decodeEntityReferences('&apos;')).toBe("'")
  })

  it('should handle case-insensitive named entities', () => {
    expect(u.decodeEntityReferences('&AMP;')).toBe('&')
    expect(u.decodeEntityReferences('&amp;')).toBe('&')
  })

  it('should decode decimal numeric entities', () => {
    expect(u.decodeEntityReferences('&#65;')).toBe('A')
    expect(u.decodeEntityReferences('&#97;')).toBe('a')
    expect(u.decodeEntityReferences('&#233;')).toBe('é')
  })

  it('should decode hexadecimal numeric entities', () => {
    expect(u.decodeEntityReferences('&#x41;')).toBe('A')
    expect(u.decodeEntityReferences('&#X41;')).toBe('A')
    expect(u.decodeEntityReferences('&#x61;')).toBe('a')
    expect(u.decodeEntityReferences('&#xe9;')).toBe('é')
  })

  it('should replace invalid code points with replacement character', () => {
    expect(u.decodeEntityReferences('&#0;')).toBe('\uFFFD')
    expect(u.decodeEntityReferences('&#xd800;')).toBe('\uFFFD')
    expect(u.decodeEntityReferences('&#x110000;')).toBe('\uFFFD')
  })

  it('should pass through unknown entities', () => {
    expect(u.decodeEntityReferences('&unknown;')).toBe('&unknown;')
  })

  it('should handle multiple entities in text', () => {
    expect(u.decodeEntityReferences('&amp; &lt; &#65;')).toBe('& < A')
  })

  it('should handle surrogate pairs for code points > 0xFFFF', () => {
    expect(u.decodeEntityReferences('&#x1F600;')).toBe('😀')
  })

  it('should handle malformed entities gracefully', () => {
    expect(u.decodeEntityReferences('&')).toBe('&')
    expect(u.decodeEntityReferences('&;')).toBe('&;')
    expect(u.decodeEntityReferences('&invalid')).toBe('&invalid')
    expect(u.decodeEntityReferences('&amp')).toBe('&amp')
  })

  it('should handle entities with unusual characters', () => {
    expect(u.decodeEntityReferences('&amp;&lt;&123&gt;')).toBe('&<&123>')
  })

  it('should handle very long entity names', () => {
    const longEntity = `&${'a'.repeat(1000)};`
    expect(u.decodeEntityReferences(longEntity)).toBe(longEntity)
  })

  it('should handle nested entities (not actually nested)', () => {
    expect(u.decodeEntityReferences('&amp;lt;')).toBe('&lt;')
  })

  it('should handle entities at string boundaries', () => {
    expect(u.decodeEntityReferences('&amp;')).toBe('&')
    expect(u.decodeEntityReferences('text&amp;')).toBe('text&')
    expect(u.decodeEntityReferences('&amp;text')).toBe('&text')
  })

  it('should handle decimal entities with leading zeros', () => {
    expect(u.decodeEntityReferences('&#00065;')).toBe('A')
    expect(u.decodeEntityReferences('&#000097;')).toBe('a')
  })

  it('should handle hexadecimal entities with mixed case', () => {
    expect(u.decodeEntityReferences('&#x41;')).toBe('A')
    expect(u.decodeEntityReferences('&#X41;')).toBe('A')
    expect(u.decodeEntityReferences('&#Xa1;')).toBe('¡')
  })

  it('should leave a nine-digit decimal entity as text and decode an out-of-range hex entity to the replacement character', () => {
    expect(u.decodeEntityReferences('&#999999999;')).toBe('&#999999999;')
    expect(u.decodeEntityReferences('&#xFFFFFF;')).toBe('\uFFFD')
  })

  it('should decode an entity before any further processing, leaving a combining acute accent after the ampersand', () => {
    expect(u.decodeEntityReferences('&amp;&#x301;')).toBe('&́')
  })

  it('should reject an empty entity, a missing semicolon, a numeric entity without a hash, and an empty numeric or hex entity', () => {
    expect(u.decodeEntityReferences('&;')).toBe('&;')
    expect(u.decodeEntityReferences('&amp')).toBe('&amp')
    expect(u.decodeEntityReferences('&123;')).toBe('&123;')
    expect(u.decodeEntityReferences('&#;')).toBe('&#;')
    expect(u.decodeEntityReferences('&#x;')).toBe('&#x;')
  })

  it('should reject negative, non-digit, non-hex, and too-large numeric entities', () => {
    expect(u.decodeEntityReferences('&#-1;')).toBe('&#-1;')
    expect(u.decodeEntityReferences('&#abc;')).toBe('&#abc;')
    expect(u.decodeEntityReferences('&#xZZ;')).toBe('&#xZZ;')
    expect(u.decodeEntityReferences('&#999999999999;')).toBe('&#999999999999;')
  })

  it('should reject entities containing a space, a newline, or a null byte', () => {
    expect(u.decodeEntityReferences('&amp ;')).toBe('&amp ;')
    expect(u.decodeEntityReferences('&amp\n;')).toBe('&amp\n;')
    expect(u.decodeEntityReferences('&amp\x00;')).toBe('&amp\x00;')
  })

  it('should decode &amp;lt; once, to &lt;, because entities are processed left to right and never decoded twice', () => {
    expect(u.decodeEntityReferences('&amp;lt;')).toBe('&lt;')
  })

  it('should leave an incomplete entity at the end of the string and decode a complete one', () => {
    expect(u.decodeEntityReferences('&amp')).toBe('&amp')
    expect(u.decodeEntityReferences('&amp;')).toBe('&')
  })
})

describe('sanitizer', () => {
  var originalWarn: typeof console.warn
  beforeEach(() => {
    originalWarn = console.warn
    console.warn = () => {}
  })
  afterEach(() => {
    console.warn = originalWarn
  })

  it('should return input unchanged for safe URLs', () => {
    expect(u.sanitizer('https://example.com')).toBe('https://example.com')
    expect(u.sanitizer('mailto:test@example.com')).toBe(
      'mailto:test@example.com'
    )
  })

  it('should return null for javascript URLs', () => {
    expect(u.sanitizer('javascript:alert(1)')).toBeNull()
    expect(u.sanitizer('JAVASCRIPT:alert(1)')).toBeNull()
  })

  it('should return null for vbscript URLs', () => {
    expect(u.sanitizer('vbscript:msgbox(1)')).toBeNull()
  })

  it('should return null for data URLs (except image)', () => {
    expect(u.sanitizer('data:text/html,<script>')).toBeNull()
    expect(u.sanitizer('data:application/javascript,code')).toBeNull()
  })

  it('should allow data:image URLs', () => {
    expect(
      u.sanitizer(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      )
    ).toBe(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    )
  })

  it('should return null for malformed URLs that cannot be decoded', () => {
    expect(u.sanitizer('https://example.com/%FF%FF')).toBeNull()
  })

  it('should warn in development mode for unsafe input', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    let warningMessage = ''
    let warningArgs: any[] = []

    console.warn = (...args: any[]) => {
      warningMessage = args[0]
      warningArgs = args
    }

    u.sanitizer('javascript:alert(1)')

    expect(warningMessage).toBe(
      'Input contains an unsafe JavaScript/VBScript/data expression, it will not be rendered.'
    )
    expect(warningArgs[1]).toBe('javascript:alert(1)')

    process.env.NODE_ENV = originalEnv
  })

  it('should handle very long URLs', () => {
    const longUrl = `https://example.com/${'a'.repeat(10_000)}`
    expect(u.sanitizer(longUrl)).toBe(longUrl)
  })

  it('should handle URLs with unusual protocols', () => {
    expect(u.sanitizer('ftp://example.com')).toBe('ftp://example.com')
    expect(u.sanitizer('custom://example.com')).toBe('custom://example.com')
  })

  it('should handle URLs with complex encoding', () => {
    expect(
      u.sanitizer(
        'https://example.com/%20%21%22%23%24%25%26%27%28%29%2A%2B%2C%2D%2E%2F'
      )
    ).toBe(
      'https://example.com/%20%21%22%23%24%25%26%27%28%29%2A%2B%2C%2D%2E%2F'
    )
  })

  it('should allow URLs with nested percent encoding', () => {
    expect(u.sanitizer('https://example.com/%2561%2564%2565%2572%2574')).toBe(
      'https://example.com/%2561%2564%2565%2572%2574'
    )
  })

  it('should block data:text URLs and allow data:image URLs', () => {
    expect(u.sanitizer('data:text/plain;base64,SGVsbG8=')).toBeNull()
    expect(u.sanitizer('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe(
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
    )
  })

  it.each([
    ['data:image/svg+xml;base64,PHN2Zz4=', 'a', 'href'],
    ['data:image/svg+xml,<svg onload=alert(1)>', 'a', 'href'],
    ['DATA:Image/SVG+XML;base64,PHN2Zz4=', 'a', 'href'],
    [' data:image/svg+xml ;base64,PHN2Zz4=', 'a', 'href'],
    ['data:image/svg%2Bxml;base64,PHN2Zz4=', 'a', 'href'],
    ['data:image/s\tvg+xml;base64,PHN2Zz4=', 'a', 'href'],
    ['data:image/svg+xml;charset=utf-8,<svg/>', 'iframe', 'src'],
    ['data:image/svg+xml,<svg/>', 'object', 'data'],
    ['data:image/svg+xml,<svg/>', 'embed', 'src'],
    ['data:image/svg+xml,<svg/>', 'form', 'action'],
    ['data:image/svg+xml,<svg/>', 'use', 'href'],
  ])('rejects the SVG data URL %j in a %s %s', (url, tag, attribute) => {
    expect(u.sanitizer(url, tag, attribute)).toBeNull()
  })

  it.each([
    ['img', 'src'],
    ['img', 'srcset'],
    ['IMG', 'SRC'],
    ['source', 'src'],
    ['source', 'srcset'],
    ['video', 'poster'],
    ['input', 'src'],
    ['image', 'href'],
    ['image', 'src'],
    ['image', 'srcset'],
    ['image', 'xlink:href'],
  ])('keeps an SVG data URL in a %s %s', (tag, attribute) => {
    expect(
      u.sanitizer('data:image/svg+xml;base64,PHN2Zz4=', tag, attribute)
    ).toBe('data:image/svg+xml;base64,PHN2Zz4=')
  })

  it.each([
    ['data:image/png;base64,iVBOR', 'a', 'href'],
    ['data:image/svgz;base64,iVBOR', 'a', 'href'],
    ['https://example.com/a.svg', 'a', 'href'],
    ['data:image/svg+xml;base64,PHN2Zz4=', undefined, undefined],
  ])('keeps %j in a %s %s', (url, tag, attribute) => {
    expect(u.sanitizer(url, tag, attribute)).toBe(url)
  })

  it('should handle URLs with unusual characters', () => {
    expect(u.sanitizer('https://example.com/🦄🌈')).toBe(
      'https://example.com/🦄🌈'
    )
  })

  it('should handle URLs that look like protocols but are not', () => {
    expect(u.sanitizer('notjavascript:alert(1)')).toBeNull()
  })

  it.each([
    'https://en.wikipedia.org/wiki/Javascript:_The_Good_Parts',
    'https://example.com/?q=javascript:x',
    'https://example.com/search?q=data:text',
    'https://example.com/#vbscript:x',
    'https://example.com/%6a%61%76%61%73%63%72%69%70%74:alert(1)',
    '/docs/javascript:intro',
    './javascript:x',
    'a/javascript:x',
    '?javascript:x',
    '#javascript:x',
    '?q=java%0Ascript:x',
  ])('keeps %j, where a browser reads no dangerous scheme', url => {
    expect(u.sanitizer(url)).toBe(url)
  })

  it.each([
    'javascript:/x',
    'javascript://x/%0Aalert(1)',
    'JAVASCRIPT:x/y',
    'vbscript:x?y',
    'data:text/html,x',
    'data:#x',
    'feed:javascript:alert(1)',
    ' javascript:x',
    `${String.fromCharCode(1)}javascript:x`,
    '\\javascript:x',
    'java\tscript:x',
    'java\tscript:alert(1)',
    'java\nscript:x/y',
    'java\nscript:alert(1)',
    'java\rscript:alert(1)',
    'ja\tva\nscr\ript:alert(1)',
    'java%09script:alert(1)',
    'da\tta:text/html,x',
    'java%0Ascript:x',
    '%6A%61vascript:x',
    'javascript%3Ax',
    'https://example.com/%',
  ])('rejects %j, which holds a blocked scheme before any path', url => {
    expect(u.sanitizer(url)).toBeNull()
  })

  it('should handle empty and whitespace URLs', () => {
    expect(u.sanitizer('')).toBe('')
    expect(u.sanitizer('   ')).toBe('   ')
  })

  it('should handle URLs with unusual encoding patterns', () => {
    expect(u.sanitizer('https://example.com/%')).toBeNull()
    expect(u.sanitizer('https://example.com/%FF')).toBeNull()
  })

  it('should reject dangerous JavaScript protocols', () => {
    expect(u.sanitizer('javascript:alert(1)')).toBeNull()
    expect(u.sanitizer('JAVASCRIPT:alert(1)')).toBeNull()
    expect(u.sanitizer('JavaScript:alert(1)')).toBeNull()
    expect(u.sanitizer('vbscript:msgbox(1)')).toBeNull()
    expect(u.sanitizer('data:text/html,<script>alert(1)</script>')).toBeNull()
  })

  it('should reject URLs with encoded dangerous content', () => {
    expect(u.sanitizer('%6a%61%76%61%73%63%72%69%70%74:alert(1)')).toBeNull()
    expect(
      u.sanitizer('data:text/html,%3cscript%3ealert(1)%3c/script%3e')
    ).toBeNull()
  })

  it('should handle URLs with unusual protocols gracefully', () => {
    expect(u.sanitizer('livescript:code')).toBe('livescript:code')
    expect(u.sanitizer('mocha:code')).toBe('mocha:code')
    expect(u.sanitizer('mocha:')).toBe('mocha:')
  })

  it('should handle malformed URLs gracefully', () => {
    expect(u.sanitizer('http://')).toBe('http://')
    expect(u.sanitizer('https://')).toBe('https://')
    expect(u.sanitizer('://example.com')).toBe('://example.com')
    expect(u.sanitizer('http:///path')).toBe('http:///path')
  })

  it('should handle URLs with unusual characters in protocol gracefully', () => {
    expect(u.sanitizer('http s://example.com')).toBe('http s://example.com')
    expect(u.sanitizer('http\t://example.com')).toBe('http\t://example.com')
    expect(u.sanitizer('http\n://example.com')).toBe('http\n://example.com')
  })

  it('should allow extremely long URLs because the sanitizer only checks for dangerous protocols', () => {
    const longUrl = `https://example.com/${'a'.repeat(100_000)}`
    expect(u.sanitizer(longUrl)).toBe(longUrl)
  })

  it('should allow null bytes and control characters in a path, and null bytes in a domain', () => {
    expect(u.sanitizer('https://example.com/\x00path')).toBe(
      'https://example.com/\x00path'
    )
    expect(u.sanitizer('https://example.com/\x01path')).toBe(
      'https://example.com/\x01path'
    )
    expect(u.sanitizer('https://example\x00.com')).toBe(
      'https://example\x00.com'
    )
  })
})

describe('encodeUrlTarget', () => {
  it('should encode internationalized URLs containing non-BMP characters', () => {
    expect(u.encodeUrlTarget('https://例え.テスト/著者/𠮷田/投稿-🚀')).toBe(
      'https://%E4%BE%8B%E3%81%88.%E3%83%86%E3%82%B9%E3%83%88/%E8%91%97%E8%80%85/%F0%A0%AE%B7%E7%94%B0/%E6%8A%95%E7%A8%BF-%F0%9F%9A%80'
    )
    expect(u.encodeUrlTarget('https://example.com/@𝒜stroWriter')).toBe(
      'https://example.com/@%F0%9D%92%9CstroWriter'
    )
    expect(u.encodeUrlTarget('https://example.com/ブログ/launch-🚀')).toBe(
      'https://example.com/%E3%83%96%E3%83%AD%E3%82%B0/launch-%F0%9F%9A%80'
    )
  })

  it('should preserve lone surrogates without throwing', () => {
    expect(u.encodeUrlTarget('https://example.com/\uD800')).toBe(
      'https://example.com/\uD800'
    )
    expect(u.encodeUrlTarget('https://example.com/\uDC00')).toBe(
      'https://example.com/\uDC00'
    )
  })

  it.each([
    ['https://example.com/a?b=c&d=e#f~', 'https://example.com/a?b=c&d=e#f~'],
    ['%25', '%25'],
    ['a b', 'a%20b'],
    ['a"b', 'a%22b'],
    ['a<b', 'a%3Cb'],
    ['a>b', 'a%3Eb'],
    ['a[b', 'a%5Bb'],
    ['a\\b', 'a%5Cb'],
    ['a]b', 'a%5Db'],
    ['a^b', 'a%5Eb'],
    ['a`b', 'a%60b'],
    ['a{b', 'a%7Bb'],
    ['a|b', 'a%7Cb'],
    ['a}b', 'a%7Db'],
    ['a~ b', 'a~%20b'],
    ['a\x7fb', 'a%7Fb'],
    ['a\x01b', 'a%01b'],
    ['a\tb', 'a%09b'],
    ['é b', '%C3%A9%20b'],
    ['%41 b', '%41%20b'],
    ['%4a b', '%4a%20b'],
    ['%zz b', '%25zz%20b'],
    ['%4 b', '%254%20b'],
    ['a b%', 'a%20b%25'],
    ['a b%4', 'a%20b%254'],
    ['a b%41', 'a%20b%41'],
    ['100%', '100%25'],
    ['🚀 b', '%F0%9F%9A%80%20b'],
    ['\uD800x y', '\uD800x%20y'],
    ['a b\uD800', 'a%20b\uD800'],
    ['\uDC00 🚀', '\uDC00%20%F0%9F%9A%80'],
  ])('encodes %j as %j', (input, expected) => {
    expect(u.encodeUrlTarget(input)).toBe(expected)
  })
})

describe('slugify', () => {
  it.each([
    ['Hello World', 'hello-world'],
    ['Hello-World', 'hello-world'],
    ['Hello   World', 'hello---world'],
    ['-hello-', '-hello-'],
    [' - hello - ', '---hello---'],
    ['abc123', 'abc123'],
    ['ABC123', 'abc123'],
    ['Hello!@#$%^&*()', 'hello'],
    ['test_file.txt', 'testfiletxt'],
    ['', ''],
    ['   ', '---'],
    ['-_-', '--'],
    ['!@#$%^&*()', ''],
    ['café', 'cafe'],
    ['café', 'cafe'],
    ['naïve', 'naive'],
    ['résumé', 'resume'],
    ['ÁÉÍÓÚ', 'aeiou'],
    ['Ññ', 'nn'],
    ['Öl Straße öÖß', 'ol-strasse-ooss'],
    ['Čech Łódź Đặng', 'cech-lodz-dang'],
    ['Œuvre ĳ', 'ouvre-'],
    ['× ÷', '-'],
    ['hello​world', 'helloworld'],
    ['​‌‍', ''],
    ['hello\nworld', 'helloworld'],
    ['hello\tworld', 'helloworld'],
    ['hello\rworld', 'helloworld'],
    ['hello\x00world', 'helloworld'],
    ['hello\x01world', 'helloworld'],
    ['hello�world', 'helloworld'],
    ['∑∆∏', ''],
    ['hello \u{1F600} world', 'hello--world'],
    ['ᚠᛇᚻ', ''],
    ['あいうえお', ''],
  ])('slugifies %j as %j', (input, expected) => {
    expect(u.slugify(input)).toBe(expected)
  })

  it('should keep every ASCII letter and digit, lowercase letters, and turn only the space and dash into hyphens', () => {
    const allChars = Array.from({ length: 128 }, (_, i) =>
      String.fromCharCode(i)
    ).join('')
    expect(u.slugify(allChars)).toBe(
      '--0123456789abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz'
    )
  })

  it('should return the input for a very long letter-only string and an empty slug for a very long punctuation-only string', () => {
    const longString = 'a'.repeat(100_000)
    expect(u.slugify(longString)).toBe(longString)
    expect(u.slugify('!'.repeat(10_000))).toBe('')
  })

  it('folds every Latin letter from U+00C0 to U+024F and U+1E00 to U+1EFF to the ASCII letter its decomposition starts with', () => {
    const noDecomposition: Record<number, string> = {
      198: 'a',
      208: 'd',
      216: 'o',
      223: 'ss',
      230: 'a',
      240: 'd',
      248: 'o',
      272: 'd',
      273: 'd',
      294: 'h',
      295: 'h',
      305: 'i',
      319: 'l',
      320: 'l',
      321: 'l',
      322: 'l',
      330: 'n',
      331: 'n',
      338: 'o',
      339: 'o',
      358: 't',
      359: 't',
      383: 's',
    }
    const codes = [
      ...Array.from({ length: 0x2_50 - 0xc0 }, (_, i) => 0xc0 + i),
      ...Array.from({ length: 0x1_00 }, (_, i) => 0x1e_00 + i),
    ]
    const fold = (code: number) => {
      const base = String.fromCharCode(code).normalize('NFD').charAt(0)
      return (
        noDecomposition[code] ?? (/[a-z]/i.test(base) ? base.toLowerCase() : '')
      )
    }
    expect(codes.map(code => u.slugify(String.fromCharCode(code)))).toEqual(
      codes.map(fold)
    )
  })

  it('should strip a combining tilde', () => {
    expect(u.slugify('ñ')).toBe('n')
  })
})

describe('headingId', () => {
  it.each([
    ['hello-world', 'hello-world'],
    ['a b', 'a b'],
    [' x ', ' x '],
    ['', undefined],
    [undefined, undefined],
    [' ', undefined],
    ['\t\n ', undefined],
  ])('returns %j as %j', (id, expected) => {
    expect(u.headingId(id)).toBe(expected)
  })
})

describe('character classification', () => {
  describe('isAlnumCode', () => {
    it('should return true for ASCII alphanumeric characters', () => {
      expect(u.isAlnumCode('a'.charCodeAt(0))).toBe(true)
      expect(u.isAlnumCode('Z'.charCodeAt(0))).toBe(true)
      expect(u.isAlnumCode('0'.charCodeAt(0))).toBe(true)
      expect(u.isAlnumCode('9'.charCodeAt(0))).toBe(true)
    })

    it('should return false for non-alphanumeric characters', () => {
      expect(u.isAlnumCode('!'.charCodeAt(0))).toBe(false)
      expect(u.isAlnumCode(' '.charCodeAt(0))).toBe(false)
      expect(u.isAlnumCode(128)).toBe(false)
    })
  })
})

describe('isVoidElement', () => {
  it('should return true for HTML5 void elements', () => {
    const voidElements = [
      'area',
      'base',
      'br',
      'col',
      'embed',
      'hr',
      'img',
      'input',
      'link',
      'meta',
      'param',
      'source',
      'track',
      'wbr',
    ]
    for (const tag of voidElements) {
      expect(u.isVoidElement(tag)).toBe(true)
      expect(u.isVoidElement(tag.toUpperCase())).toBe(true)
    }
  })

  it('should return true for SVG void elements and false for animateTransform', () => {
    const svgVoidElements = [
      'circle',
      'ellipse',
      'line',
      'path',
      'polygon',
      'polyline',
      'rect',
      'use',
      'stop',
      'animate',
      'set',
    ]
    for (const tag of svgVoidElements) {
      expect(u.isVoidElement(tag)).toBe(true)
    }
    expect(u.isVoidElement('animateTransform')).toBe(false)
  })

  it('should handle SVG namespace prefixes', () => {
    expect(u.isVoidElement('svg:circle')).toBe(true)
    expect(u.isVoidElement('custom:circle')).toBe(true)
    expect(u.isVoidElement('svg:unknown')).toBe(false)
  })

  it('should return false for non-void elements', () => {
    expect(u.isVoidElement('div')).toBe(false)
    expect(u.isVoidElement('p')).toBe(false)
    expect(u.isVoidElement('span')).toBe(false)
  })

  it('should handle extremely long tag names', () => {
    const longTag = 'a'.repeat(10_000)
    expect(u.isVoidElement(longTag)).toBe(false)
  })

  it('should handle tag names with unusual characters', () => {
    expect(u.isVoidElement('div123')).toBe(false)
    expect(u.isVoidElement('div-123')).toBe(false)
    expect(u.isVoidElement('div_123')).toBe(false)
  })

  it('should handle empty and whitespace tag names', () => {
    expect(u.isVoidElement('')).toBe(false)
    expect(u.isVoidElement(' ')).toBe(false)
    expect(u.isVoidElement('\t')).toBe(false)
  })

  it('should match void element names case-insensitively', () => {
    expect(u.isVoidElement('BR')).toBe(true)
    expect(u.isVoidElement('br')).toBe(true)
    expect(u.isVoidElement('Br')).toBe(true)
  })

  it('should return false for an empty name after the colon or a void name before it, and true for an empty prefix before a void name', () => {
    expect(u.isVoidElement('svg:')).toBe(false)
    expect(u.isVoidElement(':circle')).toBe(true)
    expect(u.isVoidElement('circle:svg')).toBe(false)
  })

  it('should return false for a tag name that includes angle brackets', () => {
    expect(u.isVoidElement('<br>')).toBe(false)
    expect(u.isVoidElement('br>')).toBe(false)
    expect(u.isVoidElement('<br')).toBe(false)
  })

  it('should handle Unicode in tag names', () => {
    expect(u.isVoidElement('br🦄')).toBe(false)
    expect(u.isVoidElement('🦄br')).toBe(false)
  })
})

describe('get', () => {
  class WithGetter {
    get a() {
      return 'from getter'
    }
  }

  it.each([
    ['an inherited key', Object.create({ a: 'inherited' }), 'a', 'inherited'],
    ['a class getter', new WithGetter(), 'a', 'from getter'],
    [
      'a Proxy',
      new Proxy({}, { get: (_, key) => `proxied ${String(key)}` }),
      'a',
      'proxied a',
    ],
    [
      'a built-in the source owns',
      { constructor: 'own' },
      'constructor',
      'own',
    ],
    ['an unowned built-in', {}, 'constructor', 'fallback'],
    ['an unowned built-in, mixed case', {}, 'toString', 'fallback'],
    ['an unowned built-in in a path', {}, 'constructor.name', 'fallback'],
  ])('reads %s', (_label, source, key, expected) => {
    expect(u.get(source, key, 'fallback')).toBe(expected)
  })

  it('returns the exact key when present', () => {
    const source = { input: 'exact', INPUT: 'upper' }
    expect(u.get(source, 'INPUT', 'fallback')).toBe('upper')
    expect(u.get(source, 'input', 'fallback')).toBe('exact')
  })

  it('falls back to the lowercase key for HTML tag overrides (#248)', () => {
    const source = {
      input: { component: 'CustomInput', props: { className: 'foo' } },
    }
    expect(u.get(source, 'INPUT', undefined).component).toBe('CustomInput')
    expect(u.get(source, 'INPUT.component', 'INPUT')).toBe('CustomInput')
    expect(u.get(source, 'INPUT.props', {})).toEqual({ className: 'foo' })
  })

  it('falls back for mixed-case mid-string uppercase tags (#248)', () => {
    expect(u.get({ div: 'x' }, 'dIV', 'fallback')).toBe('x')
    const source = {
      div: { component: 'CustomDiv', props: { className: 'bar' } },
    }
    expect(u.get(source, 'dIV', undefined).component).toBe('CustomDiv')
    expect(u.get(source, 'dIV.props', {})).toEqual({ className: 'bar' })
  })

  it('does not steal nested fields from a lowercase key when the exact key exists', () => {
    const source = {
      INPUT: { props: { className: 'upper' } },
      input: { component: 'CustomInput', props: { className: 'lower' } },
    }
    expect(u.get(source, 'INPUT.component', 'INPUT')).toBe('INPUT')
    expect(u.get(source, 'INPUT.props', {})).toEqual({ className: 'upper' })
  })

  it('returns the fallback when neither casing is present', () => {
    expect(u.get({ p: 'ok' }, 'div', 'fallback')).toBe('fallback')
    expect(u.get({ p: 'ok' }, 'DIV.props', {})).toEqual({})
    expect(u.get(undefined, 'input', 'fallback')).toBe('fallback')
  })

  it.each([
    ['CARD', { Card: 'found' }],
    ['CaRd', { Card: 'found' }],
    ['Card', { CARD: 'found' }],
    ['CaRd', { CARD: 'found' }],
    ['CARD', { cArD: 'found' }],
    ['KEY', { '\u{212A}ey': 'found' }],
  ])('matches %j to a key in any casing, with the Kelvin sign matching k, when the tag starts with an uppercase letter', (tag, source) => {
    expect(u.get(source, tag, 'fallback')).toBe('found')
    expect(
      u.get(
        { [Object.keys(source)[0]]: { props: { a: 1 } } },
        `${tag}.props`,
        {}
      )
    ).toEqual({ a: 1 })
  })

  it.each([
    ['card', { Card: 'found' }],
    ['cARD', { Card: 'found' }],
    ['dIV', { Div: 'found' }],
  ])('matches %j only to its own or its lowercase key when the tag starts with a lowercase letter', (tag, source) => {
    expect(u.get(source, tag, 'fallback')).toBe('fallback')
  })

  it('matches a key ignoring case by the rule an exact key follows', () => {
    expect(
      u.get(Object.create({ CARD: 'inherited' }), 'Card', 'fallback')
    ).toBe('inherited')

    const proto = Object.prototype as Record<string, unknown>
    proto.CARD = 'polluted'
    try {
      expect(u.get({}, 'Card', 'fallback')).toBe('fallback')
      expect(u.get({}, 'Card.props', 'fallback')).toBe('fallback')
    } finally {
      delete proto.CARD
    }
  })

  it('prefers the exact key, then the lowercase key, then the first key in order', () => {
    expect(
      u.get({ CARD: 'other', Card: 'exact', card: 'lower' }, 'Card', 'fallback')
    ).toBe('exact')
    expect(u.get({ CARD: 'other', card: 'lower' }, 'CaRd', 'fallback')).toBe(
      'lower'
    )
    expect(u.get({ CARD: 'first', cARD: 'second' }, 'CaRd', 'fallback')).toBe(
      'first'
    )
  })

  it('sees a key added to the overrides object after an earlier lookup', () => {
    const source: Record<string, string> = { Other: 'x' }
    expect(u.get(source, 'CARD', 'fallback')).toBe('fallback')
    source.Card = 'added'
    expect(u.get(source, 'CARD', 'fallback')).toBe('added')
  })
})

describe('text processing', () => {
  describe('normalizeInput', () => {
    it('should normalize CRLF to LF', () => {
      expect(u.normalizeInput('hello\r\nworld')).toBe('hello\nworld')
      expect(u.normalizeInput('line1\r\nline2\r\nline3')).toBe(
        'line1\nline2\nline3'
      )
    })

    it('should normalize standalone CR to LF', () => {
      expect(u.normalizeInput('hello\rworld')).toBe('hello\nworld')
    })

    it('should handle mixed line endings', () => {
      expect(u.normalizeInput('crlf\r\nlf\ncr\rend')).toBe('crlf\nlf\ncr\nend')
    })

    it('should return original string when no CR present (fast path)', () => {
      const original = 'hello\nworld'
      expect(u.normalizeInput(original)).toBe(original)
    })

    it('should handle empty string', () => {
      expect(u.normalizeInput('')).toBe('')
    })

    it('should handle string with only newlines', () => {
      expect(u.normalizeInput('\r\n\r\n')).toBe('\n\n')
      expect(u.normalizeInput('\n\n')).toBe('\n\n')
    })
  })
})

describe('hasKeys', () => {
  it('should return true for objects with enumerable properties', () => {
    expect(u.hasKeys({ a: 1 })).toBe(true)
    expect(u.hasKeys({ a: 1, b: 2 })).toBe(true)
  })

  it('should return false for objects without enumerable properties, including Sets', () => {
    expect(u.hasKeys({})).toBe(false)
    expect(u.hasKeys(new Set([1, 2, 3]))).toBe(false)
    expect(u.hasKeys(new Set())).toBe(false)
  })

  it('should return false for null and undefined', () => {
    expect(u.hasKeys(null)).toBe(false)
    expect(u.hasKeys(undefined)).toBe(false)
  })

  it('should return false for an object whose only property is non-enumerable', () => {
    const obj = {}
    Object.defineProperty(obj, 'hidden', { enumerable: false, value: 'value' })
    expect(u.hasKeys(obj)).toBe(false)
  })

  it('should return false for an object whose only property is a symbol key', () => {
    const sym = Symbol('test')
    const obj = { [sym]: 'value' }
    expect(u.hasKeys(obj)).toBe(false)
  })

  it('should return true for an object with an own enumerable property and an inherited one', () => {
    const obj = Object.create({ inherited: 'value' })
    obj.own = 'ownValue'
    expect(u.hasKeys(obj)).toBe(true)
  })

  it('should return true for an array with an extra enumerable property', () => {
    const arr = [1, 2, 3] as number[] & { customProp: string }
    arr.customProp = 'value'
    expect(u.hasKeys(arr)).toBe(true)
  })

  it('should handle functions with properties', () => {
    const fn = () => {}
    fn.prop = 'value'
    expect(u.hasKeys(fn)).toBe(true)
  })

  it('should return true for a String wrapper (indexed characters) and false for Number and Boolean wrappers (no enumerable properties)', () => {
    const asRecord = (value: object): Record<string, unknown> =>
      value as Record<string, unknown>
    expect(u.hasKeys(asRecord(new Object(String('hello'))))).toBe(true)
    expect(u.hasKeys(asRecord(new Object(Number(42))))).toBe(false)
    expect(u.hasKeys(asRecord(new Object(Boolean(true))))).toBe(false)
  })

  it('should handle frozen/sealed objects', () => {
    const obj = Object.freeze({ a: 1 })
    expect(u.hasKeys(obj)).toBe(true)
  })
})

describe('getFilteredTagEmit', () => {
  it('emits opener+body+closer for Type 1 verbatim nodes, because the GFM tagfilter keeps body and closer and escapes only each matching leading < at the HTML sink', () => {
    expect(
      u.getFilteredTagEmit({
        type: RuleType.htmlBlock,
        tag: 'script',
        _verbatim: true,
        _rawAttrs: '',
        _rawBody: 'alert(1)',
        _rawClose: '</script>',
        children: [],
      })
    ).toEqual({ kind: 'literal', literal: '<script>alert(1)</script>' })
  })

  it('keeps attributes and empty Type 1 bodies (closer-only _rawClose)', () => {
    expect(
      u.getFilteredTagEmit({
        type: RuleType.htmlBlock,
        tag: 'script',
        _verbatim: true,
        _rawAttrs: ' src="evil.js" type="text/javascript"',
        _rawClose: '</script>',
        children: [],
      })
    ).toEqual({
      kind: 'literal',
      literal: '<script src="evil.js" type="text/javascript"></script>',
    })
  })

  it('collapses plain-text children into a single literal', () => {
    expect(
      u.getFilteredTagEmit({
        type: RuleType.htmlBlock,
        tag: 'title',
        _rawAttrs: '',
        children: [{ type: RuleType.text, text: 'content' }],
      })
    ).toEqual({ kind: 'literal', literal: '<title>content</title>' })
  })

  it('uses open/close when structured children remain for nested rendering', () => {
    expect(
      u.getFilteredTagEmit({
        type: RuleType.htmlBlock,
        tag: 'iframe',
        _verbatim: true,
        _rawAttrs: '',
        _rawBody: 'hi <em>x</em>',
        _rawClose: '</iframe>',
        children: [
          { type: RuleType.text, text: 'hi ' },
          {
            type: RuleType.htmlBlock,
            tag: 'em',
            attrs: {},
            children: [{ type: RuleType.text, text: 'x' }],
          },
        ],
      })
    ).toEqual({ kind: 'sandwich', open: '<iframe>', close: '</iframe>' })
  })

  it('merges adjacent strings when assembling sandwich children', () => {
    expect(
      u.assembleFilteredTagChildren(
        '<iframe>',
        ['hi ', { type: 'em' }, ''],
        '</iframe>'
      )
    ).toEqual(['<iframe>hi ', { type: 'em' }, '</iframe>'])
  })

  it('reconstructs empty structured tags from attrs', () => {
    expect(
      u.getFilteredTagEmit({
        type: RuleType.htmlBlock,
        tag: 'iframe',
        _rawAttrs: ' src="evil.com"',
        children: [],
      })
    ).toEqual({ kind: 'literal', literal: '<iframe src="evil.com"></iframe>' })
  })

  it('emits self-closing and orphan closing literals', () => {
    expect(
      u.getFilteredTagEmit({
        type: RuleType.htmlSelfClosing,
        tag: 'script',
        _rawOpen: '<script src="evil.js" />',
      })
    ).toEqual({ kind: 'literal', literal: '<script src="evil.js" />' })
    expect(
      u.getFilteredTagEmit({
        type: RuleType.htmlBlock,
        tag: 'script',
        _isClosingTag: true,
        _rawClose: '</script>',
      })
    ).toEqual({ kind: 'literal', literal: '</script>' })
  })

  it('prefixes a space when _rawAttrs omits the leading whitespace', () => {
    expect(
      u.getFilteredTagEmit({
        type: RuleType.htmlBlock,
        tag: 'script',
        _verbatim: true,
        _rawAttrs: 'src="x"',
        _rawClose: '</script>',
        children: [],
      })
    ).toEqual({ kind: 'literal', literal: '<script src="x"></script>' })
  })
})

describe('htmlAttrsToJSXProps', () => {
  it('should map standard HTML attrs to JSX equivalents', () => {
    expect(
      u.htmlAttrsToJSXProps({ class: 'foo', for: 'bar' })
    ).toMatchInlineSnapshot(`
      {
        "className": "foo",
        "htmlFor": "bar",
      }
    `)
  })

  it('should preserve unmapped attributes as-is', () => {
    expect(
      u.htmlAttrsToJSXProps({ id: 'x', 'data-test': 'y' })
    ).toMatchInlineSnapshot(`
      {
        "data-test": "y",
        "id": "x",
      }
    `)
  })

  it('should convert XML namespace colon attrs to camelCase', () => {
    expect(
      u.htmlAttrsToJSXProps({
        'xlink:href': '#icon',
        'xml:lang': 'en',
        'xmlns:xlink': 'http://www.w3.org/1999/xlink',
      })
    ).toMatchInlineSnapshot(`
      {
        "xlinkHref": "#icon",
        "xmlLang": "en",
        "xmlnsXlink": "http://www.w3.org/1999/xlink",
      }
    `)
  })

  it('keeps a name outside the XML namespaces as written', () => {
    expect(
      u.htmlAttrsToJSXProps({
        'a:': '1',
        'b:c': '2',
        'h:ref': '3',
        'xlink:': '4',
      })
    ).toEqual({ 'a:': '1', 'b:c': '2', 'h:ref': '3', 'xlink:': '4' })
  })

  it('should handle case-insensitive lookup for known attrs', () => {
    expect(
      u.htmlAttrsToJSXProps({ CLASS: 'foo', For: 'bar', TABINDEX: '0' })
    ).toMatchInlineSnapshot(`
      {
        "className": "foo",
        "htmlFor": "bar",
        "tabIndex": "0",
      }
    `)
  })

  it('should map viewbox to viewBox', () => {
    expect(
      u.htmlAttrsToJSXProps({ viewbox: '0 0 100 100' })
    ).toMatchInlineSnapshot(`
      {
        "viewBox": "0 0 100 100",
      }
    `)
  })

  it('should preserve already-camelCase viewBox', () => {
    expect(
      u.htmlAttrsToJSXProps({ viewBox: '0 0 100 100' })
    ).toMatchInlineSnapshot(`
      {
        "viewBox": "0 0 100 100",
      }
    `)
  })
})

describe('withoutHandlerSource', () => {
  const fn = () => 1
  const attrs = () => ({
    'attr:onclick': 'b',
    href: '/',
    onClick: fn,
    onclick: 'a',
    onerror: true,
  })
  const kept = { href: '/', onClick: fn }
  function Card() {
    return null
  }
  const resolveTag = (tag: string, overrides: any): unknown => {
    const override = u.get(overrides, tag, undefined)
    if (typeof override === 'function' || typeof override === 'string') {
      return override
    }
    return override?.component || tag
  }

  it.each([
    ['a', undefined, kept],
    ['a', { a: { props: {} } }, kept],
    ['my-widget', { 'my-widget': Card }, kept],
    ['Btn', undefined, kept],
    ['Btn', { Other: Card }, kept],
    ['Btn', { Btn: 'a' }, kept],
    ['Btn', { Btn: { component: 'a' } }, kept],
    ['Btn', { Btn: { props: {} } }, kept],
    ['Btn', { Btn: Card }, attrs()],
    ['Btn', { btn: { component: Card } }, attrs()],
    ['BTN', { Btn: Card }, attrs()],
  ])('gives the attributes of <%s> with %j as %j when the renderer resolves tags, leaving the node as written', (tag, overrides, expected) => {
    const own = attrs()
    expect(u.withoutHandlerSource(tag, own, overrides, resolveTag)).toEqual(
      expected
    )
    expect(own).toEqual(attrs())
  })

  it('strips string handlers from a component tag when the renderer only writes elements', () => {
    expect(u.withoutHandlerSource('Btn', attrs(), { Btn: Card })).toEqual(kept)
  })

  it.each([
    ['no handler', { className: 'x', href: '/' }],
    ['no attributes', undefined],
  ])('gives back the same attributes with %s', (_, own) => {
    expect(u.withoutHandlerSource('a', own, undefined)).toBe(own)
  })
})

describe('normalizeJsxReparseText', () => {
  it.each([
    ['<div>\n  <b>x</b>\n</div>\n', '<div><b>x</b></div>'],
    ['a\n\nb', 'a b'],
    ['<i title="a >  < b"></i>', '<i title="a >  < b"></i>'],
    ["<i title='a\nb'>\nx\n</i>", "<i title='a\nb'> x </i>"],
    ['<i title = "a\nb">x</i>', '<i title = "a\nb">x</i>'],
    ['<i title="a\nb', '<i title="a\nb'],
    ['<a title="x"\nb"c\nd">\ne', '<a title="x" b"c d"> e'],
    ["<p>don't\n<b>x</b></p>", "<p>don't <b>x</b></p>"],
    ['</i title="a\nb">', '</i title="a b">'],
  ])('writes %j as %j', (text, expected) => {
    expect(u.normalizeJsxReparseText(text)).toBe(expected)
  })
})

describe('no runtime remote fetching', () => {
  var NetworkApis = [
    'fetch(',
    'globalThis.fetch',
    'self.fetch',
    'window.fetch',
    'XMLHttpRequest',
    'http.get',
    'http.request',
    'https.get',
    'https.request',
    'navigator.sendBeacon',
    'new WebSocket',
    'new EventSource',
  ]

  var srcDir = path.join(import.meta.dirname)

  function getSrcFiles(dir: string): string[] {
    var results: string[] = []
    for (var entry of fs.readdirSync(dir, { withFileTypes: true })) {
      var full = path.join(dir, entry.name)
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        results = results.concat(getSrcFiles(full))
      } else if (
        entry.isFile() &&
        /\.(ts|tsx)$/.test(entry.name) &&
        !entry.name.includes('.spec.')
      ) {
        results.push(full)
      }
    }
    return results
  }

  var files = getSrcFiles(srcDir)

  it('should have src files to scan', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('should not contain network API calls in library source', () => {
    var violations: string[] = []
    for (var file of files) {
      var content = fs.readFileSync(file, 'utf8')
      var relPath = path.relative(path.join(import.meta.dirname, '..'), file)
      for (var api of NetworkApis) {
        var lines = content.split('\n')
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim()
          if (
            line.startsWith('//') ||
            line.startsWith('*') ||
            line.startsWith('/*')
          ) {
            continue
          }
          if (line.includes(api)) {
            violations.push(`${relPath}:${i + 1} contains "${api}"`)
          }
        }
      }
    }
    expect(violations).toEqual([])
  })
})
