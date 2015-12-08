import converter from '../index';
import React from 'react';
import ReactDOM from 'react-dom';

describe('markdown-to-jsx', () => {
    const mountNode = document.body.appendChild(document.createElement('div'));
    const render = jsx => ReactDOM.render(jsx, mountNode);

    afterEach(() => ReactDOM.unmountComponentAtNode(mountNode));

    it('should handle a basic string', () => {
        const element = render(converter('Hello.'));
        const elementNode = ReactDOM.findDOMNode(element);
        const text = elementNode.querySelector('p');

        expect(text).not.toBe(null);
        expect(text.textContent).toBe('Hello.');
    });

    it('should not introduce an intermediate wrapper for basic strings', () => {
        const element = render(converter('Hello.'));
        const elementNode = ReactDOM.findDOMNode(element);
        const text = elementNode.querySelector('p');

        expect(text.childNodes.length).toBe(1);
        expect(text.childNodes[0].nodeType).toBe(3); // TEXT_NODE
    });

    describe('inline textual elements', () => {
        it('should handle emphasized text', () => {
            const element = render(converter('_Hello._'));
            const elementNode = ReactDOM.findDOMNode(element);

            const text = elementNode.querySelector('em');
            expect(text).not.toBe(null);
            expect(text.childNodes.length).toBe(1);
            expect(text.childNodes[0].nodeType).toBe(3); // TEXT_NODE
            expect(text.textContent).toBe('Hello.');
        });

        it('should handle double-emphasized text', () => {
            const element = render(converter('__Hello.__'));
            const elementNode = ReactDOM.findDOMNode(element);
            const text = elementNode.querySelector('strong');

            expect(text).not.toBe(null);
            expect(text.childNodes.length).toBe(1);
            expect(text.childNodes[0].nodeType).toBe(3); // TEXT_NODE
            expect(text.textContent).toBe('Hello.');
        });

        it('should handle triple-emphasized text', () => {
            const element = render(converter('___Hello.___'));
            const elementNode = ReactDOM.findDOMNode(element);
            const text = elementNode.querySelector('strong');

            expect(text).not.toBe(null);
            expect(text.childNodes.length).toBe(1);
            expect(text.childNodes[0].tagName).toBe('EM');
            expect(text.childNodes[0].childNodes[0].nodeType).toBe(3); // TEXT_NODE
            expect(text.childNodes[0].childNodes[0].textContent).toBe('Hello.');
        });

        it('should handle deleted text', () => {
            const element = render(converter('~~Hello.~~'));
            const elementNode = ReactDOM.findDOMNode(element);
            const text = elementNode.querySelector('del');

            expect(text).not.toBe(null);
            expect(text.childNodes.length).toBe(1);
            expect(text.childNodes[0].nodeType).toBe(3); // TEXT_NODE
            expect(text.textContent).toBe('Hello.');
        });

        it('should handle escaped text', () => {
            const element = render(converter('Hello.\_\_'));
            const elementNode = ReactDOM.findDOMNode(element);
            const text = elementNode.querySelector('p');

            expect(text).not.toBe(null);
            expect(text.childNodes.length).toBe(1);
            expect(text.childNodes[0].nodeType).toBe(3); // TEXT_NODE
            expect(text.textContent).toBe('Hello.__');
        });
    });

    describe('headings', () => {
        it('should handle level 1 properly', () => {
            const element = render(converter('# Hello World'));
            const elementNode = ReactDOM.findDOMNode(element);
            const heading = elementNode.querySelector('h1');

            expect(heading).not.toBe(null);
            expect(heading.textContent).toBe('Hello World');
        });

        it('should handle level 2 properly', () => {
            const element = render(converter('## Hello World'));
            const elementNode = ReactDOM.findDOMNode(element);
            const heading = elementNode.querySelector('h2');

            expect(heading).not.toBe(null);
            expect(heading.textContent).toBe('Hello World');
        });

        it('should handle level 3 properly', () => {
            const element = render(converter('### Hello World'));
            const elementNode = ReactDOM.findDOMNode(element);
            const heading = elementNode.querySelector('h3');

            expect(heading).not.toBe(null);
            expect(heading.textContent).toBe('Hello World');
        });

        it('should handle level 4 properly', () => {
            const element = render(converter('#### Hello World'));
            const elementNode = ReactDOM.findDOMNode(element);
            const heading = elementNode.querySelector('h4');

            expect(heading).not.toBe(null);
            expect(heading.textContent).toBe('Hello World');
        });

        it('should handle level 5 properly', () => {
            const element = render(converter('##### Hello World'));
            const elementNode = ReactDOM.findDOMNode(element);
            const heading = elementNode.querySelector('h5');

            expect(heading).not.toBe(null);
            expect(heading.textContent).toBe('Hello World');
        });

        it('should handle level 6 properly', () => {
            const element = render(converter('###### Hello World'));
            const elementNode = ReactDOM.findDOMNode(element);
            const heading = elementNode.querySelector('h6');

            expect(heading).not.toBe(null);
            expect(heading.textContent).toBe('Hello World');
        });
    });

    describe('images', () => {
        it('should handle a basic image', () => {
            const element = render(converter('![](/xyz.png)'));
            const elementNode = ReactDOM.findDOMNode(element);
            const image = elementNode.querySelector('img');

            expect(image).not.toBe(null);
            expect(image.getAttribute('alt')).toBe(null);
            expect(image.getAttribute('title')).toBe(null);
            expect(image.src).toBe('/xyz.png');
        });

        it('should handle an image with alt text', () => {
            const element = render(converter('![test](/xyz.png)'));
            const elementNode = ReactDOM.findDOMNode(element);
            const image = elementNode.querySelector('img');

            expect(image).not.toBe(null);
            expect(image.getAttribute('alt')).toBe('test');
            expect(image.getAttribute('title')).toBe(null);
            expect(image.src).toBe('/xyz.png');
        });

        it('should handle an image with title', () => {
            const element = render(converter('![test](/xyz.png "foo")'));
            const elementNode = ReactDOM.findDOMNode(element);
            const image = elementNode.querySelector('img');

            expect(image).not.toBe(null);
            expect(image.getAttribute('alt')).toBe('test');
            expect(image.getAttribute('title')).toBe('foo');
            expect(image.src).toBe('/xyz.png');
        });

        it('should handle an image reference', () => {
            const element = render(converter('![][1]\n[1]: /xyz.png'));
            const elementNode = ReactDOM.findDOMNode(element);
            const image = elementNode.querySelector('img');

            expect(image).not.toBe(null);
            /* bug in mdast: https://github.com/wooorm/mdast/issues/103 */
            // expect(image.getAttribute('alt')).toBe(null);
            expect(image.getAttribute('title')).toBe(null);
            expect(image.src).toBe('/xyz.png');
        });

        it('should handle an image reference with alt text', () => {
            const element = render(converter('![test][1]\n[1]: /xyz.png'));
            const elementNode = ReactDOM.findDOMNode(element);
            const image = elementNode.querySelector('img');

            expect(image).not.toBe(null);
            expect(image.getAttribute('alt')).toBe('test');
            expect(image.getAttribute('title')).toBe(null);
            expect(image.src).toBe('/xyz.png');
        });

        it('should handle an image reference with title', () => {
            const element = render(converter('![test][1]\n[1]: /xyz.png "foo"'));
            const elementNode = ReactDOM.findDOMNode(element);
            const image = elementNode.querySelector('img');

            expect(image).not.toBe(null);
            expect(image.getAttribute('alt')).toBe('test');
            expect(image.getAttribute('title')).toBe('foo');
            expect(image.src).toBe('/xyz.png');
        });
    });

    describe('links', () => {
        it('should handle a basic link', () => {
            const element = render(converter('[foo](/xyz.png)'));
            const elementNode = ReactDOM.findDOMNode(element);
            const link = elementNode.querySelector('a');

            expect(link).not.toBe(null);
            expect(link.textContent).toBe('foo');
            expect(link.getAttribute('title')).toBe(null);
            expect(link.getAttribute('href')).toBe('/xyz.png');
        });

        it('should handle a link with title', () => {
            const element = render(converter('[foo](/xyz.png "bar")'));
            const elementNode = ReactDOM.findDOMNode(element);
            const link = elementNode.querySelector('a');

            expect(link).not.toBe(null);
            expect(link.textContent).toBe('foo');
            expect(link.getAttribute('title')).toBe('bar');
            expect(link.getAttribute('href')).toBe('/xyz.png');
        });

        it('should handle a link reference', () => {
            const element = render(converter('[foo][1]\n[1]: /xyz.png'));
            const elementNode = ReactDOM.findDOMNode(element);
            const link = elementNode.querySelector('a');

            expect(link).not.toBe(null);
            expect(link.textContent).toBe('foo');
            expect(link.getAttribute('title')).toBe(null);
            expect(link.getAttribute('href')).toBe('/xyz.png');
        });

        it('should handle a link reference with title', () => {
            const element = render(converter('[foo][1]\n[1]: /xyz.png "bar"'));
            const elementNode = ReactDOM.findDOMNode(element);
            const link = elementNode.querySelector('a');

            expect(link).not.toBe(null);
            expect(link.textContent).toBe('foo');
            expect(link.getAttribute('title')).toBe('bar');
            expect(link.getAttribute('href')).toBe('/xyz.png');
        });
    });

    describe('lists', () => {
        /* disabled pending a fix from mdast: https://github.com/wooorm/mdast/issues/104 */
        xit('should handle a tight list', () => {
            const element = render(converter('- xyz\n- abc\n- foo'));
            const elementNode = ReactDOM.findDOMNode(element);
            const list = elementNode.querySelector('ul');

            console.log(list.children[0].childNodes[0]);

            expect(list).not.toBe(null);
            expect(list.children.length).toBe(3);
            expect(list.children[0].textContent).toBe('xyz');
            expect(list.children[0].childNodes[0].nodeType).toBe(3); // TEXT_NODE
            expect(list.children[1].textContent).toBe('abc');
            expect(list.children[1].childNodes[0].nodeType).toBe(3); // TEXT_NODE
            expect(list.children[2].textContent).toBe('foo');
            expect(list.children[2].childNodes[0].nodeType).toBe(3); // TEXT_NODE
        });

        it('should handle a loose list', () => {
            const element = render(converter('- xyz\n\n- abc\n\n- foo'));
            const elementNode = ReactDOM.findDOMNode(element);
            const list = elementNode.querySelector('ul');

            expect(list).not.toBe(null);
            expect(list.children.length).toBe(3);
            expect(list.children[0].textContent).toBe('xyz');
            expect(list.children[0].children[0].tagName).toBe('P');
            expect(list.children[1].textContent).toBe('abc');
            expect(list.children[1].children[0].tagName).toBe('P');
            expect(list.children[2].textContent).toBe('foo');
            expect(list.children[2].children[0].tagName).toBe('P');
        });

        it('should handle an ordered list', () => {
            const element = render(converter('1. xyz\n1. abc\n1. foo'));
            const elementNode = ReactDOM.findDOMNode(element);
            const list = elementNode.querySelector('ol');

            expect(list).not.toBe(null);
            expect(list.children.length).toBe(3);
            expect(list.children[0].textContent).toBe('xyz');
            expect(list.children[1].textContent).toBe('abc');
            expect(list.children[2].textContent).toBe('foo');
        });

        it('should handle an ordered list with a specific start index', () => {
            const element = render(converter('2. xyz\n3. abc\n4. foo'));
            const elementNode = ReactDOM.findDOMNode(element);
            const list = elementNode.querySelector('ol');

            expect(list).not.toBe(null);
            expect(list.getAttribute('start')).toBe('2');
        });

        it('should handle a nested list', () => {
            const element = render(converter('- xyz\n  - abc\n- foo'));
            const elementNode = ReactDOM.findDOMNode(element);
            const list = elementNode.querySelector('ul');

            expect(list).not.toBe(null);
            expect(list.children.length).toBe(2);
            expect(list.children[0].children[0].textContent).toBe('xyz');
            expect(list.children[0].children[1].tagName).toBe('UL');
            expect(list.children[0].children[1].children[0].textContent).toBe('abc');
            expect(list.children[1].textContent).toBe('foo');
        });
    });

    describe('GFM task lists', () => {
        it('should handle unchecked items', () => {
            const element = render(converter('- [ ] foo'));
            const elementNode = ReactDOM.findDOMNode(element);
            const checkbox = elementNode.querySelector('ul li input');

            expect(checkbox).not.toBe(null);
            expect(checkbox.checked).toBe(false);
            expect(checkbox.parentNode.textContent).toBe('foo');
        });

        it('should handle checked items', () => {
            const element = render(converter('- [x] foo'));
            const elementNode = ReactDOM.findDOMNode(element);
            const checkbox = elementNode.querySelector('ul li input');

            expect(checkbox).not.toBe(null);
            expect(checkbox.checked).toBe(true);
            expect(checkbox.parentNode.textContent).toBe('foo');
        });

        it('should disable the checkboxes', () => {
            const element = render(converter('- [x] foo'));
            const elementNode = ReactDOM.findDOMNode(element);
            const checkbox = elementNode.querySelector('ul li input');

            expect(checkbox).not.toBe(null);
            expect(checkbox.disabled).toBe(true);
        });
    });

    describe('GFM tables', () => {
        it('should handle a basic table', () => {
            const element = render(converter('foo|bar\n-|-\n1|2'));
            const elementNode = ReactDOM.findDOMNode(element);
            const table = elementNode.querySelector('table');
            const thead = table.querySelector('thead tr');
            const row = table.querySelector('tbody tr');

            expect(table).not.toBe(null);
            expect(thead).not.toBe(null);
            expect(thead.children.length).toBe(2);
            expect(thead.children[0].tagName).toBe('TH');
            expect(row).not.toBe(null);
            expect(row.children.length).toBe(2);
            expect(row.children[0].tagName).toBe('TD');
        });

        it('should handle a table with aligned columns', () => {
            const element = render(converter('foo|bar\n-:|-\n1|2'));
            const elementNode = ReactDOM.findDOMNode(element);
            const table = elementNode.querySelector('table');
            const thead = table.querySelector('thead tr');
            const row = table.querySelector('tbody tr');

            expect(table).not.toBe(null);
            expect(thead).not.toBe(null);
            expect(thead.children.length).toBe(2);
            expect(thead.children[0].tagName).toBe('TH');
            expect(thead.children[0].style.textAlign).toBe('right');
            expect(row).not.toBe(null);
            expect(row.children.length).toBe(2);
            expect(row.children[0].tagName).toBe('TD');
            expect(row.children[0].style.textAlign).toBe('right');
        });
    });

    describe('arbitrary HTML', () => {
        it('should preserve the HTML given', () => {
            const element = render(converter('<dd>Hello</dd>'));
            const elementNode = ReactDOM.findDOMNode(element);

            expect(elementNode.children[0].tagName).toBe('DIV');
            expect(elementNode.children[0].children[0].tagName).toBe('DD');
        });
    });

    describe('horizontal rules', () => {
        it('should be handled', () => {
            const element = render(converter('---'));
            const elementNode = ReactDOM.findDOMNode(element);
            const rule = elementNode.querySelector('hr');

            expect(rule).not.toBe(null);
        });
    });

    describe('line breaks', () => {
        it('should be handled', () => {
            const element = render(converter('hello  \nthere'));
            const elementNode = ReactDOM.findDOMNode(element);
            const lineBreak = elementNode.querySelector('br');

            expect(lineBreak).not.toBe(null);
        });
    });

    describe('fenced code blocks', () => {
        it('should be handled', () => {
            const element = render(converter('```js\nfoo\n```'));
            const elementNode = ReactDOM.findDOMNode(element);
            const pre = elementNode.querySelector('pre');

            expect(pre).not.toBe(null);
            expect(pre.children[0].tagName).toBe('CODE');
            expect(pre.children[0].classList.contains('lang-js')).toBe(true);
            expect(pre.children[0].textContent).toBe('foo');
        });
    });

    describe('inline code blocks', () => {
        it('should be handled', () => {
            const element = render(converter('`foo`'));
            const elementNode = ReactDOM.findDOMNode(element);
            const code = elementNode.querySelector('code');

            expect(code).not.toBe(null);
            expect(code.childNodes[0].nodeType).toBe(3); // TEXT_NODE
            expect(code.textContent).toBe('foo');
        });
    });

    describe('footnotes', () => {
        it('should handle conversion of references into links', () => {
            const element = render(
                converter('foo[^abc] bar\n\n[^abc]: Baz baz', {footnotes: true})
            );

            const elementNode = ReactDOM.findDOMNode(element);

            const text = elementNode.children[0].children[0];
            const footnoteLink = elementNode.children[0].children[1];
            const restOfText = elementNode.children[0].children[2];

            expect(text).not.toBe(null);
            expect(text.textContent).toBe('foo');

            expect(footnoteLink).not.toBe(null);
            expect(footnoteLink.textContent).toBe('abc');
            expect(footnoteLink.getAttribute('href')).toBe('#abc');
            expect(footnoteLink.tagName).toBe('A');
            expect(footnoteLink.children[0].tagName).toBe('SUP');

            expect(restOfText).not.toBe(null);
            expect(restOfText.textContent).toBe(' bar');
        });

        it('should inject the definitions in a footer at the end of the root', () => {
            const element = render(
                converter('foo[^abc] bar\n\n[^abc]: Baz baz', {footnotes: true})
            );

            const elementNode = ReactDOM.findDOMNode(element);
            const definitions = elementNode.children[1];

            expect(definitions).not.toBe(null);
            expect(definitions.tagName).toBe('FOOTER');
            expect(definitions.children[0].tagName).toBe('DIV');
            expect(definitions.children[0].id).toBe('abc');
            expect(definitions.children[0].textContent).toBe('[abc]: Baz baz');
        });
    });
});
