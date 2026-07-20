// This file sets up the react-native mock using Bun's mock.module
import { mock } from 'bun:test'
import * as React from 'react'

const mockLinkingOpenURL = mock(() => Promise.resolve())

/**
 * Build a forwardRef host component that renders to a plain string tag, so
 * tests can assert on the tag name while matching react-native's forwardRef
 * component shape.
 */
function mockHostComponent(tag: string) {
  return React.forwardRef<unknown, Record<string, unknown>>(
    function render(props, ref) {
      return React.createElement(tag, { ...props, ref })
    }
  )
}

// Set up the mock module
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
      openURL: mockLinkingOpenURL,
      canOpenURL: async () => Promise.resolve(true),
    },
    Platform: {
      OS: 'ios',
      select: <T,>(options: { android?: T; default?: T; ios?: T }): T | undefined =>
        options.ios ?? options.default,
    },
    StyleSheet: {
      create: <T,>(styles: T) => styles,
    },
  }
})

export {}
