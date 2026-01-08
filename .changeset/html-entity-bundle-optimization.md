---
'markdown-to-jsx': patch
---

Automatic browser bundle optimization via conditional exports. Browser builds now automatically use DOM-based entity decoding (`textarea.innerHTML`) instead of shipping the full ~11KB entity lookup table, reducing gzipped bundle size by ~11KB.

This optimization is automatic for bundlers that support the `imports` field with `browser` condition (Webpack 5+, Vite, esbuild, Rollup, Parcel). No configuration required.

Server-side/Node.js builds retain the full O(1) entity lookup table for maximum performance.

This feature uses the [`imports` field](https://nodejs.org/api/packages.html#subpath-imports) in package.json. All modern bundlers support this field (Webpack 5+, Vite, esbuild, Rollup, Parcel).
