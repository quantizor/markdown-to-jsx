---
"@marqdown/parser": minor
"@marqdown/react": minor
"@marqdown/native": minor
"@marqdown/solid": minor
"@marqdown/vue": minor
"@marqdown/html": minor
"@marqdown/markdown": minor
"markdown-to-jsx": minor
---

markdown-to-jsx is now published as a family of focused packages under the `@marqdown` scope, one per integration: `@marqdown/react`, `@marqdown/vue`, `@marqdown/solid`, `@marqdown/native`, `@marqdown/html`, `@marqdown/markdown`, and the framework-free `@marqdown/parser`. Each renderer package includes the parser and pulls in only the framework it targets, so an install carries just the integration in use. The `markdown-to-jsx` package remains available as a compatibility alias that re-exports these packages, deep imports included, so existing installs keep working and migrating stays optional. New code should install the specific `@marqdown/<integration>` package.
