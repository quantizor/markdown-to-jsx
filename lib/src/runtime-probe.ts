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
