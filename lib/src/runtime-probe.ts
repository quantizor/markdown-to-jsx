/**
 * Decide whether the runtime renders React's internal element shape.
 *
 * Both React.createElement and React's jsx() stamp `_owner` on every
 * element. Preact vnodes never do — even though preact/compat vnodes
 * mimic React's `$$typeof` marker, so that marker alone cannot prove
 * the runtime is React. If a future React drops `_owner` we degrade to
 * the (slower but correct) createElement path rather than emitting
 * elements the runtime cannot render.
 *
 * Kept in its own module so it can be unit-tested without pulling
 * react.tsx (the `markdown-to-jsx/react` entry) into the test's module
 * graph, and so it does not become part of the entry's public surface.
 */
export function supportsRawElements(probeElement: unknown): boolean {
  var probe = probeElement as { $$typeof?: symbol; _owner?: unknown } | null
  return (
    probe != null &&
    typeof probe === 'object' &&
    typeof probe.$$typeof === 'symbol' &&
    '_owner' in probe
  )
}
