[![npm version](https://badge.fury.io/js/markdown-to-jsx.svg)](https://badge.fury.io/js/markdown-to-jsx) [![downloads](https://badgen.net/npm/dy/markdown-to-jsx)](https://npm-stat.com/charts.html?package=markdown-to-jsx)

`markdown-to-jsx` is a gfm+commonmark compliant markdown parser and compiler toolchain for JavaScript and TypeScript-based projects. It is extremely fast, capable of processing large documents fast enough for real-time interactivity.

Some special features of the library:

- Arbitrary HTML is supported and parsed into the appropriate JSX representation
  without `dangerouslySetInnerHTML`

- Any HTML tags rendered by the compiler and/or `<Markdown>` component can be overridden to include additional props or even a different HTML representation entirely.

- All GFM special syntaxes are supported, including tables, task lists, strikethrough, autolinks, tag filtering, and more.

- Fenced code blocks with [highlight.js](https://highlightjs.org/) support; see [Syntax highlighting](#syntax-highlighting) for instructions on setting up highlight.js.

<h2>Table of Contents</h2>

<!-- TOC -->

- [Upgrading](#upgrading)
  - [From v8.x to v9.x](#from-v8x-to-v9x)
  - [From v7.x to v8.x](#from-v7x-to-v8x)
- [Installation](#installation)
- [Usage](#usage)
  - [Entry Points](#entry-points)
    - [Main](#main)
    - [React](#react)
    - [React Native](#react-native)
    - [SolidJS](#solidjs)
    - [Vue.js](#vuejs)
    - [HTML](#html)
    - [Markdown](#markdown)
  - [Library Options](#library-options)
    - [All Options](#all-options)
    - [options.createElement](#optionscreateelement)
    - [options.forceWrapper](#optionsforcewrapper)
    - [options.overrides](#optionsoverrides)
    - [options.evalUnserializableExpressions](#optionsevalunserializableexpressions)
    - [options.renderRule](#optionsrenderrule)
    - [options.sanitizer](#optionssanitizer)
    - [options.slugify](#optionsslugify)
    - [options.wrapper](#optionswrapper)
      - [Other useful recipes](#other-useful-recipes)
    - [options.wrapperProps](#optionswrapperprops)
  - [Syntax highlighting](#syntax-highlighting)
  - [Handling shortcodes](#handling-shortcodes)
  - [Usage with Preact](#usage-with-preact)
  - [AST Anatomy](#ast-anatomy)
    - [Node Types](#node-types)
    - [Example AST Structure](#example-ast-structure)
    - [Type Checking](#type-checking)
  - [Gotchas](#gotchas)
- [Changelog](#changelog)
- [Donate](#donate)

<!-- /TOC -->

## Upgrading

### From v8.x to v9.x

**Breaking Changes:**

- **`ast` option removed**: The `ast: true` option on `compiler()` has been removed. Use the new `parser()` function instead to access the AST directly.

```typescript
/** v8 */ compiler('# Hello world', { ast: true })
/** v9 */ parser('# Hello world')
```

- **`namedCodesToUnicode` option removed**: The `namedCodesToUnicode` option has been removed. All named HTML entities are now supported by default via the full entity list, so custom entity mappings are no longer needed.

```typescript
/** v8 */ compiler('&le; symbol', { namedCodesToUnicode: { le: '\u2264' } })
/** v9 */ compiler('&le; symbol')
```

- **`tagfilter` enabled by default**: Dangerous HTML tags (`script`, `iframe`, `style`, `title`, `textarea`, `xmp`, `noembed`, `noframes`, `plaintext`) are now escaped by default in both HTML string output and React JSX output. Previously these tags were rendered as JSX elements in React output.

```typescript
/** v8 */ tags rendered as JSX elements
/** v9 */ tags escaped by default
compiler('<script>alert("xss")</script>') // <span>&lt;script&gt;</span>

/** Restore old behavior */
compiler('<script>alert("xss")</script>', { tagfilter: false })
```

**New Features:**

- **New `parser` function**: Provides direct access to the parsed AST without rendering. This is the recommended way to get AST nodes.

- **New entry points**: React-specific, HTML-specific, and markdown-specific entry points are now available for better tree-shaking and separation of concerns.

```typescript
// React-specific usage
import Markdown, { compiler, parser } from 'markdown-to-jsx/react'

// HTML string output
import { compiler, astToHTML, parser } from 'markdown-to-jsx/html'

// Markdown string output (round-trip compilation)
import { compiler, astToMarkdown, parser } from 'markdown-to-jsx/markdown'
```

**Migration Guide:**

1. **Replace `compiler(..., { ast: true })` with `parser()`**:

```typescript
/** v8 */ compiler(markdown, { ast: true })
/** v9 */ parser(markdown)
```

2. **Migrate React imports to `/react` entry point** (optional but recommended):

```typescript
/** Legacy */ import from 'markdown-to-jsx'
/** Recommended */ import from 'markdown-to-jsx/react'
```

3. **Remove `namedCodesToUnicode` option**: All named HTML entities are now supported automatically, so you can remove any custom entity mappings.

```typescript
/** v8 */ compiler('&le; symbol', { namedCodesToUnicode: { le: '\u2264' } })
/** v9 */ compiler('&le; symbol')
```

**Note:** The main entry point (`markdown-to-jsx`) continues to work for backward compatibility, but React code there is deprecated and will be removed in a future major release. Consider migrating to `markdown-to-jsx/react` for React-specific usage.

<details>
<summary>### Older Migration Guides</summary>

### From v7.x to v8.x

**Breaking Changes:**

- Type `ParserResult` renamed to `ASTNode` - If you were using `MarkdownToJSX.ParserResult` in your code, update to `MarkdownToJSX.ASTNode`

```typescript
/** v7 */ MarkdownToJSX.ParserResult[]
/** v8+ */ MarkdownToJSX.ASTNode[]
```

- Multiple `RuleType` enums consolidated into `RuleType.textFormatted` - If you were checking for `RuleType.textBolded`, `RuleType.textEmphasized`, `RuleType.textMarked`, or `RuleType.textStrikethroughed`, update to check for `RuleType.textFormatted` and inspect the node's boolean flags:

```typescript
/** v7 */ RuleType.textBolded
/** v8+ */ RuleType.textFormatted && node.bold
```

</details>

## Installation

Install `markdown-to-jsx` with your favorite package manager.

```shell
npm i markdown-to-jsx
```

## Usage

`markdown-to-jsx` exports a React component by default for easy JSX composition:

ES6-style usage\*:

```tsx
import Markdown from 'markdown-to-jsx'
import React from 'react'
import { render } from 'react-dom'

render(<Markdown># Hello world!</Markdown>, document.body)

/*
    renders:

    <h1>Hello world!</h1>
 */
```

\* **NOTE: JSX does not natively preserve newlines in multiline text. In general, writing markdown directly in JSX is discouraged and it's a better idea to keep your content in separate .md files and require them, perhaps using webpack's [raw-loader](https://github.com/webpack-contrib/raw-loader).**

### Entry Points

`markdown-to-jsx` provides multiple entry points for different use cases:

#### Main

The legacy\*default entry point exports everything, including the React compiler and component:

```tsx
import Markdown, { compiler, parser } from 'markdown-to-jsx'
```

_The React code in this entry point is deprecated and will be removed in a future major release, migrate to `markdown-to-jsx/react`._

#### React

For React-specific usage, import from the `/react` entry point:

```tsx
import Markdown, { compiler, parser, astToJSX } from 'markdown-to-jsx/react'

const jsxElement = compiler('# Hello world')

function App() {
  return <Markdown children="# Hello world" />
}

/** Or use parser + astToJSX */
const ast = parser('# Hello world')
const jsxElement2 = astToJSX(ast)
```

#### React Native

For React Native usage, import from the `/native` entry point:

```tsx
import Markdown, { compiler, parser, astToNative } from 'markdown-to-jsx/native'
import { View, Text, StyleSheet, Linking } from 'react-native'

const nativeElement = compiler('# Hello world', {
  styles: {
    heading1: { fontSize: 32, fontWeight: 'bold' },
    paragraph: { marginVertical: 8 },
    link: { color: 'blue', textDecorationLine: 'underline' },
  },
  onLinkPress: url => {
    Linking.openURL(url)
  },
})

const markdown = `# Hello world

This is a [link](https://example.com) with **bold** and *italic* text.
`

function App() {
  return (
    <View>
      <Markdown
        children={markdown}
        options={{
          styles: StyleSheet.create({
            heading1: { fontSize: 32, fontWeight: 'bold' },
            paragraph: { marginVertical: 8 },
            link: { color: 'blue', textDecorationLine: 'underline' },
          }),
          onLinkPress: url => {
            Linking.openURL(url)
          },
        }}
      />
    </View>
  )
}
```

**React Native-specific options:**

- `onLinkPress?: (url: string, title?: string) => void` - Custom handler for link presses (defaults to `Linking.openURL`)
- `onLinkLongPress?: (url: string, title?: string) => void` - Handler for link long presses
- `styles?: Partial<Record<NativeStyleKey, StyleProp<ViewStyle | TextStyle | ImageStyle>>>` - Style overrides for each element type
- `wrapperProps?: ViewProps | TextProps` - Props for the wrapper component (defaults to `View` for block, `Text` for inline)

**HTML Tag Mapping:**
HTML tags are automatically mapped to React Native components:

- `<img>` → `Image` component
- Block elements (`<div>`, `<section>`, `<article>`, `<blockquote>`, `<ul>`, `<ol>`, `<li>`, `<table>`, etc.) → `View` component
- Inline elements (`<span>`, `<strong>`, `<em>`, `<a>`, etc.) → `Text` component
- Type 1 blocks (`<pre>`, `<script>`, `<style>`, `<textarea>`) → `View` component

**Note:** Links are underlined by default for better accessibility and discoverability. You can override this via the `styles.link` option.

#### SolidJS

For SolidJS usage, import from the `/solid` entry point:

```tsx
import Markdown, {
  compiler,
  parser,
  astToJSX,
  MarkdownProvider,
} from 'markdown-to-jsx/solid'
import { createSignal } from 'solid-js'

// Static content
const solidElement = compiler('# Hello world')

function App() {
  return <Markdown children="# Hello world" />
}

// Reactive content (automatically updates when content changes)
function ReactiveApp() {
  const [content, setContent] = createSignal('# Hello world')
  return <Markdown>{content}</Markdown>
}

// Or use parser + astToJSX
const ast = parser('# Hello world')
const solidElement2 = astToJSX(ast)

// Use context for default options
function AppWithContext() {
  return (
    <MarkdownProvider options={{ sanitizer: customSanitizer }}>
      <Markdown># Content</Markdown>
    </MarkdownProvider>
  )
}
```

**SolidJS-specific features:**

- **Reactive content**: The `Markdown` component accepts signals/accessors for automatic updates when markdown content changes
- **Memoization**: AST parsing is automatically memoized for optimal performance
- **Context API**: Use `MarkdownProvider` to provide default options and avoid prop drilling

#### Vue.js

For Vue.js 3 usage, import from the `/vue` entry point:

```tsx
import Markdown, { compiler, parser, astToJSX } from 'markdown-to-jsx/vue'
import { h } from 'vue'

// Using compiler
const vnode = compiler('# Hello world')

// Using component
<Markdown children="# Hello world" />

// Or use parser + astToJSX
const ast = parser('# Hello world')
const vnode2 = astToJSX(ast)
```

**Vue.js-specific features:**

- **Vue 3 support**: Uses Vue 3's `h()` render function API
- **JSX support**: Works with Vue 3 JSX via `@vue/babel-plugin-jsx` or `@vitejs/plugin-vue-jsx`
- **HTML attributes**: Uses standard HTML attributes (`class` instead of `className`)
- **Component overrides**: Support for both Options API and Composition API componen

#### HTML

For HTML string output (server-side rendering), import from the `/html` entry point:

```tsx
import { compiler, html, parser } from 'markdown-to-jsx/html'

const htmlString = compiler('# Hello world')

/** Or use parser + html */
const ast = parser('# Hello world')
const htmlString2 = html(ast)
```

#### Markdown

For markdown-to-markdown compilation (normalization and formatting), import from the `/markdown` entry point:

```typescript
import { compiler, astToMarkdown, parser } from 'markdown-to-jsx/markdown'

const normalizedMarkdown = compiler('# Hello  world\n\nExtra spaces!')

/** Or work with AST */
const ast = parser('# Hello  world')
const normalizedMarkdown2 = astToMarkdown(ast)
```

### Library Options

#### All Options

| Option                          | Type                          | Default  | Description                                                                                                                       |
| ------------------------------- | ----------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `createElement`                 | `function`                    | -        | Custom createElement behavior (React/React Native/SolidJS/Vue only). See [createElement](#optionscreateelement) for details.      |
| `disableAutoLink`               | `boolean`                     | `false`  | Disable automatic conversion of bare URLs to anchor tags.                                                                         |
| `disableParsingRawHTML`         | `boolean`                     | `false`  | Disable parsing of raw HTML into JSX.                                                                                             |
| `enforceAtxHeadings`            | `boolean`                     | `false`  | Require space between `#` and header text (GFM spec compliance).                                                                  |
| `evalUnserializableExpressions` | `boolean`                     | `false`  | ⚠️ Eval unserializable props (DANGEROUS). See [evalUnserializableExpressions](#optionsevalunserializableexpressions) for details. |
| `forceBlock`                    | `boolean`                     | `false`  | Force all content to be treated as block-level.                                                                                   |
| `forceInline`                   | `boolean`                     | `false`  | Force all content to be treated as inline.                                                                                        |
| `forceWrapper`                  | `boolean`                     | `false`  | Force wrapper even with single child (React/React Native/Vue only). See [forceWrapper](#optionsforcewrapper) for details.         |
| `overrides`                     | `object`                      | -        | Override HTML tag rendering. See [overrides](#optionsoverrides) for details.                                                      |
| `preserveFrontmatter`           | `boolean`                     | `false`  | Include frontmatter in rendered output (as `<pre>` for HTML/JSX, included in markdown). Behavior varies by compiler type.         |
| `renderRule`                    | `function`                    | -        | Custom rendering for AST rules. See [renderRule](#optionsrenderrule) for details.                                                 |
| `sanitizer`                     | `function`                    | built-in | Custom URL sanitizer function. See [sanitizer](#optionssanitizer) for details.                                                    |
| `slugify`                       | `function`                    | built-in | Custom slug generation for heading IDs. See [slugify](#optionsslugify) for details.                                               |
| `tagfilter`                     | `boolean`                     | `true`   | Escape dangerous HTML tags (`script`, `iframe`, `style`, etc.) to prevent XSS.                                                    |
| `wrapper`                       | `string \| component \| null` | `'div'`  | Wrapper element for multiple children (React/React Native/Vue only). See [wrapper](#optionswrapper) for details.                  |
| `wrapperProps`                  | `object`                      | -        | Props for wrapper element (React/React Native/Vue only). See [wrapperProps](#optionswrapperprops) for details.                    |

#### options.createElement

Sometimes, you might want to override the `React.createElement` default behavior to hook into the rendering process before the JSX gets rendered. This might be useful to add extra children or modify some props based on runtime conditions. The function mirrors the `React.createElement` function, so the params are [`type, [props], [...children]`](https://reactjs.org/docs/react-api.html#createelement):

```javascript
import Markdown from 'markdown-to-jsx'
import React from 'react'
import { render } from 'react-dom'

const md = `
# Hello world
`

render(
  <Markdown
    children={md}
    options={{
      createElement(type, props, children) {
        return (
          <div className="parent">
            {React.createElement(type, props, children)}
          </div>
        )
      },
    }}
  />,
  document.body
)
```

#### options.forceWrapper

By default, the compiler does not wrap the rendered contents if there is only a single child. You can change this by setting `forceWrapper` to `true`. If the child is inline, it will not necessarily be wrapped in a `span`.

```tsx
// Using `forceWrapper` with a single, inline child…
<Markdown options={{ wrapper: 'aside', forceWrapper: true }}>
  Mumble, mumble…
</Markdown>

// renders

<aside>Mumble, mumble…</aside>
```

#### options.overrides

Override HTML tag rendering or render custom React components. Three use cases:

**1. Remove tags:** Return `null` to completely remove tags (beyond `tagfilter` escaping):

```tsx
<Markdown options={{ overrides: { iframe: () => null } }}>
  <iframe src="..."></iframe>
</Markdown>
```

**2. Override HTML tags:** Change component, props, or both:

```tsx
const MyParagraph = ({ children, ...props }) => <div {...props}>{children}</div>

<Markdown options={{ overrides: { h1: { component: MyParagraph, props: { className: 'foo' } } } }}>
  # Hello
</Markdown>

/** Simplified */ { overrides: { h1: MyParagraph } }
```

**3. Render React components:** Use custom components in markdown:

```tsx
import DatePicker from './date-picker'

const md = `<DatePicker timezone="UTC+5" startTime={1514579720511} />`

<Markdown options={{ overrides: { DatePicker } }}>{md}</Markdown>
```

**Important notes:**

- **JSX props are intelligently parsed** (v9.1+):
  - Arrays and objects: `data={[1, 2, 3]}` → parsed as `[1, 2, 3]`
  - Booleans: `enabled={true}` → parsed as `true`
  - Functions: `onClick={() => ...}` → kept as string for security (use [renderRule](#optionsrenderrule) for case-by-case handling, or see [evalUnserializableExpressions](#optionsevalunserializableexpressions))
  - Complex expressions: `value={someVar}` → kept as string
- The original raw attribute string is available in `node.rawAttrs` when using `parser()`
- Some props are preserved: `a` (`href`, `title`), `img` (`src`, `alt`, `title`), `input[type="checkbox"]` (`checked`, `readonly`), `ol` (`start`), `td`/`th` (`style`)
- Element mappings: `span` for inline text, `code` for inline code, `pre > code` for code blocks

#### options.evalUnserializableExpressions

**⚠️ SECURITY WARNING: STRONGLY DISCOURAGED FOR USER INPUTS**

When enabled, attempts to eval expressions in JSX props that cannot be serialized as JSON (functions, variables, complex expressions). This uses `eval()` which can execute arbitrary code.

**By default (recommended)**, unserializable expressions are kept as strings for security:

```tsx
import { parser } from 'markdown-to-jsx'

const ast = parser('<Button onClick={() => alert("hi")} />')
// ast[0].attrs.onClick === "() => alert(\"hi\")" (string, safe)

// Arrays and objects are automatically parsed (no eval needed):
const ast2 = parser('<Table data={[1, 2, 3]} />')
// ast2[0].attrs.data === [1, 2, 3] (parsed via JSON.parse)
```

**ONLY enable this option when:**

- The markdown source is completely trusted (e.g., your own documentation)
- You control all JSX components and their props
- The content is NOT user-generated or user-editable

**DO NOT enable this option when:**

- Processing user-submitted markdown
- Rendering untrusted content
- Building public-facing applications with user content

**Example of the danger:**

```tsx
// User-submitted markdown with malicious code
const userMarkdown = '<Component onClick={() => fetch("/admin/delete-all")} />'

// ❌ DANGEROUS - function will be executable
parser(userMarkdown, { evalUnserializableExpressions: true })

// ✅ SAFE - function kept as string
parser(userMarkdown) // default behavior
```

**Safe alternative: Use renderRule for case-by-case handling:**

```tsx
// Instead of eval'ing arbitrary expressions, handle them selectively in renderRule:
const handlers = {
  handleClick: () => console.log('clicked'),
  handleSubmit: () => console.log('submitted'),
}

compiler(markdown, {
  renderRule(next, node) {
    if (
      node.type === RuleType.htmlBlock &&
      typeof node.attrs?.onClick === 'string'
    ) {
      // Option 1: Named handler lookup (safest)
      const handler = handlers[node.attrs.onClick]
      if (handler) {
        return <button onClick={handler}>{/* ... */}</button>
      }

      // Option 2: Selective eval with allowlist (still risky)
      if (
        node.tag === 'TrustedComponent' &&
        node.attrs.onClick.startsWith('() =>')
      ) {
        try {
          const fn = eval(`(${node.attrs.onClick})`)
          return <button onClick={fn}>{/* ... */}</button>
        } catch (e) {
          // Handle error
        }
      }
    }
    return next()
  },
})
```

This approach gives you full control over which expressions are evaluated and under what conditions.

#### options.renderRule

Supply your own rendering function that can selectively override how _rules_ are rendered (note, this is different than _`options.overrides`_ which operates at the HTML tag level and is more general). The `renderRule` function always executes before any other rendering code, giving you full control over how nodes are rendered, including normally-skipped nodes like `ref`, `footnote`, and `frontmatter`.

You can use this functionality to do pretty much anything with an established AST node; here's an example of selectively overriding the "codeBlock" rule to process LaTeX syntax using the `@matejmazur/react-katex` library:

````tsx
import Markdown, { RuleType } from 'markdown-to-jsx'
import TeX from '@matejmazur/react-katex'

const exampleContent =
  'Some important formula:\n\n```latex\nmathbb{N} = { a in mathbb{Z} : a > 0 }\n```\n'

function App() {
  return (
    <Markdown
      children={exampleContent}
      options={{
        renderRule(next, node, renderChildren, state) {
          if (node.type === RuleType.codeBlock && node.lang === 'latex') {
            return (
              <TeX as="div" key={state.key}>{String.raw`${node.text}`}</TeX>
            )
          }

          return next()
        },
      }}
    />
  )
}
````

**Accessing parsed HTML content:** For HTML blocks marked as `verbatim` (like `<script>`, `<style>`, `<pre>`), default renderers use `rawText` for CommonMark compliance, but `renderRule` can access the fully parsed AST in `children`:

```tsx
<Markdown
  options={{
    renderRule(next, node, renderChildren) {
      if (node.type === RuleType.htmlBlock && node.tag === 'script') {
        // Access parsed children even for verbatim blocks
        const parsedContent = node.children || []
        // Or use rawText for original content
        const rawContent = node.rawText || ''

        // Custom rendering logic here
        return <CustomScript content={parsedContent} raw={rawContent} />
      }
      return next()
    },
  }}
>
  <script>Hello **world**</script>
</Markdown>
```

#### options.sanitizer

By default a lightweight URL sanitizer function is provided to avoid common attack vectors that might be placed into the `href` of an anchor tag, for example. The sanitizer receives the input, the HTML tag being targeted, and the attribute name. The original function is available as a library export called `sanitizer`.

This can be overridden and replaced with a custom sanitizer if desired via `options.sanitizer`:

<!-- prettier-ignore -->
```tsx
// sanitizer in this situation would receive:
// ('javascript:alert("foo")', 'a', 'href')

<Markdown options={{ sanitizer: (value, tag, attribute) => value }}>
  {`[foo](javascript:alert("foo"))`}
</Markdown>

// or

compiler('[foo](javascript:alert("foo"))', {
  sanitizer: value => value,
})
```

#### options.slugify

By default, a [lightweight deburring function](https://github.com/quantizor/markdown-to-jsx/blob/bc2f57412332dc670f066320c0f38d0252e0f057/index.js#L261-L275) is used to generate an HTML id from headings. You can override this by passing a function to `options.slugify`. This is helpful when you are using non-alphanumeric characters (e.g. Chinese or Japanese characters) in headings. For example:

<!-- prettier-ignore -->
```tsx
<Markdown options={{ slugify: str => str }}># 中文</Markdown>
compiler('# 中文', { slugify: str => str })
```

The original function is available as a library export called `slugify`.

#### options.wrapper

When there are multiple children to be rendered, the compiler will wrap the output in a `div` by default. You can override this default by setting the `wrapper` option to either a string (React Element) or a component.

```tsx
const str = '# Heck Yes\n\nThis is great!'

<Markdown options={{ wrapper: 'article' }}>{str}</Markdown>

compiler(str, { wrapper: 'article' })
```

##### Other useful recipes

To get an array of children back without a wrapper, set `wrapper` to `null`. This is particularly useful when using `compiler(…)` directly.

```tsx
compiler('One\n\nTwo\n\nThree', { wrapper: null })[
  /** Returns */ ((<p>One</p>), (<p>Two</p>), (<p>Three</p>))
]
```

To render children at the same DOM level as `<Markdown>` with no HTML wrapper, set `wrapper` to `React.Fragment`. This will still wrap your children in a React node for the purposes of rendering, but the wrapper element won't show up in the DOM.

#### options.wrapperProps

Props to apply to the wrapper element when `wrapper` is used.

```tsx
<Markdown
  options={{
    wrapper: 'article',
    wrapperProps: { className: 'post', 'data-testid': 'markdown-content' },
  }}
>
  # Hello World
</Markdown>
```

### Syntax highlighting

When using [fenced code blocks](https://www.markdownguide.org/extended-syntax/#syntax-highlighting) with language annotation, that language will be added to the `<code>` element as `class="lang-${language}"`. For best results, you can use `options.overrides` to provide an appropriate syntax highlighting integration like this one using `highlight.js`:

```html
<!-- Add the following tags to your page <head> to automatically load hljs and styles: -->
<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/obsidian.min.css"
/>

<script
  crossorigin
  src="https://unpkg.com/@highlightjs/cdn-assets@11.9.0/highlight.min.js"
></script>
```

````tsx
import { Markdown, RuleType } from 'markdown-to-jsx'

const mdContainingFencedCodeBlock = '```js\nconsole.log("Hello world!");\n```\n'

function App() {
  return (
    <Markdown
      children={mdContainingFencedCodeBlock}
      options={{
        overrides: {
          code: SyntaxHighlightedCode,
        },
      }}
    />
  )
}

function SyntaxHighlightedCode(props) {
  const ref = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (ref.current && props.className?.includes('lang-') && window.hljs) {
      window.hljs.highlightElement(ref.current)

      // hljs won't reprocess the element unless this attribute is removed
      ref.current.removeAttribute('data-highlighted')
    }
  }, [props.className, props.children])

  return <code {...props} ref={ref} />
}
````

### Handling shortcodes

For Slack-style messaging with arbitrary shortcodes like `:smile:`, you can use `options.renderRule` to hook into the plain text rendering and adjust things to your liking, for example:

```tsx
import Markdown, { RuleType } from 'markdown-to-jsx'

const shortcodeMap = {
  smile: '🙂',
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

function Example() {
  return (
    <Markdown
      options={{
        renderRule(next, node) {
          if (node.type === RuleType.text && detector.test(node.text)) {
            return replaceEmoji(node.text)
          }

          return next()
        },
      }}
    >
      {`On a beautiful summer day, all I want to do is :smile:.`}
    </Markdown>
  )
}
```

When you use `options.renderRule`, any React-renderable JSX may be returned including images and GIFs. Ensure you benchmark your solution as the `text` rule is one of the hottest paths in the system!

### Usage with Preact

Everything will work just fine! Simply [Alias `react` to `preact/compat`](https://preactjs.com/guide/v10/switching-to-preact#setting-up-compat) like you probably already are doing.

### AST Anatomy

The Abstract Syntax Tree (AST) is a structured representation of parsed markdown. Each node in the AST has a `type` property that identifies its kind, and type-specific properties.

**Important:** The first node in the AST is typically a `RuleType.refCollection` node that contains all reference definitions found in the document, including footnotes (stored with keys prefixed with `^`). This node is skipped during rendering but is useful for accessing reference data. Footnotes are automatically extracted from the refCollection and rendered in a `<footer>` element by both `compiler()` and `astToJSX()`.

#### Node Types

The AST consists of the following node types (use `RuleType` to check node types):

**Block-level nodes:**

- `RuleType.heading` - Headings (`# Heading`)
  ```tsx
  { type: RuleType.heading, level: 1, id: "heading", children: [...] }
  ```
- `RuleType.paragraph` - Paragraphs
  ```tsx
  { type: RuleType.paragraph, children: [...] }
  ```
- `RuleType.codeBlock` - Fenced code blocks (```)
  ```tsx
  { type: RuleType.codeBlock, lang: "javascript", text: "code content" }
  ```
- `RuleType.blockQuote` - Blockquotes (`>`)
  ```tsx
  { type: RuleType.blockQuote, children: [...], alert?: "note" }
  ```
- `RuleType.orderedList` / `RuleType.unorderedList` - Lists
  ```tsx
  { type: RuleType.orderedList, items: [[...]], start?: 1 }
  { type: RuleType.unorderedList, items: [[...]] }
  ```
- `RuleType.table` - Tables
  ```tsx
  { type: RuleType.table, header: [...], cells: [[...]], align: [...] }
  ```
- `RuleType.htmlBlock` - HTML blocks and JSX components

  ```tsx
  {
    type: RuleType.htmlBlock,
    tag: "div",
    attrs: {},
    rawAttrs?: string,
    children?: ASTNode[],
    verbatim?: boolean,
    rawText?: string,
    text?: string // @deprecated - use rawText instead
  }
  ```

  **Note (v9.1+):** JSX components with blank lines between opening/closing tags now properly nest children instead of creating sibling nodes.

  **HTML Block Parsing (v9.2+):** HTML blocks are always fully parsed into the `children` property, even when marked as `verbatim`. The `verbatim` flag acts as a rendering hint (default renderers use `rawText` for verbatim blocks to maintain CommonMark compliance), but `renderRule` implementations can access the fully parsed AST in `children` for all HTML blocks. The `rawText` field contains the original raw HTML content for verbatim blocks, while `rawAttrs` contains the original attribute string.

**Inline nodes:**

- `RuleType.text` - Plain text
  ```tsx
  { type: RuleType.text, text: "Hello world" }
  ```
- `RuleType.textFormatted` - Bold, italic, etc.
  ```tsx
  { type: RuleType.textFormatted, tag: "strong", children: [...] }
  ```
- `RuleType.codeInline` - Inline code (`` ` ``)
  ```tsx
  { type: RuleType.codeInline, text: "code" }
  ```
- `RuleType.link` - Links
  ```tsx
  { type: RuleType.link, target: "https://example.com", children: [...] }
  ```
- `RuleType.image` - Images
  ```tsx
  { type: RuleType.image, target: "image.png", alt: "description" }
  ```

**Other nodes:**

- `RuleType.breakLine` - Hard line breaks (`  `)
- `RuleType.breakThematic` - Horizontal rules (`---`)
- `RuleType.gfmTask` - GFM task list items (`- [ ]`)
- `RuleType.ref` - Reference definition node (not rendered, stored in refCollection)
- `RuleType.refCollection` - Reference definitions collection (appears at AST root, includes footnotes with `^` prefix)
- `RuleType.footnote` - Footnote definition node (not rendered, stored in refCollection)
- `RuleType.footnoteReference` - Footnote reference (`[^identifier]`)
- `RuleType.frontmatter` - YAML frontmatter blocks
  ```tsx
  { type: RuleType.frontmatter, text: "---\ntitle: My Title\n---" }
  ```
- `RuleType.htmlComment` - HTML comment nodes
  ```tsx
  { type: RuleType.htmlComment, text: "<!-- comment -->" }
  ```
- `RuleType.htmlSelfClosing` - Self-closing HTML tags
  ```tsx
  { type: RuleType.htmlSelfClosing, tag: "img", attrs: { src: "image.png" } }
  ```

**JSX Prop Parsing (v9.1+):**

The parser intelligently parses JSX prop values:

- Arrays/objects are parsed via `JSON.parse()`: `rows={[["a", "b"]]}` → `attrs.rows = [["a", "b"]]`
- Functions are kept as strings for security: `onClick={() => ...}` → `attrs.onClick = "() => ..."`
- Booleans are parsed: `enabled={true}` → `attrs.enabled = true`
- The original raw attribute string is preserved in `rawAttrs` field

#### Example AST Structure

````tsx
import { parser, RuleType } from 'markdown-to-jsx'

const ast = parser(`# Hello World

This is a **paragraph** with [a link](https://example.com).

[linkref]: https://example.com

```javascript
console.log('code')
```

`)

// AST structure:
[
  // Reference collection (first node, if references exist)
  {
    type: RuleType.refCollection,
    refs: {
      linkref: { target: 'https://example.com', title: undefined },
    },
  },
  {
    type: RuleType.heading,
    level: 1,
    id: 'hello-world',
    children: [{ type: RuleType.text, text: 'Hello World' }],
  },
  {
    type: RuleType.paragraph,
    children: [
      { type: RuleType.text, text: 'This is a ' },
      {
        type: RuleType.textFormatted,
        tag: 'strong',
        children: [{ type: RuleType.text, text: 'paragraph' }],
      },
      { type: RuleType.text, text: ' with ' },
      {
        type: RuleType.link,
        target: 'https://example.com',
        children: [{ type: RuleType.text, text: 'a link' }],
      },
      { type: RuleType.text, text: '.' },
    ],
  },
  {
    type: RuleType.codeBlock,
    lang: 'javascript',
    text: "console.log('code')",
  },
]

````

#### Type Checking

Use the `RuleType` enum to identify AST nodes:

```tsx
import { RuleType } from 'markdown-to-jsx'

if (node.type === RuleType.heading) {
  const heading = node as MarkdownToJSX.HeadingNode
  console.log(`Heading level ${heading.level}: ${heading.id}`)
}
```

**When to use `compiler` vs `parser` vs `<Markdown>`:**

- Use `<Markdown>` when you need a simple React component that renders markdown to JSX.
- Use `compiler` when you need React JSX output from markdown (the component uses this internally).
- Use `parser` + `astToJSX` when you need the AST for custom processing before rendering to JSX, or just the AST itself.

### Gotchas

**JSX prop parsing (v9.1+):** Arrays and objects in JSX props are automatically parsed:

<!-- prettier-ignore -->
```tsx
// In markdown:
<Table
  columns={['Name', 'Age']}
  data={[
    ['Alice', 30],
    ['Bob', 25],
  ]}
/>

// In your component (v9.1+):
const Table = ({ columns, data, ...props }) => {
  // columns is already an array: ["Name", "Age"]
  // data is already an array: [["Alice", 30], ["Bob", 25]]
  // No JSON.parse needed!
}

// For backwards compatibility, check types:
const Table = ({ columns, data, ...props }) => {
  const parsedColumns =
    typeof columns === 'string' ? JSON.parse(columns) : columns
  const parsedData = typeof data === 'string' ? JSON.parse(data) : data
}
```

**Function props are kept as strings** for security. Use [renderRule](#optionsrenderrule) for case-by-case handling, or see [evalUnserializableExpressions](#optionsevalunserializableexpressions) for opt-in eval.

**HTML indentation:** Leading whitespace in HTML blocks is auto-trimmed based on the first line's indentation to avoid markdown syntax conflicts.

**Code in HTML:** Don't put code directly in HTML divs. Use fenced code blocks instead:

````md
<div>
```js
var code = here();
```
</div>
````

## Changelog

See [Github Releases](https://github.com/quantizor/markdown-to-jsx/releases).

## Donate

Like this library? It's developed entirely on a volunteer basis; chip in a few bucks if you can via the [Sponsor link](https://github.com/sponsors/quantizor)!
