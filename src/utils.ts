/**
 * Named HTML entity codes to unicode character mapping
 * Shared between parse.ts and index.tsx
 */
export const NAMED_CODES_TO_UNICODE = {
  amp: '\u0026',
  apos: '\u0027',
  gt: '\u003e',
  lt: '\u003c',
  nbsp: '\u00a0',
  quot: '\u201c',
} as const

/**
 * Convert hyphenated CSS property name to camelCase
 * Example: "background-color" -> "backgroundColor"
 */
export function camelCaseCss(prop: string): string {
  return prop.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

const SANITIZE_R = /(javascript|vbscript|data(?!:image)):/i

export function sanitizer(input: string): string {
  try {
    const decoded = decodeURIComponent(input).replace(/[^A-Za-z0-9/:]/g, '')

    if (SANITIZE_R.test(decoded)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          'Input contains an unsafe JavaScript/VBScript/data expression, it will not be rendered.',
          decoded
        )
      }

      return null
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Input could not be decoded due to malformed syntax or characters, it will not be rendered.',
        input
      )
    }

    // decodeURIComponent sometimes throws a URIError
    // See `decodeURIComponent('a%AFc');`
    // http://stackoverflow.com/questions/9064536/javascript-decodeuricomponent-malformed-uri-exception
    return null
  }

  return input
}

// based on https://stackoverflow.com/a/18123682/1141611
// not complete, but probably good enough
export function slugify(str: string) {
  return str
    .replace(/[ÀÁÂÃÄÅàáâãäåæÆ]/g, 'a')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ðÐ]/g, 'd')
    .replace(/[ÈÉÊËéèêë]/g, 'e')
    .replace(/[ÏïÎîÍíÌì]/g, 'i')
    .replace(/[Ññ]/g, 'n')
    .replace(/[øØœŒÕõÔôÓóÒò]/g, 'o')
    .replace(/[ÜüÛûÚúÙù]/g, 'u')
    .replace(/[ŸÿÝý]/g, 'y')
    .replace(/[^a-z0-9- ]/gi, '')
    .replace(/ /gi, '-')
    .toLowerCase()
}


