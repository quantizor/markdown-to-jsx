# Parser

The parser (`lib/src/parse.ts`, entry `parseMarkdown`) turns markdown text into the AST every compiler reads. This spec holds the parser's rules and the shared utilities in `lib/src/utils.ts` and `lib/src/constants.ts` that the parser relies on. Sanitization rules live in standards/security.md; hot-path technique lives in standards/performance.md.

## Block and inline mechanisms

### Scanning model

Purpose: one pass of character-code scans, with no regex in a scan loop (the regexes left are linear attribute and entity filters such as `STYLE_XSS_R` and `NUMERIC_ENTITY_R`).

Constants: `CF`, a 128-entry `Uint16Array` of bit flags from the const enum `F` (inlined by the bundler) read by `isCF`, `skipMask`, and `scanUntil`.

- `F.WS`: space, tab
- `F.WSNL`: space, tab, LF
- `F.SPNL`: space, LF
- `F.ASCII_WS`: space, tab, LF, CR, form feed
- `F.ALPHA`, `F.DIGIT`, `F.HEX`: ASCII letters, digits, hex digits
- `F.TAG`: tag-name continuation (letters, digits, `-`)
- `F.ATTR`: attribute-name continuation (letters, digits, `_`, `.`, `:`, `-`)
- `F.EMAIL`: email local-part characters
- `F.INLINE`: characters that start an inline construct
- `F.URL_TRIM`: punctuation trimmed from the end of a bare URL
- `F.UNQUOTED_STOP`: characters that end an unquoted attribute value
- `F.URL_STOP`: characters that end a bare URL or autolink
- `F.SLASH_GT`, `F.EQ_GT`: `/` and `>`; `=` and `>`

Rules:

- A scanner returns its end position through the module variable `_end` (`ret(end, node)`) instead of allocating a result object. Arguments evaluate before the call, so `_end` is set after any child parse inside `node` has overwritten it: a scanner builds its child nodes in the argument list of `ret`, never before computing `end`.
- `_doc` is one lazily allocated per-document cache; nested blocks save and restore it.
- `indent`, `dedentLine`, and `expandTabs` are the one tab-aware helper set every block container uses.
- `expandTabs` turns a tab into spaces only inside a line's container prefix: the run of spaces, tabs, `>`, and list-marker-shaped tokens followed by whitespace or the line end, cut short by four columns of indent (the rest is indented code). A tab after that prefix is content and stays a tab (CommonMark 0.31.2, tabs): `> a\tb` holds `a\tb`. The prefix is read from text alone, so a quoted line inside a fence or a paragraph that starts marker-shaped (`> -\tb`) still loses its tab (BACKLOG.md, "Known spec deviations").
- Where CommonMark says "spaces or tabs" (around a link destination and title, before a closing heading sequence, a paragraph line's leading whitespace), the scan tests `F.WS` or `F.WSNL`, never U+0020 alone.
- A line ending inside inline text trims trailing spaces and tabs (`F.WS`), as cmark and md4c do (md4c regression #250); CommonMark's soft line break text names only spaces, and commonmark.js and markdown-it keep a trailing tab. A hard line break still needs two U+0020 right before the line ending: `foo  \t\nbar` is a soft break.
- Line-break-aware inline text (`State._breaks`) is paragraph and setext heading content plus every top-level inline parse (`State.inline`: the JSX compilers' `forceInline` input and each compiler's footnote bodies); there a two-space or backslash line ending is a hard break and a soft one drops the next line's leading whitespace.
- The `breaks` option turns every soft line break in line-break-aware inline text into a `breakLine` node, after the same whitespace trim, so all six compilers render it as their hard break with no per-compiler code; the text holds no `\n` there. Raw inline HTML children parse with `_breaks` off and keep their line endings.
- Each node type builds one shape (standards/performance.md, "AST node representation"), except `htmlBlock`: `makeHtmlNode` takes an `H` mask (a const enum) naming the optional fields a node carries (attributes, body, closer, outer span, own-closer emission, verbatim, closing tag), so an `htmlBlock` has one shape and key order per mask (a single-shape experiment is open in BACKLOG.md, "Performance"). A closing-tag node lists `_rawClose` before `_rawBody`; every other node lists `_rawBody` first. Key order shows in AST snapshots.
- Streaming-edge trimming is cold code kept outside the hot loops.

### Work budgets

Purpose: keep adversarial input linear (standards/performance.md, "Bounded linear time").

- `MAX_INLINE_DEPTH` bounds inline nesting across a parse (`_globalInlineDepth`); emphasis nested past it stays literal.
- `MAX_PARSE_DEPTH` bounds block container nesting (`State._depth`); a container's content past it becomes one text node.
- A container passes its content to the next level as a new string, so a one-line nest of quote or list markers (`> > > a`, `- - - a`) copies the rest of its line once per level and its work is quadratic in nesting depth, capped by `MAX_PARSE_DEPTH` (open in BACKLOG.md, "Performance").
- `scanList` and `scanBlockquote` compute the open-block state (`openAfter`) only when a line without its marker asks whether it continues a paragraph, folding the lines read since the last such question.
- `_tagSkipBudget` (`input.length * 16 + TAG_SKIP_BUDGET_FLOOR`, reset per `parseMarkdown`) bounds the total bytes a bracket walk reads through tags.
- `findClosingTag` searches for a nested opener only up to the next closer and resumes where its last empty search ended (`openSearched`), since an opener after the closer cannot change the match; a search to `limit` for each tag is quadratic in the number of distinct tag names.
- The inline text scan stops at an `h`, `w`, or `f` only when the next character is `t`, `w`, or `t` (the bare URL start test), so prose stays in the scan loop.
- `_scanGeneration` stamps scan memos (`_urlFailGen`, `_linkNoCloseGen`), so a failed bare-URL or link search answers later candidates in the same walk without rescanning. A memo answer must be right for every later reader, not only the walk that recorded it: in `[[foo](/url)` the outer `[` has no match while the inner one does.
- Every scanner reachable from the inline dispatch has a growth-exponent case in scripts/scaling-smoke.ts (rule in AGENTS.md; method in specs/tooling.md, "Scaling smoke").

### Line classification and lazy continuation

Purpose: one classifier, `lineStartsBlock`, decides whether a line starts a block that ends the current construct.

When `lineStartsBlock` runs, its `LineBlockMode` names the question:

- `ParagraphEnd`: does the line start a block that may interrupt a paragraph
- `QuoteLazyLine`: does the line end a blockquote's lazy paragraph
- `ListLazyLine`: does the line end a list item's lazy paragraph
- `TableRowEnd`: does the line end a table body (a `<` never ends one)

Constants: `OpenState` and `OpenEncoding` (const enums, inlined by the bundler). `openAfter` returns what is open at the end of a container's content after one more line:

- `OpenState.None`, `Paragraph`, `HtmlBlockType6Or7` (ends at a blank line), `Table`
- raw HTML of CommonMark type 1 to 5: `OpenState.RawHtmlBase + type`
- an open fence: `-(fenceLength * OpenEncoding.FenceLengthUnit + fenceChar)`, decoded with `FenceLengthShift` and `FenceCharMask`

`openAfter` also keeps the containers open inside the content, innermost last (`_containers`: `0` for a blockquote, an item's content width otherwise). A line first matches them in order: a blockquote by a `>` after at most 3 spaces, an item by a blank line or at least its content width of spaces.

When `openAfter` reads the next line, it:

- matches every container while a fence or raw HTML block is open: reads the rest of the line as that block's content, never as a container marker (`> ```\n> > ```` keeps `> ```` as code)
- matches fewer containers while a paragraph is open, and the rest of the line is non-blank and ends no lazy paragraph (`QuoteLazyLine` when an unmatched container is a blockquote, `ListLazyLine` otherwise): continues the paragraph with every container kept open (`> > 1.  one\n> >\n> >     two\nthree`)
- matches fewer containers otherwise: closes the unmatched containers and the block they held, then reads the line in what is left (`> - a\n>     ```\n> - b\nlazy` closes the fence at `- b`)
- is blank right after an empty item's marker line: closes that item, since an item begins with at most one blank line (`- 1.\n\n      a` makes `a` code in the outer item)
- holds a `>` or a list marker that opens a container: resets `Paragraph` and `Table` to `None`
- is blank: keeps a fence or a raw HTML type 1 to 5 state, and returns `None` for the rest
- holds an ordered marker starting other than 1, or an empty item, while a paragraph is open: continues the paragraph, since neither may interrupt one (CommonMark 0.31.2, list items): `> a\n> 2. b` stays one paragraph, `> a\n> 1. b` splits
- holds a closing `</pre>`, `</script>`, `</style>`, or `</textarea>` with nothing after its `>`, while no paragraph is open: opens an HTML block of type 7 (a type 7 block cannot interrupt a paragraph)

A lazy continuation line extends a blockquote or list item only while the state is `Paragraph`. The block parser marks each lazy line with `CHAR_RECORD_SEP` ("Character classes"), in a blockquote as in a list item, so a lazy line stays out of block parsing and is never read as a setext underline. The marker replaces the line's indentation, and a line an outer container already marked keeps its one marker, so every nested container reads it as lazy (`- - [x]: /u\n[y]: /v` defines both):

- `> a\nb\n===`: one blockquote paragraph, `===` included
- `> a\nb\n> ---`: a blockquote holding a level 2 heading of `a` and `b` (the underline carries its quote marker)
- `- <b>x</b>\ny\n===`: no setext heading

### Lists

- `parseBlocks` detects looseness in one pass: a blank line directly between two blocks of an item loosens it, and so does a blank line inside an HTML block (`hadInternalBlank`).
- An item that starts with a blank line is empty, so an indented marker after the blank line opens a sibling item (`-\n\n  - n`). Once a line gives it content, it takes lazy lines like any item (`1. \n    a\nb`).
- A thematic break indented to the item's content column stays in the item, after a blank line too (`- a\n\n  ***`).
- An HTML tag at the list's base indent or less ends the list and is not part of the last item.
- An item opening with `[ ]`, `[x]`, or `[X]` gets a `gfmTask` only when ASCII whitespace follows the marker and the paragraph the marker opens has content (GFM, task list items): `- [x]foo`, `- [x]`, `- [x] `, `- [x]\n\n  foo`, and `- [x]\n  # h` keep `[x]` as text, and `- [x]: /url` is a link reference definition. The rest of the marker's line enters block parsing as a lazy line, so it is paragraph text and never opens a block (`- [x] # h`, `- [x] > q`, `- [x]     code`).

### Fenced and indented code

- `findFenceClose` returns the start of the closing fence line (-1 when unclosed) and sets `_fenceCloseEnd` past it. A closing fence is the opener's character, at least as long, indented at most 3 spaces, followed only by blanks (CommonMark 0.31.2, fenced code blocks).
- A backtick fence's info string holds no backtick, so `` ```py`thon `` opens no fence.
- An indented code block keeps a blank line's whitespace past 4 columns as content (CommonMark 0.31.2 example 112).

### Code spans

- A code span's content loses one leading and one trailing U+0020 when it has both and is not all U+0020 (CommonMark 0.31.2, code spans): `` ` a ` `` holds `a`, `` `  ` `` holds two spaces, `` ` a` `` holds ` a`. A tab or a no-break space is content and is never stripped.
- A line ending inside a code span becomes one space, and the spaces and tabs that start the next line go with it, since a paragraph line loses its leading whitespace (CommonMark 0.31.2, paragraphs; commonmark.js and md4c agree, markdown-it and micromark keep the indent): ``` ``a\n b`` ``` holds `a b`.

### HTML blocks

Purpose: classify raw markup by CommonMark HTML block type and pair JSX components with their closers.

Constants: `TYPE1_TAG_NAMES` (`pre`, `script`, `style`, `textarea`), the type 1 tags, which end at their own closer rather than at a blank line.

- `matchType1At`: an opening type 1 name counts only when a character other than a letter, digit, or `_` follows; a closing form needs `>` right after the name. `containsType1Tag` reports whether text holds a type 1 opener. `detectHtmlBlockType` returns 1 only for openers; closing type 1 tags take their own branch.

When `rawMarkupKind` reads an opener, it returns its CommonMark HTML block type:

- `<!--`: 2
- `<?`: 3
- `<!` plus an ASCII letter in either case: 4, a declaration (block type 4 and inline raw HTML, CommonMark 0.31.2)
- `<![CDATA[`: 5
- anything else: 0

When the block HTML scanner opens a block, the block ends:

- a CommonMark type 6 or 7 opener: at its own closer within the block, else at the next blank line
- a malformed type 6 or 7 opener, or any type 6 or 7 closing tag: at the next blank line
- a non-CommonMark tag (a JSX component, which `detectHtmlBlockType` gives 0): at its closer anywhere in the rest of the document, else at the next blank line

When `parseHtmlChildren` parses an element's content, its `HtmlChildrenMode` names the content's position:

- `Block`: an HTML block of type 6 or 7
- `Component`: a block JSX component
- `Inline`: inline HTML (empty content is kept as is)
- `Unclosed`: the blank-line fallback of an unclosed non-CommonMark tag

- With no blank line after the opener, markdown inside an HTML block stays literal (`<div>\n*E* t.\n</div>`); blank lines around the content let it parse (issue #860).

### HTML tag grammar and attributes

- A tag name is `[a-zA-Z][a-zA-Z0-9-]*`; whitespace must separate it from attributes (`<tag.name>`, `<div<inner>>` are no tags). A quote opens a value only after `=`; an unquoted value is valid; quoted values may hold newlines, `<`, and `>`. An attribute value holding `%` (`width="100%"`) never throws (issue #753).
- `processHtmlAttributes` reads a brace value: `{[...]}` or `{{...}}` through `JSON.parse`, then `true`/`false`, then `eval` only under `evalUnserializableExpressions`, else the raw string. A failed parse falls through to the next reading.
- `indexOfCi` and `lastIndexOfCi` take a lowercase `search` starting with a non-letter (`<`, `</`): the first character is found with an exact-case `indexOf`, and only the rest is case-folded. `matchesFolded` folds ASCII only.
- Raw HTML screening (`browserTagEnd`, `stripDangerousHtml`, the `content` and `attributeName` rules) is specified in standards/security.md. `stripDangerousHtml` returns the input itself when nothing changed. In `screenRawTags`, `replacement` and `keptReplacement` are reset at the top of every loop iteration, since `var` hoists them out of the loop and a stale value would carry into the next tag.

### Tables

- `parseDelimiterRow`: leading and trailing pipes are optional, alignment colons are optional, and each cell needs at least one dash (GFM 0.29, tables); a trailing pipe may be followed only by blanks.
- In a cell, an even backslash run before a pipe leaves the pipe a column split (`a\\|b` is cells `a\` and `b`); a body row's cells past the header count are dropped.

### Reference definitions

- `collectReferenceDefinitions` is a pre-pass for streaming, inline mode, and the direct API; it returns true when the input ends inside an unclosed fence and does nothing for input with no `[` (unless streaming). A line in a fence is never a definition; a definition cannot interrupt a paragraph (`prevWasContent`) but may follow a heading or thematic break; `[^` starts a footnote.
- The first definition of a label wins; labels match case-insensitively; 0 to 3 spaces of indent are allowed; a destination is not validated as a URL; `[nested [brackets]]: url` is no definition. A definition may appear anywhere, after its first use and inside nested containers included (see "Deferred inline parsing").
- `toParseOptions` normalizes compiler options into `ParseOptions`.

### Emphasis, strikethrough, mark

- `collectDelimiter`: a `~` or `=` run opens or closes only at exactly two characters (GFM 0.29 strikethrough; the same rule for `==` mark); other lengths are text. Every run follows CommonMark 0.31.2 flanking rules and resolves on one delimiter stack, so `~~` and `==` nest like emphasis; `_` also needs punctuation beside it to open or close inside a word.
- An escaped `\_` is a literal and stops only itself being a delimiter (issues #830, #271).
- `processEmphasis` never re-enters itself (link text finishes its own inline parse first), so its node list lives in module slots (`_lnDepth`, `_lnNext`, `_lnPrev`, `_lnNode`): slot i below the input length is input node i, and later slots are new emphasis nodes. `_lnNode` is emptied on return, so no AST outlives its parse there.

### Links and autolinks

- The link destination, title, bracket-label, and autolink scanners are shared. `matchAutolinkEnd` allocates nothing and returns the end index or -1. A tab invalidates an angle autolink (`<https://e.com\tpath>` stays text). A tab ends a bare link destination (`[a](/u\t"t")` links `/u` with title `t`, and `![x](java\tscript:x)` is text); only an angle-bracket destination holds a raw tab.
- Links do not nest: the inner link wins and the outer brackets are text. Unescaped brackets may sit in a destination (`[t](url[invalid])`).
- A code span, an autolink, or one raw HTML tag hides its own brackets from link text, as CommonMark specifies; an HTML element's content does not, so `[a <b>b]</b> c](/u)` is text and `[a <b title="]">x</b>](/u)` is a link.
- An email local-part may start up to 64 characters before its `@`, so the inline fast-skip stops 64 characters before the next `@` and never starts a URL at an `h`, `w`, or `f` inside the local-part (issue #877).
- A bare email's domain labels may hold `-` and `_`, as GFM extended email autolinks specify. Stricter than GFM, which bars `-` and `_` only as the domain's last character, each label also starts and ends with a letter or digit and holds at most 63 characters, as a hostname label does (`foo@a_b.c` links, `foo@a_.c` stays text).
- Heading text for slugs is the flattened inline text, so link destinations and image alt never reach the id.

### Bare URLs

- A bare URL starts only at a lowercase `http://`, `https://`, `ftp://`, or `www.`, as GFM writes them (`HTTP://a.com` stays text); an angle autolink's scheme matches in any case (`<HTTP://a.com>` links).

When the bare URL scan ends a URL, it:

- ends in a `]` while it holds more `]` than `[`: trims that `]` to text, repeating, so an interior `]` stays (`www.e.com/a]b]` links `www.e.com/a]b`)
- meets `\]`: ends before the escape, which renders as `]`
- holds an unclosed `[`: keeps the final `]`, which balances it
- meets a `==` or `~~` run inside an open `==` or `~~` that the run can close: ends there; a run that cannot close is skipped whole
- has trailing emphasis delimiters: trims them from the href (issue #839)

- `=` padding stays in the URL (`https://x.y/?t=YQ==`) unless an open `==` can close there (`==https://x.y/?t=YQ==` links `https://x.y/?t=YQ`).

## Input preparation

Purpose: give the block scanners one line-ending form, with no copy of input that is already in that form.

- `normalizeInput` (run first by `parseMarkdown`):
  - CRLF and a lone CR become LF.
  - NUL (U+0000) becomes U+FFFD (CommonMark).
  - Input with neither returns as the same string, and the module-level `crlfParts` buffer is reused across calls, so clean input allocates nothing.
- `prepareBlockInput` (the JSX compilers' block input): strips leading LF, so a template literal opening with a newline still starts with its frontmatter. It returns input with no leading LF as the same string, and the block parser treats end of input as the end of every open block, so no padding is appended.

## Frontmatter

Purpose: find a leading YAML block so it parses to its own node, which renderers skip unless `preserveFrontmatter` is set.

When `parseFrontmatterBounds` reads the input, it returns:

- the input does not start with exactly `---`, optional spaces or tabs, then LF or CRLF: null
- a later line starts with `---` and ends in a line break or the end of input: the end position after that line, plus `hasValidYaml`
- no such closing line exists: null

`hasValidYaml` is true when some line before the closer holds a key followed by `:` and then a space, a tab, or the end of the line. A key starts with `[A-Za-z0-9_]`, continues with `[A-Za-z0-9_.-]`, and may follow leading spaces or tabs.

## Entity references

Purpose: decode HTML character references in text and destinations the way CommonMark requires.

- `HTML_CHAR_CODE_R` matches `&` plus an entity name, `#` plus 1 to 7 decimal digits, or `#x` plus 1 to 6 hex digits, ending with `;` (case-insensitive).
- Named references decode through `decodeEntity` from `markdown-to-jsx/entities`: a table lookup in `lib/src/entities.generated.ts`, or a DOM lookup in browser builds (packaging: specs/tooling.md, "Entry points and packaging"; table generation: specs/tooling.md, "Entity table generator").

When `decodeEntityReferences` meets a reference, it writes:

- a known entity name: the entity's characters
- a numeric reference to code point 0, a surrogate (U+D800 to U+DFFF), or a value above U+10FFFF: U+FFFD (CommonMark)
- any other numeric reference: the code point, computed in place
- a name no entity holds: the reference as written

Text with no `&` returns unchanged without running the regex. Decoding runs once, left to right, and never re-decodes its output (`&amp;lt;` becomes `&lt;`).

## Character classes

Purpose: classify a character with one table read on hot paths.

Constants (`lib/src/utils.ts`): `CC`, a 128-entry `Uint8Array` shared by `parse.ts` and `utils.ts`, holding bit flags so one character carries several classes.

- `C_WS`: space, tab, LF, CR, form feed
- `C_NL`: LF, CR
- `C_PUNCT`: every ASCII punctuation character (the CommonMark backslash-escape set)
- `C_ALPHA`: `a` to `z`, `A` to `Z`
- `C_DIGIT`: `0` to `9`

When a delimiter classifier (`isUPunct`, `isUws` in parse.ts) reads a character above ASCII, it answers:

- `isUPunct`: `UNICODE_PUNCT_R` (`[\p{P}\p{S}]`), since CommonMark 0.31 counts general categories P and S as punctuation for emphasis flanking
- `isUws`: `UNICODE_WHITESPACE_R` (`\p{Zs}`)

A delimiter run at the start or end of its text reads as whitespace on that side, since the caller passes a space for the missing character.

- `CHAR_CASE_OFFSET` (`lib/src/constants.ts`) is the distance from an ASCII uppercase letter to its lowercase form.
- `CHAR_RECORD_SEP` (0x1E) is the lazy-continuation marker the block parser writes into text. It never reaches the AST; scripts/html-fuzz.ts fails if it does (standards/security.md, "Rules for changing any of this").

## Heading ids

Purpose: give every heading a unique, URL-safe id.

- `assignHeadingIds` runs after the block and inline passes, walking headings in document order, and calls `uniqueHeadingId(slugify(text))`. The `slugify` option replaces the default.
- `slugify` (default): ASCII letters are lowercased, digits are kept, a space or `-` becomes `-`, a Latin letter from U+00C0 to U+024F or U+1E00 to U+1EFF maps to the ASCII letter its canonical decomposition starts with (é to e, č to c, ặ to a), a letter with no decomposition to the letter it is drawn from (ł to l, đ to d, Æ to a, Œ to o), ß to ss, and every other character is dropped (×, ÷, Þ, ĳ, non-Latin scripts). `SLUG_FOLD` and `SLUG_FOLD_EXTENDED` hold one letter per code point of each range, a space marking a dropped one, and need no `String.prototype.normalize` at run time; a test in utils.spec.ts derives every letter from the decomposition.
- `State._headingIds` records the ids taken in one parse. Key presence means the id is taken; the value is the last numeric suffix tried with that id as a base (`0` means no suffix has been generated from it yet), so dense collisions stay amortized constant time without a second map.

When `uniqueHeadingId` receives a base, it returns:

- an empty base: the empty string, recording nothing
- a base not yet taken: the base
- a taken base: `<base>-<n>`, where n counts up from the last suffix tried until the candidate is free

## Deferred inline parsing

Purpose: parse inline content only once every reference definition in the document is known.

When `parseMarkdown` starts, inline content:

- the input contains `]:`, or `optimizeForStreaming` is set: is queued by `queueInline` with a packed copy of the parse state (`packState`), parsed after the block pass, and list-item unwrap operations (`_pendingOps`) run after that
- otherwise: parses immediately, since no definition can appear later

The queues are module-level (`_pendingInline`, `_pendingOps`), saved and restored around a nested `parseMarkdown` call, so a re-parse inside a compiler does not drain the outer document's queue.

## Streaming edge

Purpose: under `optimizeForStreaming`, hide syntax that is still arriving so partial output never flashes raw markup.

- Only the last block can still be completed. A link or code span in an earlier block, a closing tag, a void element, and a line break render unchanged. An unclosed code span at the edge is found by pairing backtick runs (a backslash-escaped backtick opens nothing), so a complete code span and an escaped backtick in the last block render as in the full parse, while an unclosed backtick run hides itself and everything after it in that block. Trailing blank lines do not make the last block look finished.
- `State._notAtEdge`: when true, suppression is skipped for the current block because its content cannot hold the streaming edge (the end of the text received so far).
- A line starting with a pipe at the edge is a probable incomplete table header and is suppressed; once the first body row arrives the table renders, and no later prefix of the stream drops it, including a finished row followed by the next row's opening `|`.
- A never-closed emphasis opener at the edge is hidden (`[View_results *now](` shows `View_results now`); a `_` or `*` the parser renders literally is never treated as an opener, so finished text matches non-streaming output (issue #905). The parser cannot tell the edge from finished text, so the final render is made with the option off (issue #909).
- An incomplete setext or list ambiguity never commits (issue #827).
