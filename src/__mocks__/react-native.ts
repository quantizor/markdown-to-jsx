// This file sets up the react-native mock using Bun's mock.module
import { mock } from 'bun:test'
import * as React from 'react'

const mockLinkingOpenURL = mock(() => Promise.resolve())

// Set up the mock module
mock.module('react-native', () => {
  const Text = React.forwardRef((props: any, ref: any) => {
    return React.createElement('Text', { ...props, ref })
  }) as any

  const View = React.forwardRef((props: any, ref: any) => {
    return React.createElement('View', { ...props, ref })
  }) as any

  const Image = React.forwardRef((props: any, ref: any) => {
    return React.createElement('Image', { ...props, ref })
  }) as any

  return {
    Text,
    View,
    Image,
    Linking: {
      openURL: mockLinkingOpenURL,
      canOpenURL: async () => Promise.resolve(true),
    },
    StyleSheet: {
      create: (styles: any) => styles,
    },
  }
})

export {}
