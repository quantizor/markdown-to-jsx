import React from 'react';
import unified from 'unified';
import parser from 'remark-parse';

const getType = Object.prototype.toString;
const textTypes = ['text', 'textNode'];

export default function markdownToJSX(markdown, options = {}, overrides = {}) {
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

        case 'thematicBreak':
            return 'hr';

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
                src: ast.url,
            };

        case 'imageReference':
            return {
                ...props,
                title: definitions[ast.identifier].title,
                alt: ast.alt,
                src: definitions[ast.identifier].url,
            };

        case 'link':
            return {
                ...props,
                title: ast.title,
                href: ast.url,
            };

        case 'linkReference':
            return {
                ...props,
                title: definitions[ast.identifier].title,
                href: definitions[ast.identifier].url,
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

        if (ast.type === 'list' && ast.loose === false) {
            ast.children = ast.children.map(item => {
                if (item.children.length === 1 && item.children[0].type === 'paragraph') {
                    return {
                        ...item,
                        children: item.children[0].children,
                    };
                }

                return item;
            });
        } /* tight list, remove the paragraph wrapper just inside the listItem */

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

            ast.children = ast.children.reduce((children, child, index) => {
                if (index === 0) {
                    /* manually marking the first row as tableHeader since that was removed in remark@4.x; it's important semantically. */
                    child.type = 'tableHeader';
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

        let htmlNodeType = getHTMLNodeTypeFromASTNodeType(ast);
        if (htmlNodeType === null) {
            return null;
        } /* bail out, not convertable to any HTML representation */

        let props = {key};

        const override = overrides[htmlNodeType];
        if (override) {
            if (override.component) {
                htmlNodeType = override.component;
            } /* sub out the normal html tag name for the JSX / ReactFactory
                 passed in by the caller */

            if (override.props) {
                props = {...override.props, ...props};
            } /* apply the prop overrides beneath the minimal set that are necessary
                 to have the markdown conversion work as expected */
        }

        /* their props + our props, with any duplicate keys overwritten by us
           (necessary evil, file an issue if something comes up that needs
           extra attention, only props specified in `formExtraPropsForHTMLNodeType`
           will be overwritten on a key collision) */
        const finalProps = formExtraPropsForHTMLNodeType(props, ast);

        if (ast.children && ast.children.length === 1) {
            if (textTypes.indexOf(ast.children[0].type) !== -1) {
                ast.children = ast.children[0].value;
            }
        } /* solitary text children don't need full parsing or React will add a wrapper */

        const children =   Array.isArray(ast.children)
                         ? ast.children.map(astToJSX)
                         : ast.children;

        return React.createElement(htmlNodeType, finalProps, ast.value || children);
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

    if (typeof markdown !== 'string') {
        throw new Error(`markdown-to-jsx: the first argument must be
                         a string`);
    }

    if (getType.call(options) !== '[object Object]') {
        throw new Error(`markdown-to-jsx: the second argument must be
                         undefined or an object literal ({}) containing
                         valid remark options`);
    }

    if (getType.call(overrides) !== '[object Object]') {
        throw new Error(`markdown-to-jsx: the third argument must be
                         undefined or an object literal with shape:
                         {
                            htmltagname: {
                                component: string|ReactComponent(optional),
                                props: object(optional)
                            }
                         }`);
    }

    options.position = options.position || false;
    options.footnotes = options.footnotes || true;

    const remarkAST = unified().use(parser).parse(markdown, options);
    const extracted = extractDefinitionsFromASTTree(remarkAST);

    definitions = extracted.definitions;
    footnotes = extracted.footnotes;

    let jsx = astToJSX(remarkAST);

    // discard the root <div> node if there is only one valid initial child
    // generally this is a paragraph
    if (jsx.props.children.length === 1) {
        jsx = jsx.props.children[0];
    }

    if (footnotes.length) {
        jsx.props.children.push(
            <footer key='footnotes'>{footnotes}</footer>
        );
    }

    return jsx;
}
