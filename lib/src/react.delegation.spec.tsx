/**
 * Covers the runtime-detection predicate that decides whether
 * createRawElement uses the raw React-shaped fast path or delegates to
 * the runtime's own createElement (the Preact/non-React path).
 *
 * The predicate is exercised directly with synthetic vnodes rather than
 * by mocking the 'react' module: Bun shares the module cache across test
 * files, so a module mock cannot reliably swap the runtime seen by
 * react.tsx's load-time probe. End-to-end coverage of the delegation
 * path itself lives in the Preact browser fixture.
 */

import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { supportsRawElements } from './react.tsx'

describe('runtime element-shape detection (supportsRawElements)', () => {
  it('accepts real React elements', () => {
    expect(supportsRawElements(createElement('div'))).toBe(true)
  })

  it('rejects Preact/compat vnodes that mimic React’s element marker', () => {
    // preact/compat vnodes carry $$typeof: Symbol.for('react.element');
    // only the missing _owner distinguishes them from React elements.
    expect(
      supportsRawElements({
        $$typeof: Symbol.for('react.element'),
        type: 'div',
        props: {},
        key: null,
        ref: null,
        __k: null,
        __b: 0,
      })
    ).toBe(false)
  })

  it('rejects shapes without the React marker', () => {
    expect(supportsRawElements(null)).toBe(false)
    expect(supportsRawElements(undefined)).toBe(false)
    expect(supportsRawElements({})).toBe(false)
    expect(supportsRawElements({ $$typeof: Symbol.for('react.element') })).toBe(
      false
    )
  })
})
