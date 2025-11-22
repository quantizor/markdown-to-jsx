---
'markdown-to-jsx': minor
---

Adopt CommonMark-compliant class naming for code blocks

Code blocks now use both the `language-` and `lang-` class name prefixes to match the CommonMark specification for compatibility.

### Before

````md
```js
console.log('hello')
```
````

Generated:

```html
<pre><code class="lang-js">console.log('hello');</code></pre>
```

### After

````md
```js
console.log('hello')
```
````

Generated:

```html
<pre><code class="language-js lang-js">console.log('hello');</code></pre>
```
