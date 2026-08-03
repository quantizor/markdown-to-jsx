import { useCallback, useEffect, useRef } from 'react'
import type { FpsMeter } from './fps-meter'
import { generateShaderCode } from './lava-lamp-shader'

function hexToRgb(hex: string): [number, number, number] {
  const bigint = Number.parseInt(hex.slice(1), 16)
  return [
    ((bigint >> 16) & 255) / 255,
    ((bigint >> 8) & 255) / 255,
    (bigint & 255) / 255,
  ]
}

function cn(..._args: (string | undefined)[]): string {
  var out = ''
  var i = 0
  for (; i < arguments.length; ++i) {
    var x = arguments[i]
    if (x) {
      out && (out += ' '), (out += x)
    }
  }
  return out
}

function loadParticleData(numParticles: number): Float32Array | null {
  try {
    const saved = localStorage.getItem('lava-lamp-particles')
    if (!saved) {
      return null
    }

    const parsed = JSON.parse(saved)
    const now = Date.now()
    const oneDay = 86_400_000
    let dataArray: number[] | null = null
    let timestamp: number | null = null

    if (
      parsed &&
      typeof parsed === 'object' &&
      'timestamp' in parsed &&
      'data' in parsed
    ) {
      timestamp = parsed.timestamp
      dataArray = parsed.data
    } else if (Array.isArray(parsed)) {
      dataArray = parsed
    }

    if (timestamp !== null && now - timestamp > oneDay) {
      localStorage.removeItem('lava-lamp-particles')
      return null
    }

    const expectedLength = numParticles * 12
    if (
      !(dataArray && Array.isArray(dataArray)) ||
      dataArray.length !== expectedLength
    ) {
      return null
    }

    const testData = new Float32Array(dataArray)
    let valid = true
    let hasVariation = false
    const firstX = testData[0]
    const firstY = testData[1]
    const firstZ = testData[2]

    for (let i = 0; i < numParticles && valid; i++) {
      const o = i * 12
      const x = testData[o]
      const y = testData[o + 1]
      const z = testData[o + 2]
      const r = testData[o + 3]
      const vx = testData[o + 4]
      const vy = testData[o + 5]
      const vz = testData[o + 6]
      const temp = testData[o + 8]

      if (
        Math.abs(x) > 4 ||
        Math.abs(y) > 5 ||
        Math.abs(z) > 4 ||
        r < 0.05 ||
        r > 1.0 ||
        Math.abs(vx) > 2 ||
        Math.abs(vy) > 2 ||
        Math.abs(vz) > 2 ||
        temp < -0.1 ||
        temp > 1.1 ||
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(z) ||
        !Number.isFinite(r) ||
        !Number.isFinite(vx) ||
        !Number.isFinite(vy) ||
        !Number.isFinite(vz) ||
        !Number.isFinite(temp)
      ) {
        valid = false
        break
      }

      if (i > 0 && !hasVariation) {
        hasVariation =
          Math.abs(x - firstX) > 0.1 ||
          Math.abs(y - firstY) > 0.1 ||
          Math.abs(z - firstZ) > 0.1
      }
    }

    if (valid && hasVariation) {
      return testData
    }

    localStorage.removeItem('lava-lamp-particles')
    return null
  } catch {
    return null
  }
}

function generateParticleData(numParticles: number): Float32Array {
  const particleData = new Float32Array(numParticles * 12)
  for (let i = 0; i < numParticles; i++) {
    const o = i * 12
    particleData[o] = (Math.random() - 0.5) * 3.0
    particleData[o + 1] = -2.0 + Math.random() * 4.0
    particleData[o + 2] = (Math.random() - 0.5) * 3.0
    particleData[o + 3] = 0.35 + Math.random() * 0.23
    particleData[o + 4] = 0.0
    particleData[o + 5] = 0.0
    particleData[o + 6] = 0.0
    particleData[o + 7] = 0.0
    particleData[o + 8] = (particleData[o + 1] + 2.0) / 4.0
    particleData[o + 9] = 0.0
    particleData[o + 10] = 0.0
    particleData[o + 11] = 0.0
  }
  return particleData
}

function saveParticleData(data: number[]): void {
  try {
    localStorage.setItem(
      'lava-lamp-particles',
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    )
  } catch (e) {
    console.error('Error saving particles:', e)
  }
}

export function LavaLamp({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>(null)
  const mouseRef = useRef({ x: 0, y: 0, down: false })
  const camAnglesRef = useRef({ theta: 0, phi: 0.2 })
  const camRadiusRef = useRef(4.5)

  const updateCamera = useCallback((dx: number, dy: number) => {
    camAnglesRef.current.theta -= dx * 0.01
    camAnglesRef.current.phi = Math.max(
      -0.5,
      Math.min(1.0, camAnglesRef.current.phi + dy * 0.01)
    )
  }, [])

  const handleMouseDown = useCallback((e: MouseEvent) => {
    mouseRef.current.down = true
    mouseRef.current.x = e.clientX
    mouseRef.current.y = e.clientY
    const canvas = canvasRef.current
    if (canvas) {
      canvas.style.cursor = 'grabbing'
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    mouseRef.current.down = false
    const canvas = canvasRef.current
    if (canvas) {
      canvas.style.cursor = 'grab'
    }
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!mouseRef.current.down) {
        return
      }
      updateCamera(
        e.clientX - mouseRef.current.x,
        e.clientY - mouseRef.current.y
      )
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
    },
    [updateCamera]
  )

  const handleTouchStart = useCallback((e: TouchEvent) => {
    mouseRef.current.down = true
    mouseRef.current.x = e.touches[0].clientX
    mouseRef.current.y = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback(() => {
    mouseRef.current.down = false
  }, [])

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!mouseRef.current.down) {
        return
      }
      e.preventDefault()
      const t = e.touches[0]
      updateCamera(
        t.clientX - mouseRef.current.x,
        t.clientY - mouseRef.current.y
      )
      mouseRef.current.x = t.clientX
      mouseRef.current.y = t.clientY
    },
    [updateCamera]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    if (!navigator.gpu) {
      console.warn('WebGPU not supported, lava lamp disabled')
      return
    }

    let device: GPUDevice | null = null
    let context: GPUCanvasContext | null = null
    let uniformBuffer: GPUBuffer | null = null
    let particleBuffer: GPUBuffer | null = null
    let bindGroup: GPUBindGroup | null = null
    let computePipeline: GPUComputePipeline | null = null
    let renderPipeline: GPURenderPipeline | null = null
    let stagingBuffer: GPUBuffer | null = null
    let fpsMeter: FpsMeter | null = null
    let isDestroyed = false
    let sizeObserver: ResizeObserver | null = null
    // Every listener below is registered with this signal, so teardown is one
    // abort() rather than a removeEventListener per listener, each guarded by
    // whether that listener was reached before the async setup finished.
    const listeners = new AbortController()
    const numParticles = 16
    const uniformBufferSize = 160

    const init = async () => {
      try {
        const adapter = await navigator.gpu.requestAdapter()
        if (!adapter) {
          console.warn('WebGPU adapter not available')
          return
        }

        device = await adapter.requestDevice()
        device.addEventListener('uncapturederror', event => {
          console.error('WebGPU uncaptured error:', event.error)
        })
        context = canvas.getContext('webgpu')
        if (!context) {
          console.warn('WebGPU context not available')
          return
        }

        const format = navigator.gpu.getPreferredCanvasFormat()
        context.configure({ device, format, alphaMode: 'premultiplied' })

        uniformBuffer = device.createBuffer({
          size: uniformBufferSize,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })

        const particleBufferSize = numParticles * 48
        particleBuffer = device.createBuffer({
          size: particleBufferSize,
          usage:
            GPUBufferUsage.STORAGE |
            GPUBufferUsage.COPY_DST |
            GPUBufferUsage.COPY_SRC,
        })

        const particleData =
          loadParticleData(numParticles) || generateParticleData(numParticles)

        device.queue.writeBuffer(
          particleBuffer,
          0,
          particleData as GPUAllowSharedBufferSource
        )

        const shaderCode = generateShaderCode(numParticles)
        const shaderModule = device.createShaderModule({ code: shaderCode })

        const bindGroupLayout = device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
              buffer: { type: 'uniform' },
            },
            {
              binding: 1,
              visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
              buffer: { type: 'storage' },
            },
          ],
        })

        bindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: { buffer: particleBuffer } },
          ],
        })

        const pipelineLayout = device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout],
        })

        computePipeline = device.createComputePipeline({
          layout: pipelineLayout,
          compute: { module: shaderModule, entryPoint: 'simulate' },
        })

        renderPipeline = device.createRenderPipeline({
          layout: pipelineLayout,
          vertex: { module: shaderModule, entryPoint: 'vs_main' },
          fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [{ format }],
          },
          primitive: { topology: 'triangle-list' },
        })

        const uValues = new Float32Array(uniformBufferSize / 4)
        const cBase = hexToRgb('#ff5a00')
        const cGlow = hexToRgb('#000000')
        uValues[8] = cBase[0]
        uValues[9] = cBase[1]
        uValues[10] = cBase[2]
        uValues[12] = cGlow[0]
        uValues[13] = cGlow[1]
        uValues[14] = cGlow[2]
        uValues[3] = 0.99
        uValues[4] = 0.65
        uValues[5] = 8.5

        let lastFrameTime = 0
        const frameInterval = 1000 / 60
        let lastSaveTime = 0
        stagingBuffer = device.createBuffer({
          size: particleBufferSize,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        })
        let isSaving = false
        const saveArrayLength = numParticles * 12
        // Persisting is only a reload convenience; snapshot once per second
        // instead of every 100ms. The old rate kept a GPU->CPU readback in
        // flight nearly full-time, stalling the pipeline.
        const saveInterval = 1000

        // Render at devicePixelRatio capped at 2 for edge sharpness. The cap
        // is the only resolution concession: the scene holds 60fps at full dpr,
        // scrolling included, so nothing drops resolution to keep up.
        const renderScale = () => Math.min(window.devicePixelRatio || 1, 2)

        // Sized from the canvas's own box, which CSS sizes in svw/svh, rather
        // than from visualViewport. The two disagree on iOS while the URL bar
        // collapses: sizing to the viewport stretches the image, because the
        // element's box is following the stable svh instead.
        const resizeCanvas = (cssWidth: number, cssHeight: number) => {
          if (isDestroyed) {
            return
          }
          const dpr = renderScale()
          const width = Math.round(cssWidth * dpr)
          const height = Math.round(cssHeight * dpr)
          if (
            width > 0 &&
            height > 0 &&
            (canvas.width !== width || canvas.height !== height)
          ) {
            canvas.width = width
            canvas.height = height
          }
        }

        // ResizeObserver reports the canvas's own box changing for any reason,
        // which is the actual event of interest. Watching window resize,
        // orientationchange, and visualViewport resize instead would be three
        // proxies for it: none of them fires when the element's box changes on
        // its own, all three can fire for one change, and answering them means
        // reading the box back with getBoundingClientRect, a forced layout
        // flush. The callback delivers the size directly, after layout and
        // before paint, so nothing here reads layout at all.
        sizeObserver = new ResizeObserver(entries => {
          const box = entries.at(-1)?.contentRect
          if (box) {
            resizeCanvas(box.width, box.height)
          }
        })
        sizeObserver.observe(canvas)

        // The observer fires once on observe(), but that is a frame away and
        // the first render happens sooner.
        const startRect = canvas.getBoundingClientRect()
        resizeCanvas(startRect.width, startRect.height)

        // Frame-rate readout for checking a real device: append ?fps to the
        // URL. Imported only when asked for, so a normal visit downloads none
        // of it.
        if (new URLSearchParams(window.location.search).has('fps')) {
          const { createFpsMeter } = await import('./fps-meter')
          if (!isDestroyed) {
            fpsMeter = createFpsMeter()
          }
        }

        const frame = (time: number) => {
          if (isDestroyed || !device || !context) {
            return
          }

          // requestAnimationFrame stops in background tabs on most browsers,
          // but not all (and not when throttled rather than stopped). Skip
          // the GPU work explicitly so a hidden tab costs nothing.
          if (document.visibilityState === 'hidden') {
            animationFrameRef.current = requestAnimationFrame(frame)
            return
          }

          // Cap the animation at 60fps on displays that run faster. The gate
          // allows a tenth of a frame of slack: on a 60Hz display the browser
          // routinely delivers a callback a hair under 16.67ms, and an exact
          // comparison rejects it, drops that frame, and halves the animation
          // to 30fps on exactly the displays with the least headroom.
          const elapsed = time - lastFrameTime
          if (elapsed < frameInterval * 0.9) {
            animationFrameRef.current = requestAnimationFrame(frame)
            return
          }
          // Carry the overshoot forward so the cadence stays on a 60fps grid
          // rather than drifting later every frame. The remainder only makes
          // sense once a full interval has passed: for a frame let through by
          // the slack above, `elapsed % frameInterval` is the whole elapsed
          // time, which would put the marker back where it already was and
          // let every subsequent callback through, running the animation at
          // the display's full rate instead of 60.
          lastFrameTime =
            elapsed >= frameInterval ? time - (elapsed % frameInterval) : time

          // The backing store as the observer last sized it. Reading it back
          // costs nothing, where measuring the element here would flush layout
          // every frame.
          const renderWidth = canvas.width
          const renderHeight = canvas.height
          const dpr = renderScale()

          fpsMeter?.sample(time, renderWidth, renderHeight, dpr)

          camAnglesRef.current.theta += 0.0003
          const r = camRadiusRef.current
          const phi = camAnglesRef.current.phi
          const theta = camAnglesRef.current.theta
          const cosPhi = Math.cos(phi)
          const sinPhi = Math.sin(phi)
          const cosTheta = Math.cos(theta)
          const sinTheta = Math.sin(theta)

          uValues[0] = renderWidth
          uValues[1] = renderHeight
          uValues[2] = time * 0.0005
          uValues[16] = r * cosPhi * sinTheta
          uValues[17] = r * sinPhi
          uValues[18] = r * cosPhi * cosTheta

          if (
            !(uniformBuffer && computePipeline && renderPipeline && bindGroup)
          ) {
            if (!isDestroyed) {
              animationFrameRef.current = requestAnimationFrame(frame)
            }
            return
          }

          try {
            device.queue.writeBuffer(uniformBuffer, 0, uValues)

            const commandEncoder = device.createCommandEncoder()

            const passEncoder = commandEncoder.beginComputePass()
            passEncoder.setPipeline(computePipeline)
            passEncoder.setBindGroup(0, bindGroup)
            passEncoder.dispatchWorkgroups(Math.ceil(numParticles / 64))
            passEncoder.end()

            const renderPass = commandEncoder.beginRenderPass({
              colorAttachments: [
                {
                  view: context.getCurrentTexture().createView(),
                  clearValue: { r: 0, g: 0, b: 0, a: 1 },
                  loadOp: 'clear',
                  storeOp: 'store',
                },
              ],
            })
            renderPass.setPipeline(renderPipeline)
            renderPass.setBindGroup(0, bindGroup)
            renderPass.draw(6)
            renderPass.end()

            // Encoders, passes, the command buffer, and the texture view are
            // all lightweight JS-side objects holding no GPU memory of their
            // own; only buffers and textures do, and none are allocated here.
            // The canvas texture comes from getCurrentTexture() and is owned
            // by the context, so there is nothing to destroy per frame.
            device.queue.submit([commandEncoder.finish()])
          } catch (err) {
            console.warn('Lava lamp render error:', err)
          }

          const now = Date.now()
          if (now - lastSaveTime > saveInterval && stagingBuffer && !isSaving) {
            lastSaveTime = now
            isSaving = true
            device.queue
              .onSubmittedWorkDone()
              .then(() => {
                if (
                  isDestroyed ||
                  !device ||
                  !stagingBuffer ||
                  !particleBuffer
                ) {
                  isSaving = false
                  return
                }
                const copyEncoder = device.createCommandEncoder()
                copyEncoder.copyBufferToBuffer(
                  particleBuffer,
                  0,
                  stagingBuffer,
                  0,
                  particleBufferSize
                )
                device.queue.submit([copyEncoder.finish()])
                return device.queue.onSubmittedWorkDone().then(() => {
                  if (isDestroyed || !stagingBuffer) {
                    isSaving = false
                    return
                  }
                  return stagingBuffer
                    .mapAsync(GPUMapMode.READ)
                    .then(() => {
                      if (isDestroyed || !stagingBuffer) {
                        isSaving = false
                        return
                      }
                      const data = new Float32Array(
                        stagingBuffer.getMappedRange()
                      )
                      if (
                        data.length === saveArrayLength &&
                        data.some(v => v !== 0)
                      ) {
                        const saveData = new Array<number>(saveArrayLength)
                        for (let i = 0; i < saveArrayLength; i++) {
                          saveData[i] = data[i]
                        }
                        stagingBuffer.unmap()
                        isSaving = false
                        const saveToStorage = () => {
                          if (isDestroyed) {
                            return
                          }
                          saveParticleData(saveData)
                        }
                        if (typeof requestIdleCallback === 'undefined') {
                          setTimeout(saveToStorage, 0)
                        } else {
                          requestIdleCallback(saveToStorage, { timeout: 5000 })
                        }
                      } else {
                        stagingBuffer.unmap()
                        isSaving = false
                      }
                    })
                    .catch(err => {
                      console.warn('Lava lamp save mapAsync failed:', err)
                      isSaving = false
                    })
                })
              })
              .catch(err => {
                console.warn('Lava lamp save failed:', err)
                isSaving = false
              })
          }

          if (!isDestroyed) {
            animationFrameRef.current = requestAnimationFrame(frame)
          }
        }

        animationFrameRef.current = requestAnimationFrame(frame)
      } catch (error) {
        console.error('Error initializing WebGPU lava lamp:', error)
      }
    }

    init()
    canvas.style.cursor = 'grab'
    canvas.removeAttribute('width')
    canvas.removeAttribute('height')

    const signal = listeners.signal
    canvas.addEventListener('mousedown', handleMouseDown, { signal })
    window.addEventListener('mouseup', handleMouseUp, { signal })
    window.addEventListener('mousemove', handleMouseMove, { signal })
    canvas.addEventListener('touchstart', handleTouchStart, {
      passive: false,
      signal,
    })
    window.addEventListener('touchend', handleTouchEnd, { signal })
    window.addEventListener('touchmove', handleTouchMove, {
      passive: false,
      signal,
    })

    return () => {
      isDestroyed = true
      listeners.abort()
      if (sizeObserver) {
        sizeObserver.disconnect()
        sizeObserver = null
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      if (fpsMeter) {
        fpsMeter.destroy()
        fpsMeter = null
      }
      if (stagingBuffer) {
        stagingBuffer.destroy()
        stagingBuffer = null
      }
      if (particleBuffer) {
        particleBuffer.destroy()
        particleBuffer = null
      }
      if (uniformBuffer) {
        uniformBuffer.destroy()
        uniformBuffer = null
      }
      if (device) {
        device.destroy()
        device = null
      }
      if (context) {
        context.unconfigure()
        context = null
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={cn('fixed inset-0 -z-10', className)}
      style={{
        pointerEvents: 'auto',
        display: 'block',
        width: '100svw',
        height: '100svh',
        imageRendering: 'auto',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
    />
  )
}

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    localStorage.removeItem('lava-lamp-particles')
  })
}
