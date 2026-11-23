# Compilers

The six output compilers (react, native, solid, vue, html, markdown) turn the parser's AST into elements or strings. This spec holds the rules they share, one section per compiler, and how their output differs. Sanitization rules and the downstream-renderer reading behind each markdown-output screen live in standards/security.md, and the form each screen writes lives here; the React element-creation cost findings live in standards/performance.md ("React dev-mode floor"); the parity testing rule lives in AGENTS.md ("Compiler parity").

## Shared rules

Purpose: renderer-agnostic AST logic in `lib/src/utils.ts`, called by every compiler that needs it.

### Every compiler

- A link or image target is checked again at emit, so a hand-built AST passed straight to a compiler cannot skip the URL check: the JSX and html compilers run `sanitizeAndEncodeUrlTarget` (the sanitizer, then `encodeUrlTarget` on a target it passes), and markdown runs `isSafeDestination` ("Links, images, references").
- `encodeUrlTarget` percent-encodes control characters, space, `"`, `%`, `<`, `>`, `[`, `\`, `]`, `^`, a backtick, `{`, `|`, `}`, DEL, and non-ASCII, keeps an existing valid `%XX`, copies a lone surrogate unencoded, and encodes a surrogate pair as one code point. A target with none of those returns unchanged.
- Image alt and link and image titles arrive entity-decoded from the parser, and every output shows them as that decoded text: html and markdown write them so no reference decodes a second time, so `![&amp;copy;](x)` shows the literal `&copy;` in every output.
- Reference definitions render nothing; the parser consumed them.
- A heading `id` that is empty or whitespace-only (a heading whose slug is empty, such as `# !!!`) is omitted: react, solid, vue, and html write no `id` attribute. Native writes no heading id and markdown has no id syntax.
- `extractFootnoteEntries` returns `{ identifier, footnote }` for every refs key starting with `^`; compilers render the identifier with the caret sliced off.
- `alertHeaderNode` builds the `<header>` HTML node holding a GFM alert's label, which every compiler renders inside the alert blockquote.
- `validateCompilerArgs` (JSX compilers) throws when the markdown is not a string or `overrides` is not a plain object; callers keep the `NODE_ENV` guard at the call site.

When a node sits deeper than `MAX_RENDER_DEPTH` (lib/src/constants.ts), the compiler writes the node's text in its place, or nothing when the node has no text:

- react, native, solid, vue: as a string
- html: HTML-escaped
- markdown: escaped as markdown text (`compileText`)

- The `renderChildren` a `renderRule` receives continues the current depth in every compiler, so the limit bounds a custom rule's output too.

### Overrides lookup

Purpose: find a document-named tag in `overrides` without letting the document reach a built-in member.

- `overrideValue(source, key)` returns `source[key]`, unless `key` names a member of `Object.prototype` (or `Function.prototype` for a function source) that `source` does not own: a tag named `constructor` or `call` gets nothing, while an inherited key (`Object.create(defaults)`, a class getter, a Proxy) still answers.
- `get(source, path, fallback)` reads a dot path through `overrideValue`; a one-segment path skips `split`.

When the first segment of a `get` path misses, `valueIgnoringCase` (issue #248, HTML tags are case-insensitive) returns:

- a key already all lowercase: nothing more
- a lowercase copy that has a value: that value
- a key starting with an ASCII uppercase letter: the first `for...in` key equal to it ignoring case, scanned rather than indexed so a key added later is seen; candidates must match its length and first letter in either case, or start with a non-ASCII character (the Kelvin sign lowercases to `k`)

- `lowerAsciiIfNeeded` allocates only when the key holds an ASCII uppercase letter, so the common lowercase lookup allocates nothing.
- `getTag` reads a string override or an object's `component`; `getOverrideProps` reads an object's `props`.

### Raw HTML attributes for JSX

- `HTML_TO_JSX_MAP` maps a lowercase HTML attribute to its JSX prop, each prop past `className` and `htmlFor` being its attribute's camel case; React and React Native use it, Solid and Vue use HTML names. The build keeps it out of the markdown bundle (specs/tooling.md, "Build").
- `htmlAttrsToJSXProps` maps through the table, turns an `xlink:`, `xml:`, or `xmlns:` name with a character after its colon camel case there (`xml:lang` to `xmlLang`, `xlink:href` to `xlinkHref`), keeps every other name as written (`a:`, `h:ref`), since a browser lowercases a written name and a camel-cased `h:ref` would reach it as an unscreened `href`, and returns the shared `EMPTY_JSX_PROPS` for no attributes; callers spread it, so the shared object is never mutated.
- `hasContent` is true for a non-empty string, a number, or an element at any array depth; booleans, null, undefined, `''`, and empty arrays hold nothing, as React renders them.
- `childrenAttrContent(value, ownChildren)` returns a registered tag's `children` attribute as text only when it is a string and the element has no content of its own. The caller passes it as a plain child (never parsed as markdown or HTML), drops `children` from props, and reads it only once the written tag is known, since a void tag takes none.
- `isVoidElement` ignores a namespace prefix (`svg:circle` is void); `VOID_ELEMENTS` holds the HTML void elements plus SVG elements written self-closing.
- `rawOpenTagAttrs(openTag, tagLength)` returns the text of a raw self-closing open tag (`_rawOpen`) between the tag name and its ending (` />`, `/>`, or `>`), leading gap included.

### Raw HTML re-parse for JSX

Purpose: the react, native, solid, and vue compilers render a verbatim HTML block by parsing its raw source again into nodes.

Node fields (lib/src/types.ts `HTMLNode`):

- `_rawOuter`: the parser verified the span from the element's own opener through its own closer (or end of input when none exists), so a compiler renders the parsed nodes directly and adds no wrapper.
- `_reparseSource`: the span the JSX compilers re-parse in place of `_rawOuter` (or `_rawBody`): the same screened text with the `children` attribute a registered tag keeps left in, so the re-parse reads that content too. Undefined when the screen cut no such attribute; no output writes it.
- `_emitOwnClose` (issue #862): `_rawBody` holds this element's own closing tag, plus any trailing same-line siblings, as literal text.

Helpers:

- `normalizeJsxReparseText` collapses whitespace between tags and newline runs before a re-parse, and keeps a quoted attribute value byte for byte (it is the element's data). A quote opens a value only right after `=`, as a browser reads it; an unclosed value runs to the end.
- `processVerbatimNode` drops closing-tag nodes, unwraps paragraphs (raw HTML content gets no `<p>`), drops whitespace-only text, and recurses into nested HTML blocks.
- `findOwnCloseInAST` (issue #881) splits a re-parsed AST at the element's own closing tag, found as a direct node or inside a paragraph: content before becomes the element's children, content after becomes siblings (minus closing-tag nodes). With no own closer it returns every node as `beforeClose`. The split runs before `processVerbatimNode` removes closing tags.
- `SHOULD_RENDER_AS_BLOCK_R`: content renders as block when it holds a newline or starts with a list marker plus whitespace, `#`, two spaces, two `-`, `>` plus whitespace, or an opening tag from its block-level tag list.

When `stripVerbatim` walks re-parsed nodes, an HTML block node:

- is the last sibling and its raw text holds real content after its own closing tag (issue #881): stays verbatim, since that bled tail is the only copy of the trailing content, and the next re-parse splits it out; each split shrinks the raw text, so recursion ends
- has later siblings: is cleared, since the siblings already carry the bled content
- has a bled tail of closing tags only (`</dd></dl>`): is cleared
- any other: is cleared, which stops re-parse recursion

- `reparsedToItself(nodes, source)` is true when the last node stayed verbatim over the whole source (`_reparseSource`, else `_rawOuter`), which an opener the tag parser rejects causes (`<div </div>'`); the compiler then writes the source as text instead of re-parsing forever.

### Tagfilter display

Purpose: emit a GFM-tagfiltered tag as inert text (the filter rule: standards/security.md, the paragraph beginning "Dangerous tag names" under "What a browser reads").

- `tagfilterEnabled`: `tagfilter` undefined means on.
- `FilteredTagEmit` is `literal` (the whole inert text) or `sandwich` (an inert opener and closer around normally rendered children, so allowed nested tags stay live).
- `filteredOpenTag` keeps the author's whitespace from `_rawAttrs` when present, else serializes through `formatFilteredTagAttrs` (`true` writes the bare name; undefined, null, and `false` write nothing).
- `assembleFilteredTagChildren` merges adjacent strings, so React server rendering inserts no text-boundary comments.
- `verbatimText` is what a browser shows of a type 1 body set as text: `pre` and `textarea` decode character references; `script` and `style` hold raw text.

When `getFilteredTagEmit` receives a filtered node, it returns:

- an orphan closer: literal `_rawClose` (or `</tag>`) plus any trailing `_rawBody`
- a self-closing tag: literal `_rawOpen`, else a rebuilt `<tag … />`
- a verbatim node with `_rawOuter`: a sandwich when it has children, else literal `_rawOuter`
- a verbatim node without children: literal opener, body, and `_rawClose`; a parsed opener with no closer in the source gets none, since an added `>` would close a tag left open in the body
- children that are all text: one literal, screened by `screenText` for a string output
- any other children: a sandwich
- no children: opener, body, and closer, with no closer added when the body already holds a same-name closing tag

### JSX render loop

- `createRenderer` (react, native, solid, vue) concatenates consecutive string results, splices results with a loop rather than spread, and applies the render depth limit ("Every compiler").
- A file using the classic-runtime custom pragma (react.tsx, solid.tsx, vue.tsx) never names the pragma directive in a later comment or doc comment: Bun's transpiler reads every comment for the directive, and the last mention sets the factory, so `/** the @jsx pragma is set above */` makes the file call `pragma(...)`.

## html

Purpose: write an HTML string by concatenation (`lib/src/html.ts`).

- `escapeHtml` escapes exactly `&`, `<`, `>`, `"`, so one function serves text and attribute positions; it finds the first escapable position with `indexOf` per character, so clean text costs four native searches and no allocation, and returns the same string.
- `escapeHtmlAttr` escapes `<`, `>`, `"` always and `&` only when it does not start a valid reference, so a value holding references round-trips.
- `_Ctx` is one render context per `astToHTML` call, shared by every recursive render; footnote and inline wrapper renders copy it with `refs` emptied and `forceInline: true`.

When `formatAttributes` writes a value, it writes:

- undefined or null: nothing
- `true`: the bare name
- `''`: `name=""`
- a `style` object with at least one non-null entry: `prop-name: value` pairs joined by `; `, camelCase keys turned kebab-case, attribute-escaped
- a string: the attribute-escaped value
- a number: `name="<n>"`, unescaped
- any other value (`false`, a function, a non-style object, an empty style object): nothing, and no separating space

HTML nodes:

- `_withoutChildren`: a `children` attribute on a raw HTML node is content, never an attribute.
- `_selfClosingWithChildren`: a self-closing tag with a string `children` attribute renders as an element with that text (escaped); a void tag writes only its open tag; with `_rawOpen` and no text, the raw open tag is written (through the tagfilter when on); with `_rawOpen` and content, the attribute text comes from the screened raw source (`rawOpenTagAttrs`), prefixed with one space unless it starts with whitespace, with override props appended.
- An empty raw span (an empty pair, or a tag left open) takes a `children` attribute as content and closes, matching the markdown output.
- `_rawOuter`: the source is written verbatim (through the tagfilter when on), with no wrapper.
- A type 1 block (CommonMark HTML block type 1: `pre`, `script`, `style`, `textarea`) gets `_rawClose` or `_rawOuter` from the parser; a hand-built node without either gets the tag's own closer.
- `_emitOwnClose`: the body is sliced at the element's own closing tag and the compiler writes its own `</tag>`.
- A structurally closed element always writes `</tag>`, even when empty; only a `_verbatim` node (raw pass-through, such as an unclosed `<div>`) whose rendered children are whitespace-only omits it.
- With the tagfilter on (where it reads: standards/security.md, the paragraph beginning "Dangerous tag names" under "What a browser reads"), `screenFilteredBody` screens a filtered tag's text body as markup (`stripDangerousHtml(text, true)`) without a second dev warning.

Other nodes:

- Code block: a `lang` becomes `language-<decoded lang>`, appended to any `class`/`className`, written as `class` only. The trailing newline CommonMark keeps is not written, since the scanners store `text` without it (BACKLOG.md, "Known spec deviations").
- Heading: a written `id` ("Every compiler") is applied after override props, so it wins over an override's `id`.
- Link: sanitize, then URL-encode, then HTML-escape the href as decoded text (why: standards/security.md, "URL sanitization").
- Paragraph: trailing spaces before a newline are removed (CommonMark soft breaks) only when the text holds a newline; the pass skips quoted attribute values inside tags.
- `astToHTML` uses the first `refCollection` node's refs merged into `options.refs`, skips footnote, ref, and frontmatter nodes (frontmatter renders when `preserveFrontmatter` is set), and writes footnotes after the content as `<footer>` with one `<div id="<slug>"><identifier>: <inline content></div>` per footnote, identifier without its `^`.

When `astToHTML` chooses a wrapper, it:

- `wrapper: null`: returns content plus footer unwrapped
- `forceWrapper`, `forceInline` with a wrapper set, or more than one non-ref node with a wrapper set: wraps in the string wrapper, else `span` under `forceInline`, else `div`
- `forceInline`, or `forceWrapper` with a caller-set string wrapper, and exactly one paragraph: writes the paragraph's children without `<p>`

- `wrapperProps` values pass through the sanitizer with the wrapper tag and prop name; nullish or rejected values are dropped.
- `compiler` auto-selects a wrapper only when `wrapper` is undefined (`div` for several nodes or `forceWrapper`, `span` for one node under `forceInline`), and sets `wrapperWasAutoSet` so `astToHTML` treats it as not caller-set.

## markdown

Purpose: write markdown that re-parses to the same AST and stays safe when a different renderer reads it (`lib/src/markdown.ts`). Each screen below implements a rule in standards/security.md, "What a browser reads, not what the parser reads"; that section holds the reasons.

### Document

- `astToMarkdown`: when an override renames a tag, the output is written once with the renames (forcing `useReferenceLinks: false`), parsed again with the renamed names registered (`namesAfterRenames`, undefined when nothing renames), and written again with no overrides and no `renderRule`; only that second write emits reference links. `markdown` is an alias kept for compatibility.
- `writeMarkdown` drops top-level footnote, ref, and (with `preserveFrontmatter: false`) frontmatter nodes before rendering, so `renderRule` never sees them. A kept frontmatter node is written first, before reference definitions, since a parser reads frontmatter only at the document start. For the nodes it does render, `renderRule` runs before the default, and `next()` returns the default rendering. Top-level blocks join with a blank line, an empty `renderRule` result included; `state.key` is the index among rendered nodes. With `useReferenceLinks`, collected references follow the content as `[refN]: url "title"`.
- `compileNode`: an unknown node type writes nothing. `CompilerState.inLink` is set while link text is written, because the parser reads no bare URL inside a link.

### Text

- `compileInlineChild` writes a run of adjacent text nodes as one text node (`textRun`) and the run's later nodes as nothing. A backslash escape splits text into nodes (`1\. x` parses to `1`, `.`, ` x`), so only the joined run shows the block starter or bare URL the rules below must escape again (`1\. x`, `www\.a.com`).
- `compileText` escapes, in one pass (`TEXT_ESCAPE_R`), an inline special (backslash, backtick, `*`, `_`, `[`, `]`, `~`) anywhere; a block starter only at a line start (`#`, `>`, `-`, `+`, `=`, `|`, a 1 to 9 digit run before `.` or `)`); `<` before a letter, `/`, `!`, or `?` as `&lt;`; a `&` starting a valid reference as `&amp;`; `](` as `\]\(`; and a run of exactly two `=` followed by a non-space character, which could open a highlight, as `\==` (`&#61;=` in element text).
- `TEXT_NEEDS_ESCAPE_R` matches wherever `compileText` changes something and on any `&`, so most text nodes skip the escape pass. Its anchored alternatives go last, since a leading anchored alternative costs the regex engines their first-character scan.
- A bare URL start a later node can complete (`www.`, `http(s)://`, `ftp://`, `x@y.z`, `BARE_URL_START_R`) gets a backslash before its last character, and a lone `@` text node is written `\@`, except inside a link and under `disableAutoLink`.
- A text run that is exactly `<` writes `&lt;`, since the escape pass cannot see what the node after it writes (`\<*a*` writes `&lt;*a*`). A text node starting with `(` writes `\(`, and a leading U+FEFF writes `&#xFEFF;`.
- `compileElementText` writes the content of an element the output opens with every escapable character as a numeric entity (`&lt;`, `&amp;`), the one form inert both in a raw HTML block and in a paragraph.
- `compileInlineChild`: a text node starting with `:` right after a footnote reference gets a backslash.
- A `=` at a text run's edge would join a `==` the output writes beside it into a longer run, which opens or closes nothing, so `escapeEqAt` backslash-escapes, when no odd run of backslashes already does: the run's last `=` before a highlight node, the first of a final `==` before any other inline node (`===*x==*`), and the last `=` of a highlight's content (`==a\===`). A leading `=` needs no rule, since the line-start rule above escapes it.
- `underscoreAdjacentEmphasis`: adjacent `*` emphasis runs would fuse, so a chain of any number of adjacent runs alternates `*` and `_`, each run placed so it re-parses as written (`_` cannot open or close inside a word).

### Headings

When `compileHeading` writes a heading, it writes:

- `useSetextHeaders` and level 1 or 2: the content over a `===` or `---` underline as long as the content
- `enforceAtxHeadings === false`: `#` marks with no space after them
- otherwise: `#` marks, a space, the content

- `LINE_BREAK_R` runs only when `indexOf('\n')` finds a newline; a line break and its surrounding spaces become one space.
- `escapeClosingSequence` backslash-escapes a final `#` run after a space (or at the start), ignoring trailing spaces and tabs, since a parser drops it as a closing sequence.

### Code

- `codeTextIsUnsafe` decides when a code body or fence info string cannot be written as code markup; a body with neither `<` nor `]` is never unsafe, and a tagfiltered tag counts only under `disableParsingRawHTML` (any truthy value, as options parsed from JSON give), where code is the one way the tag reaches another renderer.
- `CODE_BLOCK_MARKUP_R` lists what opens markup in a body read as raw HTML or markdown; `CODE_SPAN_MARKUP_R` adds `:`, `.`, `@`, since a span written as `<code>` is still inline markdown. `encodeCodeText` writes them as entities.
- `compileCodeBlock`: an unsafe body is written as `<pre><code>` with entities, with `class="language-x"` only when the language matches `PLAIN_LANG_R`. Otherwise the fence is backticks, or tildes when the info string holds a backtick, and is longer than any run of its character in the content (at least 3).
- `compileCodeInline`: the delimiter is longer than the longest backtick run inside; one space pads both sides when the content starts or ends with a backtick; an unsafe body is written as `<code>` with entities.

When `compileTextFormatted` writes a node, it writes:

- `em` or `i`: `*`
- `strong` or `b`: `**`
- `del` or `s`: `~~`
- `mark`: `==`
- `code`: an inline code span
- any other tag: the bare content
- unless the node is empty (only a hand-built AST): nothing, except `del`, which writes `\~\~\~\~` so neighbors do not join

### Links, images, references

- `escapeLinkTitle` escapes the backslash and quote for a `"…"` title and writes `<` before markup, `[`, `]` as entities.
- `writtenLabel` writes `<`, `[`, `(` in a reference or footnote name as entities, identically in the reference and the definition so they still match.
- `isSafeDestination` and `destinationVerdict` decode a destination as a renderer would (`completeNumericReference` adds the semicolon and drops leading zeros, entities decode, backslash escapes drop), then take the URL verdict; a raw destination holding a `DESTINATION_SPLIT_R` character is also unsafe when the decoded form names a blocked scheme (`urlNamesBlockedScheme`).
- `writeDestination` sends a destination holding whitespace, a control character, or an angle bracket through `encodeUrlTarget` (`UNREADABLE_DESTINATION_R`); wraps a destination with an unbalanced parenthesis (`hasUnbalancedParen`) in `<…>` with backslashes doubled; otherwise doubles only escaping backslashes (`ESCAPING_BACKSLASH_R`). `isECMAScriptSpace` is the wider whitespace set skipped before a destination and at the end of a raw string.
- `compileLink` screens an autolink's target here, since the parser keeps its scheme; a rejected destination writes `()` and drops the title. Under `useReferenceLinks` each link gets one `refN`.
- `compileImage` backslash-escapes `[`, `]`, `\` in alt (`ALT_BRACKET_OR_BACKSLASH_R`), writes `<` before markup as `&lt;` and `"` as `&quot;`; a destination the parser rejected stays `![alt]()`, so a leftover title cannot become a live destination.
- `compileReferenceCollection` writes one `[label]: destination "title"` per line, an unsafe destination as `<>`, and footnote definitions through `compileFootnoteDefinition` then `screenFootnoteDestination`.
- `compileFootnoteDefinition` writes text with no `<` and no unsafe link byte-exact, and sends anything else through the parser with a copy of the refs (the inline pass registers definitions it finds).
- `screenFootnoteDestination` puts `<!---->` (`FOOTNOTE_DESTINATION_BREAK`) before a body whose first word is unsafe as a link destination; an undecodable word (`100%`) names no scheme and stays.

### Raw HTML

- `RAW_SCREEN_TRIGGER_R` matches what any step of `screenRawLinks` acts on; a string with none returns unchanged.
- `screenRawLinks` runs, in order: line separators (`screenLineSeparators`), processing-instruction and CDATA bodies (`screenMarkupBody`), unended openers (`screenUnendedOpeners`), the link and autolink scan, then image alts (`screenRawImageAlts`). An unsafe inline link's `]` becomes `&#93;` and an unsafe autolink's `<` becomes `&lt;`; a `](` or `]:` ending the content gets the same `&#93;`, and a `<` left in a neutralized destination becomes `&lt;`.
- `screenLineSeparators` writes U+2028 or U+2029 as a numeric entity when at most three spaces separate it from a `>`.
- `screenRawImageAlts` writes `![` as `!&#91;` when a quote and then a `]` follow it before the next blank line.
- `autolinkEnd` returns the index of the `>` closing an autolink whose `<` is at `start`, the index of a second `<` (which ends the candidate), or -1. The scheme is a letter then 1 to 31 of letters, digits, `+`, `.`, `-`, then `:`; the body ends at a space or control character, `<`, or `>`, and U+007F stays in it.
- `linkDestinationStart` finds where the destination after `](` or `]:` starts (past ECMAScript whitespace and one `<`); `linkDestinationEnd` runs to whitespace, `)`, `>`, `]`, or the end.
- `type1NameEnd` matches a `TYPE1_TAG_NAMES` name not followed by a word character. `rawModeOpenerEnd` matches an opener a renderer stays inside (type 1 tag, `<?`, `<!--`, `<![CDATA[`, `<!X`) in any ASCII case; `RAW_MODE_MARKUP_CLOSER` gives each closer.
- `screenMarkupBody` writes `<` before an ASCII letter as `&lt;` between a processing instruction's or CDATA section's first `>` and its terminator (`?>`, `]]>`).
- `screenUnendedOpeners` writes `&lt;` for an opener a renderer stays inside (`rawModeOpenerEnd`) that starts a line after the first, past leading spaces and tabs, with no closer after it.
- `screenMarkupBody` stops at the first terminator it does not find, and `isUnendedOpener` caches each closer's last index (`lastCloser`), so both stay linear; `screenRawImageAlts` resumes each search where the last ended.
- `openTagOnOneLine` folds line breaks inside a raw element's opening tag (up to the first unquoted `>`): one between attributes becomes a space, one in a quoted value `&#10;`, one in a `{…}` value a space too.
- `compileHtmlBlock`: an orphan closer re-emits bare with its trailing `_rawBody`; a `children` attribute is content for an element with none of its own and is never written as an attribute; `_rawOuter` is written without an added wrapper, except for an empty pair taking content; the raw attribute string wins over parsed `attrs` (parsed attrs lose formatting: a style object prints `[object Object]`), with override props appended so they win; a verbatim span appends body and closer after the rebuilt opener; the `text` field holds inner content only, so a non-void element appends its closer; children go on their own lines, and empty children write nothing.
- `compileHtmlSelfClosing` writes an orphan closer as `_rawClose`, a `children` attribute as content, and a void tag's open tag only.
- `compileHtmlComment` writes a raw node (`raw: true`, whose `text` holds its delimiters: a block-level comment, or a processing instruction, CDATA section, or declaration, which the parser also emits as `htmlComment` nodes) through `screenRawLinks`; an inline comment's text is screened the same way and wrapped in `<!--` and `-->`, or `>` alone under `_endsWithGT`.
- `compileFrontmatter` writes the stored text, which already holds its `---` delimiters.
- `compileAttributes` writes `className` as `class`, a `true` boolean as its bare name, `false` as nothing, and other values quoted with `"` as `&quot;`.

### Blocks

- `compileBlockQuote` renders children, then prefixes each line with `> ` (a bare `>` on blank lines); an alert writes its `> [!ALERT]` line first.
- `isLooseList`: a list whose items kept paragraph wrappers is loose and separates items with a blank line. Ordered lists number from `start` (default 1) and indent continuation by the marker width; unordered lists use `- ` and a two-space indent.
- `compileListItemChildren`: two block siblings get a blank line, an inline and block boundary one line break, inline runs stay joined; a block after raw HTML (a node whose output starts with `<`) gets a blank line.
- `compileTable` always writes outer pipes (one column would otherwise re-parse as a setext heading) and escapes only a bare pipe, keeping an escape pair whole (`CELL_ESCAPE_PAIR_OR_PIPE_R`). The separator row is `:---`, `---:`, `:---:`, or `---`; the column count is `align.length` when present, else the header length.

## react

Purpose: build React elements (`lib/src/react.tsx`).

- `declare namespace h` types every intrinsic element through React's JSX definitions: TypeScript resolves the JSX namespace from the factory (`h.JSX`) before the global one, which `@types/react` 19 no longer declares. It emits nothing.
- `REACT_ELEMENT_TYPE` is the `$$typeof` symbol read from the installed runtime's own element (`react.element` in React 18, `react.transitional.element` in 19), narrowed with `supportsRawElements` (lib/src/runtime-probe.ts, kept outside react.tsx so react.spec.tsx can call it without widening the entry's exports). A probe that throws leaves it null.
- `supportsRawElements` accepts an object whose `$$typeof` is a symbol and that has no own `constructor`: Preact (and preact/compat, which copies React's `$$typeof`) stamps every vnode with one, React never does.

When `createRawElement` builds an element, it:

- `REACT_ELEMENT_TYPE` is set: hand-builds the element object, skipping `createElement`'s validation, key and ref extraction, defaultProps merge, and dev freezing, and always includes `_store`, `_debugStack`, `_debugTask` (React's dev reconciler throws without `_store`; the RSC Flight server warns when the debug fields are undefined, and `null` satisfies its `!== undefined` check), since the library build strips dev branches
- `REACT_ELEMENT_TYPE` is null (Preact behind a `react` alias): delegates to the runtime's `createElement`, with a props object the caller owns

- `h` (custom pragma factory) receives JSX-ready props; with overrides it merges `override.props`, combines class names with `cx`, and drops children on a void tag, since an override can make a tag void and React throws on its children. Without a custom `createElement` it goes through `createRawElement`.
- `hJsx` (HTML block and self-closing cases only) drops handler source and runs `_compilePropsJsx` on props before `h`; other elements never hold embedded JSX strings, so they skip that loop. A `children` string becomes the child when the element has no content, unless `dangerouslySetInnerHTML` is set.
- `keyedJsxProps` builds `{ key, ...attrs }` without spread syntax, since the spread helper runs even for no attributes, the common case.
- `h` without a custom `createElement` copies props to a new object without `key` rather than deleting `key`, since V8 turns an object that lost a property into a slow dictionary, which slows building every element and every later read of its props.
- `MarkdownContext` is undefined where `createContext` is absent (React Server Components); `Markdown` then calls `compiler` with no hooks. Otherwise it merges context options, options, and rest props (`useShallowStable`) into `wrapperProps`. The branch is constant per module, so hook order is stable.
- `useShallowStable` (`lib/src/shallow-stable.ts`, shared with React Native) returns the previous object when the new rest props are shallow-equal (same key count, `Object.is` per value), since a fresh object per render would re-parse on every parent render.

When `render` meets an HTML block, it:

- the tag is tagfiltered and the filter is on: escapes it into a `span` (React text also escapes `>`)
- has children, the raw source does not open with its own tag, the filter is on, and the source holds a filtered tag: renders the children, so each child gets its own filter check
- is type 1: renders verbatim inside its own element, the body being the `text` field when `_rawOuter` is set (no closer found) and `_rawBody` otherwise; a `textarea` takes the decoded body as `defaultValue` through `h` (React rejects inner HTML and children on it, and `_compilePropsJsx` would read a markup-holding string as JSX); any other body holding something tag-like (`<[a-z][^>]{0,100}>`) goes in via `dangerouslySetInnerHTML`, else as text
- is verbatim and holds a type 1 tag: injects the raw source with `dangerouslySetInnerHTML`
- is verbatim and re-parses to only its own tag (optionally an empty body): renders an empty element, or the parser's children
- is any other verbatim block: re-parses `_reparseSource`, else the raw source, with `tagfilter: true`, runs `stripVerbatim`, splits at its own closer (`findOwnCloseInAST`), and returns the element and trailing siblings in one keyed Fragment; with `_rawOuter` the parsed nodes render directly

- `render` htmlSelfClosing escapes a filtered tag into a `span` when the filter is on.
- Code block: the entity-decoded language becomes `className` `language-<lang> lang-<lang>`.
- `createRenderer` accepts one node or a list (the public `ASTRender` contract).

## solid

Purpose: build Solid elements (`lib/src/solid.tsx`).

- `createSolidElement` is the module-level element helper used by the compiler's `h` and by `MarkdownProvider` (which calls `h` directly). Without a DOM (tests, SSR) it returns `{ t: tag, p: props }` or calls a function component, attaching children as `props.children` (one bare, several as an array); with a DOM it calls `solid-js/h` and invokes the returned factory.
- `isComponent`: a function, or an object with `render`. `toArray` normalizes children, since Solid's `h` takes them as rest arguments.
- `h` (compiler factory): a `children` string attribute is the text of an element with no content of its own (which also keeps it out of the HTML-compile loop); a void tag takes none. Only props that may hold HTML (a string starting with `<` that looks like a block start, an uppercase tag, or a parseable tag) compile through the compiler with `wrapper: null`; `innerHTML` is excluded, being the compiler's own screened markup (an element there would reach the page as `[object Object]`), and moves to the final props only when overrides set no `innerHTML`. A `true` `on*` prop is dropped on a string tag, since Solid passes it to `addEventListener`, which throws on anything but a function. Classes combine with `cx`.
- HTML blocks: a tagfiltered tag or self-closing tag escapes into a `span`; a type 1 block renders as react's does, with `innerHTML` in place of `dangerouslySetInnerHTML`; other verbatim blocks re-parse (`_reparseSource` first), split at the own closer, and render `_rawOuter` nodes directly.
- `createRenderer` copies the state per node, carrying `renderDepth`.

## vue

Purpose: build Vue VNodes (`lib/src/vue.tsx`).

- `renderers` is a table keyed by `RuleType`, one function per node type sharing a `RenderContext`; a type with no entry renders null.
- `normalizeChildren` turns a render result (array, single child, or null) into an array.
- `isVueComponent`: a function, or an object with `render` or `setup`. `MarkdownOptionsKey` is the injection key sharing options across `Markdown` components.
- `hHelper` (the factory the renderers call; Vue's own `h` is the pragma factory): a `children` string is the text (vnode child, or a component's default slot) of an element with no content of its own, since Vue writes a `children` prop as an attribute; a void tag takes none. HTML-shaped props compile as in solid, `innerHTML` excluded. A component receives children as its `default` slot function. With no overrides, merged class, or `innerHTML`, the prop merge is skipped. Overrides count only when `Object.keys` finds an own key, so an inherited-only map (`Object.create(card)`) applies no override, where react honors it.
- HTML blocks: a type 1 block renders as react's does, with `innerHTML`; a non-type-1 block holding `<pre` injects its raw source through `innerHTML`; other verbatim blocks always re-parse (`_reparseSource` first), clear verbatim, split at the own closer, and render `_rawOuter` nodes directly.

## native

Purpose: build React Native elements (`lib/src/native.tsx`). React Native has no HTML tags, no generic monospace family on iOS, no checkbox, and no CSS cascade, and it forbids a bare string in a View and a View in a Text (Android); the compiler maps each node to a Text-host or View-host element, wraps stray strings in Text, and precomputes styles per compile.

### Styles

- `DEFAULT_STYLES` sits under the caller's `styles`, key by key (caller wins per property; a caller key with no default passes through), so default output has a readable hierarchy with no configuration. Layout-only defaults (list and task rows) are separate constants. The README's React Native section shows a fully overridden example.
- `DEFAULT_STYLES.text` applies under all text, so list runs, bullets, and table cells share one size with paragraphs (a bullet then sits on the line); paragraphs set their own line height on top.
- `DEFAULT_STYLES.codeInline` has no background, which React Native draws as a blocky inline rectangle; the monospace face marks code.
- `DEFAULT_STYLES.checkmark` lifts the glyph with a transform, which leaves flex centering alone where a margin would be absorbed.
- `MONOSPACE_FONT`: `Menlo` on iOS, `monospace` elsewhere.
- `LIST_ITEM_CONTENT_STYLE` is `flex: 1`, so text beside the bullet wraps and a block child (a flex table) gets a bounded width.
- `GFM_TASK_ITEM_ROW_STYLE` top-aligns, so the checkbox sits with a multi-line label's first line; `CHECKBOX_STYLE` (an outlined box that fills with an accent and a checkmark when done) then uses `marginTop` to center against that line's text, offset by the label's ink centroid as measured on device.
- `TABLE_ROW_FLEX` is the row layout; the checked accent, checkmark, grid dividers, and bold header run are `DEFAULT_STYLES` keys (`gfmTaskChecked`, `checkmark`, `tableCellDivider`, `tableRowDivider`, `tableHeaderText`).
- `mergeStyle` returns `[default, user]` when both exist (a later array entry wins), else whichever is set. `withTextBase` puts `styles.text` under a Text element's own style, returns the style unchanged with no base, and keeps the result a flat array. `withoutTrailingMargin` zeroes the last block child's `marginBottom` in a blockquote, since React Native keeps a last child's margin inside the border box.
- `ALIGN_CENTER`, `ALIGN_LEFT`, `ALIGN_RIGHT` are shared per table; `alignItemsFor` maps no alignment to no style, `center` and `right` to their values, anything else to `flex-start`.
- `resolveStyles` merges defaults under the caller's styles; with no styles, or an empty styles object, it returns `DEFAULT_STYLES` itself.
- `StyledCache` bundles the resolved stylesheet with every style derived from it (text-base merges per element kind, list and task row layouts, checkbox variants, `formatted`, a lazy per-tag cache for emphasis tags, `headingInline` indexed by level), all pure functions of the resolved styles, so each per-node allocation becomes a lookup. `DefaultStyledCache` is a lazy singleton used whenever `styles` is undefined or has no keys (a direct `compiler` or `astToNative` call without styles or with `styles: {}`, and a `Markdown` element with no styles from context or options).
- `styles.text` is the universal base: its color reaches every Text, and its `fontSize` shows where an element sets none (list item, table cell), while a heading or paragraph keeps its own size.
- `CompileContext` carries everything a compile shares (element factory, options, sanitizer, slugger, refs, style cache) in one pointer; `overrides` is undefined when empty, so per-node lookups short-circuit.

### Inline safety and hosts

- `isInlineSafe`: a string, or a Text-host element whose descendants are all inline-safe. Line break, inline code, footnote reference, HTML comment, ref, and text are inline-safe; links and formatted text are when all children are; a self-closing tag is unless it is `img` or View-mapped; an HTML block is unless its tag maps to a View (recursion makes a Text-mapped tag wrapping an image a block). Everything else is block-level.
- `singleTextChild` returns a sole text node's string directly, skipping the renderer round trip, unless a `renderRule` exists (that contract passes every node through it).
- `renderViewChildren` groups consecutive inline-safe nodes into one Text and renders every other node as its own child in a keyed Fragment (the key belongs on one sibling, and `output([node])` may return an array), so no bare string sits in a View (issue #884). An optional `runStyle` keeps a container's text style on the runs; every run in a call shares one merged style. `state.inlineSafe` is set while a run renders and restored after.

When `renderInlineHost` renders a paragraph, heading, emphasis, or Text-mapped HTML tag, it:

- all children are inline-safe, or an ancestor already marked the subtree inline-safe: renders the given Text-host tag
- a child is an image or view: renders a View that groups inline runs into Text and lays blocks out as siblings, forwarding every prop and carrying the text style onto the runs
- unless the tag is overridden: emits the override as is, since a custom component can hold any child

- The precomputed inline style is swapped into the per-node props literal; an identity guard keeps a `style` key out when nothing merges.
- `VIEW_TAGS` (a Set) names the HTML containers that need View layout, plus `input`. It differs on purpose from `BLOCK_TAGS` in parse.ts, which drives block parsing and includes document and metadata tags that must never become Views.
- `mapsToNativeView`: View-mapped tags and type 1 tags map to a View. `mapHtmlTagToNativeComponent` maps `img` to `Image`, View-mapped tags to `View`, everything else to `Text`, memoized process-wide in `NATIVE_COMPONENT_CACHE` (capped at 1000 entries against input that mints unique tag spellings, then recomputed).
- `getTag` resolves an override component (a function, or an object with `render`), else `<tag>.component`, else the tag string.
- `htmlNodeProps` keys an HTML node's attributes without handler source. `emitHtmlElement` groups a View-mapped tag's inline children into a Text, and sends a Text-mapped tag through `renderInlineHost`. `withChildrenAttr` turns a `children` string into one text node when the element has no nodes, and removes the prop either way.
- `h` merges `override.props.style` with the renderer's style through `mergeStyle`, so the override wins, and drops children on a void tag when overrides exist (an Image cannot hold children).

### Nodes

- Frontmatter (with `preserveFrontmatter`) renders as `code` (Text) inline and, in block mode, as a code block does: `pre` (View) holding `code` (Text), since a View cannot sit in an inline Text wrapper and a bare string cannot sit in a View.
- Task item: an overridden `input` receives `type`, `checked`, `readOnly`, and a `[x]`/`[ ]` text child; otherwise a drawn checkbox (a View with `✓` Text when done) replaces those props, which a View would warn about.
- HTML block, type 1: the inner text renders in a monospace Text (`codeText`) inside the View (issue #884), from `text` when `_rawOuter` is set, else `_rawBody`. A raw span holding `<pre` renders as one Text with `preText`. Other blocks re-parse (`_reparseSource` first) and split at the own closer (issue #881); content that re-parses to its own source returns as the plain string.
- HTML block keys: `_rawOuter` nodes render from key 0, so one result is re-keyed to this node's index and several go in one keyed Fragment; trailing siblings sharing a Fragment with the element are keyed `after-<index>`.
- Link: inline content stays a Text; content holding a block becomes a `Pressable` View with the same handlers. `onLinkPress` falls back to `Linking.openURL`; a long press exists only with `onLinkLongPress`.
- Table: the header row carries the bottom border, each cell but the last a right border, each body row but the last a bottom border, and header runs are bold, so with `flex: 1` cells the grid never doubles a line.
- Lists: one props object serves every bullet in a list (`createElement` never mutates its config). A task item's marker replaces the bullet, its row top-aligns the checkbox, `styles.listItem` still wins through `mergeStyle`, and the whitespace text node after the marker is dropped so the checkbox margin is the only gap. Ordered lists number from `start`.
- `toSuperscript` turns digits into Unicode superscript glyphs so a numeric footnote marker is raised like `<sup>` (React Native ignores `verticalAlign` and transforms on inline text); other identifiers pass through.
- Footnotes: `styles.text` reaches the footer; the leading `refCollection` node is ignored for the inline check; an all-inline note flows in one Text after its identifier, and a note holding a block stacks the identifier above grouped children.
- `createRenderer` satisfies `ASTRender` itself, so without a `renderRule` it calls `render` with no per-node closures.

When `astToNative` returns, it returns:

- `wrapper: null`: the array of results
- one result that is an element: that element, unwrapped
- one result that is a string: the string in a Text
- several results: the wrapper (`View`, `Text` under `forceInline`, or a custom component), with every stray top-level string in a View wrapper wrapped in Text

## Renderer parity

| Compiler | Element assembly | Class prop | Raw markup prop | Heading id | Wrapper default | `renderRule` `next()` returns |
| --- | --- | --- | --- | --- | --- | --- |
| react | JSX through `h`; `createRawElement` without a custom `createElement`; else the caller's `createElement` | `className` | `dangerouslySetInnerHTML` | `node.id` | `div` (`span` inline), key `outer`, one child returned bare | React node |
| native | `React.createElement` or `options.createElement` through `h`, tags mapped to `View`, `Text`, `Image` | none (`styles` option) | none (Text) | none | `View` (`Text` inline) | React node |
| solid | `h` then `createSolidElement` | `class` (`cx`) | `innerHTML` | `node.id` | `div` (`span` inline) | `JSX.Element \| string \| null` |
| vue | Vue `h` through `hHelper`, `key` in props | `class` (plain concatenation with the override's class) | `innerHTML` | `node.id` | `div` (`span` inline) | `VueChild[] \| VueChild \| null` |
| html | string concatenation | `class` | none (string) | `id` | `div` (`span` inline), only when requested or several nodes | string |
| markdown | string concatenation | `class` in raw HTML | none (string) | discarded (no id syntax) | none | string |

- Footnotes: react, solid, vue, and html write a footer with one `div` per footnote, id from the slugified identifier, text `<identifier>: `; native writes a footer of Text runs (its footnote references use `toSuperscript`); markdown writes definitions.
- `wrapper: null`: react returns the array; solid and vue return null for empty output, one node bare, several as an array (html and native: their sections).
- solid has no key prop; vue passes ordered-list `start` even when 1.
- Rest props on the component: react and vue pass them to the wrapper; solid reads them from `props` at memo time with `children` and `options` removed.
- native cannot express `<sup>` (Unicode superscript), a checkbox input (a drawn box), or margin collapsing (`withoutTrailingMargin`); its links carry `onPress` and `onLongPress`, and images carry `source: { uri }` and `accessibilityLabel`.
- html and markdown apply overrides as tag renames plus props; `HTMLOptions` excludes `createElement` and redefines `wrapperProps` with string, number, and boolean values; markdown ignores `createElement`, `wrapper`, `wrapperProps`, and `forceWrapper`.
