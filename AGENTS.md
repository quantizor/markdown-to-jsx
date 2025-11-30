You are maintaining markdown-to-jsx, a TypeScript-based toolchain containing an AST parser and output adapters for React, React Native, HTML, and Markdown.

See README.md for the primary library documentation.

The repository uses bun package manager and the bun test runner.

The `scripts/metrics.ts` script accepts a `--target` parameter to measure performance across different entry points: `parser`, `react`, `react-native`, `html`, or `solid` (defaults to `parser`).

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
