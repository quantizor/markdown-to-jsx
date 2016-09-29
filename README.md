# markdown to jsx compiler

![build status](https://api.travis-ci.org/yaycmyk/markdown-to-jsx.svg) [![codecov](https://codecov.io/gh/yaycmyk/markdown-to-jsx/branch/master/graph/badge.svg)](https://codecov.io/gh/yaycmyk/markdown-to-jsx) ![downloads](https://img.shields.io/npm/dm/markdown-to-jsx.svg)

Enables the safe parsing of markdown into proper React JSX objects, so you don't need to use a pattern like `dangerouslySetInnerHTML` and potentially open your application up to security issues.

The only exception is arbitrary block-level HTML in the markdown (considered a markdown antipattern), which will still use the unsafe method.

Uses [remark-parse](https://github.com/wooorm/remark-parse) under the hood to parse markdown into a consistent AST format. The following [remark](https://github.com/wooorm/remark) settings are set by `markdown-to-jsx`:

- footnotes: true
- gfm: true
- position: false

Requires React >= 0.14.

## Usage

The default export function signature:

```js
compiler(markdown: string, options: object?)
```

ES6-style usage:

```js
import compiler from 'markdown-to-jsx';
import React from 'react';
import {render} from 'react-dom';

render(compiler('# Hello world!'), document.body);
```

Override a particular HTML tag's output:

```jsx
import compiler from 'markdown-to-jsx';
import React from 'react';
import {render} from 'react-dom';

// surprise, it's a div instead!
const MyParagraph = ({children, ...props}) => (<div {...props}>{children}</div>);

render(
    compiler('# Hello world!', {
        overrides: {
            h1: {
                component: MyParagraph,
                props: {
                    className: 'foo',
                },
            },
        },
    }), document.body
);

/*
    renders:

    <div class="foo">
        Hello World
    </div>
 */
```

Depending on the type of element, there are some props that must be preserved to ensure the markdown is converted as intended. They are:

- `a`: `title`, `href`
- `img`: `title`, `alt`, `src`
- `input[type="checkbox"]`: `checked`, `readonly` (specifically, the one rendered by a GFM task list)
- `ol`: `start`
- `td`: `style`
- `th`: `style`

Any conflicts between passed `props` and the specific properties above will be resolved in favor of `markdown-to-jsx`'s code.

MIT
