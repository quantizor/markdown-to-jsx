# markdown-to-jsx

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
