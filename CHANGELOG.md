# markdown-to-jsx

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
