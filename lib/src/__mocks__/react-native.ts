import { mock } from 'bun:test'
import * as React from 'react'

const mockLinkingOpenUrl = mock(() => Promise.resolve())

function mockHostComponent(tag: string) {
  return React.forwardRef<unknown, Record<string, unknown>>(
    function render(props, ref) {
      return React.createElement(tag, { ...props, ref })
    }
  )
}

mock.module('react-native', () => {
  const Text = mockHostComponent('Text')
  const View = mockHostComponent('View')
  const Image = mockHostComponent('Image')
  const Pressable = mockHostComponent('Pressable')

  return {
    Text,
    View,
    Image,
    Pressable,
    Linking: {
      openURL: mockLinkingOpenUrl,
      canOpenURL: async () => Promise.resolve(true),
    },
    Platform: {
      OS: 'ios',
      select: <T>(options: {
        android?: T
        default?: T
        ios?: T
      }): T | undefined => options.ios ?? options.default,
    },
    StyleSheet: {
      create: <T>(styles: T) => styles,
    },
  }
})
