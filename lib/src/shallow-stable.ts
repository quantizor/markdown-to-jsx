import * as React from 'react'

export function useShallowStable<T extends Record<string, any>>(value: T): T {
  const ref = React.useRef(value)
  const prev = ref.current
  if (prev !== value) {
    var same = true
    var count = 0
    for (var key in value) {
      count++
      if (!Object.is(prev[key], value[key])) {
        same = false
        break
      }
    }
    if (same) {
      var prevCount = 0
      for (var _prevKey in prev) {
        prevCount++
      }
      same = prevCount === count
    }
    if (!same) {
      ref.current = value
    }
  }
  return ref.current
}
