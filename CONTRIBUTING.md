# Contributing to markdown-to-jsx

First, welcome and thanks so much for your interest in helping to make this library the best it can be!

markdown-to-jsx v9 is a ground-up rewrite of the library to enable highest performance and 100% GFM+CommonMark specification compliance. Here are some general guidelines of what this library looks to solve:

- Smallest possible bundle size (a challenge given the complexity of the spec)
- Highly configurable
- Support rendering arbitrary HTML in markdown

## Writing a PR

A good pull request should include a description of the change, any relevant links (security advisories, reproduction sandbox, github issue), and at least one test. We're not aiming for 100% coverage, but try to add tests for the various angles that your code might be hit from including unhappy paths.

## Creating a New Integration

To add support for a new output format (e.g., Vue, Svelte, etc.), follow these steps:

### 1. Create the Entry Point

Create a new entry point file in `src/` that follows the same pattern as existing integrations (`react.tsx`, `html.ts`, `native.tsx`, `solid.tsx`). The file should export:

- `parser` - The markdown parser
- `compiler` - The compiler function
- `astTo{Output}` - Function to convert AST to the target format
- `RuleType` - Type definitions
- Common utilities (`sanitizer`, `slugify`)
- A default `Markdown` component (if applicable for the framework)

### 2. Update Build Configuration

- Add the entry point to `bunup.config.ts`
- Add exports to `package.json` for both ESM and CommonJS formats

### 3. Add Dependencies

For integrations that require a view library:

- Add the library as an **optional peer dependency** with permissive version ranges
- Add it as a **dev dependency** for testing

### 4. Support Options

- Support every option that makes sense for the output format
- For unsupported options, mark them as `optional & never` in the TypeScript type definition
- Document unsupported options in the README

### 5. Add to Metrics and Profile

Add the new target to both `scripts/metrics.ts` and `scripts/profile.ts` so it can be benchmarked and profiled for performance analysis.

### 6. Documentation

- Add the new entry point to the README.md entry points section
- Document any format-specific option customizations
- Include usage examples

### 7. Testing

- Research current-year best practices for the output format
- Start with comprehensive tests (TDD approach)
- Bring in testing helpers like `@testing-library/*` if needed
- Test all happy and unhappy paths

## Adding a New Language

Using Cursor or equivalent, run `/i18n <language>` in plan mode (e.g., `/i18n Spanish`). This automates the entire translation workflow including research, file creation, and validation. Review and approve the plan before execution.

**Language Ordering:** Languages must be ordered by total number of speakers globally (English first, then by descending speaker count). According to Ethnologue 2025 data ([source](https://www.ethnologue.com/insights/most-spoken-language/)):

1. English (1.5B speakers)
2. Mandarin Chinese (1.2B speakers)
3. Hindi (609M speakers)
4. Spanish (558M speakers)
5. Standard Arabic (335M speakers)

## Cutting a release

This is handled automatically via changesets.

## Code of Conduct

markdown-to-jsx is maintained by a diverse team and seeks to maintain a healthy, inclusive environment for contributors. Any slurs, hate speech, or other aggressions of that nature will not be tolerated and the relevant parties will be blocked from the repository. Zero exceptions, be professional.

Finally, please realize that this library is maintained by community volunteers. We are not compensated for our time and entitlement behavior will not be tolerated. You won't be blocked for acting this way, but don't expect a response.
