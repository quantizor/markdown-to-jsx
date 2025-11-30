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
