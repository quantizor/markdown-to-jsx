# markdown to jsx converter

![build status](https://api.travis-ci.org/yaycmyk/markdown-to-jsx.svg)

Enables the safe parsing of markdown into proper React JSX objects, so you don't need to use a pattern like `dangerouslySetInnerHTML` and potentially open your application up to security issues.

The only exception is arbitrary HTML in the markdown (kind of an antipattern), which will still use the unsafe method.

Uses [remark](https://github.com/wooorm/remark) under the hood to parse markdown into a consistent AST format.

Requires React >= 0.14.

## Usage

```js
import converter from 'markdown-to-jsx';
import React from 'react';
import {render} from 'react-dom';

render(converter('# Hello world!'), document.body);
```

[remark options](https://github.com/wooorm/remark#remarkprocessvalue-options-done) can be passed as the second argument:

```js
converter('# Hello world[^2]!\n\n[^2]: A beautiful place.', {footnotes: true});
```

## Known Issues

- remark's handling of lists will sometimes add a child paragraph tag inside the
  `<li>` where it shouldn't exist - [Bug Ticket](https://github.com/wooorm/remark/issues/104)

- remark's handling of arbitrary HTML causes nodes to be split, which causes garbage and malformed HTML - [Bug Ticket](https://github.com/wooorm/remark/issues/124)

MIT
