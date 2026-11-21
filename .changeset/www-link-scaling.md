---
"markdown-to-jsx": patch
---

Documents full of web addresses now parse in time proportional to their length. Before, the time grew with the square of the length on inputs such as many `www.` addresses with no `/` after them, or long runs of addresses with no spaces between them: a 200 KB run of `www._www._…` took over 7 seconds and now takes about 11 milliseconds, and a 280 KB run of `http://a_b.c_dhttp://a_b.c_d…` took over 5 seconds and now takes about 6 milliseconds. If you render markdown written by someone else, please upgrade.

A `www.` address whose own text holds no further dot, such as `www.foo` in `www.foo bar.com`, is no longer linked just because a dot appears later in the text.
