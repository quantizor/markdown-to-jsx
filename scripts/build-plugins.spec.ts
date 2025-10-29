import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { removeDebugPlugin } from './build-plugins'
import type { OnLoadArgs, OnLoadResult } from 'esbuild'

describe('removeDebugPlugin', () => {
  let tempDir: string
  let onLoadHandlers: Array<{
    filter: RegExp
    callback: (args: OnLoadArgs) => Promise<OnLoadResult | null>
  }> = []

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-plugin-test-'))
    onLoadHandlers = []

    const plugin = removeDebugPlugin()
    plugin.setup({
      onLoad: (options, callback) => {
        onLoadHandlers.push({
          filter: options.filter,
          callback: callback as (
            args: OnLoadArgs
          ) => Promise<OnLoadResult | null>,
        })
      },
      onResolve: () => {},
      onStart: () => {},
      onEnd: () => {},
      onDispose: () => {},
      resolve: async () => ({ path: '', namespace: 'file' }),
      esbuild: {} as any,
      initialOptions: {} as any,
    } as any)
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
    onLoadHandlers = []
  })

  async function processFile(filePath: string, code: string): Promise<string> {
    fs.writeFileSync(filePath, code)

    for (const handler of onLoadHandlers) {
      if (handler.filter.test(filePath)) {
        const args: OnLoadArgs = {
          path: filePath,
          namespace: 'file',
          pluginData: undefined,
          suffix: '',
          with: {},
        }

        const result = await handler.callback(args)

        if (result && result.contents) {
          return typeof result.contents === 'string'
            ? result.contents
            : new TextDecoder().decode(result.contents)
        }

        return code
      }
    }

    return code
  }

  describe('parse.ts processing', () => {
    it('should remove function calls in conditionals', async () => {
      const realCode = `
      trackAttempt('angleBraceLink')
      var angleBraceResult = parseLinkAngleBrace(source, pos, state, options)
      if (angleBraceResult) {
        trackHit('angleBraceLink')
        return handleResult(angleBraceResult)
      }
`
      const testFile = path.join(tempDir, 'parse.ts')
      const finalCode = await processFile(testFile, realCode)

      expect(finalCode).not.toContain("trackAttempt('angleBraceLink')")
      expect(finalCode).not.toContain("trackHit('angleBraceLink')")
      expect(finalCode).toContain('if (angleBraceResult) {')
      expect(finalCode).toContain('return handleResult(angleBraceResult)')
    })

    it('should remove function calls in loops', async () => {
      const realCode = `
  while (pos < input.length) {
    trackBlockParseIteration()

    while (pos < input.length && input[pos] === '\\n') {
      pos++
      trackOperation()
    }

    if (pos >= input.length) break
  }
`
      const testFile = path.join(tempDir, 'parse.ts')
      const finalCode = await processFile(testFile, realCode)

      expect(finalCode).not.toContain('trackBlockParseIteration()')
      expect(finalCode).not.toContain('trackOperation()')
      expect(finalCode).toContain('while (pos < input.length) {')
      expect(finalCode).toContain('if (pos >= input.length) break')
    })

    it('should remove function calls with complex arguments', async () => {
      const realCode = `
        debug(
          'match',
          'breakLine',
          options,
          state,
          'hard line break (spaces)',
          pos,
          JSON.stringify(
            source.slice(Math.max(0, pos - 20), Math.min(end, pos + 20))
          )
        )
        flushText(checkPos + 1)
`
      const testFile = path.join(tempDir, 'parse.ts')
      const finalCode = await processFile(testFile, realCode)

      expect(finalCode).not.toContain('debug(')
      expect(finalCode).not.toContain('JSON.stringify')
      expect(finalCode).toContain('flushText(checkPos + 1)')
    })

    it('should remove function calls in nested if statements', async () => {
      const realCode = `
    while (pos < end) {
      if (!state.inAnchor && !options.disableAutoLink) {
        if (
          (char === 'h' && startsWith(source, 'http', pos)) ||
          (char === 'w' && startsWith(source, 'www.', pos)) ||
          (char === 'f' && startsWith(source, 'ftp://', pos))
        ) {
          trackAttempt('bareUrl')
          var bareUrlResult = parseLinkBareUrl(source, pos, state, options)
          if (bareUrlResult) {
            trackHit('bareUrl')
            if (handleResult(bareUrlResult)) continue
          }
        }
      }
      pos++
    }
`
      const testFile = path.join(tempDir, 'parse.ts')
      const finalCode = await processFile(testFile, realCode)

      expect(finalCode).not.toContain("trackAttempt('bareUrl')")
      expect(finalCode).not.toContain("trackHit('bareUrl')")
      expect(finalCode).toContain('if (bareUrlResult) {')
      expect(finalCode).toContain('if (handleResult(bareUrlResult)) continue')
    })

    it('should remove function calls in else blocks', async () => {
      const realCode = `
      if (parserFn === parseIndented) {
        trackBlockAttempt('codeBlock')
      } else if (parserFn === parseBlockQuote) {
        trackBlockAttempt('blockQuote')
      } else if (parserFn === parseHeading) {
        trackBlockAttempt('heading')
      } else {
        trackBlockAttempt('unknown')
      }
`
      const testFile = path.join(tempDir, 'parse.ts')
      const finalCode = await processFile(testFile, realCode)

      expect(finalCode).not.toContain("trackBlockAttempt('codeBlock')")
      expect(finalCode).not.toContain("trackBlockAttempt('blockQuote')")
      expect(finalCode).not.toContain("trackBlockAttempt('heading')")
      expect(finalCode).not.toContain("trackBlockAttempt('unknown')")
      expect(finalCode).toContain('if (parserFn === parseIndented) {')
      expect(finalCode).toContain('} else {')
    })

    it('should remove function calls on same line as other code', async () => {
      const realCode = `
      trackAttempt('htmlComment')
      var htmlCommentResult = parseHTMLComment(source, pos)
      if (htmlCommentResult) {
        trackHit('htmlComment')
        return handleResult(htmlCommentResult)
      }
`
      const testFile = path.join(tempDir, 'parse.ts')
      const finalCode = await processFile(testFile, realCode)

      expect(finalCode).not.toContain("trackAttempt('htmlComment')")
      expect(finalCode).not.toContain("trackHit('htmlComment')")
      expect(finalCode).toContain(
        'var htmlCommentResult = parseHTMLComment(source, pos)'
      )
      expect(finalCode).toContain('if (htmlCommentResult) {')
    })

    it('should remove multiple function calls in sequence', async () => {
      const realCode = `
      trackAttempt('escaped')
      var nextChar = pos + 1 < end ? source[pos + 1] : ''
      var asciiPunctuation = '!"#$%&\\'()*+,-./:;<=>?@[\\\\]^_\`{|}~'
      if (nextChar && includes(asciiPunctuation, nextChar)) {
        trackHit('escaped')
        flushText(pos)
      }
`
      const testFile = path.join(tempDir, 'parse.ts')
      const finalCode = await processFile(testFile, realCode)

      expect(finalCode).not.toContain("trackAttempt('escaped')")
      expect(finalCode).not.toContain("trackHit('escaped')")
      expect(finalCode).toContain(
        "var nextChar = pos + 1 < end ? source[pos + 1] : ''"
      )
      expect(finalCode).toContain(
        'if (nextChar && includes(asciiPunctuation, nextChar)) {'
      )
    })

    it('should remove function calls from real code', async () => {
      const realCode = `
function parseInlineSpan(
  source: string,
  start: number,
  end: number,
  state: MarkdownToJSX.State,
  options: ParseOptions
): MarkdownToJSX.ASTNode[] {
  debug('parse', 'inlineSpan', options, state, start, end)

  const result: MarkdownToJSX.ASTNode[] = []
  let pos = start

  trackAttempt('angleBraceLink')
  const angleBrace = parseLinkAngleBrace(source, pos, state, options)
  if (angleBrace) {
    trackHit('angleBraceLink')
    result.push(angleBrace)
    pos = angleBrace.endPos
  }

  trackAttempt('htmlComment')
  const comment = parseHTMLComment(source, pos)
  if (comment) {
    trackHit('htmlComment')
    result.push(comment)
    pos = comment.endPos
  }

  return result
}
`

      const testFile = path.join(tempDir, 'parse.ts')
      const finalCode = await processFile(testFile, realCode)

      expect(finalCode).not.toContain("debug('parse', 'inlineSpan'")
      expect(finalCode).not.toContain("trackAttempt('angleBraceLink')")
      expect(finalCode).not.toContain("trackHit('angleBraceLink')")
      expect(finalCode).not.toContain("trackAttempt('htmlComment')")
      expect(finalCode).not.toContain("trackHit('htmlComment')")
    })

    it('should remove debug function definitions from real code', async () => {
      const realCode = `
function debug(
  category: string,
  ruleType: string,
  options?: ParseOptions,
  state?: MarkdownToJSX.State,
  ...args: any[]
): void {
  if (category === 'parse') {
    if (ruleType === 'inlineSpan') {
      global.parseMetrics.inlineParseIterations++
      global.parseMetrics.totalOperations++
    }
  }
}

function trackAttempt(key: string): void {
  if (!global.parseMetrics.inlineParsers[key]) {
    global.parseMetrics.inlineParsers[key] = { attempts: 0, hits: 0 }
  }
  global.parseMetrics.inlineParsers[key].attempts++
}

function trackHit(key: string): void {
  global.parseMetrics.inlineParsers[key].hits++
}
`

      const testFile = path.join(tempDir, 'parse.ts')
      const finalCode = await processFile(testFile, realCode)

      expect(finalCode).not.toContain('function debug')
      expect(finalCode).not.toContain('function trackAttempt')
      expect(finalCode).not.toContain('function trackHit')
      expect(finalCode).not.toContain('global.parseMetrics')
    })

    it('should remove function calls in sequence expressions', async () => {
      const realCode = `
  items.push(hasTask
    ? (trackBlockAttempt('listGfmTask'), trackBlockHit('listGfmTask'), [
        task,
        ...parseContentWithParagraphHandling(actualItemContent.slice(task.endPos), itemHasBlankLine, state, options)
      ])
    : parseContentWithParagraphHandling(actualItemContent, itemHasBlankLine, state, options))
`
      const testFile = path.join(tempDir, 'parse.ts')
      const finalCode = await processFile(testFile, realCode)

      expect(finalCode).not.toContain("trackBlockAttempt('listGfmTask')")
      expect(finalCode).not.toContain("trackBlockHit('listGfmTask')")
      expect(finalCode).toContain('items.push(hasTask')
      expect(finalCode).toContain('? (')
      expect(finalCode).toContain('task,')
      expect(finalCode).toContain('parseContentWithParagraphHandling')
    })
  })

  describe('index.tsx processing', () => {
    it('should remove initializeParseMetrics function call and definition', async () => {
      const realCode = `
function initializeParseMetrics(): void {
  global.parseMetrics = {
    blockParsers: {
      codeBlock: { attempts: 0, hits: 0 },
    },
    inlineParsers: {
      escaped: { attempts: 0, hits: 0 },
    },
    totalOperations: 0,
    blockParseIterations: 0,
    inlineParseIterations: 0,
  }
}

function test() {
  initializeParseMetrics()
  return 'test'
}
`

      const testFile = path.join(tempDir, 'index.tsx')
      const finalCode = await processFile(testFile, realCode)

      expect(finalCode).not.toContain('initializeParseMetrics')
      expect(finalCode).not.toContain('global.parseMetrics')
    })
  })

  describe('plugin creation', () => {
    it('should create plugin instance', () => {
      const plugin = removeDebugPlugin()
      expect(plugin).toBeDefined()
      expect(plugin.name).toBe('remove-debug')
      expect(typeof plugin.setup).toBe('function')
    })
  })
})
