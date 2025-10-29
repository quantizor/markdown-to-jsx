---
"markdown-to-jsx": major
---

Adopt CommonMark-compliant class naming for code blocks

## Breaking Change

Code blocks now use the `language-` class name prefix instead of `lang-` to match the CommonMark specification.

### Before

```markdown
```js
console.log('hello');
\```
```

Generated:
```html
<pre><code class="lang-js">console.log('hello');</code></pre>
```

### After

```markdown
```js
console.log('hello');
\```
```

Generated:
```html
<pre><code class="language-js">console.log('hello');</code></pre>
```

## Migration

If you have CSS targeting `.lang-*` classes, update your selectors to use `.language-*` instead:

```css
/* Before */
.lang-js {
  color: blue;
}

/* After */
.language-js {
  color: blue;
}
```

Or use a more flexible selector that matches both:

```css
code[class^="lang"] {
  color: blue;
}
```

## Rationale

The CommonMark specification explicitly uses `language-` as the class name prefix for fenced code blocks. This change ensures compliance with the specification and improves interoperability with other CommonMark-compliant tools.

