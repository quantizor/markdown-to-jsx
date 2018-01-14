# Markdown Component for React, Preact + Friends

[![npm version](https://badge.fury.io/js/markdown-to-jsx.svg)](https://badge.fury.io/js/markdown-to-jsx) ![build status](https://api.travis-ci.org/probablyup/markdown-to-jsx.svg) [![codecov](https://codecov.io/gh/probablyup/markdown-to-jsx/branch/master/graph/badge.svg)](https://codecov.io/gh/probablyup/markdown-to-jsx) ![downloads](https://img.shields.io/npm/dm/markdown-to-jsx.svg)

<!-- TOC -->

- [Markdown Component for React, Preact + Friends](#markdown-component-for-react-preact-friends)
    - [Installation](#installation)
    - [Usage](#usage)
        - [Parsing Options](#parsing-options)
            - [options.forceBlock](#optionsforceblock)
            - [options.forceInline](#optionsforceinline)
            - [options.overrides - Override Any HTML Tag's Representation](#optionsoverrides---override-any-html-tags-representation)
            - [options.overrides - Rendering Arbitrary React Components](#optionsoverrides---rendering-arbitrary-react-components)
            - [options.rules - Rendering custom React components for Markdown rules](#optionsrules---rendering-custom-react-components-for-markdown-rules)
- [TODO: Fix](#todo-fix)
        - [Getting the smallest possible bundle size](#getting-the-smallest-possible-bundle-size)
        - [Usage with Preact](#usage-with-preact)
    - [Using The Compiler Directly](#using-the-compiler-directly)
    - [Changelog](#changelog)

<!-- /TOC -->

---

`markdown-to-jsx` uses a fork of [simple-markdown](https://github.com/Khan/simple-markdown) as its parsing engine and extends it in a number of ways to make your life easier. Notably, this package offers the following additional benefits:

* Arbitrary HTML is supported and parsed into the appropriate JSX representation
  without `dangerouslySetInnerHTML`

* Any HTML tags rendered by the compiler and/or `<Markdown>` component can be overridden to include additional
  props or even a different HTML representation entirely.

* GFM task list support.

* Fenced code blocks with [highlight.js](https://highlightjs.org/) support.

All this clocks in at around 5 kB gzipped, which is a fraction of the size of most other React markdown components.

Requires React >= 0.14.

## Installation

```shell
# if you use npm
npm i markdown-to-jsx

# if you use yarn
yarn add markdown-to-jsx
```

## Usage

`markdown-to-jsx` exports a React component by default for easy JSX composition:

ES6-style usage\*:

```jsx
import Markdown from 'markdown-to-jsx';
import React from 'react';
import { render } from 'react-dom';

const markdown = `# Hello world!`.trim();

render(<Markdown># Hello world!</Markdown>, document.body);

/*
    renders:

    <h1>Hello world!</h1>
 */
```

\* **NOTE: JSX does not natively preserve newlines in multiline text. In general, writing markdown directly in JSX is discouraged and it's a better idea to keep your content in separate .md files and require them, perhaps using webpack's [raw-loader](https://github.com/webpack-contrib/raw-loader).**

### Parsing Options

#### options.forceBlock

By default, the compiler will try to make an intelligent guess about the content passed and wrap it in a `<div>`, `<p>`, or `<span>` as needed to satisfy the "inline"-ness of the markdown. For instance, this string would be considered "inline":

```md
Hello. _Beautiful_ day isn't it?
```

But this string would be considered "block" due to the existence of a header tag, which is a block-level HTML element:

```md
# Whaddup?
```

However, if you really want all input strings to be treated as "block" layout, simply pass `options.forceBlock = true` like this:

```jsx
<Markdown options={{ forceBlock: true }}>Hello there old chap!</Markdown>;

// or

compiler('Hello there old chap!', { forceBlock: true });

// renders

<p>Hello there old chap!</p>;
```

#### options.forceInline

The inverse is also available by passing `options.forceInline = true`:

```jsx
<Markdown options={{ forceInline: true }}># You got it babe!</Markdown>;

// or

compiler('# You got it babe!', { forceInline: true });

// renders

<span># You got it babe!</span>;
```

#### options.overrides - Override Any HTML Tag's Representation

Pass the `options.overrides` prop to the compiler or `<Markdown>` component to seamlessly revise the rendered representation of any HTML tag. You can choose to change the component itself, add/change props, or both.

```jsx
import Markdown from 'markdown-to-jsx';
import React from 'react';
import { render } from 'react-dom';

// surprise, it's a div instead!
const MyParagraph = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);

render(
  <Markdown
    options={{
      overrides: {
        h1: {
          component: MyParagraph,
          props: {
            className: 'foo'
          }
        }
      }
    }}>
    # Hello world!
  </Markdown>,
  document.body
);

/*
    renders:

    <div class="foo">
        Hello World
    </div>
 */
```

If you only wish to provide a component override, a simplified syntax is available:

```js
{
    overrides: {
        h1: MyParagraph,
    },
}
```

Depending on the type of element, there are some props that must be preserved to ensure the markdown is converted as intended. They are:

* `a`: `title`, `href`
* `img`: `title`, `alt`, `src`
* `input[type="checkbox"]`: `checked`, `readonly` (specifically, the one rendered by a GFM task list)
* `ol`: `start`
* `td`: `style`
* `th`: `style`

Any conflicts between passed `props` and the specific properties above will be resolved in favor of `markdown-to-jsx`'s code.

#### options.overrides - Rendering Arbitrary React Components

One of the most interesting use cases enabled by the HTML syntax processing in `markdown-to-jsx` is the ability to use any kind of element, even ones that aren't real HTML tags like React component classes.

By adding an override for the components you plan to use in markdown documents, it's possible to dynamically render almost anything. One possible scenario could be writing documentation:

```jsx
import Markdown from 'markdown-to-jsx';
import React from 'react';
import { render } from 'react-dom';

import DatePicker from './date-picker';

const md = `
# DatePicker

The DatePicker works by supplying a date to bias towards,
as well as a default timezone.

<DatePicker biasTowardDateTime="2017-12-05T07:39:36.091Z" timezone="UTC+5" />
`;

render(
  <Markdown
    children={md}
    options={{
      overrides: {
        DatePicker: {
          component: DatePicker
        }
      }
    }}
  />,
  document.body
);
```

`markdown-to-jsx` also handles JSX interpolation syntax, but in a minimal way to not introduce a potential attack vector. Interpolations are sent to the component as their raw string, which the consumer can then `eval()` or process as desired to their security needs.

In the following case, `DatePicker` could simply run `parseInt()` on the passed `startTime` for example:

```jsx
import Markdown from 'markdown-to-jsx';
import React from 'react';
import { render } from 'react-dom';

import DatePicker from './date-picker';

const md = `
# DatePicker

The DatePicker works by supplying a date to bias towards,
as well as a default timezone.

<DatePicker
  biasTowardDateTime="2017-12-05T07:39:36.091Z"
  timezone="UTC+5"
  startTime={1514579720511}
/>
`;

render(
  <Markdown
    children={md}
    options={{
      overrides: {
        DatePicker: {
          component: DatePicker
        }
      }
    }}
  />,
  document.body
);
```

Another possibility is to use something like [recompose's `withProps()` HOC](https://github.com/acdlite/recompose/blob/master/docs/API.md#withprops) to create various pregenerated scenarios and then reference them by name in the markdown:

```jsx
import Markdown from 'markdown-to-jsx';
import React from 'react';
import { render } from 'react-dom';
import withProps from 'recompose/withProps';

import DatePicker from './date-picker';

const DecemberDatePicker = withProps({
  range: {
    start: new Date('2017-12-01'),
    end: new Date('2017-12-31')
  },
  timezone: 'UTC+5'
})(DatePicker);

const md = `
# DatePicker

The DatePicker works by supplying a date to bias towards,
as well as a default timezone.

<DatePicker
  biasTowardDateTime="2017-12-05T07:39:36.091Z"
  timezone="UTC+5"
  startTime={1514579720511}
/>

Here's an example of a DatePicker pre-set to only the month of December:

<DecemberDatePicker />
`;

render(
  <Markdown
    children={md}
    options={{
      overrides: {
        DatePicker,
        DecemberDatePicker
      }
    }}
  />,
  document.body
);
```

#### options.rules - Rendering custom React components for Markdown rules

# TODO: Fix

While `options.overrides` allows you to override the individual components output, `options.rules` gives you complete flexibility to return whatever React component you want for each kind of Markdown type (`text`, `codeBlock`...). All the rules are defined on the [`RULES`](index.js#621) constant and are exported as `rules`. If you wanted to see what rules are available, you can do:

```jsx
import { rules } from 'markdown-to-jsx';

function printRules() {
  console.log(Object.keys(rules));
}
```

markdown-to-jsx expects the following props on each rule:

```javascript
{
    // A RegEx to match the Markdown
    match: blockRegex(/^(?: {4}[^\n]+\n*)+(?:\n *)+\n/),
    // The parse priority
    order: PARSE_PRIORITY_MAX, // = 1
    // How to parse the element, output will be passed to the `react` method
    parse(capture, parse, state) {
      return {
        content: 'blah'
      };
    },
    // Returns the React component representation of this Markdown rule
    react(node, output, state) {
      return (
        <p key={state.key}>This is my awesome component: {node.content}</p>
      );
    }
  },
```

You may use this function to return custom component objects on the server-side which need to be hydrated by the client (with `react-dom/server`).

### Getting the smallest possible bundle size

Many development conveniences are placed behind `process.env.NODE_ENV !== "production"` conditionals. When bundling your app, it's a good idea to replace these code snippets such that a minifier (like uglify) can sweep them away and leave a smaller overall bundle.

Here are instructions for some of the popular bundlers:

* [webpack](https://webpack.js.org/guides/production/#specify-the-environment)
* [browserify plugin](https://github.com/hughsk/envify)
* [parcel](https://parceljs.org/production.html)
* [fuse-box](http://fuse-box.org/plugins/replace-plugin#notes)

### Usage with Preact

Everything will work just fine! Simply [Alias `react` to `preact-compat`](https://github.com/developit/preact-compat#usage-with-webpack) like you probably already are doing.

## Using The Compiler Directly

If desired, the compiler function is a "named" export on the `markdown-to-jsx` module:

```jsx
import { compiler } from 'markdown-to-jsx';
import React from 'react';
import { render } from 'react-dom';

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

## Changelog

See [Github Releases](https://github.com/probablyup/markdown-to-jsx/releases).

MIT
