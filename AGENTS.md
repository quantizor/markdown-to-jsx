You are maintaining markdown-to-jsx, a TypeScript-based toolchain containing an AST parser and output adapters for React, React Native, HTML, and Markdown.

See README.md for the primary library documentation.

## Repository Configuration

- Use `bun` instead of `npm`. Use `bunx` instead of `npx`.
- The repository uses bun package manager and the bun test runner.
- The `scripts/metrics.ts` script accepts a `--target` parameter to measure performance across different entry points: `parser`, `react`, `react-native`, `html`, or `solid` (defaults to `parser`).

## Library Priorities

The priorities of this library are bundle size, performance, and functionality in that order. Optimize code for best minification and tree shaking. Always prefer ES5 syntax when writing code to ensure the fastest implementation is used by the underlying JS engine.

## Testing Workflow

- Run `bun test` after each set of changes to ensure no regressions (currently 100% passing)
- Use `bun metrics` (run 3x) to check parser performance when changing library code
- Use `bun metrics` for quick parse speed analysis

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
- All new changesets, public documentation, and public JSDoc comments should include translations for all supported languages (currently: English, Chinese, Hindi).
- Run `bun run validate-i18n` before committing any i18n or documentation changes.
- New languages should have a PATCH changeset.
- Create language-specific rule files in `.cursor/rules/i18n-{lang}.mdc` for each new language containing: term translations, style guidelines, technical term handling, format conventions. Optimize for machine interpretation (no markdown formatting, minimal punctuation, concise directives).
- Prefer native/idiomatic words over transliterations for user-facing text (UI strings, alerts, documentation headings).
- For technical terms, provide both options: native word first, transliteration second (e.g., Hindi: सुझाव/टिप for "tip").
- Transliterations acceptable for programming-specific terms with no native equivalent (e.g., कंपोनेंट for "component").
- Verify translations match actual usage in target language technical communities (React docs, MDN, official framework translations).
