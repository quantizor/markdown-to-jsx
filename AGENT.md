# markdown-to-jsx Agent Rules

## Repository Overview

`markdown-to-jsx` is a lightweight, highly configurable React markdown component that converts markdown to JSX.

## Core Design Principles

### 1. Performance First

- Bundle size priority: Target is ~6.75 kB gzipped (enforced via size-limit)
- Performance optimization: Bundle size > Performance > Functionality (in that order)
- Tree shaking friendly: Optimize code for best minification and tree shaking
- ES5 syntax preferred: Use ES5 syntax for fastest JS engine implementation

### 2. Lightweight & Configurable

- Support GitHub-flavored markdown (Daring Fireball + GFM extensions)
- Configurable without compromising bundle size or ease of use for 99% of cases
- Support rendering arbitrary HTML in markdown without `dangerouslySetInnerHTML`

### 3. React-First Design

- Native JSX output without dangerous hacks
- Component override system for custom rendering
- Support for React-like libraries (Preact compatibility)

## Code Architecture

### Main Entry Point: `index.tsx`

The core architecture follows a parser-compiler-emitter pattern:

1. Parser: Converts markdown string to AST (Abstract Syntax Tree)
2. Compiler: Transforms AST to JSX elements
3. Emitter: Renders final React components

#### Key Functions:

- `compiler(markdown, options)`: Main entry point that orchestrates the entire process
- `parserFor(rules)`: Creates a parser from rule definitions
- `reactFor(renderer)`: Creates React renderer from rule renderers
- `createRenderer(rules, userRender)`: Combines rules with optional user overrides

### Rule System

Each markdown element is handled by a rule with this structure:

```typescript
{
  _qualify?: string[] | (source: string, state: State) => boolean, // Early exit check
  _match: (source: string, state: State) => RegExpMatchArray,      // Pattern matching
  _order: Priority,                                                // Processing priority
  _parse: (capture, parse, state) => ParserOutput,                // AST creation
  _render?: (node, output, state) => React.ReactNode              // JSX rendering
}
```

#### Priority Levels:

- `MAX (0)`: Must scan tree before everything else
- `HIGH (1)`: Block-level constructs
- `MED (2)`: Inline with more priority than other inline
- `LOW (3)`: Inline elements
- `MIN (4)`: Bare text and leftovers

### Performance Optimizations

1. Early Qualification: `_qualify` property allows quick rejection without expensive regex
2. Rule Ordering: Rules sorted by priority for efficient processing
3. State Management: Parser state tracks context (inline, block, list, etc.)
4. Regex Optimization: Carefully crafted regex patterns for performance
5. Conditional Code: Development-only code wrapped in `NODE_ENV` checks

## Development Rules

### Code Style & Standards

1. TypeScript: Full TypeScript support with strict typing
2. ES5 Compatibility: Prefer ES5 syntax for performance
3. Minimal Comments: Add comments sparingly, except for TypeScript interface documentation
4. No `any` Types: Avoid use of `any` in TypeScript
5. Preserve Comments: Don't remove existing code comments

### Performance Guidelines

1. Bundle Size Limits:
   - Module: 6.75 kB
   - Modern: 6.75 kB
2. Benchmarking: Regular performance testing against alternatives
3. Tree Shaking: Structure code for optimal tree shaking
4. Minification: Optimize for compression and mangling

### Testing Requirements

1. Test Coverage: Add tests for various angles including unhappy paths
2. Performance Tests: Include performance regression tests
3. Snapshot Testing: Use Jest snapshots for output verification
4. Edge Cases: Test exotic markdown scenarios

### Security Considerations

1. XSS Prevention: Sanitize URLs and attributes by default
2. HTML Parsing: Support arbitrary HTML but with safety measures
3. Override System: Allow voiding dangerous tags (script, iframe, etc.)

## Configuration Options

### Core Options

- `forceBlock/forceInline`: Control rendering context
- `wrapper`: Custom wrapper element or null for array output
- `overrides`: Component/tag overrides for custom rendering
- `renderRule`: Full control over rule rendering
- `sanitizer`: Custom URL/attribute sanitization
- `slugify`: Custom ID generation for headings
- `disableAutoLink`: Disable automatic link detection
- `disableParsingRawHTML`: Disable HTML parsing

### Advanced Features

- Alert Blockquotes: Support for `[!type]` syntax
- GFM Task Lists: `[ ]` and `[x]` syntax
- Footnotes: `[^1]` reference syntax
- Tables: GitHub-flavored table support
- Syntax Highlighting: Integration with highlight.js

## Build & Distribution

### Build Process

1. `bun run build`: uses microbundle, needed for benchmarking
2. `bun run size`: Automated bundle size checking
3. `bun run benchmark`: Performance comparison against a recent version of markdown-to-jsx

## Contributing Guidelines

### Scope Limitations

The library focuses on:

- Lightweight bundle size
- GitHub-flavored markdown support
- React-specific use cases
- Configurability without complexity

Features outside these goals are unlikely to be added.

### PR Requirements

1. Description: Create a changeset file in `.changesets` (random markdown file name) that describes the change, along with usage examples.
2. Tests: At least one test, including edge cases
3. Performance: Consider impact on bundle size and performance
4. Documentation: Update docs for new features

### Release Process

- Semantic Versioning: Follow semver strictly
- Changesets: Use changesets for version management
- Automated Builds: CI/CD for testing and building
- Release Notes: Detailed changelog with contributor credits

## Code Flow Summary

### Main Compilation Flow

1. Input Processing: Normalize whitespace, remove front matter
2. Context Detection: Determine if content is inline or block
3. Parsing: Apply rules in priority order to create AST
4. Rendering: Convert AST nodes to React elements
5. Output: Wrap in appropriate container or return array

### Rule Processing

1. Qualification: Quick check if rule applies (early exit)
2. Matching: Regex pattern matching on source
3. Parsing: Extract data and create AST node
4. Rendering: Convert AST node to React element

### State Management

Parser state tracks:

- `inline`: Whether parsing inline content
- `simple`: Whether parsing simple inline (no links)
- `list`: Whether inside a list
- `inHTML`: Whether inside HTML context
- `inTable`: Whether inside table
- `inAnchor`: Whether inside anchor link
- `key`: React key for rendering
- `prevCapture`: Previous captured text for lookbacks

This architecture enables efficient, flexible markdown parsing while maintaining the library's core principles of performance and lightweight design.
