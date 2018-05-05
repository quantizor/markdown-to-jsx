import Markdown, {compiler} from './index';
import React from 'react';
import ReactDOM from 'react-dom';
import fs from 'fs';

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

        it('wraps solely inline elements in a span, rather than a div', () => {
            render(compiler('Hello. _Beautiful_ day isn\'t it?'));

            expect(root.innerHTML).toMatchSnapshot();
        });

        it('handles a holistic example', () => {
            const md = fs.readFileSync(__dirname + '/fixture.md', 'utf8');
            render(compiler(md));

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

            it('should handle consecutive headings without a padding newline', () => {
                render(compiler('# Hello World\n## And again'));

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

            it('should handle a link reference with a space', () => {
                render(compiler([
                    '[foo] [1]',
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

            it('should handle a link with a URL in the text', () => {
                render(compiler('[https://www.google.com *heck yeah*](http://www.google.com)'));

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

            it('should handle link trees', () => {
                render(compiler(`
- [buttermilk](#buttermilk)
    - [installation](#installation)
    - [usage](#usage)
        - [configuration](#configuration)
        - [components](#components)
            - [\`<Router>\`](#router)
            - [\`<RoutingState>\`](#routingstate)
            - [\`<Link>\`](#link)
        - [utilities](#utilities)
            - [\`route(url: String, addNewHistoryEntry: Boolean = true)\`](#routeurl-string-addnewhistoryentry-boolean--true)
        - [holistic example](#holistic-example)
    - [goals](#goals)
                `));

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
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle a table with aligned columns', () => {
                render(compiler([
                    'foo|bar|baz',
                    '--:|:---:|:--',
                    '1|2|3',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle the other syntax for tables', () => {
                render(compiler([
                    '| Foo | Bar |',
                    '| --- | --- |',
                    '| 1   | 2   |',
                    '| 3   | 4   |',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle the other syntax for tables with alignment', () => {
                render(compiler([
                    '| Foo | Bar | Baz |',
                    '| --: | :-: | :-- |',
                    '| 1   | 2   | 3   |',
                    '| 4   | 5   | 6   |',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('should handle other content after a table', () => {
                render(compiler([
                    '| Foo | Bar | Baz |',
                    '| --: | :-: | :-- |',
                    '| 1   | 2   | 3   |',
                    '| 4   | 5   | 6   |',
                    '',
                    'Foo',
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

            it('processes markdown within nested inline HTML where childen appear more than once', () => {
                render(compiler('<dl><dt>foo</dt><dd>bar</dd><dt>baz</dt><dd>qux</dd></dl>'));

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

            it('processes markdown within block-level arbitrary HTML (regression)', () => {
                render(compiler('<div style="float: right">\n# Hello\n</div>'));

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

            it('block HTML regression test', () => {
                render(compiler(`
<ul id="ProjectSubmenu">
    <li><a href="/projects/markdown/" title="Markdown Project Page">Main</a></li>
    <li><a href="/projects/markdown/basics" title="Markdown Basics">Basics</a></li>
    <li><a class="selected" title="Markdown Syntax Documentation">Syntax</a></li>
    <li><a href="/projects/markdown/license" title="Pricing and License Information">License</a></li>
    <li><a href="/projects/markdown/dingus" title="Online Markdown Web Form">Dingus</a></li>
</ul>
`));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('handles svg', () => {
                render(compiler(fs.readFileSync(__dirname + '/docs/images/logo.svg', 'utf8')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('handles nested HTML blocks of the same type (regression)', () => {
                render(compiler(`
<table>
    <tbody>
      <tr>
        <td>Time</td>
        <td>Payment Criteria</td>
        <td>Payment</td>
      </tr>
      <tr>
        <td>Office Visit </td>
        <td>
          <ul>
            <li>
              Complete full visit and enroll
              <ul>
                <li>Enrolling is fun!</li>
              </ul>
            </li>
          </ul>
        </td>
        <td>$20</td>
      </tr>
    </tbody>
</table>
                `));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('regression test for #136', () => {
                render(compiler(`
$25
  <br>
  <br>
  <br>$50
  <br>
  <br>
  <br>$50
  <br>
  <br>
  <br>$50
  <br>
  <br>
  <br>
                `));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('#140 self-closing HTML with indentation', () => {
                function DatePicker () { return <div className="datepicker" />; }

                render(compiler([
                    '<DatePicker ',
                    '    biasTowardDateTime="2017-12-05T07:39:36.091Z"',
                    '    timezone="UTC+5"',
                    '/>',
                ].join('\n'), { overrides: { DatePicker }}));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('handles jsx attribute interpolation as a string', () => {
                function DatePicker ({ endTime, startTime }) {
                    return <div>{startTime} to {endTime}</div>;
                }

                render(compiler([
                    '<DatePicker ',
                    '    startTime={1514579720511}',
                    '    endTime={"1514579720512"}',
                    '/>',
                ].join('\n'), { overrides: { DatePicker }}));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('handles jsx inside jsx interpolations', () => {
                function InterpolationTest ({ component, component2, component3, component4 }) {
                    return (
                        <div>{component} and {component2} and {component3} and {component4}</div>
                    );
                }

                function Inner ({ children, ...props }) {
                    return <div {...props} className="inner">{children}</div>;
                }

                render(compiler([
                    '<InterpolationTest ',
                    '    component={<Inner children="bah" />}',
                    '    component2={<Inner>blah</Inner>}',
                    '    component3={<Inner disabled />}',
                    '    component4={<Inner disabled={false} />}',
                    '/>',
                ].join('\n'), { overrides: { Inner, InterpolationTest }}));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('handles malformed HTML', () => {
                render(compiler([
                    '<g>',
                    '<g>',
                    '<path fill="#ffffff"/>',
                    '</g>',
                    '<path fill="#ffffff"/>',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('allows whitespace between attribute and value', () => {
                render(compiler([
                    '<div class = "foo" style= "background:red;" id ="baz">',
                    'Bar',
                    '</div>',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('handles a raw hashtag inside HTML', () => {
                render(compiler([
                    '"<span>#</span>"',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('handles a heading inside HTML', () => {
                render(compiler([
                    '"<span># foo</span>"',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('does not parse the inside of <style> blocks', () => {
                render(compiler([
                    '<style>',
                    '  .bar {',
                    '    color: red;',
                    '  }',
                    '</style>',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });

            it('does not parse the inside of <script> blocks', () => {
                render(compiler([
                    '<script>',
                    '  new Date();',
                    '</script>',
                ].join('\n')));

                expect(root.innerHTML).toMatchSnapshot();
            });
        });

        describe('horizontal rules', () => {
            it('should handle the various syntaxes', () => {
                render(compiler([
                    '* * *',
                    '***',
                    '*****',
                    '- - -',
                    '---------------------------------------',
                ].join('\n\n')));

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

        describe('options.forceBlock', () => {
            it('treats given markdown as block-context', () => {
                render(compiler('Hello. _Beautiful_ day isn\'t it?', { forceBlock: true }));

                expect(root.innerHTML).toMatchSnapshot();
            });
        });

        describe('options.forceInline', () => {
            it('treats given markdown as inline-context, passing through any block-level markdown syntax', () => {
                render(compiler('# You got it babe!', { forceInline: true }));

                expect(root.innerHTML).toMatchSnapshot();
            });
        });

        describe('options.createElement', () => {
            it('should render a <custom> element if render function overrides the element type', () => {
                render(
                    compiler('Hello', {
                        createElement (type, props, children) {
                            return React.createElement('custom', props, children);
                        },
                    })
                );

                // The tag name is always in the upper-case form.
                // https://developer.mozilla.org/en-US/docs/Web/API/Element/tagName
                expect(root.children[0].tagName).toBe('CUSTOM');
            });

            it('should render an empty <div> element', () => {
                render(
                    compiler('Hello', {
                        createElement () {
                            return React.createElement('div');
                        },
                    })
                );

                expect(root.children[0].innerHTML).toBe('');
                expect(root.children[0].children.length).toBe(0);
            });

            it('should throw error if render function returns null', () => {
                expect(() => {
                    render(
                        compiler('Hello', {
                            createElement: () => null,
                        })
                    );
                }).toThrow(/Invalid component element/);
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

            it('should accept an override shorthand if props do not need to be overidden', () => {
                class FakeParagraph extends React.Component {
                    render () {
                        return (
                            <p className='foo'>{this.props.children}</p>
                        );
                    }
                }

                render(
                    compiler('Hello.\n\n', {overrides: {p: FakeParagraph}})
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

        it('handles a no-children scenario', () => {
            render(<Markdown>{''}</Markdown>);

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
