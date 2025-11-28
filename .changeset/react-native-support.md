---
'markdown-to-jsx': minor
---

Add comprehensive React Native support with new `/native` export. Includes:

- **React Native Component Mapping**: Enhanced HTML tag to React Native component mapping with semantic support for `img` → `Image`, block elements (`div`, `section`, `article`, `blockquote`, `ul`, `ol`, `li`, `table`, etc.) → `View`, and inline elements → `Text`
- **Link Handling**: Native link support with `onLinkPress` and `onLinkLongPress` callbacks, defaulting to `Linking.openURL`
- **Styling System**: Complete `NativeStyleKey` type system with styles for all markdown elements and HTML semantic tags
- **Component Overrides**: Full support for overriding default components with custom React Native components and props
- **Accessibility**: Built-in accessibility support with `accessibilityLabel` for images and proper link handling
- **Type Safety**: Comprehensive TypeScript definitions with `NativeOptions` and `NativeStyleKey` types
- **Performance**: Optimized rendering with proper React Native best practices and component lifecycle

React Native is an optional peer dependency, making this a zero-dependency addition for existing users.

