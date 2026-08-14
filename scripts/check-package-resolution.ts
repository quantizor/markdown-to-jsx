#!/usr/bin/env bun

/**
 * Resolution and runtime-shape test for the published packages, run after the
 * build against the real dist. It backs the compat shim's subpath contract:
 * the CommonJS root of markdown-to-jsx must be the renderable Markdown
 * component itself (with the named exports attached), matching the legacy
 * default-only root (lib/src/index.cjs.spec.tsx), not a module namespace.
 *
 * The compat stubs forward to @marqdown/* packages, which are linked into
 * packages/compat/node_modules, so a require/import based there resolves them.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

var ROOT = path.resolve(import.meta.dir, '..')
var COMPAT_DIST = path.join(ROOT, 'packages', 'compat', 'dist')
// Resolve as if from the compat dist so both './x.cjs' stubs and their
// forwarded '@marqdown/*' targets resolve the way a consumer's would.
var require = createRequire(path.join(COMPAT_DIST, 'index.cjs'))

var failures: string[] = []
function check(name: string, ok: boolean): void {
  if (!ok) {
    failures.push(name)
  }
}

// --- CommonJS root: require('markdown-to-jsx') is the Markdown component ---
var root = require(path.join(COMPAT_DIST, 'index.cjs'))
check('cjs root is the component (function)', typeof root === 'function')
check('cjs root .compiler', typeof root.compiler === 'function')
check('cjs root .parser', typeof root.parser === 'function')
check(
  'cjs root .RuleType',
  root.RuleType != null && typeof root.RuleType === 'object'
)
// Guarded: a namespace object (the regression) is not a valid element type, so
// the render would throw before the check could report. Report it instead.
if (typeof root === 'function') {
  var rootHtml = renderToStaticMarkup(
    React.createElement(root, { children: '# Hi' })
  )
  check(
    `cjs root renders as a component (got ${rootHtml})`,
    rootHtml === '<h1 id="hi">Hi</h1>'
  )
} else {
  check('cjs root renders as a component', false)
}

// --- CommonJS subpaths keep the namespace shape ---
var html = require(path.join(COMPAT_DIST, 'html.cjs'))
check('cjs /html .compiler', typeof html.compiler === 'function')
check('cjs /html output', html.compiler('# H') === '<h1 id="h">H</h1>')
var ent = require(path.join(COMPAT_DIST, 'entities.cjs'))
check('cjs /entities decodeEntity', ent.decodeEntity('copy') === '©')

// --- Scoped packages resolve by name with the expected shapes ---
var react = require('@marqdown/react')
check(
  '@marqdown/react default is the component',
  typeof react.default === 'function'
)
check('@marqdown/react .compiler', typeof react.compiler === 'function')
var htmlPkg = require('@marqdown/html')
check('@marqdown/html .compiler', typeof htmlPkg.compiler === 'function')

// --- ESM root: default is the component, named exports present ---
var esm = await import(pathToFileURL(path.join(COMPAT_DIST, 'index.js')).href)
check('esm root default is the component', typeof esm.default === 'function')
check('esm root named compiler', typeof esm.compiler === 'function')
check('esm root named parser', typeof esm.parser === 'function')

if (failures.length > 0) {
  console.error(
    `package resolution/shape failures:\n  ${failures.join('\n  ')}`
  )
  process.exit(1)
}
console.log(
  'check-package-resolution: compat and scoped package shapes verified.'
)
