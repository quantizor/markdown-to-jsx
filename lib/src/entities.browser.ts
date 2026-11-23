var decoder: HTMLTextAreaElement | undefined

/**
 * Decode a single HTML entity reference using the browser's native HTML parser.
 * Returns undefined if decoding fails or changes nothing (unknown entity).
 */
export function decodeEntity(name: string): string | undefined {
  if (!decoder) {
    if (typeof document === 'undefined') {
      return
    }
    decoder = document.createElement('textarea')
  }
  var encoded = `&${name};`
  decoder.innerHTML = encoded
  var decoded = decoder.value
  return decoded === encoded ? undefined : decoded
}

/** Empty: the browser build decodes through the DOM, so no entity table ships. */
export var NAMED_CODES_TO_UNICODE: Record<string, string> = {}
