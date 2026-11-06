import { parser } from './parse.ts'
import type { MarkdownToJSX } from './types.ts'

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

  // A Vue slot object holds its content behind a `default` function.
  if (typeof node.default === 'function') {
    walk(node.default(), out)
    return
  }

  // Solid elements keep props on `p`; React and Vue elements keep them on `props`.
  const props = (isRecord(node.p) ? node.p : node.props) ?? {}
  if (!isRecord(props)) {
    return
  }
  for (const name of Object.keys(props)) {
    if (name !== 'children') {
      out.push([name, props[name]])
    }
  }

  // A Vue VNode keeps children beside its props, not inside them.
  walk('children' in node ? node.children : props.children, out)
}

/**
 * Every prop of every element in a rendered React, React Native, Solid, or Vue
 * tree, as `[name, value]` pairs in tree order (an element's props, then its
 * children's). Children are walked, never reported as a prop. A Vue slot
 * object is walked through its `default()` result. Strings, null, and other
 * non-element values contribute nothing.
 */
export function treeProps(tree: unknown): [string, unknown][] {
  const out: [string, unknown][] = []
  walk(tree, out)
  return out
}

function withoutPrivateField(key: string, value: unknown): unknown {
  if (key.startsWith('_')) {
    return
  }
  return value
}

/**
 * The `parser()` output for `input` as a caller stores it: through JSON, with
 * every private `_` field dropped, so a compiler can only write it from the
 * public fields.
 */
export function storedAST(
  input: string,
  overrides?: { [tag: string]: unknown }
): MarkdownToJSX.ASTNode[] {
  return JSON.parse(
    JSON.stringify(parser(input, { overrides }), withoutPrivateField)
  )
}
