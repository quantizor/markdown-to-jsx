# markdown to jsx converter

Enables the safe parsing of markdown into proper React JSX objects, so you don't need to use a pattern like `dangerouslySetInnerHTML` and potentially open your application up to security issues.

The only exception is arbitrary HTML in the markdown (kind of an antipattern), which will still use the unsafe method.

Requires React >= 0.14.

## Development Checklist

- [x] Base library
- [ ] Unit testing
- [ ] Ship 1.0.0 to npm

- [ ] _stretch goal_ - don't use `dangerouslySetInnerHTML` for arbitrary HTML in the markdown

## Known Issues

- mdast's handling of lists will sometimes add a child paragraph tag inside the
  `<li>` where it shouldn't exist - [Bug Ticket](https://github.com/wooorm/mdast/issues/104)

- mdast does not currently have support for column-specific alignment in GFM tables -
  [Bug Ticket](https://github.com/wooorm/mdast/issues/105)

- mdast incorrectly parses footnote definitions with only one word - [Bug Ticket](https://github.com/wooorm/mdast/issues/106)

MIT
