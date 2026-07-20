# Backlog

Open work and known issues for markdown-to-jsx. Remove an entry as the final step of the change that resolves it.

## Security

- LOW: brace-expression handlers (`onClick={...}`) are kept only on component-like tags (a capitalized JSX component or a hyphenated custom element) as renderer-resolved props; standard HTML elements now strip them. For a component-like tag, the html and markdown string compilers still emit the brace handler verbatim, so a component tag rendered to a string sink and placed into a live DOM could execute the body. This is deliberate (brace expressions are the JSX prop feature, evaluation gated by `evalUnserializableExpressions`), and string-valued handlers plus dangerous-scheme URLs are stripped on every tag. If the string compilers must be safe for untrusted `{...}` on component-like tags too, strip brace handlers from `_rawAttrs`/`_rawText` while keeping them in the parsed `attrs` map.
- LOW: the inline-style XSS guard is bypassable (CSS comments, `expression()`, `-moz-binding`, `image-set()`) and is skipped entirely on the html verbatim path; only a legacy-browser risk.
- LOW: `data:image/svg+xml` is allowlisted (the `sanitizer`'s `data(?!:image)` carve-out) and is script-capable when opened as a top-level navigation. Documented as a caveat in the README; tightening the carve-out to block `data:image/svg` would also block safe inline SVG images, so it needs a script-aware check before it can be narrowed. Public `sanitizer` behavior, so treat as a maintainer decision.

## astToMarkdown round-trip fidelity

The markdown output compiler is guarded construct by construct by the "HTML equivalence corpus" round-trip harness in lib/src/markdown.spec.ts. One narrow case remains:

- An escaped ordered-list marker (`1\. text`) does not round-trip. The parser splits it into separate `1` and `.` text nodes, so the per-node line-start escaping in compileText never sees the digit-then-period pair and cannot re-escape it. Fixing it needs line-level reconstruction (escape block starters in compileParagraph on the concatenated children) rather than per-text-node escaping.

Add a corpus case when it is fixed.

## Known spec deviations

- Raw HTML blocks are not emitted verbatim: inter-tag whitespace and interior newlines are lost because the parser turns HTML into structured element nodes for the JSX renderers (CommonMark ex 150, 191). Semantic content is correct. Restoring verbatim bytes would require carrying a parallel source range through the AST.
- Code blocks omit the CommonMark trailing newline (`<pre><code>foo</code></pre>` vs the spec's `foo\n`). Established output shape, no rendered difference (a final empty line generates no line box).

## Renderer drift

- Fenced code block class names differ by renderer: the JSX renderers (react, native, solid, vue) emit `language-js lang-js` while the html string compiler emits `language-js` alone. `language-` is what hljs and prism key on and is the one to keep; `lang-` is legacy. Aligning them means either adding a duplicate class to html output or dropping `lang-` from the JSX renderers, and both change published output bytes, so it needs a maintainer call and a major or a clearly-flagged minor.

