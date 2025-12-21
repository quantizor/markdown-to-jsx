---
"markdown-to-jsx": minor
---

Add React Server Components (RSC) support with automatic environment detection.

The `Markdown` component now seamlessly works in both RSC and client-side React environments without requiring 'use client' directives. The component automatically detects hook availability and adapts its behavior accordingly:

- In RSC environments: Uses direct compilation without hooks for optimal server performance
- In client environments: Uses hooks and memoization for optimal client performance
- `MarkdownProvider` and `MarkdownContext` gracefully become no-ops in RSC environments
- Maintains identical output and API in both contexts
- Zero breaking changes for existing users

This enables better bundle splitting and SSR performance by allowing markdown rendering to happen on the server when possible.
