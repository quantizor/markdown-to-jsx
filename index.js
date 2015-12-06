import React from 'react';
import {parse} from 'mdast';

const textTypes = ['text', 'textnode', 'escape'];

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
        return node.parent.type === 'tableheader' ? 'th' : 'td';

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
            title: this[ast.identifier].title,
            alt: ast.alt,
            src: this[ast.identifier].link,
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
            title: this[ast.identifier].title,
            href: this[ast.identifier].link,
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
    }

    return props;
}

function astToJSX(ast) { /* `this` is the dictionary of definitions */
    const type = ast.type.toLowerCase();

    if (textTypes.indexOf(type) !== -1) {
        return ast.value;
    }

    const key = ast.parent ? ast.parent.children.indexOf(ast) : '0';

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
    const props = formExtraPropsForHTMLNodeType({key}, ast);

    if (ast.children.length === 1) {
        if (textTypes.indexOf(ast.children[0].type.toLowerCase()) !== -1) {
            ast.children = ast.children[0].value;
        }
    } // solitary text children don't need full parsing or React will add a wrapper

    let children =   Array.isArray(ast.children)
                   ? ast.children.map(astToJSX)
                   : ast.children;

    return   htmlNodeType !== null
           ? React.createElement(htmlNodeType, props, children)
           : null;
}

function extractDefinitionsFromASTTree(ast) {
    let type;

    const reducer = (dictionary, node) => {
        type = node.type.toLowerCase();

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

    // pass the dictionary of definitions in as context for the parsing run
    return astToJSX.bind(extractDefinitionsFromASTTree(ast))(ast);
}
