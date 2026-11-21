---
"markdown-to-jsx": patch
---

Runs of three or more tildes no longer produce strikethrough, matching GFM. `a ~~~c~~~ b` now renders as plain text instead of striking through part of it, and `~~~~` stays as literal tildes instead of becoming an empty strikethrough. A longer tilde run inside struck text, as in `~~a~~~b~~`, stays part of the struck text.
