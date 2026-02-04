You are maintaining markdown-to-jsx, a TypeScript-based toolchain containing an AST parser and output adapters for React, React Native, HTML, and Markdown.

See README.md for the primary library documentation.

## Agent Rules

- never git push code that is broken or failing tests, 100% passing tests are required as a quality gate before committing
- Use conventional commit syntax
- Do not create summary documents, deliver a concise summary in the chat when appropriate.
- Do not create helper functions unless there are at least two instances of the same pattern and overall LOC is reduced
- Follow through on each refactor to its end, including cleanup of unused code (cleanup should be a separate TODO item)
- Consider the following dimensions when authoring or refactoring code:
  - Algorithmic Complexity: Optimize time (e.g., O(n) vs O(n²)) and space usage in loops, recursion, and data processing.
  - Data Structures: Use efficient types like Arrays for ordered data, Maps/Sets for lookups, avoiding slow object key iterations.
  - Function Overhead: Minimize deep recursion, excessive closures, or higher-order functions that create unnecessary scopes.
  - Memory Management: Prevent leaks via weak references (WeakMap/WeakSet), timely nulling variables, and reducing object allocations.
  - Garbage Collection: Avoid frequent allocations/deallocations that trigger GC pauses; use object pooling for reusables.
  - Asynchronous Efficiency: Leverage Promises, async/await, or generators to avoid callback hell and unnecessary awaits in loops.
  - Event Loop Blocking: Keep synchronous code short; offload heavy tasks to Web Workers or setTimeout for non-blocking.
  - DOM Interactions: Batch updates (e.g., via DocumentFragment), minimize reflows/repaints, use virtual DOM in frameworks.
  - Rendering Performance: Debounce/throttle event handlers, optimize CSS selectors, and use requestAnimationFrame for animations.
  - Network I/O: Cache responses (Service Workers, localStorage), minimize requests, compress data, and use lazy loading.
  - Parsing and Execution: Reduce code size via minification/tree-shaking, avoid eval(), and optimize regex patterns.
  - Dependency Management: Limit third-party libraries, use tree-shakable imports, and profile for bottlenecks.
  - Browser-Specific Quirks: Handle engine differences (e.g., V8 optimizations for hot paths), test on target environments.
- When writing commit messages and changesets, speak in general terms, not specific implementation details. Keep language concise and to the point.
- When writing commit messages on public code, focus on the user-facing change; how does this change benefit them? Ensure that noteworthy public changes and bugfixes have a changeset.
- When writing commit messages on private/infra code, focus on the technical change; how does this change benefit the codebase?
- Optimize new rules for token efficiency: no bold/emphasis, headers, and stylistic formatting, concise/compact and highly-specific language
- Remove examples unless critical for understanding
- Prefer abbreviations and acronyms when unambiguous
- Use minimal punctuation, only where necessary for clarity
- Remove meta-commentary about the rule itself
- Focus on actionable directives, not explanations
- Test assertions may only have a single possible result.
- Test assertions should cover both the content and shape of the result.
- Renderer suites should focus exclusively on renderer behavior, with the parser suite handling common parsing scenarios.
- 80% or greater cumulative coverage is required.
- Tests should always assert a specific result shape, generic existence checks like `toBeTruthy()` or `toBeDefined()` are not allowed.
- Add tests to existing test files rather than creating new ones.
- Inline snapshots are preferred for parser output tests instead of many small assertions against the structure of the AST.

## Repository Configuration

- Use `bun` instead of `npm`. Use `bunx` instead of `npx`.
- The repository uses bun package manager and the bun test runner.
- The `scripts/metrics.ts` script accepts a `--target` parameter to measure performance across different entry points: `parser`, `react`, `react-native`, `html`, or `solid` (defaults to `parser`).

## Coding Style

- Prefer `$.CHAR_*` constants from `src/constants.ts` over raw char code numbers for readability (e.g., `$.CHAR_SPACE` instead of `32`)

## Parser Performance

- Never use unbounded `indexOf`/`lastIndexOf`/`includes` in loops; always bound searches to the relevant range (e.g., current line end). Unbounded searches on large documents cause O(n*m) when called per-block/paragraph.
- Avoid nested quantifiers in regexes (e.g., `(\s*-+\s*)*`); these create exponential backtracking (ReDoS). Prefer charCode-based validators for hot-path patterns.
- Never place two adjacent quantifiers over overlapping char classes (e.g., `\s+[^>]*`); use a fixed-count lead (e.g., `\s[^>]*`) or merge into one class (`[^>]*`).
- Restrict `\s` to `[ \t]` when newlines are structurally invalid in the match (e.g., table separator lines); `\s` includes `\n` which causes cross-line backtracking.
- Don't narrow a char class (e.g., `[^>]` → `[^\n>]`) to fix ReDoS if the pattern legitimately spans lines; restructure to eliminate quantifier overlap instead.
- Use segment-tracking (`segStart`/`segEnd` indices, slice once) instead of char-by-char string concat (`out += s[i]`). Single-char concat dominates CPU on large inputs.
- Avoid `.split()`, `.match()`, `.slice()` inside tight loops; prefer charCode walks that extract results in a single pass.
- Profile with the largest benchmark input (`gfm-spec.md`, 211KB) to catch O(n*m) issues that only manifest at scale. Use `bun profile` to identify hot lines. The `--cpu-prof-md` flag produces a markdown-formatted profile (`CPU.*.md`) — prefer reading this file over parsing the raw `.cpuprofile` JSON.
- In Bun/JSC, string `+=` (rope concat) is faster than array-push + join for small/medium segments; only use array-join when building very large strings with many pieces.

## Library Priorities

The priorities of this library are **correctness, speed, and small output size** in that order. Pursue these goals in sequence - correctness first, then performance, then bundle size optimization. Optimize code for best minification and tree shaking. Always prefer ES5 syntax when writing code to ensure the fastest implementation is used by the underlying JS engine.

## Testing Workflow

- **There is no time limit for agent tasks.** Work until the task is complete.
- **The main branch always has a 100% pass rate.** Broken tests are always due to changes in the current branch, not the test suite itself.
- Always use a 5s timeout when running tests (e.g., `timeout 5 bun test`). Never increase this timeout; the full suite executes within 500ms. If tests hang, it indicates an infinite loop or regression in the code being changed, not a need for more time.
- Run `bun test` after each set of changes to ensure no regressions (currently 100% passing)
- Use `bun metrics` (run 3x) to check parser performance when changing library code
- Use `bun metrics` for quick parse speed analysis
- **Use inline snapshots (`toMatchInlineSnapshot()`) for parser, HTML compiler, and markdown compiler tests.** This makes test output explicit and easy to review. Avoid individual assertions like `expect(x).toBe(y)` when the full output can be captured in a snapshot.

### Debugging Failing Compiler Tests

- **When working on difficult failing compiler tests, individually isolate them and validate parser output first before going on to debug the compiler.** This helps distinguish between parser bugs and compiler bugs.
- **Add debug logging as needed to trace the behavior of the library.** Clean up debug logs only at the final end of the process after all tests are passing.
- **Do not create summaries after working on a task unless explicitly directed by the user.**

## Commit Workflow

- Rebuild the site (`bun build-site`) before committing if there are README.md or library code changes (test files are exempt)
- For public code: focus commit messages on user-facing changes and how they benefit users. Ensure noteworthy public changes and bugfixes have a changeset.
- For private/infra code: focus commit messages on technical changes and how they benefit the codebase. Keep it short.

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
