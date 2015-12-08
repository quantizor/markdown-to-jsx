# markdown to jsx converter

![build status](https://api.travis-ci.org/yaycmyk/markdown-to-jsx.svg)

Enables the safe parsing of markdown into proper React JSX objects, so you don't need to use a pattern like `dangerouslySetInnerHTML` and potentially open your application up to security issues.

The only exception is arbitrary HTML in the markdown (kind of an antipattern), which will still use the unsafe method.

Uses [mdast](https://github.com/wooorm/mdast) under the hood to parse markdown into a consistent AST format.

Requires React >= 0.14.

## Usage

```js
import converter from 'markdown-to-jsx';
import React from 'react';
import {render} from 'react-dom';

render(converter('# Hello world!'), document.body);
```

[mdast options](https://github.com/wooorm/mdast#mdastprocessvalue-options-done) can be passed as the second argument:

```js
converter('# Hello world[^2]!\n\n[^2]: A beautiful place.', {footnotes: true});
```


## Development Checklist

- [x] Base library
- [x] Unit testing
- [x] Ship 1.0.0 to npm
- [ ] _stretch goal_ - don't use `dangerouslySetInnerHTML` for arbitrary HTML in the markdown

## Known Issues

- mdast's handling of lists will sometimes add a child paragraph tag inside the
  `<li>` where it shouldn't exist - [Bug Ticket](https://github.com/wooorm/mdast/issues/104)

- mdast does not currently have support for column-specific alignment in GFM tables -
  [Bug Ticket](https://github.com/wooorm/mdast/issues/105)

- mdast incorrectly parses footnote definitions with only one word - [Bug Ticket](https://github.com/wooorm/mdast/issues/106)

MIT
