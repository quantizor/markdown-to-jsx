import { matchInlineFormatting } from './match'

describe('matchInlineFormatting', () => {
  describe('basic single delimiters', () => {
    it('should match *italic*', () => {
      const result = matchInlineFormatting('*italic*', { inline: true })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*italic*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('italic')
    })

    it('should match _italic_', () => {
      const result = matchInlineFormatting('_italic_', { inline: true })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('_italic_')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('italic')
    })

    it('should match **bold**', () => {
      const result = matchInlineFormatting('**bold**', { inline: true })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('**bold**')
      expect(result[1]).toBe('strong')
      expect(result[2]).toBe('bold')
    })

    it('should match __bold__', () => {
      const result = matchInlineFormatting('__bold__', { inline: true })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('__bold__')
      expect(result[1]).toBe('strong')
      expect(result[2]).toBe('bold')
    })

    it('should match ~~strikethrough~~', () => {
      const result = matchInlineFormatting('~~strikethrough~~', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('~~strikethrough~~')
      expect(result[1]).toBe('del')
      expect(result[2]).toBe('strikethrough')
    })

    it('should match ==marked==', () => {
      const result = matchInlineFormatting('==marked==', { inline: true })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('==marked==')
      expect(result[1]).toBe('mark')
      expect(result[2]).toBe('marked')
    })
  })

  describe('triple delimiters', () => {
    it('should match ***bold italic*** as ** with nested *', () => {
      const result = matchInlineFormatting('***bold italic***', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('***bold italic***')
      expect(result[1]).toBe('strong')
      expect(result[2]).toBe('*bold italic*')
    })

    it('should match ___bold italic___ as __ with nested _', () => {
      const result = matchInlineFormatting('___bold italic___', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('___bold italic___')
      expect(result[1]).toBe('strong')
      expect(result[2]).toBe('_bold italic_')
    })
  })

  describe('with content after delimiter', () => {
    it('should only match the delimited portion', () => {
      const result = matchInlineFormatting('*italic* and more', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*italic*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('italic')
    })

    it('should handle text before next delimiter', () => {
      const result = matchInlineFormatting('**bold** text', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('**bold**')
      expect(result[1]).toBe('strong')
      expect(result[2]).toBe('bold')
    })
  })

  describe('escaped delimiters', () => {
    it('should skip escaped opening delimiter', () => {
      const result = matchInlineFormatting('\\*not italic\\*', {
        inline: true,
      })!
      expect(result).toBeNull()
    })

    it('should skip escaped closing delimiter and continue', () => {
      const result = matchInlineFormatting('*italic \\* still italic*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*italic \\* still italic*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('italic \\* still italic')
    })
  })

  describe('inline code blocks', () => {
    it('should skip delimiters inside inline code', () => {
      const result = matchInlineFormatting('*foo `code*` bar*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*foo `code*` bar*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('foo `code*` bar')
    })

    it('should handle inline code at the end', () => {
      const result = matchInlineFormatting('*text `code*`*', { inline: true })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*text `code*`*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('text `code*`')
    })
  })

  describe('HTML tags', () => {
    it('should skip delimiters inside HTML tags', () => {
      const result = matchInlineFormatting('*foo <span>*</span> bar*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*foo <span>*</span> bar*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('foo <span>*</span> bar')
    })

    it('should handle self-closing HTML tags', () => {
      const result = matchInlineFormatting('*text <br /> more*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*text <br /> more*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('text <br /> more')
    })
  })

  describe('double newline boundary', () => {
    it('should return null when encountering double newline', () => {
      const result = matchInlineFormatting('*foo\n\nbar*', { inline: true })!
      expect(result).toBeNull()
    })

    it('should allow single newlines', () => {
      const result = matchInlineFormatting('*foo\nbar*', { inline: true })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*foo\nbar*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('foo\nbar')
    })

    it('should allow double newlines inside code blocks', () => {
      const result = matchInlineFormatting('*foo `code\n\nblock` bar*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*foo `code\n\nblock` bar*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('foo `code\n\nblock` bar')
    })

    it('should allow double newlines inside HTML tags', () => {
      const result = matchInlineFormatting('*foo <div>\n\n</div> bar*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*foo <div>\n\n</div> bar*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('foo <div>\n\n</div> bar')
    })
  })

  describe('nested delimiters', () => {
    it('should match outer delimiter with nested content', () => {
      const result = matchInlineFormatting('*foo **bar** baz*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*foo **bar** baz*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('foo **bar** baz')
    })

    it('should match bold with nested italic', () => {
      const result = matchInlineFormatting('**foo _bar_ baz**', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('**foo _bar_ baz**')
      expect(result[1]).toBe('strong')
      expect(result[2]).toBe('foo _bar_ baz')
    })
  })

  describe('mismatched delimiters', () => {
    it('should return null for *foo_', () => {
      const result = matchInlineFormatting('*foo_', { inline: true })!
      expect(result).toBeNull()
    })

    it('should return null for **foo__', () => {
      const result = matchInlineFormatting('**foo__', { inline: true })!
      expect(result).toBeNull()
    })

    it('should return null when no closing delimiter', () => {
      const result = matchInlineFormatting('*foo bar baz', { inline: true })!
      expect(result).toBeNull()
    })
  })

  describe('state handling', () => {
    it('should return null when not inline or simple', () => {
      const result = matchInlineFormatting('*italic*', {})!
      expect(result).toBeNull()
    })

    it('should work with simple state', () => {
      const result = matchInlineFormatting('*italic*', { simple: true })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*italic*')
    })

    it('should work with both inline and simple state', () => {
      const result = matchInlineFormatting('*italic*', {
        inline: true,
        simple: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*italic*')
    })
  })

  describe('edge cases', () => {
    it('should return null for empty string', () => {
      const result = matchInlineFormatting('', { inline: true })!
      expect(result).toBeNull()
    })

    it('should return null for delimiter only', () => {
      const result = matchInlineFormatting('*', { inline: true })!
      expect(result).toBeNull()
    })

    it('should return null for delimiter pair only', () => {
      const result = matchInlineFormatting('**', { inline: true })!
      expect(result).toBeNull()
    })

    it('should handle empty content between delimiters', () => {
      const result = matchInlineFormatting('****', { inline: true })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('****')
      expect(result[1]).toBe('strong')
      expect(result[2]).toBe('')
    })

    it('should prioritize longer delimiters', () => {
      const result = matchInlineFormatting('***text***', { inline: true })!
      expect(result).not.toBeNull()
      expect(result[1]).toBe('strong')
      expect(result[2]).toBe('*text*')
    })

    it('should not match if starting with non-delimiter', () => {
      const result = matchInlineFormatting('text *italic*', { inline: true })!
      expect(result).toBeNull()
    })
  })

  describe('complex scenarios', () => {
    it('should handle multiple escape sequences', () => {
      const result = matchInlineFormatting('*\\*escaped\\* text*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[2]).toBe('\\*escaped\\* text')
    })

    it('should handle code block with backticks inside', () => {
      const result = matchInlineFormatting('*text `code with \\` tick` more*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[2]).toBe('text `code with \\` tick` more')
    })

    it('should handle nested HTML with attributes', () => {
      const result = matchInlineFormatting(
        '*text <span class="test">*</span> more*',
        { inline: true }
      )!
      expect(result).not.toBeNull()
      expect(result[2]).toBe('text <span class="test">*</span> more')
    })

    it('should handle text with periods', () => {
      const result = matchInlineFormatting('*Hello.*', { inline: true })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*Hello.*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('Hello.')
    })

    it('should handle text with commas and punctuation', () => {
      const result = matchInlineFormatting('**Hello, World!**', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[2]).toBe('Hello, World!')
    })

    it('should handle multiple spaces', () => {
      const result = matchInlineFormatting('*Hello   World*', { inline: true })!
      expect(result).not.toBeNull()
      expect(result[2]).toBe('Hello   World')
    })

    it('should handle consecutive emphasis', () => {
      const result1 = matchInlineFormatting('*foo* bar', { inline: true })!
      expect(result1).not.toBeNull()
      expect(result1[0]).toBe('*foo*')
      expect(result1[2]).toBe('foo')
    })

    it('should handle strikethrough containing escaped tildes', () => {
      const result = matchInlineFormatting('~~Foo \\~~ bar~~', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[2]).toBe('Foo \\~~ bar')
    })

    it('should handle marked text containing escaped equals', () => {
      const result = matchInlineFormatting('==Foo \\== bar==', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[2]).toBe('Foo \\== bar')
    })

    it('should handle underscores that are not delimiters in words', () => {
      const result = matchInlineFormatting('_text under\\_score word_', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[2]).toBe('text under\\_score word')
    })
  })

  describe('link and reference syntax', () => {
    it('should skip delimiters inside link text [*](url)', () => {
      const result = matchInlineFormatting('*text [*](url) more*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*text [*](url) more*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('text [*](url) more')
    })

    it('should skip delimiters inside link url [text](*)', () => {
      const result = matchInlineFormatting('*text [foo](x*) more*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*text [foo](x*) more*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('text [foo](x*) more')
    })

    it('should skip delimiters in reference syntax [text][*]', () => {
      const result = matchInlineFormatting('*text [foo][*] more*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*text [foo][*] more*')
      expect(result[1]).toBe('em')
      expect(result[2]).toBe('text [foo][*] more')
    })

    it('should handle nested brackets in link text', () => {
      const result = matchInlineFormatting('*text [foo [bar]](url) more*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*text [foo [bar]](url) more*')
      expect(result[2]).toBe('text [foo [bar]](url) more')
    })

    it('should handle nested parens in link url', () => {
      const result = matchInlineFormatting('*text [foo](url(nested)) more*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*text [foo](url(nested)) more*')
      expect(result[2]).toBe('text [foo](url(nested)) more')
    })

    it('should handle escaped brackets in links', () => {
      const result = matchInlineFormatting('*text [foo \\]](url) more*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*text [foo \\]](url) more*')
      expect(result[2]).toBe('text [foo \\]](url) more')
    })

    it('should handle image syntax with delimiters in alt text', () => {
      const result = matchInlineFormatting('*text ![*](url) more*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*text ![*](url) more*')
      expect(result[2]).toBe('text ![*](url) more')
    })

    it('should handle image syntax with delimiters in url', () => {
      const result = matchInlineFormatting('*text ![alt](url*) more*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*text ![alt](url*) more*')
      expect(result[2]).toBe('text ![alt](url*) more')
    })

    it('should handle image syntax with underscores in url', () => {
      const result = matchInlineFormatting(
        '*text ![alt](url_with_underscores.png) more*',
        {
          inline: true,
        }
      )!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*text ![alt](url_with_underscores.png) more*')
      expect(result[2]).toBe('text ![alt](url_with_underscores.png) more')
    })

    it('should handle image reference syntax ![alt][*]', () => {
      const result = matchInlineFormatting('*text ![alt][*] more*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[0]).toBe('*text ![alt][*] more*')
      expect(result[2]).toBe('text ![alt][*] more')
    })

    it('should handle underscores in URLs', () => {
      const result = matchInlineFormatting(
        '_text [link](https://example.com/asdf_asdf.pdf) more_',
        { inline: true }
      )!
      expect(result).not.toBeNull()
      expect(result[0]).toBe(
        '_text [link](https://example.com/asdf_asdf.pdf) more_'
      )
      expect(result[1]).toBe('em')
      expect(result[2]).toBe(
        'text [link](https://example.com/asdf_asdf.pdf) more'
      )
    })

    it('should handle double underscores in URLs', () => {
      const result = matchInlineFormatting(
        '__text [link](https://example.com/asdf__asdf.pdf) more__',
        { inline: true }
      )!
      expect(result).not.toBeNull()
      expect(result[0]).toBe(
        '__text [link](https://example.com/asdf__asdf.pdf) more__'
      )
      expect(result[1]).toBe('strong')
      expect(result[2]).toBe(
        'text [link](https://example.com/asdf__asdf.pdf) more'
      )
    })
  })

  describe('edge cases from compiler tests', () => {
    it('should handle escaped underscores - regression for escaped syntax', () => {
      const result = matchInlineFormatting('\\_\\_foo\\_\\_', { inline: true })!
      expect(result).toBeNull()
    })

    it('should handle strikethrough with tildes in code blocks', () => {
      const result = matchInlineFormatting('~~Foo `~~bar` baz.~~', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[1]).toBe('del')
      expect(result[2]).toBe('Foo `~~bar` baz.')
    })

    it('should handle marked text with equals in code blocks', () => {
      const result = matchInlineFormatting('==Foo `==bar` baz.==', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[1]).toBe('mark')
      expect(result[2]).toBe('Foo `==bar` baz.')
    })

    it('should handle very long content', () => {
      const longText = 'a'.repeat(1000)
      const result = matchInlineFormatting(`*${longText}*`, { inline: true })!
      expect(result).not.toBeNull()
      expect(result[2]).toBe(longText)
    })

    it('should handle content with various punctuation', () => {
      const result = matchInlineFormatting('*Hello, World! How are you?*', {
        inline: true,
      })!
      expect(result).not.toBeNull()
      expect(result[2]).toBe('Hello, World! How are you?')
    })

    it('should handle mixed asterisk and underscore for bold', () => {
      const result1 = matchInlineFormatting('**text**', { inline: true })!
      const result2 = matchInlineFormatting('__text__', { inline: true })!
      expect(result1).not.toBeNull()
      expect(result2).not.toBeNull()
      expect(result1[1]).toBe('strong')
      expect(result2[1]).toBe('strong')
    })
  })
})
