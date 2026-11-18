---
"markdown-to-jsx": patch
---

A web address written inside square brackets no longer takes the closing bracket into the link. `[see https://example.com/a]` and `[GitHub repo][https://github.com/user/repo]` now link to the address and leave the `]` as text after it, instead of linking to `https://example.com/a%5D`. A `]` that closes a `[` inside the address, as in `?a[0]=1`, stays part of it, and an address with no unclosed `[` before it is unchanged.
