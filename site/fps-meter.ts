/**
 * On-screen frame-rate readout, used to check the lava lamp on a real device
 * where no profiler is available.
 *
 * Loaded only when the page is opened with `?fps`, so the default visit never
 * downloads or runs any of this.
 */

/** A running frame-time sample with a visible readout. */
export interface FpsMeter {
  /** Remove the overlay and drop its samples. */
  destroy: () => void
  /**
   * Record one rendered frame. `time` is the animation-frame timestamp, and
   * the dimensions are the canvas backing store, reported so a device showing
   * an unexpected number also shows what it was rendering.
   */
  sample: (time: number, width: number, height: number, dpr: number) => void
}

/** How often the readout refreshes, in milliseconds. */
const REPORT_INTERVAL = 500

export function createFpsMeter(): FpsMeter {
  const element = document.createElement('div')
  // Announced to nobody: the text changes twice a second, which is noise in a
  // screen reader and useful only on screen.
  element.setAttribute('aria-hidden', 'true')
  element.style.cssText =
    'position:fixed;top:0;left:0;z-index:2147483647;' +
    'margin:calc(env(safe-area-inset-top, 0px) + 8px) 8px;' +
    'padding:6px 8px;border-radius:6px;background:rgba(0,0,0,0.72);' +
    'color:#fff;font:600 12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;' +
    'white-space:pre;pointer-events:none'
  document.body.append(element)

  const gaps: number[] = []
  let previous = 0
  let reported = 0

  return {
    destroy() {
      element.remove()
      gaps.length = 0
    },
    sample(time, width, height, dpr) {
      if (previous > 0) {
        gaps.push(time - previous)
      }
      previous = time
      if (time - reported <= REPORT_INTERVAL || gaps.length < 2) {
        return
      }
      reported = time
      const sorted = gaps.slice().sort((a, b) => a - b)
      const median = sorted[(sorted.length / 2) | 0]
      const worst = sorted.at(-1) ?? median
      element.textContent =
        `${(1000 / median).toFixed(0)} fps  ${median.toFixed(1)} ms\n` +
        `worst ${worst.toFixed(1)} ms\n` +
        `${width}x${height} @${dpr}x`
      gaps.length = 0
    },
  }
}
