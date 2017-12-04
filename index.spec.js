import Markdown, {compiler} from './index';
import React from 'react';
import ReactDOM from 'react-dom';

describe('markdown-to-jsx', () => {
    const root = document.body.appendChild(document.createElement('div'));
    function render (jsx) { return ReactDOM.render(jsx, root); }

    afterEach(() => ReactDOM.unmountComponentAtNode(root));

    describe('compiler', () => {
        it('should throw if not passed a string (first arg)', () => {
            expect(() => compiler('')).not.toThrow();

            expect(() => compiler()).toThrow();
            expect(() => compiler(1)).toThrow();
            expect(() => compiler(() => {})).toThrow();
            expect(() => compiler({})).toThrow();
            expect(() => compiler([])).toThrow();
            expect(() => compiler(null)).toThrow();
            expect(() => compiler(true)).toThrow();
        });

        it('should handle a basic string', () => {
            render(compiler('Hello.'));

            expect(root.textContent).toBe('Hello.');
        });

        it('wraps multiple block element returns in a div to avoid invalid nesting errors', () => {
            render(compiler('# Boop\n\n## Blep'));

            expect(root.innerHTML).toMatchSnapshot();
        });

        it('wraps solely inline elements in a paragraph, rather than a div', () => {
            render(compiler('Hello. _Beautiful_ day isn\'t it?'));

            expect(root.innerHTML).toMatchSnapshot();
        });

        describe('inline textual elements', () => {
            it('should handle emphasized text', () => {
                render(compiler('*Hello.*'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle double-emphasized text', () => {
                render(compiler('**Hello.**'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle triple-emphasized text', () => {
                render(compiler('***Hello.***'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle the alternate form of bold/italic', () => {
                render(compiler('___Hello.___'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle deleted text', () => {
                render(compiler('~~Hello.~~'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle escaped text', () => {
                render(compiler('Hello.\\_\\_foo\\_\\_'));

                expect(root.innerHTML).toMatchSnapshot();
            });
        });

        describe('misc block level elements', () => {
            it('should handle blockquotes', () => {
                render(compiler('> Something important, perhaps?'));

                expect(root.innerHTML).toMatchSnapshot();
            });
        });

        describe('headings', () => {
            it('should handle level 1 properly', () => {
                render(compiler('# Hello World'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle level 2 properly', () => {
                render(compiler('## Hello World'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle level 3 properly', () => {
                render(compiler('### Hello World'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle level 4 properly', () => {
                render(compiler('#### Hello World'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle level 5 properly', () => {
                render(compiler('##### Hello World'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle level 6 properly', () => {
                render(compiler('###### Hello World'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle setext level 1 style', () => {
                render(compiler('Hello World\n===========\n\nsomething'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle setext level 2 style', () => {
                render(compiler('Hello World\n-----------\n\nsomething'));

                expect(root.innerHTML).toMatchSnapshot();
            });
        });

        describe('images', () => {
            it('should handle a basic image', () => {
                render(compiler('![](/xyz.png)'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle an image with alt text', () => {
                render(compiler('![test](/xyz.png)'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle an image with title', () => {
                render(compiler('![test](/xyz.png "foo")'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle an image reference', () => {
                render(compiler([
                    '![][1]',
                    '[1]: /xyz.png',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle an image reference with alt text', () => {
                render(compiler([
                    '![test][1]',
                    '[1]: /xyz.png',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle an image reference with title', () => {
                render(compiler([
                    '![test][1]',
                    '[1]: /xyz.png "foo"',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });
        });

        describe('links', () => {
            it('should handle a basic link', () => {
                render(compiler('[foo](/xyz.png)'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle a link with title', () => {
                render(compiler('[foo](/xyz.png "bar")'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle a link reference', () => {
                render(compiler([
                    '[foo][1]',
                    '[1]: /xyz.png',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle a link reference with title', () => {
                render(compiler([
                    '[foo][1]',
                    '[1]: /xyz.png "bar"',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle autolink style', () => {
                render(compiler('<https://google.com>'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle a mailto autolink', () => {
                render(compiler('<mailto:probablyup@gmail.com>'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should an email autolink and add a mailto: prefix', () => {
                render(compiler('<probablyup@gmail.com>'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should automatically link found URLs', () => {
                render(compiler('https://google.com'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should sanitize links containing JS expressions', () => {
                render(compiler('[foo](javascript:doSomethingBad)'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should sanitize links containing invalid characters', () => {
                render(compiler('[foo](https://google.com/%AF)'));

                expect(root.innerHTML).toMatchSnapshot();
            });
        });

        describe('lists', () => {
            it('should handle a tight list', () => {
                render(compiler([
                    '- xyz',
                    '- abc',
                    '- foo',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle a loose list', () => {
                render(compiler([
                    '- xyz',
                    '',
                    '- abc',
                    '',
                    '- foo',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle an ordered list', () => {
                render(compiler([
                    '1. xyz',
                    '1. abc',
                    '1. foo',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle an ordered list with a specific start index', () => {
                render(compiler([
                    '2. xyz',
                    '3. abc',
                    '4. foo',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle a nested list', () => {
                render(compiler([
                    '- xyz',
                    '  - abc',
                    '- foo',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle a mixed nested list', () => {
                render(compiler([
                    '- xyz',
                    '  1. abc',
                    '    - def',
                    '- foo',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should not add an extra wrapper around a list', () => {
                render(compiler([
                    '',
                    '- xyz',
                    '  1. abc',
                    '    - def',
                    '- foo',
                    '',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });
        });

        describe('GFM task lists', () => {
            it('should handle unchecked items', () => {
                render(compiler('- [ ] foo'));

                const checkbox = root.querySelector('ul li input');

                expect(root.innerHTML).toMatchSnapshot();
                expect(checkbox.checked).toBe(false);
            });

            it('should handle checked items', () => {
                render(compiler('- [x] foo'));

                const checkbox = root.querySelector('ul li input');

                expect(root.innerHTML).toMatchSnapshot();
                expect(checkbox.checked).toBe(true);
            });

            it('should mark the checkboxes as readonly', () => {
                render(compiler('- [x] foo'));

                const checkbox = root.querySelector('ul li input');

                expect(checkbox).not.toBe(null);
                expect(checkbox.readOnly).toBe(true);
            });
        });

        describe('GFM tables', () => {
            it('should handle a basic table', () => {
                render(compiler([
                    'foo|bar',
                    '---|---',
                    '1  |2',
                    '',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle a table with aligned columns', () => {
                render(compiler([
                    'foo|bar|baz',
                    '--:|:---:|:--',
                    '1|2|3',
                    '',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });
        });

        describe('arbitrary HTML', () => {
            it('preserves the HTML given', () => {
                render(compiler('<dd>Hello</dd>'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('processes markdown within inline HTML', () => {
                render(compiler('<time>**Hello**</time>'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('processes markdown within nested inline HTML', () => {
                render(compiler('<time><span>**Hello**</span></time>'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('processes attributes within inline HTML', () => {
                render(compiler('<time data-foo="bar">Hello</time>'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('processes attributes that need JSX massaging within inline HTML', () => {
                render(compiler('<span tabindex="0">Hello</span>'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('processes inline HTML with inline styles', () => {
                render(compiler('<span style="color: red; position: top; margin-right: 10px">Hello</span>'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('processes markdown within block-level arbitrary HTML', () => {
                render(compiler('<p>**Hello**</p>'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('renders inline <code> tags', () => {
                render(compiler('Text and <code>**code**</code>'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('handles self-closing html inside parsable html (regression)', () => {
                render(compiler('<a href="https://opencollective.com/react-dropzone/sponsor/0/website" target="_blank"><img src="https://opencollective.com/react-dropzone/sponsor/0/avatar.svg"></a>'));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('throws out HTML comments', () => {
                render(compiler('Foo\n<!-- blah -->'));

                expect(root.innerHTML).toMatchSnapshot();
            });
        });

        describe('horizontal rules', () => {
            it('should be handled', () => {
                render(compiler('---'));

                expect(root.innerHTML).toMatchSnapshot();
            });
        });

        describe('line breaks', () => {
            it('should be added for 2-space sequences', () => {
                render(compiler([
                    'hello  ',
                    'there',
                ].join('\n')));

                const lineBreak = root.querySelector('br');

                expect(lineBreak).not.toBe(null);
            });
        });

        describe('fenced code blocks', () => {
            it('should be handled', () => {
                render(compiler([
                    '```js',
                    'foo',
                    '```',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });
        });

        describe('indented code blocks', () => {
            it('should be handled', () => {
                render(compiler('    foo\n\n'));

                expect(root.innerHTML).toMatchSnapshot();
            });
        });

        describe('inline code blocks', () => {
            it('should be handled', () => {
                render(compiler('`foo`'));

                expect(root.innerHTML).toMatchSnapshot();
            });
        });

        describe('footnotes', () => {
            it('should handle conversion of references into links', () => {
                render(compiler([
                    'foo[^abc] bar',
                    '',
                    '[^abc]: Baz baz',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should inject the definitions in a footer at the end of the root', () => {
                render(compiler([
                    'foo[^abc] bar',
                    '',
                    '[^abc]: Baz baz',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle single word footnote definitions', () => {
                render(compiler([
                    'foo[^abc] bar',
                    '',
                    '[^abc]: Baz',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });
        });

        describe('overrides', () => {
            it('should substitute the appropriate JSX tag if given a component', () => {
                class FakeParagraph extends React.Component {
                    render () {
                        return (
                            <p className='foo'>{this.props.children}</p>
                        );
                    }
                }

                render(
                    compiler('Hello.\n\n', {overrides: {p: {component: FakeParagraph}}})
                );

                expect(root.children[0].className).toBe('foo');
                expect(root.children[0].textContent).toBe('Hello.');
            });

            it('should add props to the appropriate JSX tag if supplied', () => {
                render(
                    compiler('Hello.\n\n', {overrides: {p: {props: {className: 'abc'}}}})
                );

                expect(root.children[0].className).toBe('abc');
                expect(root.children[0].textContent).toBe('Hello.');
            });

            it('should add props to pre & code tags if supplied', () => {
                render(
                    compiler([
                        '```',
                        'foo',
                        '```',
                    ].join('\n'), {
                        overrides: {
                            code: {
                                props: {
                                    'data-foo': 'bar',
                                },
                            },

                            pre: {
                                props: {
                                    className: 'abc',
                                },
                            },
                        },
                    })
                );

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should substitute pre & code tags if supplied with an override component', () => {
                class OverridenPre extends React.Component {
                    render () {
                        const {children, ...props} = this.props;

                        return (
                            <pre {...props} data-bar='baz'>{children}</pre>
                        );
                    }
                }

                class OverridenCode extends React.Component {
                    render () {
                        const {children, ...props} = this.props;

                        return (
                            <code {...props} data-baz='fizz'>{children}</code>
                        );
                    }
                }

                render(
                    compiler([
                        '```',
                        'foo',
                        '```',
                    ].join('\n'), {
                        overrides: {
                            code: {
                                component: OverridenCode,
                                props: {
                                    'data-foo': 'bar',
                                },
                            },

                            pre: {
                                component: OverridenPre,
                                props: {
                                    className: 'abc',
                                },
                            },
                        },
                    })
                );

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should be able to override gfm task list items', () => {
                render(compiler('- [ ] foo', {overrides: {li: {props: {className: 'foo'}}}}));
                const $element = root.querySelector('li');

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should be able to override gfm task list item checkboxes', () => {
                render(compiler('- [ ] foo', {overrides: {input: {props: {className: 'foo'}}}}));
                const $element = root.querySelector('input');

                expect($element.outerHTML).toMatchSnapshot();
            });
        });
    });

    describe('component', () => {
        it('accepts markdown content', () => {
            render(<Markdown>_Hello._</Markdown>);

            expect(root.innerHTML).toMatchSnapshot();
        });

        it('accepts options', () => {
            class FakeParagraph extends React.Component {
                render () {
                    return (
                        <p className='foo'>{this.props.children}</p>
                    );
                }
            }

            render(
                <Markdown options={{overrides: {p: {component: FakeParagraph}}}}>
                    _Hello._
                </Markdown>
            );

            expect(root.innerHTML).toMatchSnapshot();
        });

        it('merges className overrides, rather than overwriting', () => {
            const code = [
                '```js',
                'foo',
                '```',
            ].join('\n');

            render(
                <Markdown options={{overrides: {code: {props: {className: 'foo'}}}}}>
                    {code}
                </Markdown>
            );

            expect(root.innerHTML).toMatchSnapshot();
        });
    });
});
