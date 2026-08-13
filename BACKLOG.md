# Backlog

Open work and known issues for marqdown. Remove an entry as the final step of the change that resolves it.

## Package rename (marqdown), remaining publish/infra steps

The in-repo rename from markdown-to-jsx to marqdown (package name, workspace scopes, imports, docs, i18n) is done. These outward-facing steps are the maintainer's and are not yet done:

- Publish the shim: ship a final markdown-to-jsx version whose entry points re-export marqdown for every subpath (`.`, `/entities`, `/react`, `/html`, `/markdown`, `/native`, `/solid`, `/vue`) and that depends on marqdown, so existing installs and deep imports keep resolving. The README, llms.txt, and AGENTS.md already describe this shim as live, so publishing it is what makes those docs true.
- Deprecate the old name: `npm deprecate markdown-to-jsx@"*" "Renamed to marqdown; see https://www.npmjs.com/package/marqdown"` after both are published.
- Rename the GitHub repo quantizor/markdown-to-jsx to quantizor/marqdown (GitHub auto-redirects the old paths). Then update the github.com URLs and lib/package.json homepage/repository fields that were intentionally left pointing at the old name.
- Point the site domain at marqdown (DNS + CNAME files at ./CNAME, docs/CNAME, public/CNAME) once ready; the site currently still serves markdown-to-jsx.quantizor.dev.
- Re-run `bun bench -u` to re-baseline benchmarks/bench.baseline.json under the new working-copy label (marqdown (next)).

## Security

- LOW: brace-expression handlers (`onClick={...}`) are kept only on component-like tags (a capitalized JSX component or a hyphenated custom element) as renderer-resolved props; standard HTML elements now strip them. For a component-like tag, the html and markdown string compilers still emit the brace handler verbatim, so a component tag rendered to a string sink and placed into a live DOM could execute the body. This is deliberate (brace expressions are the JSX prop feature, evaluation gated by `evalUnserializableExpressions`), and string-valued handlers plus dangerous-scheme URLs are stripped on every tag. If the string compilers must be safe for untrusted `{...}` on component-like tags too, strip brace handlers from `_rawAttrs`/`_rawOpen`/`_rawBody`/`_rawOuter` while keeping them in the parsed `attrs` map.
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

