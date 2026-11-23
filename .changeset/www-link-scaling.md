---
"markdown-to-jsx": patch
---

Long runs of web addresses parse over 600 times faster at 200 to 280 kB. A run of `www.` addresses, or of addresses with no spaces between them, took time that grew with the square of its length and now takes time proportional to it. If you render markdown written by someone else, please upgrade.

A `www.` address with no further dot, such as `www.foo` in `www.foo bar.com`, is no longer linked just because a later word has one.
