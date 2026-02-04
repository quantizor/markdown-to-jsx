import { describe, expect, it } from 'bun:test'
import { type MarkdownToJSX, RuleType } from './types'
import * as u from './utils'

describe('parseFrontmatterBounds', () => {
  it('should return null for input not starting with ---', () => {
    expect(u.parseFrontmatterBounds('')).toBeNull()
    expect(u.parseFrontmatterBounds('no frontmatter')).toBeNull()
    expect(u.parseFrontmatterBounds('---missing space')).toBeNull()
  })

  it('should return null if no newline after ---', () => {
    expect(u.parseFrontmatterBounds('---')).toBeNull()
    expect(u.parseFrontmatterBounds('---content')).toBeNull()
  })

  it('should parse valid frontmatter bounds', () => {
    const result = u.parseFrontmatterBounds('---\nkey: value\n---\n')
    expect(result).toEqual({ endPos: 19, hasValidYaml: true })
  })

  it('should handle frontmatter with only whitespace after ---', () => {
    const result = u.parseFrontmatterBounds('---   \nkey: value\n---\n')
    expect(result).toEqual({ endPos: 22, hasValidYaml: true })
  })

  it('should detect YAML when colon is present in lines', () => {
    const result = u.parseFrontmatterBounds('---\nkey: value\n---\n')
    expect(result?.hasValidYaml).toBe(true)
  })

  it('should not detect YAML when no colon present', () => {
    const result = u.parseFrontmatterBounds('---\nno yaml here\n---\n')
    expect(result?.hasValidYaml).toBe(false)
  })

  it('should handle multiline frontmatter', () => {
    const result = u.parseFrontmatterBounds(
      '---\nkey1: value1\nkey2: value2\n---\n'
    )
    expect(result).toEqual({ endPos: 34, hasValidYaml: true })
  })

  it('should return null for unclosed frontmatter', () => {
    expect(u.parseFrontmatterBounds('---\nkey: value\n')).toBeNull()
  })

  it('should handle frontmatter with nested markers', () => {
    const result = u.parseFrontmatterBounds('---\ncontent: ---\n---\n')
    expect(result).toEqual({ endPos: 21, hasValidYaml: true })
  })

  it('should handle frontmatter with very long content', () => {
    const longContent = '---\n' + 'x: y\n'.repeat(1000) + '---\n'
    const result = u.parseFrontmatterBounds(longContent)
    expect(result?.hasValidYaml).toBe(true)
  })

  it('should handle frontmatter with unusual YAML structures', () => {
    const result = u.parseFrontmatterBounds(
      '---\nkey: "quoted"\nother: [1,2,3]\n---\n'
    )
    expect(result?.hasValidYaml).toBe(true)
  })

  it('should handle frontmatter with tabs and mixed whitespace', () => {
    const result = u.parseFrontmatterBounds('---\t \n\tkey: value\n---\n')
    expect(result?.hasValidYaml).toBe(true)
  })

  it('should handle empty frontmatter', () => {
    const result = u.parseFrontmatterBounds('---\n---\n')
    expect(result).toEqual({ endPos: 8, hasValidYaml: false })
  })

  it('should handle frontmatter with only whitespace content', () => {
    const result = u.parseFrontmatterBounds('---\n   \t   \n---\n')
    expect(result).toEqual({ endPos: 16, hasValidYaml: false })
  })

  it('should reject frontmatter with invalid markers', () => {
    expect(u.parseFrontmatterBounds('--\ncontent\n---\n')).toBeNull() // too few dashes
    expect(u.parseFrontmatterBounds('----\ncontent\n---\n')).toBeNull() // uneven dashes
    expect(u.parseFrontmatterBounds('---content\n---\n')).toBeNull() // no newline after opening
  })

  it('should handle frontmatter with malformed content gracefully', () => {
    expect(u.parseFrontmatterBounds('---\n:invalid\n---\n')).toEqual({
      endPos: 17,
      hasValidYaml: true,
    }) // colon without key - still valid YAML
    const result = u.parseFrontmatterBounds('---\nkey: value\n---\nextra') // content after closing is allowed
    expect(result?.hasValidYaml).toBe(true)
  })

  it('should handle frontmatter with very long keys', () => {
    const tooLongKey = 'a'.repeat(10000) + ': value'
    const result = u.parseFrontmatterBounds(`---\n${tooLongKey}\n---\n`)
    expect(result?.hasValidYaml).toBe(true) // function handles long content
  })

  it('should handle frontmatter with binary/null characters', () => {
    const result1 = u.parseFrontmatterBounds('---\nkey: val\x00ue\n---\n')
    expect(result1?.hasValidYaml).toBe(true) // null chars don't break parsing
    const result2 = u.parseFrontmatterBounds('---\nkey\x01: value\n---\n')
    expect(result2?.hasValidYaml).toBe(true) // control chars don't break parsing
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
    expect(u.decodeEntityReferences('&amp')).toBe('&amp') // missing semicolon
  })

  it('should handle entities with unusual characters', () => {
    expect(u.decodeEntityReferences('&amp;&lt;&123&gt;')).toBe('&<&123>')
  })

  it('should handle very long entity names', () => {
    const longEntity = '&' + 'a'.repeat(1000) + ';'
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

  it('should handle entities with maximum allowed lengths', () => {
    expect(u.decodeEntityReferences('&#999999999;')).toBe('&#999999999;') // too long
    expect(u.decodeEntityReferences('&#xFFFFFF;')).toBe('\uFFFD') // becomes replacement char
  })

  it('should handle combining characters in entities', () => {
    // This tests that entities are decoded before any further processing
    expect(u.decodeEntityReferences('&amp;&#x301;')).toBe('&́') // & + combining acute
  })

  it('should reject invalid entity formats', () => {
    expect(u.decodeEntityReferences('&;')).toBe('&;') // empty entity
    expect(u.decodeEntityReferences('&amp')).toBe('&amp') // missing semicolon
    expect(u.decodeEntityReferences('&123;')).toBe('&123;') // numeric without #
    expect(u.decodeEntityReferences('&#;')).toBe('&#;') // empty numeric
    expect(u.decodeEntityReferences('&#x;')).toBe('&#x;') // empty hex
  })

  it('should reject malformed numeric entities', () => {
    expect(u.decodeEntityReferences('&#-1;')).toBe('&#-1;') // negative numbers
    expect(u.decodeEntityReferences('&#abc;')).toBe('&#abc;') // invalid decimal
    expect(u.decodeEntityReferences('&#xZZ;')).toBe('&#xZZ;') // invalid hex
    expect(u.decodeEntityReferences('&#999999999999;')).toBe('&#999999999999;') // too large
  })

  it('should reject entities with invalid characters', () => {
    expect(u.decodeEntityReferences('&amp ;')).toBe('&amp ;') // space in entity
    expect(u.decodeEntityReferences('&amp\n;')).toBe('&amp\n;') // newline in entity
    expect(u.decodeEntityReferences('&amp\x00;')).toBe('&amp\x00;') // null byte in entity
  })

  it('should not decode nested entities', () => {
    expect(u.decodeEntityReferences('&amp;lt;')).toBe('&lt;') // &amp; becomes &, then &lt; becomes <
    // This is actually correct behavior - entities are processed left to right
  })

  it('should handle entities at string boundaries correctly', () => {
    expect(u.decodeEntityReferences('&amp')).toBe('&amp') // incomplete at end
    expect(u.decodeEntityReferences('&amp;')).toBe('&') // complete entity
  })
})

describe('sanitizer', () => {
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

  it('should decode and check percent-encoded dangerous content', () => {
    expect(
      u.sanitizer('https://example.com/%6a%61%76%61%73%63%72%69%70%74:alert(1)')
    ).toBeNull()
  })

  it('should return null for malformed URLs that cannot be decoded', () => {
    expect(u.sanitizer('https://example.com/%FF%FF')).toBeNull()
  })

  it('should warn in development mode for unsafe input', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const originalWarn = console.warn
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

    console.warn = originalWarn
    process.env.NODE_ENV = originalEnv
  })

  it('should handle very long URLs', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(10000)
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

  it('should handle URLs with nested percent encoding', () => {
    expect(u.sanitizer('https://example.com/%2561%2564%2565%2572%2574')).toBe(
      'https://example.com/%2561%2564%2565%2572%2574'
    ) // nested encoding is allowed
  })

  it('should handle data URLs with unusual MIME types', () => {
    expect(u.sanitizer('data:text/plain;base64,SGVsbG8=')).toBeNull() // data:text should be blocked
    expect(u.sanitizer('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe(
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
    )
  })

  it('should handle URLs with unusual characters', () => {
    expect(u.sanitizer('https://example.com/🦄🌈')).toBe(
      'https://example.com/🦄🌈'
    )
  })

  it('should handle URLs that look like protocols but are not', () => {
    expect(u.sanitizer('notjavascript:alert(1)')).toBeNull() // sanitizer is more aggressive
  })

  it('should handle empty and whitespace URLs', () => {
    expect(u.sanitizer('')).toBe('')
    expect(u.sanitizer('   ')).toBe('   ')
  })

  it('should handle URLs with unusual encoding patterns', () => {
    expect(u.sanitizer('https://example.com/%')).toBeNull() // malformed encoding
    expect(u.sanitizer('https://example.com/%FF')).toBeNull() // malformed encoding
  })

  it('should reject dangerous JavaScript protocols', () => {
    expect(u.sanitizer('javascript:alert(1)')).toBeNull()
    expect(u.sanitizer('JAVASCRIPT:alert(1)')).toBeNull()
    expect(u.sanitizer('JavaScript:alert(1)')).toBeNull()
    expect(u.sanitizer('vbscript:msgbox(1)')).toBeNull()
    expect(u.sanitizer('data:text/html,<script>alert(1)</script>')).toBeNull()
  })

  it('should reject URLs with encoded dangerous content', () => {
    expect(
      u.sanitizer('https://example.com/%6a%61%76%61%73%63%72%69%70%74:alert(1)')
    ).toBeNull()
    expect(
      u.sanitizer('data:text/html,%3cscript%3ealert(1)%3c/script%3e')
    ).toBeNull()
  })

  it('should handle URLs with unusual protocols gracefully', () => {
    expect(u.sanitizer('livescript:code')).toBe('livescript:code') // unknown protocols are allowed
    expect(u.sanitizer('mocha:code')).toBe('mocha:code') // unknown protocols are allowed
    expect(u.sanitizer('mocha:')).toBe('mocha:') // empty protocol content is allowed
  })

  it('should handle malformed URLs gracefully', () => {
    expect(u.sanitizer('http://')).toBe('http://') // empty host is allowed
    expect(u.sanitizer('https://')).toBe('https://') // empty host is allowed
    expect(u.sanitizer('://example.com')).toBe('://example.com') // missing protocol is allowed
    expect(u.sanitizer('http:///path')).toBe('http:///path') // empty host with path is allowed
  })

  it('should handle URLs with unusual characters in protocol gracefully', () => {
    expect(u.sanitizer('http s://example.com')).toBe('http s://example.com') // space in protocol is allowed
    expect(u.sanitizer('http\t://example.com')).toBe('http\t://example.com') // tab in protocol is allowed
    expect(u.sanitizer('http\n://example.com')).toBe('http\n://example.com') // newline in protocol is allowed
  })

  it('should handle extremely long URLs', () => {
    // Long URLs are allowed - sanitizer only checks for dangerous protocols
    const longUrl = 'https://example.com/' + 'a'.repeat(100000)
    expect(u.sanitizer(longUrl)).toBe(longUrl)
  })

  it('should handle URLs with null bytes or control characters gracefully', () => {
    expect(u.sanitizer('https://example.com/\x00path')).toBe(
      'https://example.com/\x00path'
    ) // null bytes are allowed
    expect(u.sanitizer('https://example.com/\x01path')).toBe(
      'https://example.com/\x01path'
    ) // control chars are allowed
    expect(u.sanitizer('https://example\x00.com')).toBe(
      'https://example\x00.com'
    ) // null bytes in domain are allowed
  })
})

describe('slugify', () => {
  it('should convert text to URL-safe slugs', () => {
    expect(u.slugify('Hello World')).toBe('hello-world')
    expect(u.slugify('Hello-World')).toBe('hello-world')
  })

  it('should preserve multiple spaces as multiple hyphens', () => {
    expect(u.slugify('Hello   World')).toBe('hello---world')
  })

  it('should handle Unicode characters', () => {
    expect(u.slugify('café')).toBe('cafe')
    expect(u.slugify('naïve')).toBe('naive')
    expect(u.slugify('résumé')).toBe('resume')
  })

  it('should preserve alphanumeric characters', () => {
    expect(u.slugify('abc123')).toBe('abc123')
    expect(u.slugify('ABC123')).toBe('abc123')
  })

  it('should handle special characters', () => {
    expect(u.slugify('Hello!@#$%^&*()')).toBe('hello')
    expect(u.slugify('test_file.txt')).toBe('testfiletxt')
  })

  it('should handle empty and edge cases', () => {
    expect(u.slugify('')).toBe('')
    expect(u.slugify('   ')).toBe('---')
    expect(u.slugify('-_-')).toBe('--') // underscores are filtered out
  })

  it('should handle complex Unicode combinations', () => {
    expect(u.slugify('ÁÉÍÓÚ')).toBe('aeiou')
    expect(u.slugify('Ññ')).toBe('nn')
  })

  it('should handle extremely long strings', () => {
    const longString = 'a'.repeat(100000)
    expect(u.slugify(longString)).toBe(longString)
  })

  it('should handle strings with every ASCII character', () => {
    const allChars = Array.from({ length: 128 }, (_, i) =>
      String.fromCharCode(i)
    ).join('')
    const result = u.slugify(allChars)
    expect(result).toMatch(/^[a-z0-9\-]*$/)
  })

  it('should handle strings with combining characters', () => {
    expect(u.slugify('café')).toBe('cafe') // combining acute
    expect(u.slugify('ñ')).toBe('n') // combining tilde
  })

  it('should handle strings with zero-width characters', () => {
    expect(u.slugify('hello\u200Bworld')).toBe('helloworld') // zero-width space
  })

  it('should handle strings with control characters', () => {
    expect(u.slugify('hello\nworld')).toBe('helloworld') // control chars are filtered out
    expect(u.slugify('hello\tworld')).toBe('helloworld') // control chars are filtered out
    expect(u.slugify('hello\rworld')).toBe('helloworld') // control chars are filtered out
  })

  it('should handle strings with mathematical symbols', () => {
    expect(u.slugify('∑∆∏')).toBe('') // these are filtered out
  })

  it('should handle strings with emoji', () => {
    expect(u.slugify('hello 😀 world')).toBe('hello--world') // emoji creates multiple spaces
  })

  it('should handle strings with unusual Unicode ranges', () => {
    expect(u.slugify('ᚠᛇᚻ')).toBe('') // runic characters
    expect(u.slugify('あいうえお')).toBe('') // hiragana
  })

  it('should reject strings that result in empty slugs', () => {
    expect(u.slugify('!@#$%^&*()')).toBe('') // only punctuation
    expect(u.slugify('∑∆∏')).toBe('') // only mathematical symbols
    expect(u.slugify('')).toBe('') // empty string
    expect(u.slugify('   ')).toBe('---') // only whitespace becomes hyphens
  })

  it('should handle strings with invalid characters', () => {
    expect(u.slugify('hello\x00world')).toBe('helloworld') // null bytes are filtered
    expect(u.slugify('hello\x01world')).toBe('helloworld') // control chars are filtered
    expect(u.slugify('hello\uFFFDworld')).toBe('helloworld') // replacement chars are filtered
  })

  it('should reject strings that could cause issues', () => {
    // Very long strings with only punctuation
    const longPunct = '!'.repeat(10000)
    expect(u.slugify(longPunct)).toBe('')

    // Strings that normalize to nothing
    expect(u.slugify('\u200B\u200C\u200D')).toBe('') // zero-width characters
  })

  it('should not produce slugs that start or end with hyphens inappropriately', () => {
    expect(u.slugify('-hello-')).toBe('-hello-') // preserves existing hyphens
    expect(u.slugify(' - hello - ')).toBe('---hello---') // spaces become hyphens
  })

  it('should handle malformed input gracefully', () => {
    expect(() => u.slugify(null as any)).toThrow() // null input should throw
    expect(() => u.slugify(undefined as any)).toThrow() // undefined input should throw
  })
})

describe('string utilities', () => {
  describe('startsWith', () => {
    it('should check if string starts with prefix', () => {
      expect(u.startsWith('hello world', 'hello')).toBe(true)
      expect(u.startsWith('hello world', 'world')).toBe(false)
      expect(u.startsWith('hello', 'hello world')).toBe(false)
    })

    it('should handle position parameter', () => {
      expect(u.startsWith('hello world', 'world', 6)).toBe(true)
      expect(u.startsWith('hello world', 'hello', 1)).toBe(false)
    })
  })

  describe('endsWith', () => {
    it('should check if string ends with suffix', () => {
      expect(u.endsWith('hello world', 'world')).toBe(true)
      expect(u.endsWith('hello world', 'hello')).toBe(false)
    })

    it('should handle position parameter', () => {
      expect(u.endsWith('hello world', 'hello', 5)).toBe(true)
      expect(u.endsWith('hello world', 'world', 5)).toBe(false)
    })
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
      expect(u.isAlnumCode(128)).toBe(false) // Non-ASCII
    })
  })

  describe('isASCIIPunctuation', () => {
    it('should return true for ASCII punctuation characters', () => {
      const punctuation = '!@#$%^&*()-_=+[]{}|;:,.<>?/~`'
      for (const char of punctuation) {
        expect(u.isASCIIPunctuation(char.charCodeAt(0))).toBe(true)
      }
    })

    it('should return false for non-punctuation characters', () => {
      expect(u.isASCIIPunctuation('a'.charCodeAt(0))).toBe(false)
      expect(u.isASCIIPunctuation(' '.charCodeAt(0))).toBe(false)
      expect(u.isASCIIPunctuation(128)).toBe(false) // Non-ASCII
    })
  })

  describe('isASCIIWhitespace', () => {
    it('should return true for ASCII whitespace characters', () => {
      expect(u.isASCIIWhitespace('\t'.charCodeAt(0))).toBe(true)
      expect(u.isASCIIWhitespace('\n'.charCodeAt(0))).toBe(true)
      expect(u.isASCIIWhitespace('\r'.charCodeAt(0))).toBe(true)
      expect(u.isASCIIWhitespace(' '.charCodeAt(0))).toBe(true)
      expect(u.isASCIIWhitespace('\f'.charCodeAt(0))).toBe(true)
    })

    it('should return false for non-whitespace characters', () => {
      expect(u.isASCIIWhitespace('a'.charCodeAt(0))).toBe(false)
      expect(u.isASCIIWhitespace('!'.charCodeAt(0))).toBe(false)
      expect(u.isASCIIWhitespace(128)).toBe(false) // Non-ASCII
    })
  })

  describe('isUnicodeWhitespace', () => {
    it('should return true for Unicode whitespace characters', () => {
      expect(u.isUnicodeWhitespace(' ')).toBe(true)
      expect(u.isUnicodeWhitespace('\t')).toBe(true)
      expect(u.isUnicodeWhitespace('\n')).toBe(true)
      expect(u.isUnicodeWhitespace('\u00A0')).toBe(true) // Non-breaking space
      expect(u.isUnicodeWhitespace('\u2000')).toBe(true) // Various Unicode spaces
    })

    it('should return true for empty string', () => {
      expect(u.isUnicodeWhitespace('')).toBe(true)
    })

    it('should return false for non-whitespace characters', () => {
      expect(u.isUnicodeWhitespace('a')).toBe(false)
      expect(u.isUnicodeWhitespace('!')).toBe(false)
    })
  })

  describe('isUnicodePunctuation', () => {
    it('should return true for Unicode punctuation characters', () => {
      expect(u.isUnicodePunctuation('!')).toBe(true)
      expect(u.isUnicodePunctuation('.')).toBe(true)
      expect(u.isUnicodePunctuation('?')).toBe(true)
      expect(u.isUnicodePunctuation('¿')).toBe(true) // Unicode punctuation
      expect(u.isUnicodePunctuation('¡')).toBe(true)
    })

    it('should return false for non-punctuation characters', () => {
      expect(u.isUnicodePunctuation('a')).toBe(false)
      expect(u.isUnicodePunctuation(' ')).toBe(false)
      expect(u.isUnicodePunctuation('')).toBe(false)
    })

    it('should handle numeric code parameter', () => {
      expect(u.isUnicodePunctuation('.'.charCodeAt(0))).toBe(true)
      expect(u.isUnicodePunctuation('a'.charCodeAt(0))).toBe(false)
    })

    it('should handle edge cases with high Unicode codepoints', () => {
      expect(u.isUnicodePunctuation(0x10ffff)).toBe(false) // maximum valid Unicode
      expect(u.isUnicodePunctuation(0x110000)).toBe(false) // beyond maximum
    })

    it('should handle combining characters', () => {
      expect(u.isUnicodePunctuation('\u0300')).toBe(false) // combining grave accent
      expect(u.isUnicodePunctuation('\u0301')).toBe(false) // combining acute accent
    })

    it('should handle control characters', () => {
      expect(u.isUnicodePunctuation('\u0000')).toBe(false) // null
      expect(u.isUnicodePunctuation('\u0001')).toBe(false) // start of heading
      expect(u.isUnicodePunctuation('\u007F')).toBe(false) // delete
    })

    it('should handle mathematical operators', () => {
      expect(u.isUnicodePunctuation('+')).toBe(true)
      expect(u.isUnicodePunctuation('=')).toBe(true)
      expect(u.isUnicodePunctuation('±')).toBe(true) // plus-minus sign
    })

    it('should handle currency symbols', () => {
      expect(u.isUnicodePunctuation('$')).toBe(true)
      expect(u.isUnicodePunctuation('€')).toBe(true)
      expect(u.isUnicodePunctuation('£')).toBe(true)
    })

    it('should handle dingbats and symbols', () => {
      expect(u.isUnicodePunctuation('✓')).toBe(true) // check mark
      expect(u.isUnicodePunctuation('✗')).toBe(true) // ballot x
    })

    it('should handle various Unicode punctuation categories', () => {
      // Pc (connector punctuation)
      expect(u.isUnicodePunctuation('_')).toBe(true)
      // Pd (dash punctuation)
      expect(u.isUnicodePunctuation('—')).toBe(true) // em dash
      // Pe (close punctuation)
      expect(u.isUnicodePunctuation(')')).toBe(true)
      expect(u.isUnicodePunctuation('}')).toBe(true)
      // Pf (final punctuation)
      expect(u.isUnicodePunctuation('»')).toBe(true)
      // Pi (initial punctuation)
      expect(u.isUnicodePunctuation('«')).toBe(true)
      // Po (other punctuation)
      expect(u.isUnicodePunctuation('!')).toBe(true)
      expect(u.isUnicodePunctuation('?')).toBe(true)
      // Ps (open punctuation)
      expect(u.isUnicodePunctuation('(')).toBe(true)
      expect(u.isUnicodePunctuation('{')).toBe(true)
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

  it('should return true for SVG void elements', () => {
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
    // animateTransform is not a void element
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
    const longTag = 'a'.repeat(10000)
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

  it('should handle case sensitivity correctly', () => {
    expect(u.isVoidElement('BR')).toBe(true) // case insensitive
    expect(u.isVoidElement('br')).toBe(true)
    expect(u.isVoidElement('Br')).toBe(true)
  })

  it('should handle SVG namespace edge cases', () => {
    expect(u.isVoidElement('svg:')).toBe(false) // empty after colon
    expect(u.isVoidElement(':circle')).toBe(true) // :circle matches circle (empty before colon is ignored)
    expect(u.isVoidElement('circle:svg')).toBe(false) // wrong order
  })

  it('should handle malformed tag names', () => {
    expect(u.isVoidElement('<br>')).toBe(false) // includes brackets
    expect(u.isVoidElement('br>')).toBe(false) // includes bracket
    expect(u.isVoidElement('<br')).toBe(false) // includes bracket
  })

  it('should handle Unicode in tag names', () => {
    expect(u.isVoidElement('br🦄')).toBe(false)
    expect(u.isVoidElement('🦄br')).toBe(false)
  })
})

describe('text processing', () => {
  describe('findLineEnd', () => {
    it('should find the end of the current line', () => {
      expect(u.findLineEnd('hello\nworld', 0)).toBe(5)
      expect(u.findLineEnd('hello\r\nworld', 0)).toBe(5) // CRLF: returns position before \r
      expect(u.findLineEnd('hello', 0)).toBe(5)
      expect(u.findLineEnd('hello\nworld', 6)).toBe(11)
    })

    it('should return string length when no newline found', () => {
      expect(u.findLineEnd('no newline', 0)).toBe(10)
    })

    it('should handle extremely long strings', () => {
      const longString = 'a'.repeat(100000) + '\n'
      expect(u.findLineEnd(longString, 0)).toBe(100000)
    })

    it('should handle strings with unusual newline combinations', () => {
      expect(u.findLineEnd('hello\r\nworld', 0)).toBe(5) // CRLF - returns position before \r
      expect(u.findLineEnd('hello\rworld', 0)).toBe(11) // CR only (not treated as newline)
      expect(u.findLineEnd('hello\n\rworld', 0)).toBe(5) // LF then CR
    })

    it('should handle empty strings and edge positions', () => {
      expect(u.findLineEnd('', 0)).toBe(0)
      expect(u.findLineEnd('a', 0)).toBe(1)
      expect(u.findLineEnd('a', 1)).toBe(1) // position beyond string
    })

    it('should handle strings with multiple consecutive newlines', () => {
      expect(u.findLineEnd('hello\n\nworld', 0)).toBe(5)
      expect(u.findLineEnd('hello\n\nworld', 6)).toBe(6) // at the second newline
    })
  })

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

  describe('skipWhitespace', () => {
    it('should skip spaces and tabs', () => {
      expect(u.skipWhitespace('  \t hello', 0)).toBe(4)
      expect(u.skipWhitespace('hello', 0)).toBe(0)
      expect(u.skipWhitespace('   ', 0)).toBe(3)
    })

    it('should respect maxPos parameter', () => {
      expect(u.skipWhitespace('  \t hello', 0, 3)).toBe(3)
      expect(u.skipWhitespace('  \t hello', 0, 2)).toBe(2)
    })

    it('should handle extremely long whitespace sequences', () => {
      const longWhitespace = ' '.repeat(100000) + 'text'
      expect(u.skipWhitespace(longWhitespace, 0)).toBe(100000)
    })

    it('should handle mixed whitespace characters', () => {
      expect(u.skipWhitespace(' \t \n \r \f hello', 0)).toBe(3) // only space and tab are considered whitespace here
    })

    it('should handle Unicode whitespace characters', () => {
      expect(u.skipWhitespace(' \u00A0\u2000\u2001hello', 0)).toBe(1) // only space is considered whitespace here
    })

    it('should handle edge positions', () => {
      expect(u.skipWhitespace('', 0)).toBe(0) // empty string
      expect(u.skipWhitespace('   ', 3)).toBe(3) // position at end
      expect(u.skipWhitespace('   ', 10)).toBe(10) // position beyond string
    })

    it('should handle strings starting with non-whitespace', () => {
      expect(u.skipWhitespace('hello world', 0)).toBe(0)
      expect(u.skipWhitespace('hello world', 5)).toBe(6) // at space, skips to next non-whitespace
      expect(u.skipWhitespace('hello   world', 6)).toBe(8) // skip multiple spaces
    })
  })

  describe('extractPlainText', () => {
    it('should extract text from text and codeInline nodes', () => {
      const nodes = [
        { type: RuleType.text, text: 'hello' },
        { type: RuleType.codeInline, text: 'world' },
      ]
      expect(u.extractPlainText(nodes, RuleType)).toBe('helloworld')
    })

    it('should recursively extract from formatted text and links', () => {
      const nodes = [
        {
          type: RuleType.textFormatted,
          children: [{ type: RuleType.text, text: 'bold' }],
        },
        {
          type: RuleType.link,
          children: [{ type: RuleType.text, text: 'link' }],
        },
      ]
      expect(u.extractPlainText(nodes, RuleType)).toBe('boldlink')
    })

    it('should extract alt text from images', () => {
      const nodes = [{ type: RuleType.image, alt: 'alt text' }]
      expect(u.extractPlainText(nodes, RuleType)).toBe('alt text')
    })

    it('should handle null/undefined text gracefully', () => {
      const nodes = [
        { type: RuleType.text, text: null },
        { type: RuleType.text, text: undefined },
        { type: RuleType.text, text: 'valid' },
      ]
      expect(u.extractPlainText(nodes, RuleType)).toBe('valid')
    })

    it('should handle extremely deep nesting', () => {
      let node: MarkdownToJSX.ASTNode = { type: RuleType.text, text: 'deep' }
      for (let i = 0; i < 100; i++) {
        node = { type: RuleType.textFormatted, children: [node], tag: 'strong' }
      }
      expect(u.extractPlainText([node], RuleType)).toBe('deep')
    })

    it('should handle very large node arrays', () => {
      const nodes = Array.from({ length: 10000 }, (_, i) => ({
        type: RuleType.text,
        text: `text${i}`,
      }))
      const result = u.extractPlainText(nodes, RuleType)
      expect(result.length).toBeGreaterThan(50000) // roughly 6 chars per node * 10000
    })

    it('should handle malformed node structures', () => {
      const nodes = [
        { type: RuleType.text, text: 'good' },
        { type: RuleType.text }, // missing text property
        { type: RuleType.textFormatted }, // missing children
        { type: RuleType.link, children: null }, // null children
      ]
      expect(u.extractPlainText(nodes, RuleType)).toBe('good')
    })

    it('should handle circular references safely', () => {
      // Note: The function currently doesn't protect against infinite recursion
      // This test documents that circular references cause stack overflow
      const node: MarkdownToJSX.FormattedTextNode = {
        type: RuleType.textFormatted,
        children: [],
        tag: 'strong',
      }
      node.children.push(node) // circular reference
      // This will cause infinite recursion - verify it throws RangeError
      expect(() => {
        u.extractPlainText([node], RuleType)
      }).toThrow(RangeError)
    })

    it('should handle nodes with unusual type values', () => {
      const nodes = [
        { type: 'unknown', text: 'should be ignored' },
        { type: '', text: 'should be ignored' },
        { type: null, text: 'should be ignored' },
      ]
      expect(u.extractPlainText(nodes, RuleType)).toBe('')
    })

    it('should handle mixed content types efficiently', () => {
      const nodes = [
        { type: RuleType.text, text: 'start' },
        {
          type: RuleType.textFormatted,
          children: [
            {
              type: RuleType.link,
              children: [{ type: RuleType.text, text: 'middle' }],
            },
          ],
        },
        { type: RuleType.image, alt: 'end' },
      ]
      expect(u.extractPlainText(nodes, RuleType)).toBe('startmiddleend')
    })
  })
})

describe('hasKeys', () => {
  it('should return true for objects with enumerable properties', () => {
    expect(u.hasKeys({ a: 1 })).toBe(true)
    expect(u.hasKeys({ a: 1, b: 2 })).toBe(true)
  })

  it('should return false for objects without enumerable properties', () => {
    expect(u.hasKeys({})).toBe(false)
    expect(u.hasKeys(new Set([1, 2, 3]))).toBe(false) // Sets don't have enumerable string keys
    expect(u.hasKeys(new Set())).toBe(false)
  })

  it('should return false for null and undefined', () => {
    expect(u.hasKeys(null)).toBe(false)
    expect(u.hasKeys(undefined)).toBe(false)
  })

  it('should handle objects with non-enumerable properties', () => {
    const obj = {}
    Object.defineProperty(obj, 'hidden', { enumerable: false, value: 'value' })
    expect(u.hasKeys(obj)).toBe(false) // only enumerable properties count
  })

  it('should handle objects with symbol properties', () => {
    const sym = Symbol('test')
    const obj = { [sym]: 'value' }
    expect(u.hasKeys(obj)).toBe(false) // symbols are not string keys
  })

  it('should handle prototype chain properties', () => {
    const obj = Object.create({ inherited: 'value' })
    obj.own = 'ownValue'
    expect(u.hasKeys(obj)).toBe(true) // own enumerable properties
  })

  it('should handle arrays with properties', () => {
    const arr = [1, 2, 3] as number[] & { customProp: string }
    arr.customProp = 'value'
    expect(u.hasKeys(arr)).toBe(true) // has length and customProp
  })

  it('should handle functions with properties', () => {
    const fn = function () {}
    fn.prop = 'value'
    expect(u.hasKeys(fn)).toBe(true)
  })

  it('should handle primitive wrappers', () => {
    expect(u.hasKeys(new String('hello'))).toBe(true) // has length and other properties
    expect(u.hasKeys(new Number(42))).toBe(false) // Number wrapper has no enumerable properties
    expect(u.hasKeys(new Boolean(true))).toBe(false) // Boolean wrapper has no enumerable properties
  })

  it('should handle frozen/sealed objects', () => {
    const obj = Object.freeze({ a: 1 })
    expect(u.hasKeys(obj)).toBe(true)
  })
})

describe('htmlAttrsToJSXProps', () => {
  it('should map standard HTML attrs to JSX equivalents', () => {
    expect(u.htmlAttrsToJSXProps({ class: 'foo', for: 'bar' }))
      .toMatchInlineSnapshot(`
      {
        "className": "foo",
        "htmlFor": "bar",
      }
    `)
  })

  it('should preserve unmapped attributes as-is', () => {
    expect(u.htmlAttrsToJSXProps({ id: 'x', 'data-test': 'y' }))
      .toMatchInlineSnapshot(`
      {
        "data-test": "y",
        "id": "x",
      }
    `)
  })

  it('should convert XML namespace colon attrs to camelCase', () => {
    expect(u.htmlAttrsToJSXProps({
      'xlink:href': '#icon',
      'xml:lang': 'en',
      'xmlns:xlink': 'http://www.w3.org/1999/xlink',
    })).toMatchInlineSnapshot(`
      {
        "xlinkHref": "#icon",
        "xmlLang": "en",
        "xmlnsXlink": "http://www.w3.org/1999/xlink",
      }
    `)
  })

  it('should handle case-insensitive lookup for known attrs', () => {
    expect(u.htmlAttrsToJSXProps({ CLASS: 'foo', For: 'bar', TABINDEX: '0' }))
      .toMatchInlineSnapshot(`
      {
        "className": "foo",
        "htmlFor": "bar",
        "tabIndex": "0",
      }
    `)
  })

  it('should map viewbox to viewBox', () => {
    expect(u.htmlAttrsToJSXProps({ viewbox: '0 0 100 100' }))
      .toMatchInlineSnapshot(`
      {
        "viewBox": "0 0 100 100",
      }
    `)
  })

  it('should preserve already-camelCase viewBox', () => {
    expect(u.htmlAttrsToJSXProps({ viewBox: '0 0 100 100' }))
      .toMatchInlineSnapshot(`
      {
        "viewBox": "0 0 100 100",
      }
    `)
  })
})
