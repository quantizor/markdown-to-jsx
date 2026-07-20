---
"markdown-to-jsx": patch
---

The Vue renderer's `renderRule` types now reflect that a single rule can render more than one sibling node. The `next()` callback and a custom `renderRule` may return an array of nodes, matching what the renderer already produced at runtime, so TypeScript no longer flags valid pass-through overrides.
