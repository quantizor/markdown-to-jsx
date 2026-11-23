---
"markdown-to-jsx": patch
---

A `]` right after a web address is no longer part of the link, so `[see https://example.com/a]` links to `https://example.com/a` instead of `https://example.com/a%5D`. A `]` stays in the address when it closes a `[` there (`?a[0]=1`) or when more address text follows it.
