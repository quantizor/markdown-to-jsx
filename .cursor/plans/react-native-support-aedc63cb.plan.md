<!-- aedc63cb-6512-4f2e-abf2-e9c775c23062 0e9ff09f-5ef6-43e8-8028-b6275595ac18 -->
# React Native Support Implementation

## Architecture Overview

Create a new renderer (`src/native.tsx`) that follows the same pattern as [`src/react.tsx`](src/react.tsx) and [`src/html.ts`](src/html.ts), mapping the existing AST node types to React Native components (`Text`, `View`, `Image`).

## Component Mapping Strategy

| Markdown Element | React Native Component | Notes |

|------------------|------------------------|-------|

| text | Raw string | Must be inside `<Text>` |

| paragraph | `<Text>` | Block wrapper |

| heading (h1-h6) | `<Text>` | User provides level-specific styles |

| link | `<Text onPress={...}>` | Default underline style, uses `Linking.openURL` or custom handler |

| image | `<Image source={{ uri }}` | With `alt` as `accessibilityLabel` |

| codeBlock | `<View><Text>{code}</Text></View>` | Pre-formatted text |

| codeInline | `<Text>` | Inline monospace |

| blockquote | `<View>` | Container with children |

| orderedList/unorderedList | `<View>` | Container for items |

| listItem | `<View>` with bullet/number | Row layout |

| thematicBreak (hr) | `<View>` | Styled divider line |

| breakLine (br) | `'\n'` | Newline in text |

| table | Nested `<View>` | Flexbox-based table layout |

| gfmTask | Custom checkbox view | `[x]` / `[ ]` indicator |

| textFormatted | `<Text>` | em/strong/del via style |

## Key Files

### New Files

- [`src/native.tsx`](src/native.tsx) - Main React Native compiler and Markdown component
- [`src/native.spec.tsx`](src/native.spec.tsx) - Unit tests (written first per TDD)

### Modified Files

- [`package.json`](package.json) - Add `react-native` as optional peer dependency + `/native` export
- [`bunup.config.ts`](bunup.config.ts) - Add `src/native.tsx` to entry array, external `react-native`
- [`README.md`](README.md) - Document React Native usage

## Exports (matching src/react.tsx pattern)

```typescript
// Re-exports from shared modules
export { parser } from './parse'
export { RuleType, type MarkdownToJSX } from './types'
export { sanitizer, slugify } from './utils'

// Native-specific exports
export type { NativeOptions, NativeStyleKeys }
export { astToNative }
export { compiler }
export { Markdown }
export default Markdown
```

## Package Configuration

### bunup.config.ts

```typescript
entry: ['src/index.tsx', 'src/react.tsx', 'src/html.ts', 'src/markdown.ts', 'src/native.tsx'],
external: ['react', 'react-native'],
```

### package.json

```json
{
  "exports": {
    "./native": {
      "import": { "types": "./dist/native.d.ts", "default": "./dist/native.js" },
      "require": { "types": "./dist/native.d.cts", "default": "./dist/native.cjs" }
    }
  },
  "peerDependencies": {
    "react-native": ">= 0.60.0"
  },
  "peerDependenciesMeta": {
    "react-native": { "optional": true }
  }
}
```

## Options Compatibility

| Option | React Native Handling |

|--------|----------------------|

| `createElement` | Works as-is (React.createElement) |

| `disableAutoLink` | Works as-is (parsing option) |

| `disableParsingRawHTML` | Works as-is (parsing option) |

| `tagfilter` | Works as-is (parsing option) |

| `enforceAtxHeadings` | Works as-is (parsing option) |

| `forceBlock` | Works as-is |

| `forceInline` | Works as-is |

| `forceWrapper` | Works - wrapper is `View` or `Text` |

| `overrides` | Adapted - keys are element names (`p`, `h1`, `a`, etc.) mapping to RN components |

| `renderRule` | Works as-is - full control over node rendering |

| `sanitizer` | Works as-is |

| `slugify` | Works as-is |

| `wrapper` | Default `View` (block) or `Text` (inline) instead of `div`/`span` |

| `wrapperProps` | Uses `ViewProps` or `TextProps` instead of HTML attributes |

| `preserveFrontmatter` | Works as-is |

### Native-Specific Options

```typescript
export type NativeOptions = Omit<
  MarkdownToJSX.Options,
  'wrapperProps'
> & {
  // Called when link is pressed (overrides default Linking.openURL)
  onLinkPress?: (url: string, title?: string) => void
  // Called when link is long-pressed
  onLinkLongPress?: (url: string, title?: string) => void
  // Style overrides per element type
  styles?: Partial<Record<NativeStyleKey, StyleProp<ViewStyle | TextStyle | ImageStyle>>>
  // RN-specific wrapper props
  wrapperProps?: ViewProps | TextProps
}

export type NativeStyleKey =
  | 'text' | 'paragraph' | 'heading1' | 'heading2' | 'heading3'
  | 'heading4' | 'heading5' | 'heading6' | 'link' | 'image'
  | 'codeBlock' | 'codeInline' | 'blockquote' | 'listOrdered'
  | 'listUnordered' | 'listItem' | 'listItemBullet' | 'listItemNumber'
  | 'thematicBreak' | 'table' | 'tableHeader' | 'tableHeaderCell'
  | 'tableRow' | 'tableCell' | 'em' | 'strong' | 'del' | 'gfmTask'
```

### Override System

The `overrides` prop uses the same HTML-like keys for consistency:

```tsx
<Markdown
  overrides={{
    // Map 'a' (link) to custom component
    a: { component: CustomLink, props: { style: styles.link } },
    // Map 'img' to cached image component  
    img: FastImage,
    // Map 'code' to syntax highlighter
    code: { component: SyntaxHighlighter },
  }}
>
  {markdown}
</Markdown>
```

## TDD Approach

Write tests first in `src/native.spec.tsx`:

1. **Export tests** - Verify all expected exports exist
2. **AST node rendering tests** - Each RuleType maps to correct RN component
3. **Link handling tests** - Default Linking behavior + onLinkPress override
4. **Style override tests** - Custom styles applied correctly
5. **Component override tests** - Custom components via overrides
6. **Integration tests** - Full markdown documents render correctly

### To-dos

- [ ] Define ReactNativeOptions type and style keys in react-native.tsx
- [ ] Implement render() function mapping AST nodes to RN components
- [ ] Implement compiler() and Markdown component with link handling
- [ ] Update bunup.config.ts and package.json for new entry point
- [ ] Create react-native.spec.tsx with unit tests
- [ ] Update README.md with React Native usage documentation