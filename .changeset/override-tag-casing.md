---
"markdown-to-jsx": patch
---

A tag's first letter now decides how its override and its attributes are read, in every output. If you list components in `overrides`, or read attributes through `renderRule` or `parser()`, check the cases below.

- A tag that starts with an uppercase letter is a component and finds its `overrides` key ignoring case, so `<CARD>` and `<CaRd>` now use a `Card` key. A tag that starts with a lowercase letter is HTML, so `<card>` still never uses a `Card` key.
- A capitalized tag with no key renders as a plain element with its attributes as written, `{…}` included, and loses its event handlers. `<Table data={[1, 2, 3]} />` with no `Table` key gives `data="{[1, 2, 3]}"` rather than an array. A component you render through `renderRule` or `createElement` without listing it in `overrides` now receives that text, so list the tag in `overrides` to keep parsed values.
- An override on a lowercase tag receives its attributes as written text, so with `{ a: MyLink }`, `<a data={{"a":1}}>` gives MyLink the text `{{"a":1}}` to parse as it sees fit. An event handler on such a tag, quoted or `{…}`, stays on the parsed node as written text for `renderRule` and `parser()`, and never reaches MyLink or the page.
- `evalUnserializableExpressions` applies only to a capitalized tag listed in `overrides`.
