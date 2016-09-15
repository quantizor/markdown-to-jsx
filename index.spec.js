import converter from './index';
import React from 'react';
import ReactDOM from 'react-dom';

const dom = ReactDOM.findDOMNode;

describe('markdown-to-jsx', () => {
    const root = document.body.appendChild(document.createElement('div'));
    const render = jsx => ReactDOM.render(jsx, root);

    afterEach(() => ReactDOM.unmountComponentAtNode(root));

    it('should throw if not passed a string (first arg)', () => {
        expect(() => converter('')).not.toThrow();

        expect(() => converter()).toThrow();
        expect(() => converter(1)).toThrow();
        expect(() => converter(function(){})).toThrow();
        expect(() => converter({})).toThrow();
        expect(() => converter([])).toThrow();
        expect(() => converter(null)).toThrow();
        expect(() => converter(true)).toThrow();
    });

    it('should throw if not passed an object or undefined (second arg)', () => {
        expect(() => converter('')).not.toThrow();
        expect(() => converter('', {})).not.toThrow();

        expect(() => converter('', 1)).toThrow();
        expect(() => converter('', function(){})).toThrow();
        expect(() => converter('', [])).toThrow();
        expect(() => converter('', null)).toThrow();
        expect(() => converter('', true)).toThrow();
    });

    it('should throw if not passed an object or undefined (third arg)', () => {
        expect(() => converter('', {})).not.toThrow();
        expect(() => converter('', {}, {})).not.toThrow();

        expect(() => converter('', {}, 1)).toThrow();
        expect(() => converter('', {}, function(){})).toThrow();
        expect(() => converter('', {}, [])).toThrow();
        expect(() => converter('', {}, null)).toThrow();
        expect(() => converter('', {}, true)).toThrow();
    });

    it('should discard the root <div> wrapper if there is only one root child', () => {
        const element = render(converter('Hello.'));
        const $element = dom(element);

        expect($element.tagName.toLowerCase()).toBe('p');
    });

    it('should handle a basic string', () => {
        const element = render(converter('Hello.'));
        const $element = dom(element);

        expect($element.textContent).toBe('Hello.');
    });

    it('should not introduce an intermediate wrapper for basic strings', () => {
        const element = render(converter('Hello.'));
        const $element = dom(element);

        expect($element.childNodes.length).toBe(1);
        expect($element.childNodes[0].nodeType).toBe(3); // TEXT_NODE
    });

    describe('inline textual elements', () => {
        it('should handle emphasized text', () => {
            const element = render(converter('_Hello._'));
            const $element = dom(element);

            const text = $element.querySelector('em');
            expect(text).not.toBe(null);
            expect(text.childNodes.length).toBe(1);
            expect(text.childNodes[0].nodeType).toBe(3); // TEXT_NODE
            expect(text.textContent).toBe('Hello.');
        });

        it('should handle double-emphasized text', () => {
            const element = render(converter('__Hello.__'));
            const $element = dom(element);
            const text = $element.querySelector('strong');

            expect(text).not.toBe(null);
            expect(text.childNodes.length).toBe(1);
            expect(text.childNodes[0].nodeType).toBe(3); // TEXT_NODE
            expect(text.textContent).toBe('Hello.');
        });

        it('should handle triple-emphasized text', () => {
            const element = render(converter('___Hello.___'));
            const $element = dom(element);
            const text = $element.querySelector('strong');

            expect(text).not.toBe(null);
            expect(text.childNodes.length).toBe(1);
            expect(text.childNodes[0].tagName).toBe('EM');
            expect(text.childNodes[0].childNodes[0].nodeType).toBe(3); // TEXT_NODE
            expect(text.childNodes[0].childNodes[0].textContent).toBe('Hello.');
        });

        it('should handle deleted text', () => {
            const element = render(converter('~~Hello.~~'));
            const $element = dom(element);
            const text = $element.querySelector('del');

            expect(text).not.toBe(null);
            expect(text.childNodes.length).toBe(1);
            expect(text.childNodes[0].nodeType).toBe(3); // TEXT_NODE
            expect(text.textContent).toBe('Hello.');
        });

        it('should handle escaped text', () => {
            const element = render(converter('Hello.\_\_'));
            const $element = dom(element);

            expect($element).not.toBe(null);
            expect($element.childNodes.length).toBe(1);
            expect($element.childNodes[0].nodeType).toBe(3); // TEXT_NODE
            expect($element.textContent).toBe('Hello.__');
        });
    });

    describe('headings', () => {
        it('should handle level 1 properly', () => {
            const element = render(converter('# Hello World'));
            const $element = dom(element);

            expect($element).not.toBe(null);
            expect($element.tagName.toLowerCase()).toBe('h1');
            expect($element.textContent).toBe('Hello World');
        });

        it('should handle level 2 properly', () => {
            const element = render(converter('## Hello World'));
            const $element = dom(element);

            expect($element).not.toBe(null);
            expect($element.tagName.toLowerCase()).toBe('h2');
            expect($element.textContent).toBe('Hello World');
        });

        it('should handle level 3 properly', () => {
            const element = render(converter('### Hello World'));
            const $element = dom(element);

            expect($element).not.toBe(null);
            expect($element.tagName.toLowerCase()).toBe('h3');
            expect($element.textContent).toBe('Hello World');
        });

        it('should handle level 4 properly', () => {
            const element = render(converter('#### Hello World'));
            const $element = dom(element);

            expect($element).not.toBe(null);
            expect($element.tagName.toLowerCase()).toBe('h4');
            expect($element.textContent).toBe('Hello World');
        });

        it('should handle level 5 properly', () => {
            const element = render(converter('##### Hello World'));
            const $element = dom(element);

            expect($element).not.toBe(null);
            expect($element.tagName.toLowerCase()).toBe('h5');
            expect($element.textContent).toBe('Hello World');
        });

        it('should handle level 6 properly', () => {
            const element = render(converter('###### Hello World'));
            const $element = dom(element);

            expect($element).not.toBe(null);
            expect($element.tagName.toLowerCase()).toBe('h6');
            expect($element.textContent).toBe('Hello World');
        });
    });

    describe('images', () => {
        it('should handle a basic image', () => {
            const element = render(converter('![](/xyz.png)'));
            const $element = dom(element);
            const image = $element.querySelector('img');

            expect(image).not.toBe(null);
            expect(image.getAttribute('alt')).toBe(null);
            expect(image.getAttribute('title')).toBe(null);
            expect(image.src).toBe('/xyz.png');
        });

        it('should handle an image with alt text', () => {
            const element = render(converter('![test](/xyz.png)'));
            const $element = dom(element);
            const image = $element.querySelector('img');

            expect(image).not.toBe(null);
            expect(image.getAttribute('alt')).toBe('test');
            expect(image.getAttribute('title')).toBe(null);
            expect(image.src).toBe('/xyz.png');
        });

        it('should handle an image with title', () => {
            const element = render(converter('![test](/xyz.png "foo")'));
            const $element = dom(element);
            const image = $element.querySelector('img');

            expect(image).not.toBe(null);
            expect(image.getAttribute('alt')).toBe('test');
            expect(image.getAttribute('title')).toBe('foo');
            expect(image.src).toBe('/xyz.png');
        });

        it('should handle an image reference', () => {
            const element = render(converter([
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
            const element = render(converter([
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
            const element = render(converter([
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
            const element = render(converter('[foo](/xyz.png)'));
            const $element = dom(element);
            const link = $element.querySelector('a');

            expect(link).not.toBe(null);
            expect(link.textContent).toBe('foo');
            expect(link.getAttribute('title')).toBe(null);
            expect(link.getAttribute('href')).toBe('/xyz.png');
        });

        it('should handle a link with title', () => {
            const element = render(converter('[foo](/xyz.png "bar")'));
            const $element = dom(element);
            const link = $element.querySelector('a');

            expect(link).not.toBe(null);
            expect(link.textContent).toBe('foo');
            expect(link.getAttribute('title')).toBe('bar');
            expect(link.getAttribute('href')).toBe('/xyz.png');
        });

        it('should handle a link reference', () => {
            const element = render(converter([
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
            const element = render(converter([
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
            const element = render(converter([
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
            const element = render(converter([
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
            const element = render(converter([
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
            const element = render(converter([
                '2. xyz',
                '3. abc',
                '4. foo',
            ].join('\n')));

            const $element = dom(element);

            expect($element).not.toBe(null);
            expect($element.getAttribute('start')).toBe('2');
        });

        it('should handle a nested list', () => {
            const element = render(converter([
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
            const element = render(converter('- [ ] foo'));
            const $element = dom(element);
            const checkbox = $element.querySelector('ul li input');

            expect(checkbox).not.toBe(null);
            expect(checkbox.checked).toBe(false);
            expect(checkbox.parentNode.textContent).toBe('foo');
        });

        it('should handle checked items', () => {
            const element = render(converter('- [x] foo'));
            const $element = dom(element);
            const checkbox = $element.querySelector('ul li input');

            expect(checkbox).not.toBe(null);
            expect(checkbox.checked).toBe(true);
            expect(checkbox.parentNode.textContent).toBe('foo');
        });

        it('should disable the checkboxes', () => {
            const element = render(converter('- [x] foo'));
            const $element = dom(element);
            const checkbox = $element.querySelector('ul li input');

            expect(checkbox).not.toBe(null);
            expect(checkbox.disabled).toBe(true);
        });
    });

    describe('GFM tables', () => {
        it('should handle a basic table', () => {
            const element = render(converter([
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
            const element = render(converter([
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
        it('should preserve the HTML given', () => {
            const element = render(converter('<dd>Hello</dd>'));
            const $element = dom(element);

            expect($element.children[0].tagName).toBe('DD');
            expect($element.children[0].parentElement.tagName).toBe('DIV');
        });

        it('should wrap a top-level bit of HTML in a <div>', () => {
            const element = render(converter('<dd>Hello</dd>'));
            const $element = dom(element);

            expect($element.tagName).toBe('DIV');
        });

        fit('should wrap the HTML in a <span> instead of <div> if a descendant of a block-level element', () => {
            const element = render(converter('Hello <dd>Hello</dd> **<time>123</time>**'));
            const $element = dom(element);

            expect($element.querySelector('dd').parentElement.tagName).toBe('SPAN');
            expect($element.querySelector('dd').parentElement.parentElement.tagName).toBe('P');
            expect($element.querySelector('time').parentElement.tagName).toBe('SPAN');
            expect($element.querySelector('time').parentElement.parentElement.tagName).toBe('STRONG');
        });
    });

    describe('horizontal rules', () => {
        it('should be handled', () => {
            const element = render(converter('---'));
            const $element = dom(element);

            expect($element).not.toBe(null);
            expect($element.tagName.toLowerCase()).toBe('hr');
        });
    });

    describe('line breaks', () => {
        it('should be added for 2-space sequences', () => {
            const element = render(converter([
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
            const element = render(converter([
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
            const element = render(converter('`foo`'));
            const $element = dom(element);
            const code = $element.querySelector('code');

            expect(code).not.toBe(null);
            expect(code.childNodes[0].nodeType).toBe(3); // TEXT_NODE
            expect(code.textContent).toBe('foo');
        });
    });

    describe('footnotes', () => {
        it('should handle conversion of references into links', () => {
            const element = render(converter([
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
            const element = render(converter([
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
            const element = render(converter([
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
                converter('Hello.', {}, {p: {component: FakeParagraph}})
            );

            const $element = dom(element);

            expect($element.className).toBe('foo');
            expect($element.textContent).toBe('Hello.');
        });

        it('should add props to the appropriate JSX tag if supplied', () => {
            const element = render(
                converter('Hello.', {}, {p: {props: {className: 'abc'}}})
            );

            const $element = dom(element);

            expect($element.className).toBe('abc');
            expect($element.textContent).toBe('Hello.');
        });
    });
});
