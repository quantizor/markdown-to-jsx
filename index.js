import React from 'react';
import {parse} from 'remark';

const textTypes = ['text', 'textNode'];

let definitions;
let footnotes;

function getHTMLNodeTypeFromASTNodeType(node) {
    switch (node.type) {
    case 'break':
        return 'br';

    case 'delete':
        return 'del';

    case 'emphasis':
        return 'em';

    case 'footnoteReference':
        return 'a';

    case 'heading':
        return `h${node.depth}`;

    case 'horizontalRule':
        return 'hr';

    case 'html':
        return 'div';

    case 'image':
    case 'imageReference':
        return 'img';

    case 'inlineCode':
        return 'code';

    case 'link':
    case 'linkReference':
        return 'a';

    case 'list':
        return node.ordered ? 'ol' : 'ul';

    case 'listItem':
        return 'li';

    case 'paragraph':
        return 'p';

    case 'root':
        return 'div';

    case 'tableHeader':
        return 'thead';

    case 'tableRow':
        return 'tr';

    case 'tableCell':
        return 'td';

    case 'definition':
    case 'footnoteDefinition':
    case 'yaml':
        return null;

    default:
        return node.type;
    }
}

function formExtraPropsForHTMLNodeType(props = {}, ast) {
    switch (ast.type) {
    case 'footnoteReference':
        return {
            ...props,
            href: `#${ast.identifier}`,
        };

    case 'image':
        return {
            ...props,
            title: ast.title,
            alt: ast.alt,
            src: ast.src,
        };

    case 'imageReference':
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

    case 'linkReference':
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

    case 'tableCell':
    case 'th':
        return {
            ...props,
            style: {textAlign: ast.align},
        };
    }

    return props;
}

function seekCellsAndAlignThemIfNecessary(root, alignmentValues) {
    const mapper = (child, index) => {
        if (child.type === 'tableCell') {
            return {
                ...child,
                align: alignmentValues[index],
            };
        } else if (Array.isArray(child.children) && child.children.length) {
            return child.children.map(mapper);
        }

        return child;
    };

    if (Array.isArray(root.children) && root.children.length) {
        root.children = root.children.map(mapper);
    }

    return root;
}

function astToJSX(ast, index) { /* `this` is the dictionary of definitions */
    if (textTypes.indexOf(ast.type) !== -1) {
        return ast.value;
    }

    const key = index || '0';

    if (ast.type === 'code') {
        return (
            <pre key={key}>
                <code className={`lang-${ast.lang}`}>
                    {ast.value}
                </code>
            </pre>
        );
    } /* Refers to fenced blocks, need to create a pre:code nested structure */

    if (ast.type === 'listItem') {
        if (ast.checked === true || ast.checked === false) {
            return (
                <li key={key}>
                    <input key='checkbox'
                           type="checkbox"
                           checked={ast.checked}
                           disabled />
                    {ast.children.map(astToJSX)}
                </li>
            );
        } /* gfm task list, need to add a checkbox */
    }

    if (ast.type === 'html') {
        return (
            <div key={key} dangerouslySetInnerHTML={{__html: ast.value}} />
        );
    } /* arbitrary HTML, do the gross thing for now */

    if (ast.type === 'table') {
        const tbody = {type: 'tbody', children: []};

        ast.children = ast.children.reduce((children, child) => {
            if (child.type === 'tableHeader') {
                children.unshift(
                    seekCellsAndAlignThemIfNecessary(child, ast.align)
                );
            } else if (child.type === 'tableRow') {
                tbody.children.push(
                    seekCellsAndAlignThemIfNecessary(child, ast.align)
                );
            } else if (child.type === 'tableFooter') {
                children.push(
                    seekCellsAndAlignThemIfNecessary(child, ast.align)
                );
            }

            return children;

        }, [tbody]);

    } /* React yells if things aren't in the proper structure, so need to
        delve into the immediate children and wrap tablerow(s) in a tbody */

    if (ast.type === 'tableFooter') {
        ast.children = [{
            type: 'tr',
            children: ast.children
        }];
    } /* React yells if things aren't in the proper structure, so need to
        delve into the immediate children and wrap the cells in a tablerow */

    if (ast.type === 'tableHeader') {
        ast.children = [{
            type: 'tr',
            children: ast.children.map(child => {
                if (child.type === 'tableCell') {
                    child.type = 'th';
                } /* et voila, a proper table header */

                return child;
            })
        }];
    } /* React yells if things aren't in the proper structure, so need to
        delve into the immediate children and wrap the cells in a tablerow */

    if (ast.type === 'footnoteReference') {
        ast.children = [{type: 'sup', value: ast.identifier}];
    } /* place the identifier inside a superscript tag for the link */

    const htmlNodeType = getHTMLNodeTypeFromASTNodeType(ast);

    if (htmlNodeType === null) {
        return null;
    } /* bail out, not convertable to any HTML representation */

    const props = formExtraPropsForHTMLNodeType({key}, ast);

    if (ast.children && ast.children.length === 1) {
        if (textTypes.indexOf(ast.children[0].type) !== -1) {
            ast.children = ast.children[0].value;
        }
    } /* solitary text children don't need full parsing or React will add a wrapper */

    let children =   Array.isArray(ast.children)
                   ? ast.children.map(astToJSX)
                   : ast.children;

    return React.createElement(htmlNodeType, props, ast.value || children);
}

function extractDefinitionsFromASTTree(ast) {
    const reducer = (aggregator, node) => {
        if (node.type === 'definition' || node.type === 'footnoteDefinition') {
            aggregator.definitions[node.identifier] = node;

            if (node.type === 'footnoteDefinition') {
                if (   node.children
                    && node.children.length === 1
                    && node.children[0].type === 'paragraph') {
                    node.children[0].children.unshift({
                        type: 'textNode',
                        value: `[${node.identifier}]: `,
                    });
                } /* package the prefix inside the first child */

                aggregator.footnotes.push(
                    <div key={node.identifier} id={node.identifier}>
                        {node.value || node.children.map(astToJSX)}
                    </div>
                );
            }
        }

        return   Array.isArray(node.children)
               ? node.children.reduce(reducer, aggregator)
               : aggregator;
    };

    return [ast].reduce(reducer, {
        definitions: {},
        footnotes: []
    });
}

export default function markdownToJSX(markdown, remarkOptions = {}) {
    let ast;

    remarkOptions.position = remarkOptions.position || false;

    try {
        ast = parse(markdown, remarkOptions);
    } catch (error) {
        return error;
    }

    const extracted = extractDefinitionsFromASTTree(ast);

    definitions = extracted.definitions;
    footnotes = extracted.footnotes;

    const jsx = astToJSX(ast);

    if (footnotes.length) {
        jsx.props.children.push(
            <footer key='footnotes'>{footnotes}</footer>
        );
    }

    return jsx;
}
