You are maintaining markdown-to-jsx, a TypeScript-based toolchain containing an AST parser and output adapters for React, React Native, HTML, and Markdown.

See README.md for the primary library documentation.

The repository uses bun package manager and the bun test runner.

The `scripts/metrics.ts` script accepts a `--target` parameter to measure performance across different entry points: `parser`, `react`, `react-native`, `html`, or `solid` (defaults to `parser`).
