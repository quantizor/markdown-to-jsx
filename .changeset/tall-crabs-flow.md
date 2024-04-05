---
"markdown-to-jsx": patch
---

Prevent global namespace pollution

Browsers assign element with `id` to the global scope using the value as the variable name. E.g.: `<h1 id="analytics">` can be referenced via `window.analytics`.
This can be a problem when a name conflict happens. For instance, pages that expect `analytics.push()` to be a function will stop working if the an element with an `id` of `analytics` exists in the page.

In this change, we prefix the `id` with a `-`, making it an invalid JS variable name so it can't pollute the global scope. 
The browser behavior of automatically scrolling to the corresponding landmark still works as expected (e.g.: visiting /page#-section-heading will still automatically scroll the page to element with id="-section-heading".
