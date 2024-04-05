---
"markdown-to-jsx": patch
---

Browsers assign element with `id` to the global scope using the value as the variable name. E.g.: `<h1 id="analytics">` can be referenced via `window.analytics`.
This can be a problem when a name conflict happens. For instance, pages that expect `analytics.push()` to be a function will stop working if the an element with an `id` of `analytics` exists in the page.

In this change, we export the `slugify` function so that users can easily augment it. 
This can be used to avoid variable name conflicts by giving the element a different `id`.

```js
import { slugify } from 'markdown-to-jsx';

options={{
  slugify: str => {
    let result = slugify(str)

    return result ? '-' + str : result;
  }
}}
```
