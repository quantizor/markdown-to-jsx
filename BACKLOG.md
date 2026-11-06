# Backlog

Open work and known issues for markdown-to-jsx. Remove an entry as the final step of the change that resolves it.

## Security

- LOW: brace-expression handlers (`onClick={...}`) are kept as renderer-resolved props on a capitalized tag `overrides` registers. There the html and markdown string compilers emit the handler verbatim. On a registered tag with no component, Vue writes it onto a native element and Solid throws on it. A registered capitalized tag renamed to a native element string (`Card: { component: 'a' }`) gets it too: Solid writes it onto the element it creates and the html compiler writes it live, because the handler guard for Vue and Solid covers only unregistered tags. So a registered name in untrusted input can run script. Removing it is a breaking change left to the next major.
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
- An HTML block whose content sits on its own lines with heading syntax (`<div>\n# x\n</div>`) renders differently by renderer: the html and markdown compilers emit the block's source text, so `# x` stays literal, while the JSX renderers (react, native, solid, vue) render the parsed children, an `<h1>`. CommonMark Example 189 keeps newline-wrapped content without a blank line raw, so html is the conforming side. The block-syntax check that sends such content to block parsing feeds the JSX renderers only; aligning them changes published JSX output.
- An inline HTML element split across blocks by a block start on its second line (`<span>foo\n# bar</span>`, CommonMark gives `<p><span>foo</p><h1>bar</span></h1>`) renders differently by renderer: html emits the open and close tags where they fall, matching the reference, while the JSX renderers emit an empty element in each block (`<p><span></span>foo</p><h1>bar<span></span></h1>`). Any block start that interrupts a paragraph triggers it (`#`, `-`, `>`, and `#bar` under `enforceAtxHeadings: false`). A JSX tree cannot hold a half-open element, so the choice is which shape to emit; changing it changes published JSX output.
- A tag renamed through `overrides` (`{ Card: { component: 'aside' } }`) is renamed by the html and markdown compilers only when it is a self-closing tag standing alone as a block (`<Card />` on its own line). A paired tag (`<Card>hi</Card>`), an inline tag (`x <Card /> y`), and a tag inside a raw HTML block (`<div>\n<Card />\n</div>`) keep their written name, and a `children` attribute on the nested shape loses its text. The JSX renderers (react, native, solid, vue) rename all four. The string compilers pass raw HTML through as screened source text, so renaming there means rewriting tag names inside that text in step with the screen; changing it changes published html and markdown output.
- A raw HTML block whose screened text holds a `</pre>` but that React's Type 1 check does not read as a `<pre>` block (`<div <b c="d"/>\n<![CDATA[</pre>\n`) renders differently by renderer: Solid and Vue set the screened raw text as `innerHTML`, React drops it and renders an empty element, and html passes it through. Solid and Vue test for `</?pre` in the raw text, while React calls `parse.containsType1Tag`. Aligning them on one check changes published JSX output.
- An override given as a bare tag-name string (`{ a: 'span' }`, allowed by the `Override` type through `React.ElementType`) is ignored by React and the other JSX renderers, which render `<a>`, while the html and markdown compilers rename it to `<span>`. React's `getTag` reads only a function, a `render` object, or `.component`; the string compilers use `util.getTag`, which accepts the string. Making the JSX renderers honor it changes published JSX output.

## Performance

- Parse speed depends on what the process parsed before. One copy of the parser parses the stress fixture about 17% slower after parsing `gfm-spec.md` and `markdown-spec.md` than in a fresh process (six processes each way, no overlap), and compile logs tie the slow state to `parseBlocks` keeping optimized code from the earlier inputs. Unmeasured: whether real mixes of documents trigger it or only the synthetic stress fixture. A worker that cycles a corpus of real documents and compares per-document time against fresh processes settles it.

## Tooling

- No typecheck covers `scripts/`: verify's typecheck runs `lib/tsconfig.typecheck.json` (library and specs) and the harness workspaces, so a type error in a dev script or its spec surfaces only at run time. Add a tsconfig for `scripts/` (Bun types, the lib type roots) to verify's typecheck wave.

