# markdown to jsx compiler

[![npm version](https://badge.fury.io/js/markdown-to-jsx.svg)](https://badge.fury.io/js/markdown-to-jsx) ![build status](https://api.travis-ci.org/probablyup/markdown-to-jsx.svg) [![codecov](https://codecov.io/gh/probablyup/markdown-to-jsx/branch/master/graph/badge.svg)](https://codecov.io/gh/probablyup/markdown-to-jsx) ![downloads](https://img.shields.io/npm/dm/markdown-to-jsx.svg)

`markdown-to-jsx` uses a fork of [simple-markdown](https://github.com/Khan/simple-markdown) as its parsing engine and extends it in a number of ways to make your life easier. Notably, this package offers the following additional benefits:

  - Arbitrary HTML is supported and parsed into the appropriate JSX representation
    without `dangerouslySetInnerHTML`

  - Any HTML tags rendered by the compiler and/or `<Markdown>` component can be overridden to include additional
    props or even a different HTML representation entirely.

  - GFM task list support.

  - Fenced code blocks with [highlight.js](https://highlightjs.org/) support.

All this clocks in at around 5 kB gzipped, which is a fraction of the size of most other React markdown components.

Requires React >= 0.14.

## Usage

`markdown-to-jsx` exports a React component by default for easy JSX composition (since version v5):

ES6-style usage\*:

```jsx
import Markdown from 'markdown-to-jsx';
import React from 'react';
import {render} from 'react-dom';

const markdown = `# Hello world!`.trim();

render((
    <Markdown>
        # Hello world!
    </Markdown>
), document.body);

/*
    renders:

    <h1>Hello world!</h1>
 */
```

\* __NOTE: JSX does not natively preserve newlines in multiline text. In general, writing markdown directly in JSX is discouraged and it's a better idea to keep your content in separate .md files and require them, perhaps using webpack's [raw-loader](https://github.com/webpack-contrib/raw-loader).__

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
