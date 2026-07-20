You are maintaining markdown-to-jsx, a TypeScript-based toolchain containing an AST parser and output adapters for React, React Native, HTML, and Markdown.

See README.md for the primary library documentation.

## Principles

Never ship unverified work. Quality gates (tests, builds) must pass before any commit or push.
- 100% passing tests required before committing or pushing
- Run `bun test` after each set of changes to ensure no regressions
- Rebuild the site (`bun build-site`) before committing if there are README.md or library code changes (test files are exempt)

Think before you code. Most critical bugs come from misunderstanding the problem, not from typos. Build a mental model first. When a bug appears, reason about how the model is wrong, not just where the symptom is.

Data first, code second. Choose data structures before writing algorithms; the algorithm should emerge from the data layout. Understand the shape, volume, and access patterns of data before designing code around it.

Simplicity is not optional. Simple means not interleaved, not "easy to type." Every abstraction must justify itself with concrete reuse and net reduction in complexity. Never include code that isn't used. Don't generalize before you need to. N is usually small; fancy algorithms have big constants and more bugs.
- Do not create helper functions unless there are at least two instances of the same pattern and overall LOC is reduced

Eliminate edge cases through better abstractions. Good taste means reformulating problems so special cases disappear -- the right data structure, the right interface, the right level of indirection.

Compose small, focused units. Each function/module should do one thing well. Design how modules communicate, not what they contain internally.

Fail explicitly, recover independently. Don't hide errors behind silent fallbacks. Make failures observable and isolated. Prefer corrective code over defensive code.

Complete all work end-to-end. Refactors include cleanup of dead code (as a separate step).

Minimize artifacts; communicate in-context. Don't create files when conversation suffices.
- Do not create summary documents; deliver concise summaries in chat
- Do not create summaries after working on a task unless explicitly directed

Reason about efficiency across all dimensions. Understand how CPUs, caches, and memory work -- smaller data structures mean faster programs via cache effects. This is foundational design, not premature optimization. Consider algorithmic complexity, data structures, function overhead, memory management, GC pressure, event loop blocking, DOM interactions, rendering performance, parsing/execution cost, dependency weight, and browser-specific quirks when authoring or refactoring code.
- Minimize intermediate representations; every serialization/deserialization boundary is wasted work. Do maximum work per pass. Keep data in a single consistent format throughout the pipeline

All string operations must complete in bounded linear time with no backtracking. Prefer single-pass charCode scans over regex on hot paths.
- Never use unbounded `indexOf`/`lastIndexOf`/`includes` in loops; bound searches to the relevant range (e.g., current line end)
- Avoid nested quantifiers in regexes (e.g., `(\s*-+\s*)*`); these create exponential backtracking (ReDoS)
- Adjacent capture groups with overlapping char classes cause backtracking when the delimiter is absent; replace with charCode scans in a single forward pass
- Regexes applied to unbounded input (e.g., entire document via `.match()`) are inherently risky; prefer charCode scans that walk the string once
- Restrict `\s` to `[ \t]` when newlines are structurally invalid in the match; `\s` includes `\n` which causes cross-line backtracking

Minimize allocations in hot paths. Use segment tracking (start/end indices, slice once) over incremental string building.
- Avoid char-by-char string concat (`out += s[i]`); use `segStart`/`segEnd` indices and slice once
- Avoid `.split()`, `.match()`, `.slice()` inside tight loops; prefer charCode walks that extract results in a single pass
- In Bun/JSC, string `+=` (rope concat) is faster than array-push + join for small/medium segments; only use array-join when building very large strings with many pieces

Measure, don't guess. Never optimize without profiling. Bottlenecks occur in surprising places. But when you find the critical path, optimize it ruthlessly. Use the largest benchmark (`gfm-spec.md`, 211KB) to surface O(n*m) issues.
- Use `bun profile` to identify hot lines. The `--cpu-prof-md` flag produces a markdown-formatted profile (`CPU.*.md`)
- Use `bun metrics` (run 3x) to check parser performance when changing library code
- When comparing a branch against `main` (not just checking stability), interleave samples: alternate single runs between the two variants rather than running all of one then all of the other. Run-to-run variance here is large enough that sequential blocks fake a directional signal from short-timescale system drift; interleaving cancels it. Re-baseline (`bun metrics --target <name> -u`) in the release flow so the stored baseline does not drift stale and misreport unrelated movement as regression.

Tests are the source of truth; never work around them.
- The main branch always has a 100% pass rate. Broken tests are due to changes in the current branch, not the suite itself
- Always use a 5s timeout when running tests (e.g., `timeout 5 bun test`). The full suite executes within 500ms; hangs indicate infinite loops or regressions
- There is no time limit for agent tasks. Work until the task is complete

Tests must be deterministic, specific, and structural. Every assertion has exactly one valid outcome and covers both content and shape.
- Prefer inline snapshots (`toMatchInlineSnapshot()`) over many small assertions against AST structure
- No generic existence checks like `toBeTruthy()` or `toBeDefined()`
- Renderer suites focus exclusively on renderer behavior; parser suite handles common parsing scenarios
- 80% or greater cumulative coverage is required
- Add tests to existing test files rather than creating new ones
- When debugging failing compiler tests, isolate them and validate parser output first to distinguish parser bugs from compiler bugs
- Add debug logging as needed; clean up only after all tests pass

Commit messages serve their audience. Public: user-facing impact. Private: technical impact. Always concise.
- Use conventional commit syntax
- Speak in general terms, not specific implementation details
- Public code: focus on how the change benefits users. Ensure noteworthy changes and bugfixes have a changeset
- Private/infra code: focus on how the change benefits the codebase
- Changesets and PR descriptions are public-facing only. Describe the perceived change to users in plain terms. No internal mechanics, file paths, flag names, or parser/AST terminology

Prose in commits, changesets, PR descriptions, comments, and docs follows one house style. American English (color, recognize, center). Plain language over jargon; define a rare term on first use. No em-dashes: use a colon, comma, period, or and/or/but instead. No attribution footers (no "Generated with", "Co-authored-by", or similar) on commits, PRs, files, or any output. Public-facing writing is first-person from the maintainer and warm toward contributors.

Rules must be maximally concise and actionable. No decoration, no meta-commentary, no examples unless critical.
- Optimize for token efficiency: no bold/emphasis, headers, or stylistic formatting in rules
- Prefer abbreviations and acronyms when unambiguous
- Use minimal punctuation, only where necessary for clarity

Library code must be fully self-contained at runtime. Zero network dependencies, zero remote fetches.
- Code under `lib/src/` must never fetch, request, or depend on remote URLs/network resources at runtime
- Dev-time scripts may fetch remote resources to produce local artifacts, but generated output must be committed and verified
- Tests must assert no runtime network dependencies exist (scan `lib/src/` for `fetch(`, `XMLHttpRequest`, `http.get`, `http.request`, `https.get`, `https.request`, `navigator.sendBeacon`, `WebSocket`, `EventSource`)
- All data dependencies must be vendored locally via relative imports

## Repository Configuration

- Use `bun` instead of `npm`. Use `bunx` instead of `npx`.
- The repository uses bun package manager and the bun test runner.
- `bun metrics --target <name>` (`scripts/metrics.ts`) measures this library against its own stored baseline for a single entry point: `parser`, `react`, `react-native`, `html`, `solid`, `vue`, or `markdown` (defaults to `parser`). Use it for quick regression checks while editing library code.
- The `benchmarks/` workspace is the single cross-library benchmark surface. `bun bench` compares the working copy against the published version; `bun bench:jsx`, `bun bench:html`, and `bun bench:all` add `Bun.markdown` and other parsers (marked, markdown-it, react-markdown, remark) across 1kB/27kB/211kB inputs, with a baseline diff. Do not add standalone benchmark scripts; extend this workspace instead.
- `bun scripts/emit-selfcheck.ts [--save]` checks renderToStaticMarkup byte-equality against a golden file; run in both dev and `NODE_ENV=production` modes when touching the React emit path.

## Coding Style

- Prefer `$.CHAR_*` constants from `lib/src/constants.ts` over raw char code numbers for readability (e.g., `$.CHAR_SPACE` instead of `32`)
- Types are law. Do not reach for escape hatches (`as any`, non-null `!`, `@ts-expect-error`, `@ts-nocheck`); if a type will not check, restructure the code to express it properly. A `@ts-expect-error` used to assert a negative-type behavior is a test and must be marked as such.
- Block comments (`/** */`) on exported members, functions, types, and fields so they surface as hover docs; line comments are fine for in-body notes. Comments disambiguate the CURRENT code, never narrate edits or history.
- Alphabetize fields in type/interface declarations and object literals by default; keep a non-alphabetical order only when it is load-bearing and say why in a comment. Applies to code you write and nearby code you edit, not a mandate to reorder untouched files.
- Backward compatibility is required only for public API surfaces (exported functions, types, and options); internal code is free to change.

## Reference Documents

- [compiler-wisdom.md](compiler-wisdom.md) -- Read before designing or optimizing parser/compiler code. Covers production compiler techniques (AST design, scanner optimization, string handling, parallelism) and practitioner wisdom from 20 engineering legends.
- [BACKLOG.md](BACKLOG.md) -- Open work and known issues.

## Library Priorities

The priorities of this library are correctness, speed, and small output size in that order. Pursue these goals in sequence - correctness first, then performance, then bundle size optimization. Optimize code for best minification and tree shaking. Always prefer ES5 syntax when writing code to ensure the fastest implementation is used by the underlying JS engine.

## Compiler Parity

There are six output compilers: react, native, solid, vue, html, markdown. Any change to rendering behavior (especially HTML block handling) must be verified across all six, not just the one in front of you. They drift: the JSX renderers (react/native/solid/vue) share AST logic via utils.ts but assemble elements with their own primitives (React.Fragment, Solid/Vue arrays, normalizeChildren), and html/markdown emit strings.
- Put renderer-agnostic AST logic in utils.ts and call it from each compiler; keep only element assembly per-renderer
- Add a regression test to every affected compiler suite when fixing a rendering bug. Output shape differs by renderer, so assert each one's actual structure (serialize JSX renderers to a string and snapshot; html/markdown snapshot the returned string)
- react-native cannot be imported directly in `bun -e`; preload the mock: `bun --preload ./lib/src/__mocks__/react-native.ts`. react-dom/server is unavailable there, so walk React elements via `.type`/`.props.children`

## Key Library Files

### Core Parser & Types

- `lib/src/parse.ts` - Core markdown parser with AST generation
- `lib/src/types.ts` - TypeScript type definitions for AST nodes, options, and state
- `lib/src/utils.ts` - Utility functions (entity decoding, sanitization, slugification, character classification)
- `lib/src/constants.ts` - Character code constants (CHAR_SPACE, CHAR_TAB, etc.)
- `lib/src/entities.generated.ts` - Auto-generated HTML entity mappings for CommonMark compliance

### Output Adapters

- `lib/src/react.tsx` - React JSX compiler with rendering logic and component overrides
- `lib/src/native.tsx` - React Native adapter
- `lib/src/html.ts` - HTML output compiler with tag filtering and entity escaping
- `lib/src/markdown.ts` - Markdown output adapter
- `lib/src/solid.tsx` - SolidJS adapter
- `lib/src/vue.tsx` - Vue.js adapter

### Entry Points

- `lib/src/index.tsx` - Main entry point re-exporting parser, types, and utilities
- `lib/src/index.cjs.tsx` - CommonJS entry point with deprecated exports

## Internationalization (i18n)

- All localized content in `lib/src/i18n/`.
- Required files per language: `README.md`, `default-template.md`, `gfm-spec.md`, `markdown-spec.md`.
- UI strings in `lib/src/i18n/ui-strings.ts`.
- Supported languages in `lib/src/i18n/languages.ts`.
- Language ordering by global speakers ([Ethnologue 2025](https://www.ethnologue.com/insights/most-spoken-language/)): English, Mandarin Chinese, Hindi, Spanish, Arabic.
- Technical documentation standards: Simplified Chinese (Mandarin, 普通话), Modern Standard Hindi (मानक हिन्दी with formal आप pronoun).
- Code examples: Keep API names, package names, technical constants in English. Translate text content within code blocks (string literals, user-facing text, natural language comments, example markdown text) while preserving syntax and markup.
- Do not add `@lang` JSDoc tags or inline translations to source code. Keep JSDoc English-only.
- `lib/README.md` is the single source for library docs, and `docs/llms.txt` builds from it alone. Any edit to it must propagate in the same change to every `lib/src/i18n/{lang}/README.md`: copy `lib/README.md` verbatim into `en/README.md` (an exact mirror), and translate the changed sections into `hi` and `zh` per their `.cursor/rules/i18n-{lang}.mdc`. `validate-i18n` checks only file and UI-string completeness, not README content, so verify parity by hand: equal fenced-code-block counts across all four files (`grep -c '^\`\`\`'`), every translated table-of-contents anchor resolving to a heading in its own file, and every `lib/README.md` section present in each translation. Keep code identifiers, API names, and anchors as each file already does.
- Changesets are English-only. Do not translate changeset bodies.
- Run `bun run validate-i18n` before committing any i18n or documentation changes.
- New languages should have a PATCH changeset.
- Create language-specific rule files in `.cursor/rules/i18n-{lang}.mdc` for each new language containing: term translations, style guidelines, technical term handling, format conventions. Optimize for machine interpretation (no markdown formatting, minimal punctuation, concise directives).
- Prefer native/idiomatic words over transliterations for user-facing text (UI strings, alerts, documentation headings).
- For technical terms, provide both options: native word first, transliteration second (e.g., Hindi: सुझाव/टिप for "tip").
- Transliterations acceptable for programming-specific terms with no native equivalent (e.g., कंपोनेंट for "component").
- Verify translations match actual usage in target language technical communities (React docs, MDN, official framework translations).
