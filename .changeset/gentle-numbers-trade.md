---
"markdown-to-jsx": patch
---

Fixes the issue where link text containing multiple nested brackets is not parsed correctly.

Before: `[title[bracket1][bracket2]](url)` fails to parse as a link
After: `[title[bracket1][bracket2]](url)` correctly parses as a link
