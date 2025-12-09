# markdown-to-jsx

## 9.3.3

### Patch Changes

- 7ac3408: Restore angle-bracket autolinks when raw HTML parsing is disabled so `<https://...>` still renders as links
- 7ac3408: Improve autolink parsing: stricter angle controls, domain underscore validation, and added coverage for mailto labels and raw-HTML-disabled cases.

## 9.3.2

### Patch Changes

- a84c300: Ensure Solid renderer uses Solid's hyperscript runtime so JSX returns real elements instead of `[object Object]` placeholders

## 9.3.1

### Patch Changes

- c1b0ea2: Fix unintended node-specific code from entering browser bundles by changing build target from 'node' to 'browser'

## 9.3.0

### Minor Changes

- a482de6: Add SolidJS integration with full JSX output support. Includes compiler, parser, astToJSX, and Markdown component with reactive support via signals/accessors.
- f9a8fca: Add Vue.js 3+ integration. Includes `compiler`, `parser`, `astToJSX`, and `Markdown` component. Vue uses standard HTML attributes (class, not className) with minimal attribute mapping (only 'for' -> 'htmlFor').

### Patch Changes

- 2bb3f2b: Fix AST and options mutation bugs that could cause unexpected side effects when using memoization or reusing objects across multiple compiler calls.

## 9.2.0

### Minor Changes

- 88d4b1f: Add comprehensive React Native support with new `/native` export. Includes:
  - **React Native Component Mapping**: Enhanced HTML tag to React Native component mapping with semantic support for `img` → `Image`, block elements (`div`, `section`, `article`, `blockquote`, `ul`, `ol`, `li`, `table`, etc.) → `View`, and inline elements → `Text`
  - **Link Handling**: Native link support with `onLinkPress` and `onLinkLongPress` callbacks, defaulting to `Linking.openURL`
  - **Styling System**: Complete `NativeStyleKey` type system with styles for all markdown elements and HTML semantic tags
  - **Component Overrides**: Full support for overriding default components with custom React Native components and props
  - **Accessibility**: Built-in accessibility support with `accessibilityLabel` for images and proper link handling
  - **Type Safety**: Comprehensive TypeScript definitions with `NativeOptions` and `NativeStyleKey` types
  - **Performance**: Optimized rendering with proper React Native best practices and component lifecycle

  React Native is an optional peer dependency, making this a zero-dependency addition for existing users.

## 9.1.2

### Patch Changes

- f93214a: Fix infinite recursion when using `forceBlock: true` with empty unclosed HTML tags

  When `React.createElement(Markdown, {options: {forceBlock: true}}, '<var>')` was called with an empty unclosed tag, it would cause infinite recursion. The parser would set the `text` field to the opening tag itself (e.g., `<var>`), which would then be parsed again in the rendering phase, causing recursion.

  This fix adds detection in `createVerbatimHTMLBlock` to detect when `forceBlock` is used and the text contains just the opening tag (empty unclosed tag), rendering it as an empty element to prevent recursion.

## 9.1.1

### Patch Changes

- 733f10e: Fix lazy continuation lines for list items when continuation text appears at base indentation without a blank line. Previously, continuation text was incorrectly appended inline to the list item. Now both the existing inline content and the continuation text are properly wrapped in separate paragraphs.

## 9.1.0

### Minor Changes

- 0ba757d: Add `preserveFrontmatter` option to control whether YAML frontmatter is rendered in the output. When set to `true`, frontmatter is rendered as a `<pre>` element in HTML/JSX output. For markdown-to-markdown compilation, frontmatter is preserved by default but can be excluded with `preserveFrontmatter: false`.

  | Compiler Type            | Default Behavior            | When `preserveFrontmatter: true` | When `preserveFrontmatter: false` |
  | ------------------------ | --------------------------- | -------------------------------- | --------------------------------- |
  | **React/HTML**           | ❌ Don't render frontmatter | ✅ Render as `<pre>` element     | ❌ Don't render frontmatter       |
  | **Markdown-to-Markdown** | ✅ Preserve frontmatter     | ✅ Preserve frontmatter          | ❌ Exclude frontmatter            |

### Patch Changes

- f945132: Fix lazy continuation lines for list items when continuation text appears at base indentation without a blank line before it. Previously, such lines were incorrectly parsed as separate paragraphs instead of being appended to the list item content.
- 36ef089: yWork around a bundling bug with exporting TypeScript namespaces directly. Bonus: MarkdownToJSX is now declared ambiently so you may not need to import it.

## 9.0.0

### Major Changes

- 1ce83eb: Complete GFM+CommonMark specification compliance
  - **Full CommonMark compliance**: All 652 official test cases now pass
  - **Verified GFM extensions**: Tables, task lists, strikethrough, autolinks with spec compliance
  - **Tag filtering**: Default filtering of dangerous HTML tags (`<script>`, `<iframe>`, etc.) in both HTML string output and React JSX output
  - **URL sanitization**: Protection against `javascript:`, `vbscript:`, and malicious `data:` URLs

  Default filtering of dangerous HTML tags:
  - `<script>`, `<iframe>`, `<object>`, `<embed>`
  - `<title>`, `<textarea>`, `<style>`, `<xmp>`
  - `<plaintext>`, `<noembed>`, `<noframes>`

  ## ⚠️ Breaking Changes
  - **Tagfilter enabled by default**: Dangerous HTML tags are now escaped by default in both HTML and React output
  - **Inline formatting restrictions**: Inline formatting delimiters (emphasis, bold, strikethrough, mark) can no longer span across newlines, per CommonMark specification

  ## 📋 Migration

  ### Tagfilter Migration

  No changes necessary in most cases, but if you need to render potentially dangerous HTML tags, you can disable tag filtering:

  ```ts
  compiler(markdown, { tagfilter: false })
  ```

  ### Inline Formatting Migration

  **Previous Behavior (Non-Compliant):**
  The library previously allowed inline formatting to span multiple lines:

  ```markdown
  _Hello
  World._
  ```

  This was parsed as a single `<em>` element containing the newline.

  **New Behavior (CommonMark Compliant):**
  Per CommonMark specification, inline formatting cannot span newlines. The above example is now parsed as literal underscores:

  ```markdown
  _Hello
  World._
  ```

  Renders as: `<p>_Hello World._</p>`

  **Impact:**
  - Single-line formatting still works: `*Hello World*` → `<em>Hello World</em>`
  - Multi-line formatting is now rejected: `*Hello\nWorld*` → literal asterisks
  - Affects all inline formatting: `*emphasis*`, `**bold**`, `~~strikethrough~~`, `==mark==`

  **Migration Options:**
  If you have markdown with multi-line inline formatting:
  1. Keep formatting on a single line: `*Hello World*`
  2. Use HTML tags: `<em>Hello\nWorld</em>`
  3. Accept that multi-line formatting renders as literal delimiters

  **Examples:**

  ```markdown
  # Works (single line)

  _This is emphasized_
  **This is bold**

  # No longer works (multi-line)

  _This is
  emphasized_
  **This is
  bold**

  # Renders as literal delimiters:

  <p>_This is
  emphasized_</p>
  <p>**This is
  bold**</p>

  # Workaround: Use HTML tags

  <em>This is
  emphasized</em>
  <strong>This is
  bold</strong>
  ```

- 1ce83eb: Remove internal type definitions and rename `MarkdownToJSX.RuleOutput` to `MarkdownToJSX.ASTRender`

  This change removes internal type definitions from the `MarkdownToJSX` namespace:
  - Removed `NestedParser` type
  - Removed `Parser` type
  - Removed `Rule` type
  - Removed `Rules` type
  - Renamed `RuleOutput` to `ASTRender` for clarity

  **Breaking changes:**

  If you are using the internal types directly:
  - Code referencing `MarkdownToJSX.NestedParser`, `MarkdownToJSX.Parser`, `MarkdownToJSX.Rule`, or `MarkdownToJSX.Rules` will need to be updated
  - The `renderRule` option in `MarkdownToJSX.Options` now uses `ASTRender` instead of `RuleOutput` for the `renderChildren` parameter type
  - `HTMLNode.children` type changed from `ReturnType<MarkdownToJSX.NestedParser>` to `ASTNode[]` (semantically equivalent, but requires updates if using the old type)

- 1ce83eb: Remove `options.namedCodesToUnicode`. The library now encodes the full HTML entity list by default per CommonMark specification requirements.

  **Migration:**

  If you were using `options.namedCodesToUnicode` to add custom entity mappings, you can remove the option entirely as all specified HTML entities are now supported automatically.

- 1ce83eb: Drop support for React versions less than 16
  - Update peer dependency requirement from `>= 0.14.0` to `>= 16.0.0`
  - Remove legacy code that wrapped string children in `<span>` elements for React < 16 compatibility
  - Directly return single children and null without wrapper elements

- 1ce83eb: Upgrade to React 19 types
  - Update to `@types/react@^19.2.2` and `@types/react-dom@^19.2.2`
  - Use `React.JSX.*` namespace instead of `JSX.*` for React 19 compatibility

### Minor Changes

- 1ce83eb: Adopt CommonMark-compliant class naming for code blocks

  Code blocks now use both the `language-` and `lang-` class name prefixes to match the CommonMark specification for compatibility.

  ### Before

  ````md
  ```js
  console.log('hello')
  ```
  ````

  Generated:

  ```html
  <pre><code class="lang-js">console.log('hello');</code></pre>
  ```

  ### After

  ````md
  ```js
  console.log('hello')
  ```
  ````

  Generated:

  ```html
  <pre><code class="language-js lang-js">console.log('hello');</code></pre>
  ```

- 1ce83eb: Separate JSX renderer from compiler and add new entry points

  ## New Features
  - **New `parser` function**: Low-level API that returns AST nodes. Exported from main entry point and all sub-entry points.

    ```tsx
    import { parser } from 'markdown-to-jsx'
    const source = '# Hello world'
    const ast = parser(source)
    ```

  - **New `/react` entry point**: React-specific entry point that exports compiler, Markdown component, parser, types, and utils.

    ```tsx
    import Markdown, { astToJSX, compiler, parser } from 'markdown-to-jsx/react'

    const source = '# Hello world'
    const oneStepJSX = compiler(source)
    const twoStepJSX = astToJSX(parser(source))

    function App() {
      return <Markdown children={source} />
      // or
      // return <Markdown>{source}</Markdown>
    }
    ```

  - **New `/html` entry point**: HTML string output entry point that exports html function, parser, types, and utils.

    ```tsx
    import { astToHTML, compiler, parser } from 'markdown-to-jsx/html'
    const source = '# Hello world'
    const oneStepHTML = compiler(source)
    const twoStepHTML = astToHTML(parser(source))
    ```

  - **New `/markdown` entry point**: Useful for situations where editing of the markdown is desired without resorting to gnarly regex-based parsing.
    ```tsx
    import { astToMarkdown, compiler, parser } from 'markdown-to-jsx/markdown'
    const source = '# Hello world'
    const oneStepMarkdown = compiler(source)
    const twoStepMarkdown = astToMarkdown(parser(source))
    ```

  ## Deprecations

  React code in the main entry point `markdown-to-jsx` is deprecated and will be removed in a future major release. In v10, the main entry point will only export the parser function, the types, and any exposed utility functions.

  ## Migration
  - For React-specific usage, switch imports to `markdown-to-jsx/react`
  - For HTML output, use `markdown-to-jsx/html` entry point
  - Use `parser()` for direct acces to AST

## 8.0.0

### Major Changes

- 450d2bb: Added `ast` option to compiler to expose the parsed AST directly. When `ast: true`, the compiler returns the AST structure (`ASTNode[]`) instead of rendered JSX.

  **Breaking Changes:**
  - The internal type `ParserResult` has been renamed to `ASTNode` for clarity. If you were accessing this type directly (e.g., via module augmentation or type manipulation), you'll need to update references from `MarkdownToJSX.ParserResult` to `MarkdownToJSX.ASTNode`.

  **First time the AST is accessible to users!** This enables:
  - AST manipulation and transformation before rendering
  - Custom rendering logic without parsing
  - Caching parsed AST for performance
  - Linting or validation of markdown structure

  **Usage:**

  ```typescript
  import { compiler } from 'markdown-to-jsx'
  import type { MarkdownToJSX } from 'markdown-to-jsx'

  // Get the AST structure
  const ast: MarkdownToJSX.ASTNode[] = compiler('# Hello world', {
    ast: true,
  })

  // Inspect/modify AST
  console.log(ast) // Array of parsed nodes

  // Render AST to JSX using createRenderer (not implemented yet)
  ```

  The AST format is `MarkdownToJSX.ASTNode[]`. When footnotes are present, the returned value will be an object with `ast` and `footnotes` properties instead of just the AST array.

- 3fa0c22: Refactored inline formatting parsing to eliminate ReDoS vulnerabilities and improve performance. The previous regex-based approach was susceptible to exponential backtracking on certain inputs and had several edge case bugs with nested formatting, escaped characters, and formatting inside links. The new implementation uses a custom iterative scanner that runs in O(n) time and is immune to ReDoS attacks.

  This also consolidates multiple formatting rule types into a single unified rule with boolean flags, reducing code duplication and bundle size. Performance has improved measurably on simple markdown strings:

  **Breaking Changes:**

  The following `RuleType` enum values have been removed and consolidated into a single `RuleType.textFormatted`:
  - `RuleType.textBolded`
  - `RuleType.textEmphasized`
  - `RuleType.textMarked`
  - `RuleType.textStrikethroughed`

  If you're using these rule types directly (e.g., for custom AST processing or overrides), you'll need to update your code to check for `RuleType.textFormatted` instead and inspect the node's boolean flags (`bold`, `italic`, `marked`, `strikethrough`) to determine which formatting is applied.

### Minor Changes

- a421067: fix: overhaul HTML block parsing to eliminate exponential backtracking

  Replaced the complex nested regex `HTML_BLOCK_ELEMENT_R` with an efficient iterative depth-counting algorithm that maintains O(n) complexity. The new implementation uses stateful regex matching with `lastIndex` to avoid exponential backtracking on nested HTML elements while preserving all existing functionality.

  **Performance improvements:**
  - Eliminates O(2^n) worst-case exponential backtracking
  - Linear O(n) time complexity regardless of nesting depth

### Patch Changes

- e6b1e14: Fix renderer crash on extremely deeply nested markdown content

  Previously, rendering markdown with extremely deeply nested content (e.g., thousands of nested bold markers like `****************...text...****************`) would cause a stack overflow crash. The renderer now gracefully handles such edge cases by falling back to plain text rendering instead of crashing.

  **Technical details:**
  - Added render depth tracking to prevent stack overflow
  - Graceful fallback at 2500 levels of nesting (way beyond normal usage)
  - Try/catch safety net as additional protection for unexpected errors
  - Zero performance impact during normal operation
  - Prevents crashes while maintaining O(n) parsing complexity

  This fix ensures stability even with adversarial or malformed inputs while having no impact on normal markdown documents.

- fe95c02: Remove unnecessary wrapper when footnotes are present.

## 7.7.17

### Patch Changes

- acc11ad: Fix null children crashing app in production

  When `null` is passed as children to the `<Markdown>` component, it would previously crash the app in production. This fix handles this case by converting it to empty string.

  ### Usage Example

  Before this fix, the following code would crash in production:

  ```jsx
  <Markdown>{null}</Markdown>
  ```

  After this fix, this case is handled gracefully and renders nothing.

## 7.7.16

### Patch Changes

- 7e487bd: Fix the issue where YAML frontmatter in code blocks doesn't render properly.

  This is done by lowering the parsing priority of Setext headings to match ATX headings; both are now prioritized lower than code blocks.

## 7.7.15

### Patch Changes

- 8e4c270: Mark react as an optional peer dependency as when passing createElement, you don't need React

## 7.7.14

### Patch Changes

- 73d4398: Cut down on unnecessary matching operations by improving qualifiers. Also improved the matching speed of paragraphs, which led to a roughly 2x boost in throughput for larger input strings.

## 7.7.13

### Patch Changes

- da003e4: Fix exponential backtracking issue for unpaired inline delimiter sequences.

## 7.7.12

### Patch Changes

- 4351ef5: Adjust text parsing to not split on double spaces unless followed by a newline.
- 4351ef5: Special case detection of :shortcode: so the text processor doesn't break it into chunks, enables shortcode replacement via renderRule.

## 7.7.11

### Patch Changes

- 4a692dc: Fixes the issue where link text containing multiple nested brackets is not parsed correctly.

  Before: `[title[bracket1][bracket2]](url)` fails to parse as a link
  After: `[title[bracket1][bracket2]](url)` correctly parses as a link

## 7.7.10

### Patch Changes

- bf9dd3d: Unescape content intended for JSX attributes.

## 7.7.9

### Patch Changes

- 95dda3e: Avoid creating unnecessary paragraphs inside of HTML.
- 95dda3e: Fix HTML parser to avoid processing the inside of `<pre>` blocks.

## 7.7.8

### Patch Changes

- db378c7: Implement early short-circuit for rules to avoid expensive throwaway work.
- db378c7: Simpler fix that preserves existing performance.
- db378c7: Various low-hanging minor performance enhancements by doing less work.
- db378c7: Improve compression by inlining static RuleType entries when used in the codebase.

## 7.7.7

### Patch Changes

- 89c87e5: Handle spaces in text as a stop token to improve processing, also adapt paragraph detection to exclude non-atx compliant headings if that option is enabled.

  Fixes #680

## 7.7.6

### Patch Changes

- 654855b: Sanitize more attributes by default to help address XSS vectors.
- 7639c08: Improve splitting of style attributes.

## 7.7.5

### Patch Changes

- 0ddaabb: Remove unescaping of content inside fenced code blocks.
- 07b4280: Better handle exotic backtick scenarios for inline code blocks.
- 0dad192: Fix consecutive marked text.

## 7.7.4

### Patch Changes

- adc08c7: Further optimize the plain text splitting regex.
- c8bc5f3: Remove redundant detectors when processing paragraphs.
- d96a8d8: Replace some regexes with optimized functions to avoid polynomial time scenarios. Also fixes compatibility issues in some older browsers with the `trimEnd` API.
- 7be3d77: Optimize regexes and parsing to do less work.
- cf7693c: Rework inline code syntax handling, handle escaped characters in code blocks correctly so they render without the backslash.

## 7.7.3

### Patch Changes

- 8026103: Handle paragraph splitting better, fixes #641.
- 1ea00bb: Adjust table row parsing to better handle inline syntaxes and improve performance.

## 7.7.2

### Patch Changes

- 52a727c: Use `ReactNode` instead of `ReactChild` for React 19 compatibility
- 4fa87d8: Bump ws from 8.11.0 to 8.18.0

## 7.7.1

### Patch Changes

- 9d42449: Factor out unnecessary element cloning.
- 8920038: Remove use of explicit React.createElement.

## 7.7.0

### Minor Changes

- 20777bf: Add support for GFM alert-style blockquotes.

  ```md
  > [!Note]
  > This is a note-flavored alert blockquote. The "Note" text is injected as a `<header>` by
  > default and the blockquote can be styled via the injected class `markdown-alert-note`
  > for example.
  ```

### Patch Changes

- 5d7900b: Adjust type signature for `<Markdown>` component to allow for easier composition.
- 918b44b: Use newer `React.JSX.*` namespace instead of `JSX.*` for React 19 compatibility.
- 91a5948: Arbitrary HTML no longer punches out pipes when parsing rows. If you absolutely need a pipe character that isn't a table separator, either escape it or enclose it in backticks to trigger inline code handling.
- 23caecb: Drop encountered `ref` attributes when processing inline HTML, React doesn't handle it well.

## 7.6.2

### Patch Changes

- 0274445: Fix false detection of tables in some scenarios.
- 69f815e: Handle `class` attribute from arbitrary HTML properly to avoid React warnings.
- 857809a: Fenced code blocks are now tolerant to a missing closing sequence; this improves use in LLM scenarios where the code block markdown is being streamed into the editor in chunks.

## 7.6.1

### Patch Changes

- 87d8bd3: Handle `class` attribute from arbitrary HTML properly to avoid React warnings.

## 7.6.0

### Minor Changes

- 2281a4d: Add `options.disableAutoLink` to customize bare URL handling behavior.

  By default, bare URLs in the markdown document will be converted into an anchor tag. This behavior can be disabled if desired.

  ```jsx
  <Markdown options={{ disableAutoLink: true }}>
    The URL https://quantizor.dev will not be rendered as an anchor tag.
  </Markdown>

  // or

  compiler(
    'The URL https://quantizor.dev will not be rendered as an anchor tag.',
    { disableAutoLink: true }
  )

  // renders:

  <span>
    The URL https://quantizor.dev will not be rendered as an anchor tag.
  </span>
  ```

### Patch Changes

- fb3d716: Simplify handling of fallback scenario if a link reference is missing its corresponding footnote.

## 7.5.1

### Patch Changes

- b16f668: Fix issue with lookback cache resulting in false detection of lists inside lists in some scenarios
- 58b96d3: fix: handle empty HTML tags more consistently #597

## 7.5.0

### Minor Changes

- 62a16f3: Allow modifying HTML attribute sanitization when `options.sanitizer` is passed by the composer.

  By default a lightweight URL sanitizer function is provided to avoid common attack vectors that might be placed into the `href` of an anchor tag, for example. The sanitizer receives the input, the HTML tag being targeted, and the attribute name. The original function is available as a library export called `sanitizer`.

  This can be overridden and replaced with a custom sanitizer if desired via `options.sanitizer`:

  ```jsx
  // sanitizer in this situation would receive:
  // ('javascript:alert("foo")', 'a', 'href')

  ;<Markdown options={{ sanitizer: (value, tag, attribute) => value }}>
    {`[foo](javascript:alert("foo"))`}
  </Markdown>

  // or

  compiler('[foo](javascript:alert("foo"))', {
    sanitizer: (value, tag, attribute) => value,
  })
  ```

### Patch Changes

- 553a175: Replace RuleType enum with an object

## 7.4.7

### Patch Changes

- 7603248: Fix parsing isolation of individual table cells.
- f9328cc: Improved block html detection regex to handle certain edge cases that cause extreme slowness. Thank you @devbrains-com for the basis for this fix 🤝

## 7.4.6

### Patch Changes

- a9e5276: Browsers assign element with `id` to the global scope using the value as the variable name. E.g.: `<h1 id="analytics">` can be referenced via `window.analytics`.
  This can be a problem when a name conflict happens. For instance, pages that expect `analytics.push()` to be a function will stop working if the an element with an `id` of `analytics` exists in the page.

  In this change, we export the `slugify` function so that users can easily augment it.
  This can be used to avoid variable name conflicts by giving the element a different `id`.

  ```js
  import { slugify } from 'markdown-to-jsx';

  options={{
    slugify: str => {
      let result = slugify(str)

      return result ? '-' + str : result;
    }
  }}
  ```

## 7.4.5

### Patch Changes

- f5a0079: fix: double newline between consecutive blockquote syntax creates separate blockquotes

  Previously, for consecutive blockquotes they were rendered as one:

  **Input**

  ```md
  > Block A.1
  > Block A.2

  > Block B.1
  ```

  **Output**

  ```html
  <blockquote>
    <p>Block A.1</p>
    <p>Block A.2</p>
    <p>Block.B.1</p>
  </blockquote>
  ```

  This is not compliant with the [GFM spec](https://github.github.com/gfm/#block-quotes) which states that consecutive blocks should be created if there is a blank line between them.

## 7.4.4

### Patch Changes

- 8eb8a13: Handle newlines inside of HTML tags themselves (not just nested children.)
- c72dd31: Default `children` to an empty string if no content is passed.
- 4f752c8: Fix handling of deeply-nested HTML in some scenarios.
- 1486aa4: Handle extra brackets in links, thanks @zegl!
- 1486aa4: Allow a newline to appear within inline formatting like bold, emphasis, etc, thanks @austingreco!
- 1486aa4: Starting using changesets
- fd35402: Fix HTML block regex for custom component scenarios where a nested component shares the same prefix as the parent, e.g. Accordion vs AccordionItem.
- 1486aa4: Fix support for multi-line footnotes, thanks @zegl!
