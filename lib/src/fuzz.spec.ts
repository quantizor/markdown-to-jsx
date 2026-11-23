import { describe, expect, it } from 'bun:test'
import { performance } from 'node:perf_hooks'
import { compiler } from './index.tsx'

const CI_TOLERANT_MAX_EXECUTION_TIME_MS = 1000

function timeExecution(fn: () => void): number {
  const start = performance.now()
  fn()
  return performance.now() - start
}

describe('Fuzzing: Exponential Backtracking Protections', () => {
  describe('HTML Block Parsing Protection', () => {
    it('should handle deeply nested HTML tags without exponential backtracking', () => {
      const depths = [10, 50, 100, 200]

      for (const depth of depths) {
        let html = ''
        for (let i = 0; i < depth; i++) {
          html += '<div>'
        }
        html += 'content'
        for (let i = 0; i < depth; i++) {
          html += '</div>'
        }

        const executionTime = timeExecution(() => {
          compiler(html)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle alternating nested tags without exponential backtracking', () => {
      const depths = [10, 25, 50]

      for (const depth of depths) {
        let html = ''
        for (let i = 0; i < depth; i++) {
          html += i % 2 === 0 ? '<span>' : '<div>'
        }
        html += 'content'
        for (let i = depth - 1; i >= 0; i--) {
          html += i % 2 === 0 ? '</span>' : '</div>'
        }

        const executionTime = timeExecution(() => {
          compiler(html)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle mismatched tags efficiently', () => {
      const testCases = [
        '<div><span></div></span>',
        '<div><span><p></div></span></p>',
        '<div>'.repeat(50) + '</span>'.repeat(50),
      ]

      for (const html of testCases) {
        const executionTime = timeExecution(() => {
          compiler(html)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle tags with similar prefixes efficiently', () => {
      const depths = [20, 50]

      for (const depth of depths) {
        let html = ''
        for (let i = 0; i < depth; i++) {
          html += '<divider>'
        }
        html += 'content'
        for (let i = 0; i < depth; i++) {
          html += '</divider>'
        }

        const executionTime = timeExecution(() => {
          compiler(html)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle nested tags with attributes efficiently', () => {
      const depths = [20, 50]

      for (const depth of depths) {
        let html = ''
        for (let i = 0; i < depth; i++) {
          html += `<div class="nested" data-depth="${i}">`
        }
        html += 'content'
        for (let i = 0; i < depth; i++) {
          html += '</div>'
        }

        const executionTime = timeExecution(() => {
          compiler(html)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })
  })

  describe('Inline Formatting Protection', () => {
    it('should handle deeply nested delimiters without exponential backtracking', () => {
      const depths = [10, 20, 50]

      for (const depth of depths) {
        let markdown = ''
        for (let i = 0; i < depth; i++) {
          markdown += '*'
        }
        markdown += 'text'
        for (let i = 0; i < depth; i++) {
          markdown += '*'
        }

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle alternating delimiter types efficiently', () => {
      const depths = [10, 20]

      for (const depth of depths) {
        let markdown = ''
        for (let i = 0; i < depth; i++) {
          markdown += i % 2 === 0 ? '*' : '_'
        }
        markdown += 'text'
        for (let i = 0; i < depth; i++) {
          markdown += i % 2 === 0 ? '*' : '_'
        }

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle delimiters with inline code blocks efficiently', () => {
      const depths = [10, 20]

      for (const depth of depths) {
        let markdown = '*'
        for (let i = 0; i < depth; i++) {
          markdown += 'text `code` '
        }
        markdown += '*'

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle delimiters with nested links efficiently', () => {
      const depths = [10, 20]

      for (const depth of depths) {
        let markdown = '*'
        for (let i = 0; i < depth; i++) {
          markdown += 'text [link](url) '
        }
        markdown += '*'

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle delimiters with HTML tags efficiently', () => {
      const depths = [10, 20]

      for (const depth of depths) {
        let markdown = '*'
        for (let i = 0; i < depth; i++) {
          markdown += 'text <span>*</span> '
        }
        markdown += '*'

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle mismatched delimiters efficiently', () => {
      const testCases = [
        '*text_',
        '**text__',
        '*text**',
        '***text**',
        '____text**',
      ]

      for (const markdown of testCases) {
        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })
  })

  describe('Combined Attack Vectors', () => {
    it('should handle HTML with nested formatting efficiently', () => {
      const depths = [10, 20]

      for (const depth of depths) {
        let markdown = '<div>'
        for (let i = 0; i < depth; i++) {
          markdown += '*text* '
        }
        markdown += '</div>'

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle deeply nested lists efficiently', () => {
      const depths = [10, 20]

      for (const depth of depths) {
        let markdown = ''
        for (let i = 0; i < depth; i++) {
          markdown += `${'  '.repeat(i)}* item\n`
        }

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle tables with excessive nesting efficiently', () => {
      const sizes = [10, 50]

      for (const size of sizes) {
        let markdown = '| '
        for (let i = 0; i < size; i++) {
          markdown += '*item* | '
        }
        markdown += '\n| '
        for (let i = 0; i < size; i++) {
          markdown += '--- | '
        }
        markdown += '\n| '
        for (let i = 0; i < size; i++) {
          markdown += '*item* | '
        }

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle link references with excessive nesting efficiently', () => {
      const depths = [10, 20]

      for (const depth of depths) {
        let markdown = ''
        for (let i = 0; i < depth; i++) {
          markdown += `[${'*'.repeat(i + 1)}text${'*'.repeat(i + 1)}][ref]\n`
        }
        markdown += '\n[ref]: http://example.com\n'

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })
  })

  describe('Repetitive Delimiter Sequences', () => {
    it('should handle alternating single-character delimiters', () => {
      const repetitions = [100, 500, 1000]

      for (const count of repetitions) {
        let markdown = ''
        for (let i = 0; i < count; i++) {
          markdown += i % 2 === 0 ? '*' : '_'
        }
        markdown += 'text'
        for (let i = 0; i < count; i++) {
          markdown += i % 2 === 0 ? '*' : '_'
        }

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle repeating delimiter pairs efficiently', () => {
      const repetitions = [50, 100, 200]

      for (const count of repetitions) {
        let markdown = ''
        for (let i = 0; i < count; i++) {
          markdown += '**'
        }
        markdown += 'text'
        for (let i = 0; i < count; i++) {
          markdown += '**'
        }

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle cycling through all delimiter types', () => {
      const cycles = [20, 50, 100]
      const delimiters = ['*', '_', '**', '__', '~~', '==']

      for (const cycleCount of cycles) {
        let markdown = ''
        for (let i = 0; i < cycleCount; i++) {
          markdown += delimiters[i % delimiters.length]
        }
        markdown += 'text'
        for (let i = 0; i < cycleCount; i++) {
          markdown += delimiters[i % delimiters.length]
        }

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle increasingly long delimiter sequences', () => {
      const patterns = [
        '*_*_*_*',
        '**__**__**__',
        '***___***___',
        '****____****____',
      ]

      for (const pattern of patterns) {
        const longPattern = pattern.repeat(50)

        const executionTime = timeExecution(() => {
          compiler(`${longPattern}text${longPattern}`)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle delimiter runs with text separators', () => {
      const repetitions = [50, 100]

      for (const count of repetitions) {
        let markdown = '*'
        for (let i = 0; i < count; i++) {
          markdown += `a${i}*`
        }
        markdown += 'text'
        for (let i = 0; i < count; i++) {
          markdown += `*b${i}`
        }
        markdown += '*'

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle nested delimiter sequences', () => {
      const depths = [10, 20]

      for (const depth of depths) {
        let markdown = ''
        for (let i = 0; i < depth; i++) {
          markdown += '*'.repeat(i + 1)
        }
        markdown += 'text'
        for (let i = depth - 1; i >= 0; i--) {
          markdown += '*'.repeat(i + 1)
        }

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle delimiter-alike characters', () => {
      const repetitions = [100, 500]

      for (const count of repetitions) {
        const patterns = [
          `${'_'.repeat(count)}text${'_'.repeat(count)}`,
          `${'-'.repeat(count)}text${'-'.repeat(count)}`,
          `${'='.repeat(count)}text${'='.repeat(count)}`,
          `${'~'.repeat(count)}text${'~'.repeat(count)}`,
        ]

        for (const pattern of patterns) {
          const executionTime = timeExecution(() => {
            compiler(pattern)
          })

          expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
        }
      }
    })

    it('should handle alternating delimiter lengths', () => {
      const cycles = [20, 50]

      for (const cycleCount of cycles) {
        let markdown = ''
        for (let i = 0; i < cycleCount; i++) {
          markdown += '*'.repeat((i % 3) + 1)
        }
        markdown += 'text'
        for (let i = 0; i < cycleCount; i++) {
          markdown += '*'.repeat((i % 3) + 1)
        }

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle delimiter patterns inside code blocks', () => {
      const repetitions = [50, 100]

      for (const count of repetitions) {
        let markdown = '*text `'
        for (let i = 0; i < count; i++) {
          markdown += i % 2 === 0 ? '*' : '_'
        }
        markdown += '` more*'

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle delimiter patterns inside links', () => {
      const repetitions = [50, 100]

      for (const count of repetitions) {
        let markdown = '*text ['
        for (let i = 0; i < count; i++) {
          markdown += i % 2 === 0 ? '*' : '_'
        }
        markdown += '](url) more*'

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle delimiter patterns inside HTML tags', () => {
      const repetitions = [50, 100]

      for (const count of repetitions) {
        let markdown = '*text <span>'
        for (let i = 0; i < count; i++) {
          markdown += i % 2 === 0 ? '*' : '_'
        }
        markdown += '</span> more*'

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle incomplete delimiter sequences', () => {
      const testCases = [
        `${'*'.repeat(1000)}text`,
        `text${'*'.repeat(1000)}`,
        `${'_'.repeat(1000)}text`,
        `text${'_'.repeat(1000)}`,
        `${'**'.repeat(500)}text`,
        `text${'**'.repeat(500)}`,
      ]

      for (const markdown of testCases) {
        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle delimiter runs with line breaks', () => {
      const repetitions = [50, 100]

      for (const count of repetitions) {
        let markdown = '*'
        for (let i = 0; i < count; i++) {
          markdown += '*\n'
        }
        markdown += 'text\n'
        for (let i = 0; i < count; i++) {
          markdown += '*\n'
        }
        markdown += '*'

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle very long delimiter sequences gracefully', () => {
      const lengths = [1000, 5000, 10_000]

      for (const length of lengths) {
        const markdown = `${'*'.repeat(length)}text${'*'.repeat(length)}`

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should not throw on 10,000 opening and 10,000 closing delimiters around text', () => {
      const extremeNesting = `${'*'.repeat(10_000)}text${'*'.repeat(10_000)}`

      const executionTime = timeExecution(() => {
        expect(() => {
          const result = compiler(extremeNesting)
          expect(result).toBeDefined()
        }).not.toThrow()
      })

      expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
    })

    it('should handle mixed delimiter characters that look similar', () => {
      const repetitions = [100, 500]

      for (const count of repetitions) {
        const patterns = [
          `${'*'.repeat(count)}text${'_'.repeat(count)}`,
          `${'**'.repeat(count)}text${'__'.repeat(count)}`,
          `${'*_'.repeat(count)}text${'_*'.repeat(count)}`,
          `${'**_'.repeat(count)}text${'__*'.repeat(count)}`,
        ]

        for (const pattern of patterns) {
          const executionTime = timeExecution(() => {
            compiler(pattern)
          })

          expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
        }
      }
    })

    it('should handle delimiter sequences in list items', () => {
      const repetitions = [50, 100]

      for (const count of repetitions) {
        let markdown = '* item '
        for (let i = 0; i < count; i++) {
          markdown += i % 2 === 0 ? '*' : '_'
        }
        markdown += ' text\n'

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle delimiter sequences in blockquotes', () => {
      const repetitions = [50, 100]

      for (const count of repetitions) {
        let markdown = '> '
        for (let i = 0; i < count; i++) {
          markdown += i % 2 === 0 ? '*' : '_'
        }
        markdown += ' text\n'

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })
  })

  describe('Random Fuzzing', () => {
    function randomString(length: number): string {
      const chars =
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 *[]()_<>~=`'
      let result = ''
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return result
    }

    it('should handle random inputs without throwing or hanging', () => {
      const testCount = 100
      const inputLengths = [10, 50, 100, 500]

      for (const length of inputLengths) {
        for (let i = 0; i < testCount; i++) {
          const input = randomString(length)

          const executionTime = timeExecution(() => {
            compiler(input)
          })

          expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
        }
      }
    })

    it('should handle adversarial patterns without throwing or exponential behavior', () => {
      const adversarialPatterns = [
        '*'.repeat(1000) + 'a'.repeat(1000) + '*'.repeat(1000),
        '['.repeat(100) + ']'.repeat(100),
        '('.repeat(100) + ')'.repeat(100),
        '<'.repeat(100) + '>'.repeat(100),
        `${'`'.repeat(100)}code${'`'.repeat(100)}`,
        `***${'*'.repeat(100)}***`,
        `___${'_'.repeat(100)}___`,
        `<div>${'<span>'.repeat(50)}${'</span>'.repeat(50)}</div>`,
      ]

      for (const pattern of adversarialPatterns) {
        const executionTime = timeExecution(() => {
          compiler(pattern)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })
  })

  describe('Incomplete & Ambiguous Syntax', () => {
    it('should handle unclosed HTML tags', () => {
      const testCases = [
        '<div>unclosed',
        '<div><span>nested unclosed',
        '<div attr="value">no closing',
        `${'<div>'.repeat(50)}content`,
        '<div>text'.repeat(100),
        '<div><div><div>',
        '<div/',
        '<div >',
        '<div attr',
        '<div attr=',
        '<div attr="',
        '<div attr="value',
      ]

      for (const html of testCases) {
        const executionTime = timeExecution(() => {
          compiler(html)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle mismatched HTML tags', () => {
      const testCases = [
        '<div></span>',
        '<div><span></div></span>',
        '<div></span></div>',
        '<div>'.repeat(50) + '</span>'.repeat(50),
        '<div><div></span></span>',
        '<div attr="value"></span>',
        '<div></div></div>',
        '<div><div>',
        '</div></div>',
      ]

      for (const html of testCases) {
        const executionTime = timeExecution(() => {
          compiler(html)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle incomplete links', () => {
      const testCases = [
        '[incomplete link',
        '[text',
        '[text]',
        '[text](',
        '[text](url',
        '[text](url ',
        '[text][ref',
        '[text][',
        '[text][ref]',
        '[incomplete link](',
        '['.repeat(100),
        ']'.repeat(100),
        '[['.repeat(50),
        ']]'.repeat(50),
        '[text](url))',
        '[text]((url)',
        '[text](url)]',
        '[text](url)]]',
      ]

      for (const markdown of testCases) {
        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle incomplete code blocks', () => {
      const testCases = [
        '```unclosed',
        '``',
        '`incomplete',
        '```incomplete\ncode',
        '```language',
        '~~~code',
        '```code```',
        '```code~~~',
        '~~~code```',
        '`'.repeat(100),
        '```'.repeat(50),
        '~~~'.repeat(50),
        '```~~~`'.repeat(20),
      ]

      for (const markdown of testCases) {
        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle incomplete tables', () => {
      const testCases = [
        '| incomplete',
        '| ',
        '| incomplete\n|',
        '| col1 | col2',
        '| col1 | col2\n---',
        '| col1 | col2\n| ---',
        '| col1\n',
        '|'.repeat(1000),
        '| | |'.repeat(100),
        '| col |\n|:--:|\n|:data|',
        '| col |\n|---|\n|data| |extra',
        '|',
        '||',
        '|||',
        '| ',
        '| ||',
        '|| |',
        '| col |\n',
        '| col |\n|',
        '| col |\n| -',
        '| col |\n| --',
        '| col |\n| :',
        '| col |\n| :-',
        '| col |\n| :-:',
        '| col |\n| :--',
        '| col |\n| :--:',
        '| col |\n| :--: ',
        '| col |\n|---|\n|data',
        '| col |\n|---|\n|data\n',
        '| col |\n|---|\n|data|',
        '| col |\n|---|\n|data| ',
        '| col |\n|---|\n|data| |',
        '| col |\n|---|\n|data| |more',
      ]

      for (const table of testCases) {
        const executionTime = timeExecution(() => {
          compiler(table)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle incomplete lists', () => {
      const testCases = [
        '* item\n2. ',
        '* item\n*',
        '* item\n1. item',
        '1. item\n* item',
        '           * item',
        '\t\t\t\t\t\t* item',
        '*item',
        '1.item',
        '10.item',
      ]

      for (const markdown of testCases) {
        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle malformed quotes in attributes', () => {
      const testCases = [
        '<div attr="unclosed">',
        "<div attr='unclosed>",
        '<div attr="mixed\'quotes">',
        "<div attr='mixed\"quotes'>",
        '<div attr="no closing',
        "<div attr='no closing",
        '<div attr="many"quotes"here">',
        "<div attr='many'quotes'here'>",
        `<div attr="${'"'.repeat(100)}">`,
        `<div attr='${"'".repeat(100)}'>`,
        `<div attr="'inner'"'>`,
        `<div attr='"inner"'">`,
      ]

      for (const html of testCases) {
        const executionTime = timeExecution(() => {
          compiler(html)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle incomplete interpolations', () => {
      const testCases = [
        '<div attr={unclosed>',
        '<div attr={unclosed',
        '<div attr={',
        '<div attr={>',
        '<div attr={}>',
        '<div attr={nested{>',
        '<div attr={many{braces}',
        '<div attr={deep{nested{here}',
        '<div attr={"string',
        "<div attr={'string",
        '<div attr={123',
        '<div attr={true',
        '<div attr={false',
      ]

      for (const html of testCases) {
        const executionTime = timeExecution(() => {
          compiler(html)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle unclosed blockquotes', () => {
      const testCases = [
        '> unclosed',
        '> ',
        '>blockquote',
        '>>',
        '>>>',
        '>>>>>>>>',
        ' > ',
        '  > ',
        '> item\n> ',
        '> item\n',
        '> item\n> item\n',
      ]

      for (const markdown of testCases) {
        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle incomplete headings', () => {
      const testCases = ['#######', '#no space', '##no space']

      for (const markdown of testCases) {
        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle reference syntax edge cases', () => {
      const testCases = [
        '[text]: "unclosed',
        "[text]: 'unclosed",
        '[text]: <no closing',
        '[text]: url"',
        '[text]: url)',
        '[text]: url]',
        '[ref]: http://example.com',
        '[text][nonexistent]',
        '[text][]',
        '[][ref]',
        '[text][',
        '][ref]',
      ]

      for (const markdown of testCases) {
        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle images with incomplete syntax', () => {
      const testCases = [
        '![alt](url"',
        '![alt](url"title',
        "![alt](url'title",
        '![alt](url "title',
        '![alt][ref',
        '![][ref]',
      ]

      for (const markdown of testCases) {
        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle malformed HTML comments', () => {
      const testCases = [
        '<!--',
        '<!--incomplete',
        '<!--no closing-->',
        '<!--unclosed-->extra',
        '<!--<!--nested-->',
        '<!-- --',
        '<!-- -->',
        '<!-- ',
        '<!--!',
        '<!-- >',
        '<!--->',
        '<!--invalid-->',
      ]

      for (const html of testCases) {
        const executionTime = timeExecution(() => {
          compiler(html)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle malformed footnotes', () => {
      const testCases = [
        '[^',
        '[^ref',
        '[^ref]',
        '[^]: ',
        '[^ref]: ',
        '[^ref]: content',
        '[^ref]: content\n',
        '[[^ref]',
        '[^ref]]',
        '[^^]',
        '[^]: incomplete\n',
      ]

      for (const markdown of testCases) {
        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle combinations of incomplete syntax', () => {
      const testCases = [
        '<div>[incomplete link',
        '[link<div>]',
        '*item<div>',
        '<div>*text',
        '```code<div>',
        '<div>```code',
        '| table<div>',
        '<div>| table',
        '# heading<div>',
        '<div># heading',
        '<div><span>[link*item`code',
        '[link](<div>*text```code',
        '| table\n<div>[link*item',
      ]

      for (const markdown of testCases) {
        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })
  })

  describe('Brutal Attack Scenarios', () => {
    it('should handle ATTR_EXTRACTOR_R edge cases without backtracking', () => {
      const brutalCases = [
        `<div attr="${'"'.repeat(1000)}val${'"'.repeat(1000)}"></div>`,
        `<div attr='${"''".repeat(100)}'></div>`,
        `<div attr="\\${'x'.repeat(500)}"></div>`,
        '<div attr={a{b{c{d}}}}></div>',
        `<div attr="\\${'"'.repeat(100)}${"'$&#39;".repeat(50)}"></div>`,
        `<div ${'attr="val" '.repeat(200)}></div>`,
      ]

      for (const html of brutalCases) {
        const executionTime = timeExecution(() => {
          compiler(html)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle HTML tags with similar prefixes', () => {
      const similarPrefixes = [
        'div',
        'divi',
        'divid',
        'divide',
        'divider',
        'divides',
        'divine',
        'divinity',
      ]

      for (const prefix of similarPrefixes) {
        const testCases = [
          `<${prefix}><div>content</div></${prefix}>`,
          `<div><${prefix}>content</${prefix}></div>`,
          `${'<div>'.repeat(50)}<${prefix}>content</${prefix}>${'</div>'.repeat(
            50
          )}`,
        ]

        for (const html of testCases) {
          const executionTime = timeExecution(() => {
            compiler(html)
          })

          expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
        }
      }
    })

    it('should handle deeply nested brackets in links', () => {
      const depths = [10, 50, 100]

      for (const depth of depths) {
        let markdown = '['
        for (let i = 0; i < depth; i++) {
          markdown += `[${'a'.repeat(10)}]`
        }
        markdown += ' text'
        for (let i = 0; i < depth; i++) {
          markdown += ']'
        }
        markdown += '](url)'

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle escaped content proliferation', () => {
      const testCases = [
        '*text \\*\\*\\*\\*\\* text*',
        '**text \\\\\\\\\\\\\\\\ text**',
        '`code \\\\\\\\\\\\\\\\ code`',
        '*\\*\\*\\*text\\*\\*\\*\\*\\*text*',
        '_\\_\\_\\_text\\_\\_\\_\\_\\_text_',
        `<div title="\\${'*'.repeat(100)}"></div>`,
        `<div class='\\${'_'.repeat(100)}'></div>`,
      ]

      for (const markdown of testCases) {
        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle many small emphasis lines followed by a final list item', () => {
      const sizes = [100, 500, 1000]

      for (const size of sizes) {
        let markdown = ''
        for (let i = 0; i < size; i++) {
          markdown += `*item${i}*\n`
        }
        markdown += '* final item'

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle table parsing with pathological patterns', () => {
      const brutalTables = [
        '| ' +
          '*'.repeat(100) +
          ' | '.repeat(100) +
          '\n' +
          '| ' +
          '--- | '.repeat(100),
        '|   '.repeat(50) +
          ' |   '.repeat(50) +
          '\n|   ' +
          '---   |   '.repeat(50),
        '| ' +
          '***'.repeat(50) +
          ' | '.repeat(10) +
          '\n| ' +
          '--- | '.repeat(10),
        '| ' +
          '--- | '.repeat(50) +
          '\n| ' +
          ':-: | '.repeat(50) +
          '\n| ' +
          '-: | '.repeat(50),
      ]

      for (const table of brutalTables) {
        const executionTime = timeExecution(() => {
          compiler(table)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle code block fence variations', () => {
      const testCases = [
        `\`\`\`${'`'.repeat(100)}\ncode\n\`\`\`${'`'.repeat(100)}`,
        `~~~${'~'.repeat(100)}\ncode\n~~~${'~'.repeat(100)}`,
        `${'```~~~```~~~'.repeat(50)}\ncode\n${'```~~~```~~~'.repeat(50)}`,
        `\`\`\`${'a'.repeat(1000)}\ncode\n\`\`\``,
      ]

      for (const markdown of testCases) {
        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle reference definitions explosion', () => {
      const sizes = [100, 500]

      for (const size of sizes) {
        let markdown = ''
        for (let i = 0; i < size; i++) {
          markdown += `[ref${i}]: http://example.com/path${i}\n`
        }
        for (let i = 0; i < size; i++) {
          markdown += `[link${i}][ref${i}] `
        }

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle mixed HTML and markdown depth exhaustion', () => {
      const depths = [20, 50]

      for (const depth of depths) {
        let markdown = ''
        for (let i = 0; i < depth; i++) {
          markdown += `<div>*${i}*\n`
        }
        markdown += 'content\n'
        for (let i = depth - 1; i >= 0; i--) {
          markdown += `*${i}*</div>\n`
        }

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle lists with deeply nested content', () => {
      const depths = [10, 20]

      for (const depth of depths) {
        let markdown = ''
        for (let i = 0; i < depth; i++) {
          markdown += `${'  '.repeat(i)}* `
          markdown += `${'*'.repeat(i + 1)}text${'*'.repeat(i + 1)} `
          markdown += `${'_'.repeat(i + 1)}text${'_'.repeat(i + 1)}\n`
        }

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle pathological whitespace patterns', () => {
      const testCases = [
        `${' '.repeat(1000)}text`,
        `${'\t'.repeat(1000)}text`,
        `${' \t '.repeat(500)}text`,
        `${'\n'.repeat(1000)}text`,
        `\`\`\`\n${' '.repeat(1000)}code\n\`\`\``,
      ]

      for (const markdown of testCases) {
        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle HTML character entity variations', () => {
      const testCases = [
        'a'.repeat(100) + '&'.repeat(100) + 'b'.repeat(100),
        '&amp;'.repeat(1000),
        `&#x${'0'.repeat(100)};`,
        `&#${'9'.repeat(100)};`,
        'text&nbsp;'.repeat(500),
        `<div title="&${'amp;'.repeat(100)}">content</div>`,
      ]

      for (const markdown of testCases) {
        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle links with excessive parentheses', () => {
      const depths = [10, 50, 100]

      for (const depth of depths) {
        let markdown = '[text]('
        for (let i = 0; i < depth; i++) {
          markdown += '('
        }
        markdown += 'url'
        for (let i = 0; i < depth; i++) {
          markdown += ')'
        }
        markdown += ')'

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })

    it('should handle mixing every delimiter type repeatedly', () => {
      const repetitions = [50, 100]

      for (const count of repetitions) {
        let markdown = ''
        const patterns = ['*', '_', '**', '__', '~~', '==', '`', '[']
        for (let i = 0; i < count; i++) {
          markdown += patterns[i % patterns.length]
        }
        markdown += 'text'
        for (let i = 0; i < count; i++) {
          markdown += patterns[i % patterns.length]
        }

        const executionTime = timeExecution(() => {
          compiler(markdown)
        })

        expect(executionTime).toBeLessThan(CI_TOLERANT_MAX_EXECUTION_TIME_MS)
      }
    })
  })
})
