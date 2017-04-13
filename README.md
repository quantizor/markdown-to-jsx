# markdown to jsx compiler

[![npm version](https://badge.fury.io/js/markdown-to-jsx.svg)](https://badge.fury.io/js/markdown-to-jsx) ![build status](https://api.travis-ci.org/probablyup/markdown-to-jsx.svg) [![codecov](https://codecov.io/gh/probablyup/markdown-to-jsx/branch/master/graph/badge.svg)](https://codecov.io/gh/probablyup/markdown-to-jsx) ![downloads](https://img.shields.io/npm/dm/markdown-to-jsx.svg)

Enables the safe parsing of markdown into proper React JSX objects, so you don't need to use a pattern like `dangerouslySetInnerHTML` and potentially open your application up to security issues.

The only exception is arbitrary block-level HTML in the markdown (considered a markdown antipattern), which will still use the unsafe method.

Uses [remark-parse](https://github.com/wooorm/remark-parse) under the hood to parse markdown into a consistent AST format. The following [remark](https://github.com/wooorm/remark) settings are set by `markdown-to-jsx`:

- footnotes: true
- gfm: true
- position: false

Requires React >= 0.14.

## Usage

`markdown-to-jsx` exports a React component by default for easy JSX composition (since version v5):

ES6-style usage\*:

```jsx
import Markdown from 'markdown-to-jsx';
import React from 'react';
import {render} from 'react-dom';

const markdown = `
# Hello world!
`.trim();

render((
    <Markdown>
        {markdown}
    </Markdown>
), document.body);

/*
    renders:

    <h1>Hello world!</h1>
 */
```

\* __NOTE: JSX does not natively preserve newlines in multiline text, which is why the example above is inside an ES6 template literal. In general, writing markdown directly in JSX is discouraged and it's a better idea to keep your content in separate .md files and require them, perhaps using webpack's [raw-loader](https://github.com/webpack-contrib/raw-loader).__

Override a particular HTML tag's output:

```jsx
import Markdown from 'markdown-to-jsx';
import React from 'react';
import {render} from 'react-dom';

// surprise, it's a div instead!
const MyParagraph = ({children, ...props}) => (<div {...props}>{children}</div>);

render((
    <Markdown
        options={{
            overrides: {
                h1: {
                    component: MyParagraph,
                    props: {
                        className: 'foo',
                    },
                },
            },
        }}>
        # Hello world!
    </Markdown>
), document.body);

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

## Using the compiler directly

If desired, the compiler function is a "named" export on the `markdown-to-jsx` module:

```jsx
import {compiler} from 'markdown-to-jsx';
import React from 'react';
import {render} from 'react-dom';

render(compiler('# Hello world!'), document.body);

/*
    renders:

    <h1>Hello world!</h1>
 */
```

It accepts the following arguments:

```js
compiler(markdown: string, options: object?)
```

MIT
