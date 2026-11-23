---
"markdown-to-jsx": patch
---

Runs of three or more tildes inside a line no longer strike text through, as GFM specifies, so `a ~~~c~~~ b` stays plain text and `a ~~~~ b` keeps its tildes.
