import Markdown, {compiler} from './index';
import React from 'react';
import ReactDOM from 'react-dom';

const dom = ReactDOM.findDOMNode;

describe('markdown-to-jsx', () => {
    const root = document.body.appendChild(document.createElement('div'));
    const render = jsx => ReactDOM.render(jsx, root);

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

        it('should discard the root <div> wrapper if there is only one root child', () => {
            const element = render(compiler('Hello.'));
            const $element = dom(element);

            expect($element.tagName.toLowerCase()).toBe('p');
        });

        it('should handle a basic string', () => {
            const element = render(compiler('Hello.'));
            const $element = dom(element);

            expect($element.textContent).toBe('Hello.');
        });

        it('should not introduce an intermediate wrapper for basic strings', () => {
            const element = render(compiler('Hello.'));
            const $element = dom(element);

            expect($element.childNodes.length).toBe(1);
            expect($element.childNodes[0].nodeType).toBe(3); // TEXT_NODE
        });

        describe('inline textual elements', () => {
            it('should handle emphasized text', () => {
                const element = render(compiler('_Hello._'));
                const $element = dom(element);

                const text = $element.querySelector('em');
                expect(text).not.toBe(null);
                expect(text.childNodes.length).toBe(1);
                expect(text.childNodes[0].nodeType).toBe(3); // TEXT_NODE
                expect(text.textContent).toBe('Hello.');
            });

            it('should handle double-emphasized text', () => {
                const element = render(compiler('__Hello.__'));
                const $element = dom(element);
                const text = $element.querySelector('strong');

                expect(text).not.toBe(null);
                expect(text.childNodes.length).toBe(1);
                expect(text.childNodes[0].nodeType).toBe(3); // TEXT_NODE
                expect(text.textContent).toBe('Hello.');
            });

            it('should handle triple-emphasized text', () => {
                const element = render(compiler('___Hello.___'));
                const $element = dom(element);
                const text = $element.querySelector('strong');

                expect(text).not.toBe(null);
                expect(text.childNodes.length).toBe(1);
                expect(text.childNodes[0].tagName).toBe('EM');
                expect(text.childNodes[0].childNodes[0].nodeType).toBe(3); // TEXT_NODE
                expect(text.childNodes[0].childNodes[0].textContent).toBe('Hello.');
            });

            it('should handle deleted text', () => {
                const element = render(compiler('~~Hello.~~'));
                const $element = dom(element);
                const text = $element.querySelector('del');

                expect(text).not.toBe(null);
                expect(text.childNodes.length).toBe(1);
                expect(text.childNodes[0].nodeType).toBe(3); // TEXT_NODE
                expect(text.textContent).toBe('Hello.');
            });

            it('should handle escaped text', () => {
                const element = render(compiler('Hello.\_\_'));
                const $element = dom(element);

                expect($element).not.toBe(null);
                expect($element.childNodes.length).toBe(1);
                expect($element.childNodes[0].nodeType).toBe(3); // TEXT_NODE
                expect($element.textContent).toBe('Hello.__');
            });
        });

        describe('headings', () => {
            it('should handle level 1 properly', () => {
                const element = render(compiler('# Hello World'));
                const $element = dom(element);

                expect($element).not.toBe(null);
                expect($element.tagName.toLowerCase()).toBe('h1');
                expect($element.textContent).toBe('Hello World');
            });

            it('should handle level 2 properly', () => {
                const element = render(compiler('## Hello World'));
                const $element = dom(element);

                expect($element).not.toBe(null);
                expect($element.tagName.toLowerCase()).toBe('h2');
                expect($element.textContent).toBe('Hello World');
            });

            it('should handle level 3 properly', () => {
                const element = render(compiler('### Hello World'));
                const $element = dom(element);

                expect($element).not.toBe(null);
                expect($element.tagName.toLowerCase()).toBe('h3');
                expect($element.textContent).toBe('Hello World');
            });

            it('should handle level 4 properly', () => {
                const element = render(compiler('#### Hello World'));
                const $element = dom(element);

                expect($element).not.toBe(null);
                expect($element.tagName.toLowerCase()).toBe('h4');
                expect($element.textContent).toBe('Hello World');
            });

            it('should handle level 5 properly', () => {
                const element = render(compiler('##### Hello World'));
                const $element = dom(element);

                expect($element).not.toBe(null);
                expect($element.tagName.toLowerCase()).toBe('h5');
                expect($element.textContent).toBe('Hello World');
            });

            it('should handle level 6 properly', () => {
                const element = render(compiler('###### Hello World'));
                const $element = dom(element);

                expect($element).not.toBe(null);
                expect($element.tagName.toLowerCase()).toBe('h6');
                expect($element.textContent).toBe('Hello World');
            });
        });

        describe('images', () => {
            it('should handle a basic image', () => {
                const element = render(compiler('![](/xyz.png)'));
                const $element = dom(element);
                const image = $element.querySelector('img');

                expect(image).not.toBe(null);
                expect(image.getAttribute('alt')).toBe(null);
                expect(image.getAttribute('title')).toBe(null);
                expect(image.src).toBe('/xyz.png');
            });

            it('should handle an image with alt text', () => {
                const element = render(compiler('![test](/xyz.png)'));
                const $element = dom(element);
                const image = $element.querySelector('img');

                expect(image).not.toBe(null);
                expect(image.getAttribute('alt')).toBe('test');
                expect(image.getAttribute('title')).toBe(null);
                expect(image.src).toBe('/xyz.png');
            });

            it('should handle an image with title', () => {
                const element = render(compiler('![test](/xyz.png "foo")'));
                const $element = dom(element);
                const image = $element.querySelector('img');

                expect(image).not.toBe(null);
                expect(image.getAttribute('alt')).toBe('test');
                expect(image.getAttribute('title')).toBe('foo');
                expect(image.src).toBe('/xyz.png');
            });

            it('should handle an image reference', () => {
                const element = render(compiler([
                    '![][1]',
                    '[1]: /xyz.png',
                ].join('\n')));

                const $element = dom(element);
                const image = $element.querySelector('img');

                expect(image).not.toBe(null);
                /* bug in mdast: https://github.com/wooorm/mdast/issues/103 */
                expect(image.getAttribute('alt')).toBe(null);
                expect(image.getAttribute('title')).toBe(null);
                expect(image.src).toBe('/xyz.png');
            });

            it('should handle an image reference with alt text', () => {
                const element = render(compiler([
                    '![test][1]',
                    '[1]: /xyz.png',
                ].join('\n')));

                const $element = dom(element);
                const image = $element.querySelector('img');

                expect(image).not.toBe(null);
                expect(image.getAttribute('alt')).toBe('test');
                expect(image.getAttribute('title')).toBe(null);
                expect(image.src).toBe('/xyz.png');
            });

            it('should handle an image reference with title', () => {
                const element = render(compiler([
                    '![test][1]',
                    '[1]: /xyz.png "foo"',
                ].join('\n')));

                const $element = dom(element);
                const image = $element.querySelector('img');

                expect(image).not.toBe(null);
                expect(image.getAttribute('alt')).toBe('test');
                expect(image.getAttribute('title')).toBe('foo');
                expect(image.src).toBe('/xyz.png');
            });
        });

        describe('links', () => {
            it('should handle a basic link', () => {
                const element = render(compiler('[foo](/xyz.png)'));
                const $element = dom(element);
                const link = $element.querySelector('a');

                expect(link).not.toBe(null);
                expect(link.textContent).toBe('foo');
                expect(link.getAttribute('title')).toBe(null);
                expect(link.getAttribute('href')).toBe('/xyz.png');
            });

            it('should handle a link with title', () => {
                const element = render(compiler('[foo](/xyz.png "bar")'));
                const $element = dom(element);
                const link = $element.querySelector('a');

                expect(link).not.toBe(null);
                expect(link.textContent).toBe('foo');
                expect(link.getAttribute('title')).toBe('bar');
                expect(link.getAttribute('href')).toBe('/xyz.png');
            });

            it('should handle a link reference', () => {
                const element = render(compiler([
                    '[foo][1]',
                    '[1]: /xyz.png',
                ].join('\n')));

                const $element = dom(element);
                const link = $element.querySelector('a');

                expect(link).not.toBe(null);
                expect(link.textContent).toBe('foo');
                expect(link.getAttribute('title')).toBe(null);
                expect(link.getAttribute('href')).toBe('/xyz.png');
            });

            it('should handle a link reference with title', () => {
                const element = render(compiler([
                    '[foo][1]',
                    '[1]: /xyz.png "bar"',
                ].join('\n')));

                const $element = dom(element);
                const link = $element.querySelector('a');

                expect(link).not.toBe(null);
                expect(link.textContent).toBe('foo');
                expect(link.getAttribute('title')).toBe('bar');
                expect(link.getAttribute('href')).toBe('/xyz.png');
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

                expect($element).not.toBe(null);
                expect($element.children.length).toBe(3);
                expect($element.children[0].textContent).toBe('xyz');
                expect($element.children[0].childNodes[0].nodeType).toBe(3); // TEXT_NODE
                expect($element.children[1].textContent).toBe('abc');
                expect($element.children[1].childNodes[0].nodeType).toBe(3); // TEXT_NODE
                expect($element.children[2].textContent).toBe('foo');
                expect($element.children[2].childNodes[0].nodeType).toBe(3); // TEXT_NODE
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

                expect($element).not.toBe(null);
                expect($element.tagName.toLowerCase()).toBe('ul');
                expect($element.children.length).toBe(3);
                expect($element.children[0].textContent).toBe('xyz');
                expect($element.children[0].children[0].tagName.toLowerCase()).toBe('p');
                expect($element.children[1].textContent).toBe('abc');
                expect($element.children[1].children[0].tagName.toLowerCase()).toBe('p');
                expect($element.children[2].textContent).toBe('foo');
                expect($element.children[2].children[0].tagName.toLowerCase()).toBe('p');
            });

            it('should handle an ordered list', () => {
                const element = render(compiler([
                    '1. xyz',
                    '1. abc',
                    '1. foo',
                ].join('\n')));

                const $element = dom(element);

                expect($element).not.toBe(null);
                expect($element.tagName.toLowerCase()).toBe('ol');
                expect($element.children.length).toBe(3);
                expect($element.children[0].textContent).toBe('xyz');
                expect($element.children[1].textContent).toBe('abc');
                expect($element.children[2].textContent).toBe('foo');
            });

            it('should handle an ordered list with a specific start index', () => {
                const element = render(compiler([
                    '2. xyz',
                    '3. abc',
                    '4. foo',
                ].join('\n')));

                const $element = dom(element);

                expect($element).not.toBe(null);
                expect($element.getAttribute('start')).toBe('2');
            });

            it('should handle a nested list', () => {
                const element = render(compiler([
                    '- xyz',
                    '  - abc',
                    '- foo',
                ].join('\n')));

                const $element = dom(element);

                expect($element).not.toBe(null);
                expect($element.children.length).toBe(2);
                expect($element.children[0].children[0].textContent).toBe('xyz');
                expect($element.children[0].children[1].tagName.toLowerCase()).toBe('ul');
                expect($element.children[0].children[1].children[0].textContent).toBe('abc');
                expect($element.children[1].textContent).toBe('foo');
            });
        });

        describe('GFM task lists', () => {
            it('should handle unchecked items', () => {
                const element = render(compiler('- [ ] foo'));
                const $element = dom(element);
                const checkbox = $element.querySelector('ul li input');

                expect(checkbox).not.toBe(null);
                expect(checkbox.checked).toBe(false);
                expect(checkbox.parentNode.textContent).toBe('foo');
            });

            it('should handle checked items', () => {
                const element = render(compiler('- [x] foo'));
                const $element = dom(element);
                const checkbox = $element.querySelector('ul li input');

                expect(checkbox).not.toBe(null);
                expect(checkbox.checked).toBe(true);
                expect(checkbox.parentNode.textContent).toBe('foo');
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
                const thead = $element.querySelector('thead tr');
                const row = $element.querySelector('tbody tr');

                expect($element).not.toBe(null);
                expect($element.tagName.toLowerCase()).toBe('table');
                expect(thead).not.toBe(null);
                expect(thead.children.length).toBe(2);
                expect(thead.children[0].tagName.toLowerCase()).toBe('th');
                expect(row).not.toBe(null);
                expect(row.children.length).toBe(2);
                expect(row.children[0].tagName.toLowerCase()).toBe('td');
            });

            it('should handle a table with aligned columns', () => {
                const element = render(compiler([
                    'foo|bar',
                    '--:|---',
                    '1  |2',
                    '',
                ].join('\n')));

                const $element = dom(element);
                const thead = $element.querySelector('thead tr');
                const row = $element.querySelector('tbody tr');

                expect($element).not.toBe(null);
                expect(thead).not.toBe(null);
                expect(thead.children.length).toBe(2);
                expect(thead.children[0].tagName.toLowerCase()).toBe('th');
                expect(thead.children[0].style.textAlign).toBe('right');
                expect(row).not.toBe(null);
                expect(row.children.length).toBe(2);
                expect(row.children[0].tagName.toLowerCase()).toBe('td');
                expect(row.children[0].style.textAlign).toBe('right');
            });
        });

        describe('arbitrary HTML', () => {
            it('preserves the HTML given', () => {
                const element = render(compiler('<dd>Hello</dd>'));
                const $element = dom(element);

                // block level elements are currently wrapped with a <div> due to dangerouslySetInnerHTML
                expect($element.tagName).toBe('DIV');

                expect($element.children[0].tagName).toBe('DD');
                expect($element.children[0].textContent).toBe('Hello');
            });

            it('processes markdown within inline HTML', () => {
                const element = render(compiler('<time>**Hello**</time>'));
                const $element = dom(element);

                // inline elements are always wrapped in a paragraph context
                expect($element.tagName).toBe('P');

                expect($element.children[0].tagName).toBe('TIME');
                expect($element.children[0].children[0].tagName).toBe('STRONG');
                expect($element.children[0].children[0].textContent).toBe('Hello');
            });

            it('processes markdown within nested inline HTML', () => {
                const element = render(compiler('<time><span>**Hello**</span></time>'));
                const $element = dom(element);

                // inline elements are always wrapped in a paragraph context
                expect($element.tagName).toBe('P');

                expect($element.children[0].tagName).toBe('TIME');
                expect($element.children[0].children[0].tagName).toBe('SPAN');
                expect($element.children[0].children[0].children[0].tagName).toBe('STRONG');
                expect($element.children[0].children[0].children[0].textContent).toBe('Hello');
            });

            it('processes attributes within inline HTML', () => {
                const element = render(compiler('<time data-foo="bar">Hello</time>'));
                const $element = dom(element);

                // inline elements are always wrapped in a paragraph context
                expect($element.tagName).toBe('P');

                expect($element.children[0].tagName).toBe('TIME');
                expect($element.children[0].getAttribute('data-foo')).toBe('bar');
                expect($element.children[0].textContent).toBe('Hello');
            });

            it('processes attributes that need JSX massaging within inline HTML', () => {
                const element = render(compiler('<span tabindex="0">Hello</span>'));
                const $element = dom(element);

                // inline elements are always wrapped in a paragraph context
                expect($element.tagName).toBe('P');

                expect($element.children[0].tagName).toBe('SPAN');
                expect($element.children[0].hasAttribute('tabindex')).toBe(true);
                expect($element.children[0].textContent).toBe('Hello');
            });

            it('processes inline HTML with inline styles', () => {
                const element = render(compiler('<span style="color: red; position: top; margin-right: 10px">Hello</span>'));
                const $element = dom(element);

                // inline elements are always wrapped in a paragraph context
                expect($element.tagName).toBe('P');

                expect($element.children[0].tagName).toBe('SPAN');
                expect($element.children[0].style.color).toBe('red');
                expect($element.children[0].style.marginRight).toBe('10px');
                expect($element.children[0].style.position).toBe('top');
                expect($element.children[0].textContent).toBe('Hello');
            });

            xit('processes markdown within block-level arbitrary HTML', () => {
                const element = render(compiler('<p>**Hello**</p>'));
                const $element = dom(element);

                expect($element.tagName).toBe('P');
                expect($element.children[0].tagName).toBe('STRONG');
                expect($element.children[0].textContent).toBe('Hello');
            });

            it('renders inline <code> tags', () => {
                const element = render(compiler('Text and <code>**code**</code>'));
                const $element = dom(element);

                expect($element.tagName).toBe('P');
                expect($element.children[0].tagName).toBe('CODE');
                expect($element.children[0].children[0].tagName).toBe('STRONG');
                expect($element.children[0].children[0].textContent).toBe('code');
            });

            it('handles self-closing html inside parsable html (regression)', () => {
                const element = render(compiler('<a href="https://opencollective.com/react-dropzone/sponsor/0/website" target="_blank"><img src="https://opencollective.com/react-dropzone/sponsor/0/avatar.svg"></a>'));
                const $element = dom(element);

                expect($element.tagName).toBe('P');
                expect($element.children[0].tagName).toBe('A');
                expect($element.children[0].children[0].tagName).toBe('IMG');
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

                expect($element).not.toBe(null);
                expect($element.tagName.toLowerCase()).toBe('pre');
                expect($element.children[0].tagName).toBe('CODE');
                expect($element.children[0].classList.contains('lang-js')).toBe(true);
                expect($element.children[0].textContent).toBe('foo');
            });
        });

        describe('inline code blocks', () => {
            it('should be handled', () => {
                const element = render(compiler('`foo`'));
                const $element = dom(element);
                const code = $element.querySelector('code');

                expect(code).not.toBe(null);
                expect(code.childNodes[0].nodeType).toBe(3); // TEXT_NODE
                expect(code.textContent).toBe('foo');
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

                const text = $element.children[0].textContent;
                const footnoteLink = $element.querySelector('a');

                expect(text).toBe('fooabc bar');

                expect(footnoteLink).not.toBe(null);
                expect(footnoteLink.textContent).toBe('abc');
                expect(footnoteLink.getAttribute('href')).toBe('#abc');
                expect(footnoteLink.children[0].tagName).toBe('SUP');
            });

            it('should inject the definitions in a footer at the end of the root', () => {
                const element = render(compiler([
                    'foo[^abc] bar',
                    '',
                    '[^abc]: Baz baz',
                ].join('\n')));

                const $element = dom(element);
                const definitions = $element.children[1];

                expect(definitions).not.toBe(null);
                expect(definitions.tagName).toBe('FOOTER');
                expect(definitions.children[0].tagName).toBe('DIV');
                expect(definitions.children[0].id).toBe('abc');
                expect(definitions.children[0].textContent).toBe('[abc]: Baz baz');
            });

            it('should handle single word footnote definitions', () => {
                const element = render(compiler([
                    'foo[^abc] bar',
                    '',
                    '[^abc]: Baz',
                ].join('\n')));

                const $element = dom(element);
                const definitions = $element.children[1];

                expect(definitions).not.toBe(null);
                expect(definitions.tagName).toBe('FOOTER');
                expect(definitions.children[0].tagName).toBe('DIV');
                expect(definitions.children[0].id).toBe('abc');
                expect(definitions.children[0].textContent).toBe('[abc]: Baz');
            });
        });

        describe('overrides', () => {
            it('should substitute the appropriate JSX tag if given a component', () => {
                class FakeParagraph extends React.Component {
                    render() {
                        return (
                            <p className='foo'>{this.props.children}</p>
                        );
                    }
                }

                const element = render(
                    compiler('Hello.', {overrides: {p: {component: FakeParagraph}}})
                );

                const $element = dom(element);

                expect($element.className).toBe('foo');
                expect($element.textContent).toBe('Hello.');
            });

            it('should add props to the appropriate JSX tag if supplied', () => {
                const element = render(
                    compiler('Hello.', {overrides: {p: {props: {className: 'abc'}}}})
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

                expect($element.tagName).toBe('PRE');
                expect($element.className).toBe('abc');
                expect($element.textContent).toContain('foo');
                expect($element.children[0].tagName).toBe('CODE');
                expect($element.children[0].getAttribute('data-foo')).toBe('bar');
            });

            it('should substitute pre & code tags if supplied with an override component', () => {
                class OverridenPre extends React.Component {
                    render() {
                        const {children, ...props} = this.props;

                        return (
                            <pre {...props} data-bar='baz'>{children}</pre>
                        );
                    }
                }

                class OverridenCode extends React.Component {
                    render() {
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

                expect($element.tagName).toBe('PRE');
                expect($element.className).toBe('abc');
                expect($element.getAttribute('data-bar')).toBe('baz');
                expect($element.textContent).toContain('foo');
                expect($element.children[0].tagName).toBe('CODE');
                expect($element.children[0].getAttribute('data-foo')).toBe('bar');
                expect($element.children[0].getAttribute('data-baz')).toBe('fizz');
            });

            it('should be able to override gfm task list items', () => {
                const element = render(compiler('- [ ] foo', {overrides: {li: {props: {className: 'foo'}}}}));
                const $element = dom(element).querySelector('li');

                expect($element).not.toBe(null);
                expect($element.className).toContain('foo');
            });

            it('should be able to override gfm task list item checkboxes', () => {
                const element = render(compiler('- [ ] foo', {overrides: {input: {props: {className: 'foo'}}}}));
                const $element = dom(element).querySelector('input');

                expect($element).not.toBe(null);
                expect($element.className).toContain('foo');
            });
        });
    });

    describe('component', () => {
        it('accepts markdown content', () => {
            render(<Markdown>_Hello._</Markdown>);

            const $element = root.querySelector('em');

            expect($element).not.toBe(null);
            expect($element.childNodes.length).toBe(1);
            expect($element.childNodes[0].nodeType).toBe(3); // TEXT_NODE
            expect($element.textContent).toBe('Hello.');
        });

        it('accepts options', () => {
            class FakeParagraph extends React.Component {
                render() {
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

            const $element = root.querySelector('p');

            expect($element.className).toBe('foo');
            expect($element.textContent).toBe('Hello.');
        });
    });
});
