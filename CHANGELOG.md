# markdown-to-jsx

## 7.4.6

### Patch Changes

- a9e5276: Browsers assign element with `id` to the global scope using the value as the variable name. E.g.: `<h1 id="analytics">` can be referenced via `window.analytics`.
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

## 7.4.5

### Patch Changes

- f5a0079: fix: double newline between consecutive blockquote syntax creates separate blockquotes

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

## 7.4.4

### Patch Changes

- 8eb8a13: Handle newlines inside of HTML tags themselves (not just nested children.)
- c72dd31: Default `children` to an empty string if no content is passed.
- 4f752c8: Fix handling of deeply-nested HTML in some scenarios.
- 1486aa4: Handle extra brackets in links, thanks @zegl!
- 1486aa4: Allow a newline to appear within inline formatting like bold, emphasis, etc, thanks @austingreco!
- 1486aa4: Starting using changesets
- fd35402: Fix HTML block regex for custom component scenarios where a nested component shares the same prefix as the parent, e.g. Accordion vs AccordionItem.
- 1486aa4: Fix support for multi-line footnotes, thanks @zegl!
