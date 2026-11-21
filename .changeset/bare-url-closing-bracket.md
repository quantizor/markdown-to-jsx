---
"markdown-to-jsx": patch
---

A `]` at the end of a web address now stays out of the link unless a `[` inside the address opened it. `[see https://example.com/a]` and `[GitHub repo][https://github.com/user/repo]` link to the address and leave the `]` as text after it, instead of linking to `https://example.com/a%5D`. The same applies with no `[` before the address, so `see https://example.com/a]` also links without the `]`. A `]` that closes a `[` inside the address, as in `?a[0]=1`, stays part of it, as does a `]` followed by more address text, as in `https://example.com/a]b`. An escaped `\]` after an address renders as a literal `]` outside the link.
