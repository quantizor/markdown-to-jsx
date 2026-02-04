declare module 'react-native' {
  import type * as React from 'react'

  export const Text: React.ForwardRefExoticComponent<any>
  export const View: React.ForwardRefExoticComponent<any>
  export const Image: React.ForwardRefExoticComponent<any>

  export namespace Linking {
    function openURL(url: string): Promise<void>
    function canOpenURL(url: string): Promise<boolean>
  }

  export namespace StyleSheet {
    function create<T>(styles: T): T
  }
}
