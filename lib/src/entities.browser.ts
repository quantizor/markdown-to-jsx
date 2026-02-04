/**
 * Browser-optimized HTML entity decoder
 *
 * Uses the DOM's built-in entity decoding via textarea.innerHTML.
 * The browser's HTML parser has the complete entity table built-in,
 * so we can leverage it instead of shipping our own copy.
 *
 * This file is automatically selected for browser builds via the package.json
 * "imports" field with a "browser" condition, resulting in ~10KB gzipped savings.
 */

var decoder: HTMLTextAreaElement | undefined

/**
 * Decode a single HTML entity reference using the browser's native HTML parser.
 * Returns undefined if decoding fails or changes nothing (unknown entity).
 */
export function decodeEntity(name: string): string | undefined {
  if (!decoder) {
    if (typeof document !== 'undefined') {
      decoder = document.createElement('textarea')
    } else {
      return undefined
    }
  }
  var encoded = '&' + name + ';'
  decoder.innerHTML = encoded
  var decoded = decoder.value
  return decoded !== encoded ? decoded : undefined
}

/**
 * Empty placeholder - browser uses DOM decoding for lookups
 * This export exists for API compatibility with the full entity table
 */
export var NAMED_CODES_TO_UNICODE: Record<string, string> = {}
