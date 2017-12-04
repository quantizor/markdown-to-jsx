import Markdown, {compiler} from './index';
import React from 'react';
import ReactDOM from 'react-dom';

const dom = ReactDOM.findDOMNode;

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
            const element = render(compiler('Hello.'));
            const $element = dom(element);

            expect($element.textContent).toBe('Hello.');
        });

        it('wraps multiple block element returns in a div to avoid invalid nesting errors', () => {
            const element = render(compiler('# Boop\n\n## Blep'));
            const $element = dom(element);

            expect($element.outerHTML).toMatchSnapshot();
        });

        it('wraps solely inline elements in a paragraph, rather than a div', () => {
            const element = render(compiler('Hello. _Beautiful_ day isn\'t it?'));
            const $element = dom(element);

            expect($element.outerHTML).toMatchSnapshot();
        });

        describe('inline textual elements', () => {
            it('should handle emphasized text', () => {
                const element = render(compiler('*Hello.*'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle double-emphasized text', () => {
                const element = render(compiler('**Hello.**'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle triple-emphasized text', () => {
                const element = render(compiler('***Hello.***'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle the alternate form of bold/italic', () => {
                const element = render(compiler('___Hello.___'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle deleted text', () => {
                const element = render(compiler('~~Hello.~~'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle escaped text', () => {
                const element = render(compiler('Hello.\\_\\_foo\\_\\_'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });
        });

        describe('misc block level elements', () => {
            it('should handle blockquotes', () => {
                const element = render(compiler('> Something important, perhaps?'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });
        });

        describe('headings', () => {
            it('should handle level 1 properly', () => {
                const element = render(compiler('# Hello World'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle level 2 properly', () => {
                const element = render(compiler('## Hello World'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle level 3 properly', () => {
                const element = render(compiler('### Hello World'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle level 4 properly', () => {
                const element = render(compiler('#### Hello World'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle level 5 properly', () => {
                const element = render(compiler('##### Hello World'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle level 6 properly', () => {
                const element = render(compiler('###### Hello World'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle setext level 1 style', () => {
                const element = render(compiler('Hello World\n===========\n\nsomething'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle setext level 2 style', () => {
                const element = render(compiler('Hello World\n-----------\n\nsomething'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });
        });

        describe('images', () => {
            it('should handle a basic image', () => {
                const element = render(compiler('![](/xyz.png)'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle an image with alt text', () => {
                const element = render(compiler('![test](/xyz.png)'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle an image with title', () => {
                const element = render(compiler('![test](/xyz.png "foo")'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle an image reference', () => {
                const element = render(compiler([
                    '![][1]',
                    '[1]: /xyz.png',
                ].join('\n')));

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle an image reference with alt text', () => {
                const element = render(compiler([
                    '![test][1]',
                    '[1]: /xyz.png',
                ].join('\n')));

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle an image reference with title', () => {
                const element = render(compiler([
                    '![test][1]',
                    '[1]: /xyz.png "foo"',
                ].join('\n')));

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });
        });

        describe('links', () => {
            it('should handle a basic link', () => {
                const element = render(compiler('[foo](/xyz.png)'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle a link with title', () => {
                const element = render(compiler('[foo](/xyz.png "bar")'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle a link reference', () => {
                const element = render(compiler([
                    '[foo][1]',
                    '[1]: /xyz.png',
                ].join('\n')));

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle a link reference with title', () => {
                const element = render(compiler([
                    '[foo][1]',
                    '[1]: /xyz.png "bar"',
                ].join('\n')));

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle autolink style', () => {
                const element = render(compiler('<https://google.com>'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle a mailto autolink', () => {
                const element = render(compiler('<mailto:probablyup@gmail.com>'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should an email autolink and add a mailto: prefix', () => {
                const element = render(compiler('<probablyup@gmail.com>'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should automatically link found URLs', () => {
                const element = render(compiler('https://google.com'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should sanitize links containing JS expressions', () => {
                const element = render(compiler('[foo](javascript:doSomethingBad)'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should sanitize links containing invalid characters', () => {
                const element = render(compiler('[foo](https://google.com/%AF)'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });
        });

        describe('lists', () => {
            it('should handle a tight list', () => {
                const element = render(compiler([
                    '- xyz',
                    '- abc',
                    '- foo',
                ].join('\n')));

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle a loose list', () => {
                const element = render(compiler([
                    '- xyz',
                    '',
                    '- abc',
                    '',
                    '- foo',
                ].join('\n')));

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle an ordered list', () => {
                const element = render(compiler([
                    '1. xyz',
                    '1. abc',
                    '1. foo',
                ].join('\n')));

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle an ordered list with a specific start index', () => {
                const element = render(compiler([
                    '2. xyz',
                    '3. abc',
                    '4. foo',
                ].join('\n')));

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle a nested list', () => {
                const element = render(compiler([
                    '- xyz',
                    '  - abc',
                    '- foo',
                ].join('\n')));

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });
        });

        describe('GFM task lists', () => {
            it('should handle unchecked items', () => {
                const element = render(compiler('- [ ] foo'));
                const $element = dom(element);
                const checkbox = $element.querySelector('ul li input');

                expect($element.outerHTML).toMatchSnapshot();
                expect(checkbox.checked).toBe(false);
            });

            it('should handle checked items', () => {
                const element = render(compiler('- [x] foo'));
                const $element = dom(element);
                const checkbox = $element.querySelector('ul li input');

                expect($element.outerHTML).toMatchSnapshot();
                expect(checkbox.checked).toBe(true);
            });

            it('should mark the checkboxes as readonly', () => {
                const element = render(compiler('- [x] foo'));
                const $element = dom(element);
                const checkbox = $element.querySelector('ul li input');

                expect(checkbox).not.toBe(null);
                expect(checkbox.readOnly).toBe(true);
            });
        });

        describe('GFM tables', () => {
            it('should handle a basic table', () => {
                const element = render(compiler([
                    'foo|bar',
                    '---|---',
                    '1  |2',
                    '',
                ].join('\n')));

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle a table with aligned columns', () => {
                const element = render(compiler([
                    'foo|bar|baz',
                    '--:|:---:|:--',
                    '1|2|3',
                    '',
                ].join('\n')));

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });
        });

        describe('arbitrary HTML', () => {
            it('preserves the HTML given', () => {
                const element = render(compiler('<dd>Hello</dd>'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('processes markdown within inline HTML', () => {
                const element = render(compiler('<time>**Hello**</time>'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('processes markdown within nested inline HTML', () => {
                const element = render(compiler('<time><span>**Hello**</span></time>'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('processes attributes within inline HTML', () => {
                const element = render(compiler('<time data-foo="bar">Hello</time>'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('processes attributes that need JSX massaging within inline HTML', () => {
                const element = render(compiler('<span tabindex="0">Hello</span>'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('processes inline HTML with inline styles', () => {
                const element = render(compiler('<span style="color: red; position: top; margin-right: 10px">Hello</span>'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('processes markdown within block-level arbitrary HTML', () => {
                const element = render(compiler('<p>**Hello**</p>'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('renders inline <code> tags', () => {
                const element = render(compiler('Text and <code>**code**</code>'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('handles self-closing html inside parsable html (regression)', () => {
                const element = render(compiler('<a href="https://opencollective.com/react-dropzone/sponsor/0/website" target="_blank"><img src="https://opencollective.com/react-dropzone/sponsor/0/avatar.svg"></a>'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('throws out HTML comments', () => {
                const element = render(compiler('Foo\n<!-- blah -->'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });
        });

        describe('horizontal rules', () => {
            it('should be handled', () => {
                const element = render(compiler('---'));
                const $element = dom(element);

                expect($element).not.toBe(null);
                expect($element.tagName.toLowerCase()).toBe('hr');
            });
        });

        describe('line breaks', () => {
            it('should be added for 2-space sequences', () => {
                const element = render(compiler([
                    'hello  ',
                    'there',
                ].join('\n')));

                const $element = dom(element);
                const lineBreak = $element.querySelector('br');

                expect(lineBreak).not.toBe(null);
            });
        });

        describe('fenced code blocks', () => {
            it('should be handled', () => {
                const element = render(compiler([
                    '```js',
                    'foo',
                    '```',
                ].join('\n')));

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });
        });

        describe('indented code blocks', () => {
            it('should be handled', () => {
                const element = render(compiler('    foo\n\n'));

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });
        });

        describe('inline code blocks', () => {
            it('should be handled', () => {
                const element = render(compiler('`foo`'));
                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });
        });

        describe('footnotes', () => {
            it('should handle conversion of references into links', () => {
                const element = render(compiler([
                    'foo[^abc] bar',
                    '',
                    '[^abc]: Baz baz',
                ].join('\n')));

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should inject the definitions in a footer at the end of the root', () => {
                const element = render(compiler([
                    'foo[^abc] bar',
                    '',
                    '[^abc]: Baz baz',
                ].join('\n')));

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should handle single word footnote definitions', () => {
                const element = render(compiler([
                    'foo[^abc] bar',
                    '',
                    '[^abc]: Baz',
                ].join('\n')));

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
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

                const element = render(
                    compiler('Hello.\n\n', {overrides: {p: {component: FakeParagraph}}})
                );

                const $element = dom(element);

                expect($element.className).toBe('foo');
                expect($element.textContent).toBe('Hello.');
            });

            it('should add props to the appropriate JSX tag if supplied', () => {
                const element = render(
                    compiler('Hello.\n\n', {overrides: {p: {props: {className: 'abc'}}}})
                );

                const $element = dom(element);

                expect($element.className).toBe('abc');
                expect($element.textContent).toBe('Hello.');
            });

            it('should add props to pre & code tags if supplied', () => {
                const element = render(
                    compiler(`
                        \`\`\`
                        foo
                        \`\`\`
                    `, {
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

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
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

                const element = render(
                    compiler(`
                        \`\`\`
                        foo
                        \`\`\`
                    `, {
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

                const $element = dom(element);

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should be able to override gfm task list items', () => {
                const element = render(compiler('- [ ] foo', {overrides: {li: {props: {className: 'foo'}}}}));
                const $element = dom(element).querySelector('li');

                expect($element.outerHTML).toMatchSnapshot();
            });

            it('should be able to override gfm task list item checkboxes', () => {
                const element = render(compiler('- [ ] foo', {overrides: {input: {props: {className: 'foo'}}}}));
                const $element = dom(element).querySelector('input');

                expect($element.outerHTML).toMatchSnapshot();
            });
        });
    });

    describe('component', () => {
        it('accepts markdown content', () => {
            const element = render(<Markdown>_Hello._</Markdown>);
            const $element = dom(element);

            expect($element.outerHTML).toMatchSnapshot();
        });

        it('accepts options', () => {
            class FakeParagraph extends React.Component {
                render () {
                    return (
                        <p className='foo'>{this.props.children}</p>
                    );
                }
            }

            const element = render(
                <Markdown options={{overrides: {p: {component: FakeParagraph}}}}>
                    _Hello._
                </Markdown>
            );

            const $element = dom(element);

            expect($element.outerHTML).toMatchSnapshot();
        });

        it('merges className overrides, rather than overwriting', () => {
            const code = [
                '```js',
                'foo',
                '```',
            ].join('\n');

            const element = render(
                <Markdown options={{overrides: {code: {props: {className: 'foo'}}}}}>
                    {code}
                </Markdown>
            );

            const $element = dom(element);

            expect($element.outerHTML).toMatchSnapshot();
        });
    });
});
