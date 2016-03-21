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
converter('* abc\n* def\n* ghi', {bullet: '*'});
```

_Footnotes are enabled by default as of `markdown-to-jsx@2.0.0`._

## Overriding tags and adding props

As of `markdown-to-jsx@2.0.0`, it's now possible to selectively override a given HTML tag's JSX representation. This is done through a new third argument to the converter: an object made of keys, each being the lowercase html tag name (p, figure, a, etc.) to be overridden.

Each override can be given a `component` that will be substituted for the tag name and/or `props` that will be applied as you would expect.

```js
converter('Hello there!', {}, {
    p: {
        component: MyParagraph,
        props: {
            className: 'foo'
        },
    }
});
```

The code above will replace all emitted `<p>` tags with the given component `MyParagraph`, and add the `className` specified in `props`.

Depending on the type of element, there are some props that must be preserved to ensure the markdown is converted as intended. They are:

- `a`: `title`, `href`
- `img`: `title`, `alt`, `src`
- `ol`: `start`
- `td`: `style`
- `th`: `style`

Any conflicts between passed `props` and the specific properties above will be resolved in favor of `markdown-to-jsx`'s code.

## Known Issues

- remark's handling of lists will sometimes add a child paragraph tag inside the
  `<li>` where it shouldn't exist - [Bug Ticket](https://github.com/wooorm/remark/issues/104)

- remark's handling of arbitrary HTML causes nodes to be split, which causes garbage and malformed HTML - [Bug Ticket](https://github.com/wooorm/remark/issues/124)

MIT
