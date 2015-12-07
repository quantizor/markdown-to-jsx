import React from 'react';
import {parse} from 'mdast';

const textTypes = ['text', 'textnode', 'escape'];
let definitions;

function getHTMLNodeTypeFromASTNodeType(node) {
    switch (node.type.toLowerCase()) {
    case 'break':
        return 'br';

    case 'delete':
        return 'del';

    case 'emphasis':
        return 'em';

    case 'heading':
        return `h${node.depth}`;

    case 'horizontalrule':
        return 'hr';

    case 'html':
        return 'div';

    case 'image':
    case 'imagereference':
        return 'img';

    case 'inlinecode':
        return 'code';

    case 'link':
    case 'linkreference':
        return 'a';

    case 'list':
        return node.ordered ? 'ol' : 'ul';

    case 'listitem':
        return 'li';

    case 'paragraph':
        return 'p';

    case 'root':
        return 'div';

    case 'tableheader':
        return 'thead';

    case 'tablerow':
        return 'trow';

    case 'tablecell':
        return 'td';

    case 'tableheadercell':
        return 'th';

    case 'definition':
    case 'footnotedefinition':
    case 'yaml':
        return null;

    default:
        return node.type;
    }
}

function formExtraPropsForHTMLNodeType(props = {}, ast) {
    switch (ast.type.toLowerCase()) {
    case 'image':
        return {
            ...props,
            title: ast.title,
            alt: ast.alt,
            src: ast.src,
        };

    case 'imagereference':
        return {
            ...props,
            title: definitions[ast.identifier].title,
            alt: ast.alt,
            src: definitions[ast.identifier].link,
        };

    case 'link':
        return {
            ...props,
            title: ast.title,
            href: ast.href,
        };

    case 'linkreference':
        return {
            ...props,
            title: definitions[ast.identifier].title,
            href: definitions[ast.identifier].link,
        };

    case 'list':
        return {
            ...props,
            start: ast.start,
        };

    case 'table':
        return {
            ...props,
            style: {align: ast.align},
        };

    case 'tableheader':
        ast.children = ast.children.map(child => {
            if (child.type === 'tablecell') {
                child.type = 'TableHeaderCell';
            } /* inventing a new type so the correct element can be emitted */

            return child;
        });

        return {
            ...props,
            style: {align: ast.align},
        };
    }

    return props;
}

function astToJSX(ast, index) { /* `this` is the dictionary of definitions */
    const type = ast.type.toLowerCase();

    if (textTypes.indexOf(type) !== -1) {
        return ast.value;
    }

    const key = index || '0';

    if (type === 'code') {
        return (
            <pre key={key}>
                <code className={`lang-${ast.lang}`}>
                    {ast.children.map(astToJSX)}
                </code>
            </pre>
        );
    } /* Refers to fenced blocks, need to create a pre:code nested structure */

    if (    type === 'listItem'
        && (ast.checked === true || ast.checked === false)) {
        return (
            <li>
                <input key='checkbox'
                       type="checkbox"
                       checked={ast.checked}
                       disabled />
                {ast.children.map(astToJSX)}
            </li>
        );
    } /* gfm task list, need to add a checkbox */

    if (type === 'footnotedefinition') {
        return this[ast.identifier].children.map(astToJSX);
    } /* the children are stored elsewhere in the definition */

    if (type === 'html') {
        return (
            <div key={key} dangerouslySetInnerHTML={{__html: ast.value}} />
        );
    } /* arbitrary HTML, do the gross thing for now */

    const htmlNodeType = getHTMLNodeTypeFromASTNodeType(ast);

    if (htmlNodeType === null) {
        return null;
    } /* bail out, not convertable to any HTML representation */

    const props = formExtraPropsForHTMLNodeType({key}, ast);

    if (ast.children && ast.children.length === 1) {
        if (textTypes.indexOf(ast.children[0].type.toLowerCase()) !== -1) {
            ast.children = ast.children[0].value;
        }
    } /* solitary text children don't need full parsing or React will add a wrapper */

    let children =   Array.isArray(ast.children)
                   ? ast.children.map(astToJSX)
                   : ast.children;

    return React.createElement(htmlNodeType, props, children);
}

function extractDefinitionsFromASTTree(ast) {
    const reducer = (dictionary, node) => {
        let type = node.type.toLowerCase();

        if (type === 'definition' || type === 'footnotedefinition') {
            dictionary[node.identifier] = node;
        }

        return   node.children
               ? node.children.reduce(reducer, dictionary)
               : dictionary;
    };

    return (Array.isArray(ast) ? ast : [ast]).reduce(reducer, {});
}

export default function markdownToJSX(markdown, mdastOptions = {}) {
    let ast;

    try {
        ast = parse(markdown, mdastOptions);
    } catch (error) {
        return error;
    }

    definitions = extractDefinitionsFromASTTree(ast);

    return astToJSX(ast);
}
