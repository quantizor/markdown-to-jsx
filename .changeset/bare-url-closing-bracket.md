---
"markdown-to-jsx": patch
---

A web address no longer takes a closing `]` it did not open into the link. `[see https://example.com/a]` and `[GitHub repo][https://github.com/user/repo]` now link to the address and leave the `]` as text after it, instead of linking to `https://example.com/a%5D`, and an escaped `\]` after an address renders as a literal `]` outside the link. A `]` that closes a `[` inside the address, as in `?a[0]=1`, stays part of it.
