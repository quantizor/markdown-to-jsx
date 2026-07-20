---
"markdown-to-jsx": patch
---

React Native footnote references now render as a superscript, matching the web renderers, instead of bold. Numeric markers use Unicode superscript characters so they sit raised and scale with the surrounding text, and you can style them with the new `styles.footnote` option. In the footnotes list, each note now reads on one line next to its number instead of below it.
