---
"markdown-to-jsx": patch
---

A tab inside the text of a quote or list item now stays a tab instead of turning into spaces, so `> a\tb` keeps its tab. Tabs now count as spaces where the CommonMark spec allows either: between a link's address and its title (`[a](/u\t"t")`), before a heading's closing `#`, and at the end of a line. An inline code span that wraps onto an indented line now joins the two lines with one space, as the spec requires, instead of also keeping that line's indentation.
