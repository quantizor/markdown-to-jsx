You are maintaining markdown-to-jsx, a TypeScript-based toolchain containing an AST parser and output adapters for React, React Native, HTML, and Markdown.

See README.md for the primary library documentation.

## Principles

**Never ship unverified work.** Quality gates (tests, builds) must pass before any commit or push.
- 100% passing tests required before committing or pushing
- Run `bun test` after each set of changes to ensure no regressions
- Rebuild the site (`bun build-site`) before committing if there are README.md or library code changes (test files are exempt)

**Minimize artifacts; communicate in-context.** Don't create files when conversation suffices.
- Do not create summary documents; deliver concise summaries in chat
- Do not create summaries after working on a task unless explicitly directed

**Don't abstract prematurely.** Every abstraction must justify itself with concrete reuse and net reduction in complexity.
- Do not create helper functions unless there are at least two instances of the same pattern and overall LOC is reduced

**Complete all work end-to-end.** Refactors include cleanup of dead code (as a separate step).

**Reason about efficiency across all dimensions.** Consider algorithmic complexity, data structures, function overhead, memory management, GC pressure, async efficiency, event loop blocking, DOM interactions, rendering performance, network I/O, parsing/execution cost, dependency weight, and browser-specific quirks when authoring or refactoring code.

**All string operations must complete in bounded linear time with no backtracking.** Prefer single-pass charCode scans over regex on hot paths.
- Never use unbounded `indexOf`/`lastIndexOf`/`includes` in loops; bound searches to the relevant range (e.g., current line end)
- Avoid nested quantifiers in regexes (e.g., `(\s*-+\s*)*`); these create exponential backtracking (ReDoS)
- Adjacent capture groups with overlapping char classes cause backtracking when the delimiter is absent; replace with charCode scans in a single forward pass
- Regexes applied to unbounded input (e.g., entire document via `.match()`) are inherently risky; prefer charCode scans that walk the string once
- Restrict `\s` to `[ \t]` when newlines are structurally invalid in the match; `\s` includes `\n` which causes cross-line backtracking

**Minimize allocations in hot paths.** Use segment tracking (start/end indices, slice once) over incremental string building.
- Avoid char-by-char string concat (`out += s[i]`); use `segStart`/`segEnd` indices and slice once
- Avoid `.split()`, `.match()`, `.slice()` inside tight loops; prefer charCode walks that extract results in a single pass
- In Bun/JSC, string `+=` (rope concat) is faster than array-push + join for small/medium segments; only use array-join when building very large strings with many pieces

**Profile against worst-case inputs.** Use the largest benchmark (`gfm-spec.md`, 211KB) to surface O(n*m) issues.
- Use `bun profile` to identify hot lines. The `--cpu-prof-md` flag produces a markdown-formatted profile (`CPU.*.md`)
- Use `bun metrics` (run 3x) to check parser performance when changing library code

**Tests are the source of truth; never work around them.**
- The main branch always has a 100% pass rate. Broken tests are due to changes in the current branch, not the suite itself
- Always use a 5s timeout when running tests (e.g., `timeout 5 bun test`). The full suite executes within 500ms; hangs indicate infinite loops or regressions
- There is no time limit for agent tasks. Work until the task is complete

**Tests must be deterministic, specific, and structural.** Every assertion has exactly one valid outcome and covers both content and shape.
- Prefer inline snapshots (`toMatchInlineSnapshot()`) over many small assertions against AST structure
- No generic existence checks like `toBeTruthy()` or `toBeDefined()`
- Renderer suites focus exclusively on renderer behavior; parser suite handles common parsing scenarios
- 80% or greater cumulative coverage is required
- Add tests to existing test files rather than creating new ones
- When debugging failing compiler tests, isolate them and validate parser output first to distinguish parser bugs from compiler bugs
- Add debug logging as needed; clean up only after all tests pass

**Commit messages serve their audience.** Public: user-facing impact. Private: technical impact. Always concise.
- Use conventional commit syntax
- Speak in general terms, not specific implementation details
- Public code: focus on how the change benefits users. Ensure noteworthy changes and bugfixes have a changeset
- Private/infra code: focus on how the change benefits the codebase

**Rules must be maximally concise and actionable.** No decoration, no meta-commentary, no examples unless critical.
- Optimize for token efficiency: no bold/emphasis, headers, or stylistic formatting in rules
- Prefer abbreviations and acronyms when unambiguous
- Use minimal punctuation, only where necessary for clarity

**Library code must be fully self-contained at runtime.** Zero network dependencies, zero remote fetches.
- Code under `src/` must never fetch, request, or depend on remote URLs/network resources at runtime
- Dev-time scripts may fetch remote resources to produce local artifacts, but generated output must be committed and verified
- Tests must assert no runtime network dependencies exist (scan `src/` for `fetch(`, `XMLHttpRequest`, `http.get`, `http.request`, `https.get`, `https.request`, `navigator.sendBeacon`, `WebSocket`, `EventSource`)
- All data dependencies must be vendored locally via relative imports

## Repository Configuration

- Use `bun` instead of `npm`. Use `bunx` instead of `npx`.
- The repository uses bun package manager and the bun test runner.
- The `scripts/metrics.ts` script accepts a `--target` parameter to measure performance across different entry points: `parser`, `react`, `react-native`, `html`, or `solid` (defaults to `parser`).

## Coding Style

- Prefer `$.CHAR_*` constants from `src/constants.ts` over raw char code numbers for readability (e.g., `$.CHAR_SPACE` instead of `32`)

## Library Priorities

The priorities of this library are **correctness, speed, and small output size** in that order. Pursue these goals in sequence - correctness first, then performance, then bundle size optimization. Optimize code for best minification and tree shaking. Always prefer ES5 syntax when writing code to ensure the fastest implementation is used by the underlying JS engine.

## Key Library Files

### Core Parser & Types

- `src/parse.ts` - Core markdown parser with AST generation
- `src/types.ts` - TypeScript type definitions for AST nodes, options, and state
- `src/utils.ts` - Utility functions (entity decoding, sanitization, slugification, character classification)
- `src/constants.ts` - Character code constants (CHAR_SPACE, CHAR_TAB, etc.)
- `src/entities.generated.ts` - Auto-generated HTML entity mappings for CommonMark compliance

### Output Adapters

- `src/react.tsx` - React JSX compiler with rendering logic and component overrides
- `src/native.tsx` - React Native adapter
- `src/html.ts` - HTML output compiler with tag filtering and entity escaping
- `src/markdown.ts` - Markdown output adapter
- `src/solid.tsx` - SolidJS adapter
- `src/vue.tsx` - Vue.js adapter

### Entry Points

- `src/index.tsx` - Main entry point re-exporting parser, types, and utilities
- `src/index.cjs.tsx` - CommonJS entry point with deprecated exports

## Internationalization (i18n)

- All localized content in `src/i18n/`.
- Required files per language: `README.md`, `default-template.md`, `gfm-spec.md`, `markdown-spec.md`.
- UI strings in `src/i18n/ui-strings.ts`.
- Supported languages in `src/i18n/languages.ts`.
- Language ordering by global speakers ([Ethnologue 2025](https://www.ethnologue.com/insights/most-spoken-language/)): English, Mandarin Chinese, Hindi, Spanish, Arabic.
- Technical documentation standards: Simplified Chinese (Mandarin, 普通话), Modern Standard Hindi (मानक हिन्दी with formal आप pronoun).
- Code examples: Keep API names, package names, technical constants in English. Translate text content within code blocks (string literals, user-facing text, natural language comments, example markdown text) while preserving syntax and markup.
- Use `@lang <code>` JSDoc tags for multilingual documentation (Public APIs and types only): English baseline, then `@lang zh` for Chinese, `@lang hi` for Hindi, etc.
- Updates to `README.md` or public API documentation must be mirrored in all `src/i18n/{lang}/` files.
- All new changesets, public documentation, and public JSDoc comments should include translations for all supported languages (currently: English, Chinese, Hindi). Changesets use plain text translations (no `@lang` prefix).
- Run `bun run validate-i18n` before committing any i18n or documentation changes.
- New languages should have a PATCH changeset.
- Create language-specific rule files in `.cursor/rules/i18n-{lang}.mdc` for each new language containing: term translations, style guidelines, technical term handling, format conventions. Optimize for machine interpretation (no markdown formatting, minimal punctuation, concise directives).
- Prefer native/idiomatic words over transliterations for user-facing text (UI strings, alerts, documentation headings).
- For technical terms, provide both options: native word first, transliteration second (e.g., Hindi: सुझाव/टिप for "tip").
- Transliterations acceptable for programming-specific terms with no native equivalent (e.g., कंपोनेंट for "component").
- Verify translations match actual usage in target language technical communities (React docs, MDN, official framework translations).
