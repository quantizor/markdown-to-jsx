---
"markdown-to-jsx": patch
---

fix: double newline between consecutive blockquote syntax creates separate blockquotes

Previously, for consecutive blockquotes they were rendered as one:

**Input**
 
```md
> Block A.1
> Block A.2

> Block B.1
```

**Output**

```html
<blockquote>
  <p>Block A.1</p>
  <p>Block A.2</p>
  <p>Block.B.1</p>
</blockquote>
```

This is not compliant with the [GFM spec](https://github.github.com/gfm/#block-quotes) which states that consecutive blocks should be created if there is a blank line between them.
