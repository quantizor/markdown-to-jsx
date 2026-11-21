/**
 * Accepts an element the runtime built with React's own element shape: an
 * object whose `$$typeof` is a symbol and that has no own `constructor`.
 * Rejects anything else, so such runtimes get elements from their own
 * createElement instead of a hand-built object.
 *
 * The own `constructor` decides because Preact (including preact/compat)
 * stamps every vnode with one (`undefined` in Preact 10, `Symbol.for('pv')`
 * in Preact 11) to reject plain objects, and preact/compat also copies React's
 * `$$typeof` marker onto its vnodes, so the marker alone cannot tell the two
 * apart. React elements have no own `constructor`, in development or production builds.
 *
 * Lives outside react.tsx so the spec can call it without widening the
 * `markdown-to-jsx/react` entry's exports.
 */
export function supportsRawElements(
  probe: unknown
): probe is { $$typeof: symbol } {
  return (
    typeof probe === 'object' &&
    probe !== null &&
    '$$typeof' in probe &&
    typeof probe.$$typeof === 'symbol' &&
    !Object.hasOwn(probe, 'constructor')
  )
}
