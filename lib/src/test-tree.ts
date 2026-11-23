import { parser } from './parse.ts'
import { type MarkdownToJSX, RuleType } from './types.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function walk(node: unknown, out: [string, unknown][]): void {
  if (Array.isArray(node)) {
    for (const child of node) {
      walk(child, out)
    }
    return
  }
  if (!isRecord(node)) {
    return
  }

  if (typeof node.default === 'function') {
    walk(node.default(), out)
    return
  }

  const props = (isRecord(node.p) ? node.p : node.props) ?? {}
  if (!isRecord(props)) {
    return
  }
  for (const name of Object.keys(props)) {
    if (name !== 'children') {
      out.push([name, props[name]])
    }
  }

  walk('children' in node ? node.children : props.children, out)
}

export function treeProps(tree: unknown): [string, unknown][] {
  const out: [string, unknown][] = []
  walk(tree, out)
  return out
}

export function elementTypes(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) {
      elementTypes(child, out)
    }
    return out
  }
  if (!isRecord(node)) {
    return out
  }
  if (typeof node.default === 'function') {
    return elementTypes(node.default(), out)
  }
  const type = node.t ?? node.type
  if (typeof type === 'string') {
    out.push(type)
  }
  const props = isRecord(node.p) ? node.p : node.props
  return elementTypes(
    'children' in node || !isRecord(props) ? node.children : props.children,
    out
  )
}

function withoutPrivateField(key: string, value: unknown): unknown {
  if (key.startsWith('_')) {
    return
  }
  return value
}

export function storedAST(
  input: string,
  overrides?: { [tag: string]: unknown }
): MarkdownToJSX.ASTNode[] {
  return JSON.parse(
    JSON.stringify(parser(input, { overrides }), withoutPrivateField)
  )
}

export function quotesDeep(count: number): MarkdownToJSX.ASTNode[] {
  let node: MarkdownToJSX.ASTNode = {
    type: RuleType.blockQuote,
    children: [{ type: RuleType.text, text: 'x' }],
  }
  for (let i = 1; i < count; i++) {
    node = { type: RuleType.blockQuote, children: [node] }
  }
  return [node]
}

export function escapeText(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
