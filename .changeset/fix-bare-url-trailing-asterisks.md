---
"markdown-to-jsx": patch
---

fix: strip trailing asterisks from bare URL href (fixes #839)

When a bare URL was wrapped in bold markdown (`**url**`), the generated link's `href` incorrectly included the closing asterisks (e.g. `href="https://example.com/foo**"`). The parser now trims trailing `*` from bare URLs so the href is correct. No consumer changes required.
