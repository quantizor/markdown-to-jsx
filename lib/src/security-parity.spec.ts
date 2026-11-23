import { describe, expect, it } from 'bun:test'
import { compiler as htmlCompiler } from './html.ts'
import { compiler as markdownCompiler } from './markdown.ts'
import { compiler as nativeCompiler } from './native.tsx'
import { compiler as reactCompiler } from './react.tsx'
import { compiler as solidCompiler } from './solid.tsx'
import { elementTypes, treeProps } from './test-tree.ts'
import { compiler as vueCompiler } from './vue.tsx'

interface DangerCase {
  id: string
  md: string
  absentFromHtml: string[]
  absentFromMarkdown: string[]
  absentFromNativeProps?: string[]
}

const LINK_PROPS = ['href', 'onPress']

const CASES: DangerCase[] = [
  {
    id: 'javascript-href',
    md: '[x](javascript:alert(1))',
    absentFromHtml: ['javascript:'],
    absentFromMarkdown: ['javascript:'],
    absentFromNativeProps: LINK_PROPS,
  },
  {
    id: 'javascript-href-encoded',
    md: '[x](java%73cript:alert(1))',
    absentFromHtml: ['javascript:', 'java%73cript'],
    absentFromMarkdown: ['javascript:', 'java%73cript'],
    absentFromNativeProps: LINK_PROPS,
  },
  {
    id: 'javascript-href-entity',
    md: '[x](&#106;avascript:alert(1))',
    absentFromHtml: ['javascript:'],
    absentFromMarkdown: ['javascript:'],
    absentFromNativeProps: LINK_PROPS,
  },
  {
    id: 'javascript-href-named-entity',
    md: '<a href="javascript&colon;alert(1)">x</a>',
    absentFromHtml: ['alert(1)'],
    absentFromMarkdown: ['alert(1)'],
    absentFromNativeProps: LINK_PROPS,
  },
  {
    id: 'javascript-href-named-entity-tab',
    md: '<a href="java&Tab;script:alert(1)">x</a>',
    absentFromHtml: ['alert(1)'],
    absentFromMarkdown: ['alert(1)'],
    absentFromNativeProps: LINK_PROPS,
  },
  {
    id: 'javascript-href-control-character',
    md: '<a href="java\u0001script:alert(1)">x</a>',
    absentFromHtml: ['alert(1)'],
    absentFromMarkdown: ['alert(1)'],
    absentFromNativeProps: LINK_PROPS,
  },
  {
    id: 'formaction-button',
    md: '<button formaction="javascript:alert(1)">b</button>',
    absentFromHtml: ['alert(1)'],
    absentFromMarkdown: ['alert(1)'],
  },
  {
    id: 'formaction-input',
    md: '<input type="image" formaction="javascript:alert(1)">',
    absentFromHtml: ['alert(1)'],
    absentFromMarkdown: ['alert(1)'],
  },
  {
    id: 'onerror-attr',
    md: '<img src="x" onerror="alert(1)">',
    absentFromHtml: ['onerror'],
    absentFromMarkdown: ['onerror'],
  },
  {
    id: 'onclick-attr',
    md: '<div onclick="alert(1)">x</div>',
    absentFromHtml: ['onclick'],
    absentFromMarkdown: ['onclick'],
  },
  {
    id: 'srcdoc',
    md: '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    absentFromHtml: ['srcdoc'],
    absentFromMarkdown: ['srcdoc'],
  },
  {
    id: 'style-js-url',
    md: '<div style="background:url(javascript:alert(1))">x</div>',
    absentFromHtml: ['javascript:'],
    absentFromMarkdown: ['javascript:'],
  },
  {
    id: 'style-js-url-css-comment',
    md: '<div style="background:url(/**/javascript:alert(1))">x</div>',
    absentFromHtml: ['javascript:'],
    absentFromMarkdown: ['javascript:'],
  },
  {
    id: 'style-js-url-css-escape',
    md: '<div style="background:url(\\6a avascript:alert(1))">x</div>',
    absentFromHtml: ['6a avascript'],
    absentFromMarkdown: ['6a avascript'],
  },
  {
    id: 'style-js-image-set',
    md: '<div style="background:image-set(&quot;javascript:alert(1)&quot; 1x)">x</div>',
    absentFromHtml: ['javascript:'],
    absentFromMarkdown: ['javascript:'],
  },
  {
    id: 'style-expression',
    md: '<div style="width:expression(alert(1))">x</div>',
    absentFromHtml: ['expression('],
    absentFromMarkdown: ['expression('],
  },
  {
    id: 'style-expression-comment-split',
    md: '<div style="width:expr/**/ession(alert(1))">x</div>',
    absentFromHtml: ['ession(alert'],
    absentFromMarkdown: ['ession(alert'],
  },
  {
    id: 'style-moz-binding',
    md: '<div style="-moz-binding:url(x.xml#xss)">x</div>',
    absentFromHtml: ['binding'],
    absentFromMarkdown: ['binding'],
  },
  {
    id: 'style-ie-behavior',
    md: '<div style="behavior:url(x.htc)">x</div>',
    absentFromHtml: ['behavior'],
    absentFromMarkdown: ['behavior'],
  },
  {
    id: 'image-javascript-tab',
    md: '![x](java\tscript:alert(1))',
    absentFromHtml: ['javascript:', 'script:alert'],
    absentFromMarkdown: ['javascript:', 'script:alert'],
  },
  {
    id: 'image-javascript-tab-entity-mixed-case',
    md: '![x](JaVa&#9;ScRiPt:alert(1))',
    absentFromHtml: ['javascript:', 'script:alert'],
    absentFromMarkdown: ['javascript:', 'script:alert'],
  },
  {
    id: 'image-javascript-percent-control',
    md: '![x](java%01script:alert(1))',
    absentFromHtml: ['javascript:', 'script:alert', '%01'],
    absentFromMarkdown: ['javascript:', 'script:alert', '%01'],
  },
  {
    id: 'image-raw-control-character-encoded-in-every-output',
    md: '![x](java\u0001script:alert(1))',
    absentFromHtml: ['\u0001', '\\u0001'],
    absentFromMarkdown: ['\u0001'],
  },
  {
    id: 'meta-refresh-javascript',
    md: '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
    absentFromHtml: ['javascript:'],
    absentFromMarkdown: ['javascript:'],
  },
  {
    id: 'meta-refresh-uppercase-spaced-quoted',
    md: `<meta http-equiv="refresh" content="0; URL = 'JavaScript:alert(1)'">`,
    absentFromHtml: ['javascript:'],
    absentFromMarkdown: ['javascript:'],
  },
  {
    id: 'meta-refresh-entity',
    md: '<meta http-equiv="refresh" content="0;url=&#106;avascript:alert(1)">',
    absentFromHtml: ['javascript:', '&#106;'],
    absentFromMarkdown: ['javascript:', '&#106;'],
  },
  {
    id: 'meta-refresh-percent',
    md: '<meta http-equiv="refresh" content="0;url=java%73cript:alert(1)">',
    absentFromHtml: ['java%73cript'],
    absentFromMarkdown: ['java%73cript'],
  },
  {
    id: 'meta-refresh-data',
    md: '<meta http-equiv="refresh" content="0; url=data:text/html,x">',
    absentFromHtml: ['data:text/html'],
    absentFromMarkdown: ['data:text/html'],
  },
  {
    id: 'meta-refresh-no-url-prefix',
    md: '<meta http-equiv="refresh" content="0;javascript:alert(1)">',
    absentFromHtml: ['javascript:'],
    absentFromMarkdown: ['javascript:'],
  },
  {
    id: 'svg-data-link',
    md: '[x](data:image/svg+xml;base64,PHN2Zz4=)',
    absentFromHtml: ['data:image/svg'],
    absentFromMarkdown: ['data:image/svg'],
    absentFromNativeProps: LINK_PROPS,
  },
  {
    id: 'svg-data-link-uppercase-spaced',
    md: '[x](<DATA:Image/SVG+XML ;base64,PHN2Zz4=>)',
    absentFromHtml: ['data:image/svg'],
    absentFromMarkdown: ['data:image/svg'],
    absentFromNativeProps: LINK_PROPS,
  },
  {
    id: 'svg-data-link-percent-plus',
    md: '[x](data:image/svg%2Bxml;base64,PHN2Zz4=)',
    absentFromHtml: ['data:image/svg'],
    absentFromMarkdown: ['data:image/svg'],
    absentFromNativeProps: LINK_PROPS,
  },
  {
    id: 'svg-data-autolink',
    md: '<data:image/svg+xml;base64,PHN2Zz4=>',
    absentFromHtml: ['href="data:image/svg', '"href":"data:image/svg'],
    absentFromMarkdown: ['](data:image/svg', '<data:image/svg'],
    absentFromNativeProps: LINK_PROPS,
  },
  {
    id: 'svg-data-raw-anchor',
    md: '<a href="data:image/svg+xml;base64,PHN2Zz4=">x</a>',
    absentFromHtml: ['data:image/svg'],
    absentFromMarkdown: ['data:image/svg'],
    absentFromNativeProps: LINK_PROPS,
  },
  {
    id: 'svg-data-object',
    md: '<object data="data:image/svg+xml;base64,PHN2Zz4="></object>',
    absentFromHtml: ['data:image/svg'],
    absentFromMarkdown: ['data:image/svg'],
  },
  {
    id: 'svg-data-embed-entity',
    md: '<embed src="data&colon;image/svg+xml;base64,PHN2Zz4=">',
    absentFromHtml: ['data:image/svg', 'data&colon;image'],
    absentFromMarkdown: ['data:image/svg', 'data&colon;image'],
  },
  {
    id: 'svg-data-meta-refresh',
    md: '<meta http-equiv="refresh" content="0; URL=\'data:image/svg+xml;base64,PHN2Zz4=\'">',
    absentFromHtml: ['data:image/svg'],
    absentFromMarkdown: ['data:image/svg'],
  },
]

const KEPT_VALUES = [
  [
    'an SVG data URL in a raw image tag, which a browser reads as img',
    '<image src="data:image/svg+xml;base64,PHN2Zz4=">',
    'data:image/svg+xml;base64,PHN2Zz4=',
  ],
  [
    'an SVG data URL in a markdown image',
    '![x](data:image/svg+xml;base64,PHN2Zz4=)',
    'data:image/svg+xml;base64,PHN2Zz4=',
  ],
  [
    'an SVG data URL in a raw img',
    '<img src="data:image/svg+xml;base64,PHN2Zz4=">',
    'data:image/svg+xml;base64,PHN2Zz4=',
  ],
  [
    'a scroll-behavior style',
    '<div style="scroll-behavior:smooth">x</div>',
    'smooth',
  ],
  [
    'an https background style',
    '<div style="background:url(https://example.com/a.png)">x</div>',
    'https://example.com/a.png',
  ],
  [
    'a PNG data URL background style',
    '<div style="background:url(&quot;data:image/png;base64,AA==&quot;)">x</div>',
    'data:image/png;base64,AA==',
  ],
] as const

function dumpJsx(value: unknown): string {
  return JSON.stringify(value)
}

function assertNoScriptElement(tree: unknown): void {
  expect(elementTypes(tree)).not.toContain('script')
}

describe('a safe value next to a blocked one', () => {
  for (const [shape, md, kept] of KEPT_VALUES) {
    it.each([
      ['html', () => htmlCompiler(md)],
      ['markdown', () => markdownCompiler(md)],
      ['react', () => dumpJsx(reactCompiler(md))],
      ['solid', () => dumpJsx(solidCompiler(md))],
      ['vue', () => dumpJsx(vueCompiler(md))],
      ['native', () => dumpJsx(nativeCompiler(md))],
    ] as const)(`stays in %s output for ${shape}`, (_name, run) => {
      expect(run()).toContain(kept)
    })
  }
})

describe('a brace handler on a tag `overrides` registers', () => {
  const md = '<Card onclick={alert(1)}>x</Card>'
  const element = { Card: { component: 'a' as const } }
  const registered = { Card: { props: {} } }
  const Echo = (props: { onclick?: unknown }) => String(props.onclick)
  const component = { Card: Echo }

  it.each([
    ['html', () => htmlCompiler(md, { overrides: element })],
    ['markdown', () => markdownCompiler(md, { overrides: element })],
    ['react', () => dumpJsx(reactCompiler(md, { overrides: element }))],
    ['solid', () => dumpJsx(solidCompiler(md, { overrides: element }))],
    ['vue', () => dumpJsx(vueCompiler(md, { overrides: element }))],
    ['native', () => dumpJsx(nativeCompiler(md, { overrides: element }))],
  ] as const)('leaves %s output no handler when the override renders an element', (_name, run) => {
    expect(run()).not.toContain('alert(1)')
  })

  it.each([
    ['html', () => htmlCompiler(md, { overrides: registered }), false],
    ['markdown', () => markdownCompiler(md, { overrides: registered }), false],
    ['vue', () => dumpJsx(vueCompiler(md, { overrides: component })), false],
    ['react', () => dumpJsx(reactCompiler(md, { overrides: component })), true],
    ['solid', () => dumpJsx(solidCompiler(md, { overrides: component })), true],
    [
      'native',
      () => dumpJsx(nativeCompiler(md, { overrides: component })),
      true,
    ],
  ] as const)('gives the handler to a registered component in %s output only where no element writes it', (_name, run, kept) => {
    expect(run().includes('alert(1)')).toBe(kept)
  })
})

describe('a colon inside an attribute name', () => {
  const inputs = [
    ['<a h:ref="javascript:alert(1)">x</a>', 'href', {}],
    ['<a :href="javascript:alert(1)">x</a>', 'href', {}],
    ['<iframe s:rcdoc="<b>x</b>"></iframe>', 'srcdoc', { tagfilter: false }],
    [
      '<Card dangerously:setInnerHTML={{"__html":"<img src=x>"}} />',
      'dangerouslysetinnerhtml',
      { overrides: { Card: { component: 'div' } } },
    ],
    ['<div dangerously:setInnerHTML="x" />', 'dangerouslysetinnerhtml', {}],
  ] as const

  for (const [md, target, options] of inputs) {
    it.each([
      ['react', () => reactCompiler(md, options)],
      ['solid', () => solidCompiler(md, options)],
      ['vue', () => vueCompiler(md, options)],
      ['native', () => nativeCompiler(md, options)],
    ] as const)(`never reaches %s output as ${target} from ${md}`, (_name, run) => {
      const names = treeProps(run()).map(([name]) => name)
      expect(names.filter(name => name.toLowerCase() === target)).toEqual([])
    })
  }

  it.each([
    ['html', htmlCompiler],
    ['markdown', markdownCompiler],
  ] as const)('stays written with its colon in %s output', (_name, compile) => {
    expect(inputs.map(([md, , options]) => compile(md, options))).toEqual([
      expect.stringContaining('h:ref="javascript:alert(1)"'),
      expect.stringContaining(':href="javascript:alert(1)"'),
      expect.stringContaining('s:rcdoc="<b>x</b>"'),
      expect.stringContaining('dangerously:setInnerHTML='),
      expect.stringContaining('dangerously:setInnerHTML="x"'),
    ])
  })
})

describe('a brace array on a component-like tag', () => {
  const md =
    '<svg><a><Anim attributeName={["href"]} to="javascript:alert(1)" begin="0s" /><text>x</text></a></svg>'
  const overrides = { Anim: { component: 'animate' as const } }

  it.each([
    ['html', () => htmlCompiler(md, { overrides })],
    ['markdown', () => markdownCompiler(md, { overrides })],
    ['react', () => dumpJsx(reactCompiler(md, { overrides }))],
    ['solid', () => dumpJsx(solidCompiler(md, { overrides }))],
    ['vue', () => dumpJsx(vueCompiler(md, { overrides }))],
    ['native', () => dumpJsx(nativeCompiler(md, { overrides }))],
  ] as const)('leaves %s output no attributeName that names href', (_name, run) => {
    expect(run().toLowerCase().indexOf('attributename')).toBe(-1)
  })
})

describe('security sink parity', () => {
  for (const c of CASES) {
    it(`html: ${c.id}`, () => {
      const out = htmlCompiler(c.md)
      for (const needle of c.absentFromHtml) {
        expect(out.toLowerCase()).not.toContain(needle.toLowerCase())
      }
    })

    it(`markdown: ${c.id}`, () => {
      const out = markdownCompiler(c.md)
      for (const needle of c.absentFromMarkdown) {
        expect(out.toLowerCase()).not.toContain(needle.toLowerCase())
      }
    })

    it(`react: ${c.id}`, () => {
      const out = dumpJsx(reactCompiler(c.md))
      for (const needle of c.absentFromHtml) {
        expect(out.toLowerCase()).not.toContain(needle.toLowerCase())
      }
    })

    it(`solid: ${c.id}`, () => {
      const out = dumpJsx(solidCompiler(c.md))
      for (const needle of c.absentFromHtml) {
        expect(out.toLowerCase()).not.toContain(needle.toLowerCase())
      }
    })

    it(`vue: ${c.id}`, () => {
      const out = dumpJsx(vueCompiler(c.md))
      for (const needle of c.absentFromHtml) {
        expect(out.toLowerCase()).not.toContain(needle.toLowerCase())
      }
    })

    it(`native: ${c.id}`, () => {
      const tree = nativeCompiler(c.md)
      const out = dumpJsx(tree)
      for (const needle of c.absentFromHtml) {
        expect(out.toLowerCase()).not.toContain(needle.toLowerCase())
      }

      const propNames = treeProps(tree).map(([name]) => name)
      for (const prop of c.absentFromNativeProps ?? []) {
        expect(propNames).not.toContain(prop)
      }
    })
  }

  it('finds a script element in React, Solid, and Vue tree shapes', () => {
    expect(
      elementTypes({
        type: 'div',
        props: { children: [{ type: 'script', props: { children: 'x' } }] },
      })
    ).toEqual(['div', 'script'])
    expect(
      elementTypes({
        t: 'div',
        p: { children: [{ t: 'script', p: { children: 'x' } }] },
      })
    ).toEqual(['div', 'script'])
    expect(
      elementTypes({
        type: 'div',
        props: {},
        children: [{ type: 'script', props: {}, children: 'x' }],
      })
    ).toEqual(['div', 'script'])
    expect(
      elementTypes({
        type: 'div',
        props: {},
        children: {
          default: () => [{ type: 'script', props: {}, children: 'x' }],
        },
      })
    ).toEqual(['div', 'script'])
  })

  it('tagfilter escapes script for html and JSX compilers (markdown is fidelity)', () => {
    const md = '<script>alert(1)</script>'
    expect(htmlCompiler(md)).toContain('&lt;script')
    expect(htmlCompiler(md)).not.toMatch(/<script>/i)

    assertNoScriptElement(reactCompiler(md))
    assertNoScriptElement(solidCompiler(md))
    assertNoScriptElement(vueCompiler(md))
    assertNoScriptElement(nativeCompiler(md))

    expect(markdownCompiler(md)).toContain('<script>')
  })
})
