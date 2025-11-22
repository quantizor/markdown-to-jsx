import React, { useRef, useEffect, useCallback } from 'react'

function generateMapFunction(numParticles: number): string {
  var parts: string[] = [
    'fn map(pos: vec3f) -> f32 {\n    let k = u.elasticity;\n    let p0 = particles[0u];\n    let delta0 = pos - p0.position.xyz;\n    var d = length(delta0) - p0.position.w;\n',
  ]
  for (var i = 1; i < numParticles; i++) {
    parts.push(
      `    let p${i} = particles[${i}u];\n    let delta${i} = pos - p${i}.position.xyz;\n    d = smin(d, length(delta${i}) - p${i}.position.w, k);\n`
    )
  }
  parts.push('    return d;\n}\n')
  return parts.join('')
}

function generateShaderCode(numParticles: number): string {
  const mapFunction = generateMapFunction(numParticles)

  return `
struct Uniforms {
    resolution: vec2f,
    time: f32,
    viscosity: f32,
    elasticity: f32,
    heatSpeed: f32,
    baseColor: vec3f,
    _pad1: f32,
    glowColor: vec3f,
    _pad2: f32,
    cameraPos: vec3f,
    _pad3: f32,
}

struct Particle {
    position: vec4f, // xyz = pos, w = radius
    velocity: vec4f, // xyz = vel, w = padding
    state: vec4f,    // x = temperature (0..1), yzw = padding
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;

// --- COMPUTE STAGE: PHYSICS ---
@compute @workgroup_size(64)
fn simulate(@builtin(global_invocation_id) id : vec3u) {
    let i = id.x;
    if (i >= arrayLength(&particles)) { return; }

    var p = particles[i];
    let dt = 0.06;

    let h = p.position.y;
    let bottomZone = -2.0;
    let topZone = 2.0;

    // Heat Rate based on Slider
    let heatRate = u.heatSpeed * 0.000225;

    if (h < bottomZone) {
        p.state.x += heatRate * 2.5;
    } else if (h > topZone) {
        p.state.x -= heatRate * 1.5;
    } else {
        p.state.x = mix(p.state.x, 0.4, 0.000025);
    }
    p.state.x = clamp(p.state.x, 0.0, 1.0);

    // Buoyancy
    let buoyancyScale = 0.00012 + (u.heatSpeed * 0.0003);
    let buoyancyForce = (p.state.x - 0.5) * buoyancyScale;

    p.velocity.y += buoyancyForce * dt;

    // Add small random turbulence to prevent stagnation
    let turbulence = 0.00003;
    let noise1 = sin(dot(p.position.xyz, vec3f(12.9898, 78.233, 54.53)) + u.time * 0.5);
    let noise2 = sin(dot(p.position.xyz, vec3f(19.9898, 88.233, 64.53)) + u.time * 0.7);
    p.velocity.x += (noise1 * 0.5) * turbulence;
    p.velocity.z += (noise2 * 0.5) * turbulence;

    let drag = mix(0.998, 0.995, 1.0 - u.viscosity);
    p.velocity *= drag;

    p.position += p.velocity * dt;

    let radius = 4.0;
    let limitY = 3.0;

    if (p.position.y < -limitY) {
        p.position.y = -limitY + 0.01;
        p.velocity.y = max(p.velocity.y, 0.001); // Don't completely stop at boundaries
    }
    if (p.position.y > limitY) {
        p.position.y = limitY - 0.01;
        p.velocity.y = min(p.velocity.y, -0.001); // Don't completely stop at boundaries
    }

    let distXZ = length(p.position.xz);
    let radiusMinusW = radius - p.position.w;
    if (distXZ > radiusMinusW) {
        let invDistXZ = 1.0 / max(distXZ, 0.001);
        let normX = p.position.x * invDistXZ;
        let normZ = p.position.z * invDistXZ;
        let push = (distXZ - radiusMinusW) * 0.02;
        p.velocity.x -= normX * push;
        p.velocity.z -= normZ * push;
        p.position.x -= normX * 0.001;
        p.position.z -= normZ * 0.001;
        p.velocity.x += p.position.z * 0.0001;
        p.velocity.z -= p.position.x * 0.0001;
    }

    particles[i] = p;
}

// --- RENDER STAGE: RAYMARCHING ---

struct VertexOut {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
}

@vertex
fn vs_main(@builtin(vertex_index) vIdx: u32) -> VertexOut {
    var pos = array<vec2f, 6>(
        vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
        vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
    );
    var out: VertexOut;
    out.pos = vec4f(pos[vIdx], 0.0, 1.0);
    out.uv = pos[vIdx];
    return out;
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
    let h = clamp(0.5 + 0.5 * (b - a) / max(k, 0.001), 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

{{MAP_FUNCTION}}

fn calcNormal(p: vec3f) -> vec3f {
    let e = 0.005;
    return normalize(vec3f(
        map(p + vec3f(e, 0.0, 0.0)) - map(p - vec3f(e, 0.0, 0.0)),
        map(p + vec3f(0.0, e, 0.0)) - map(p - vec3f(0.0, e, 0.0)),
        map(p + vec3f(0.0, 0.0, e)) - map(p - vec3f(0.0, 0.0, e))
    ));
}

// Raymarch a single ray and return color
fn getPixelColor(uv: vec2f) -> vec3f {
    // Camera Basis
    let ro = u.cameraPos;
    let ta = vec3f(0.0, 0.0, 0.0);
    let fw = normalize(ta - ro);
    let rt = normalize(cross(fw, vec3f(0.0, 1.0, 0.0)));
    let up = normalize(cross(rt, fw));
    let rd = normalize(fw * 2.0 + rt * uv.x + up * uv.y);

    // Background
    let bgTop = u.glowColor * 0.3;
    let bgBot = u.glowColor * 1.2;
    var col = mix(bgBot, bgTop, uv.y * 0.5 + 0.5);

    let lightPos = vec3f(0.0, -3.0, 0.0);
    let limeLightPos = vec3f(0.0, 5.0, 0.0);
    let pulse = 1.0 + 0.15 * sin(u.time * 0.75);

    var t = 0.0;
    var prevD = 1000.0;

    for(var step=0; step<30; step++) {
        let p = ro + rd * t;
        let d = map(p);

        // Early exit if distance is very large and increasing (ray moving away from scene)
        if (d > 3.0 && d > prevD * 1.1) { break; }
        prevD = d;

        if(d < 0.002) { // Slightly relaxed hit threshold
            let n = calcNormal(p);
            let viewDir = ro - p;
            let view = normalize(viewDir);
            let viewDotN = max(dot(view, n), 0.0);
            let lDir = lightPos - p;
            let l = normalize(lDir);
            let limeLDir = limeLightPos - p;
            let limeL = normalize(limeLDir);
            let limeDistSq = dot(limeLDir, limeLDir);

            let oneMinusViewDotN = 1.0 - viewDotN;
            let fresnel = pow(oneMinusViewDotN, 2.5);
            let alpha = clamp(0.7 + 0.2 * fresnel, 0.0, 1.0);

            let nDotL = max(dot(n, l), 0.0);
            let nDotLimeL = max(dot(n, limeL), 0.0);
            let negL = -l;
            let negLimeL = -limeL;
            let viewDotNegL = max(dot(view, negL), 0.0);
            let viewDotNegLimeL = max(dot(view, negLimeL), 0.0);
            let backScatter = pow(viewDotNegL, 3.0);
            let limeBackScatter = pow(viewDotNegLimeL, 3.0);
            let reflL = reflect(negL, n);
            let reflLimeL = reflect(negLimeL, n);
            let spec = pow(max(dot(view, reflL), 0.0), 8.0);
            let limeSpec = pow(max(dot(view, reflLimeL), 0.0), 8.0);

            let rim = u.baseColor * fresnel * 2.0;
            let waxTint = mix(u.baseColor, u.baseColor * 1.4, smoothstep(-1.0, 1.0, p.y) * 0.5);

            var surfCol = (waxTint * nDotL * 0.5) + (waxTint * backScatter * pulse) + rim;
            surfCol += vec3f(1.0, 0.9, 0.8) * spec * 0.2;

            let limeAttenuation = 1.0 / (1.0 + limeDistSq * 0.1);
            let limeContribution = vec3f(0.5, 1.0, 0.0) * (nDotLimeL * 0.3 + limeBackScatter * pulse * 0.2) * 2.0 * limeAttenuation;
            surfCol += limeContribution + vec3f(0.7, 1.0, 0.6) * limeSpec * 0.15 * limeAttenuation;

            col = mix(col, surfCol, alpha);
            break;
        }

        t += d;
        if(t > 10.0) { break; }
    }
    return col;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4f {
    // Aspect Ratio
    let aspect = u.resolution.x / u.resolution.y;
    let uv = in.uv * vec2f(aspect, 1.0);

    // 2x Super-Sampling Anti-Aliasing (reduced for performance)
    let pixelSize = 1.0 / u.resolution.y;

    // 2-sample diagonal pattern
    let o1 = vec2f(0.25, 0.25) * pixelSize;
    let o2 = vec2f(-0.25, -0.25) * pixelSize;

    let c1 = getPixelColor(uv + o1);
    let c2 = getPixelColor(uv + o2);

    let finalColor = (c1 + c2) * 0.5;

    return vec4f(finalColor, 1.0);
}
`.replace('{{MAP_FUNCTION}}', mapFunction)
}

function hexToRgb(hex: string): [number, number, number] {
  const bigint = parseInt(hex.slice(1), 16)
  return [
    ((bigint >> 16) & 255) / 255,
    ((bigint >> 8) & 255) / 255,
    (bigint & 255) / 255,
  ]
}

function cn(...args: (string | undefined)[]): string {
  var out = '',
    i = 0
  for (; i < arguments.length; ++i) {
    var x = arguments[i]
    if (x) (out && (out += ' '), (out += x))
  }
  return out
}

function loadParticleData(numParticles: number): Float32Array | null {
  try {
    const saved = localStorage.getItem('lava-lamp-particles')
    if (!saved) return null

    const parsed = JSON.parse(saved)
    const now = Date.now()
    const oneDay = 86400000
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
      !dataArray ||
      !Array.isArray(dataArray) ||
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
        !isFinite(x) ||
        !isFinite(y) ||
        !isFinite(z) ||
        !isFinite(r) ||
        !isFinite(vx) ||
        !isFinite(vy) ||
        !isFinite(vz) ||
        !isFinite(temp)
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
  } catch (e) {
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
        data: data,
      })
    )
  } catch (e) {
    console.error('Error saving particles:', e)
  }
}

export function LavaLamp({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>(null)
  const saveTimeoutRef = useRef<number | null>(null)
  const mouseRef = useRef({ x: 0, y: 0, down: false })
  const camAnglesRef = useRef({ theta: 0, phi: 0.2 })
  const camRadiusRef = useRef(4.5)
  const isDestroyedRef = useRef(false)
  const resourcesRef = useRef<{
    device: GPUDevice | null
    context: GPUCanvasContext | null
    uniformBuffer: GPUBuffer | null
    particleBuffer: GPUBuffer | null
    bindGroup: GPUBindGroup | null
    computePipeline: GPUComputePipeline | null
    renderPipeline: GPURenderPipeline | null
    stagingBuffer: GPUBuffer | null
  }>({
    device: null,
    context: null,
    uniformBuffer: null,
    particleBuffer: null,
    bindGroup: null,
    computePipeline: null,
    renderPipeline: null,
    stagingBuffer: null,
  })

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
    if (canvas) canvas.style.cursor = 'grabbing'
  }, [])

  const handleMouseUp = useCallback(() => {
    mouseRef.current.down = false
    const canvas = canvasRef.current
    if (canvas) canvas.style.cursor = 'grab'
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!mouseRef.current.down) return
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
      if (!mouseRef.current.down) return
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
    if (!canvas) return

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
    let handleWindowResize: (() => void) | null = null
    let isDestroyed = false
    let numParticles = 16
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
        context = canvas.getContext('webgpu')!
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

        const updateCanvasSize = () => {
          if (isDestroyed) return
          const width = window.innerWidth
          const height = window.innerHeight
          if (width > 0 && height > 0) {
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
            const renderWidth = width * dpr
            const renderHeight = height * dpr
            if (
              canvas.width !== renderWidth ||
              canvas.height !== renderHeight
            ) {
              canvas.width = renderWidth
              canvas.height = renderHeight
              canvas.style.width = width + 'px'
              canvas.style.height = height + 'px'
            }
          }
        }

        updateCanvasSize()

        handleWindowResize = () => {
          updateCanvasSize()
        }
        window.addEventListener('resize', handleWindowResize)

        const frame = (time: number) => {
          if (isDestroyed || !device || !context) {
            return
          }

          const elapsed = time - lastFrameTime
          if (elapsed < frameInterval) {
            animationFrameRef.current = requestAnimationFrame(frame)
            return
          }
          lastFrameTime = time - (elapsed % frameInterval)

          const width = window.innerWidth
          const height = window.innerHeight
          const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
          const renderWidth = width * dpr
          const renderHeight = height * dpr

          if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
            canvas.width = renderWidth
            canvas.height = renderHeight
            canvas.style.width = width + 'px'
            canvas.style.height = height + 'px'
          }

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
            !uniformBuffer ||
            !computePipeline ||
            !renderPipeline ||
            !bindGroup
          ) {
            if (!isDestroyed) {
              animationFrameRef.current = requestAnimationFrame(frame)
            }
            return
          }

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

          device.queue.submit([commandEncoder.finish()])

          const now = Date.now()
          if (now - lastSaveTime > 100 && stagingBuffer) {
            if (isSaving) {
              lastSaveTime = now
              return
            }
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
                          if (isDestroyed) return
                          saveParticleData(saveData)
                        }
                        if (typeof requestIdleCallback !== 'undefined') {
                          requestIdleCallback(saveToStorage, { timeout: 5000 })
                        } else {
                          setTimeout(saveToStorage, 0)
                        }
                      } else {
                        stagingBuffer.unmap()
                        isSaving = false
                      }
                    })
                    .catch(() => {
                      isSaving = false
                    })
                })
              })
              .catch(() => {
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

    canvas.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      isDestroyed = true
      if (handleWindowResize) {
        window.removeEventListener('resize', handleWindowResize)
      }
      canvas.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchmove', handleTouchMove)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      if (saveTimeoutRef.current !== null) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
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
