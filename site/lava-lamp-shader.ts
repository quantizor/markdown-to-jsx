/**
 * WGSL source for the lava lamp: a compute pass that steps the particle
 * physics and a fullscreen fragment pass that raymarches the blended
 * distance field they define.
 *
 * Kept apart from the React component because the shader is the whole of what
 * makes this scene expensive, and reading or changing it should not mean
 * scrolling past device setup, pointer handling, and React lifecycle.
 */

/**
 * Copies every particle's position and radius into per-invocation storage,
 * once per pixel.
 *
 * The particle buffer is bound `read_write` because the compute stage writes
 * it, and a writable storage buffer may alias, so the compiler cannot hoist a
 * load out of a loop: reading `particles[i]` inside map() re-fetches all of
 * them on every one of the ~15 map() calls a pixel makes. Reading them once
 * into private storage is the same arithmetic against registers instead of
 * memory, and measured 2x faster with pixel-identical output.
 */
function generateParticleLoad(numParticles: number): string {
  var parts: string[] = [
    `var<private> P: array<vec4f, ${numParticles}>;\n`,
    'fn loadParticles() {\n',
  ]
  for (var i = 0; i < numParticles; i++) {
    parts.push(`    P[${i}u] = particles[${i}u].position;\n`)
  }
  parts.push('}\n')
  return parts.join('')
}

/**
 * The distance field, unrolled over `numParticles` so the loop bound is a
 * compile-time constant and no dynamic indexing survives into the hot path.
 */
function generateMapFunction(numParticles: number): string {
  var parts: string[] = [
    'fn map(pos: vec3f) -> f32 {\n    let k = u.elasticity;\n    let q0 = P[0u];\n    var d = length(pos - q0.xyz) - q0.w;\n',
  ]
  for (var i = 1; i < numParticles; i++) {
    parts.push(
      `    let q${i} = P[${i}u];\n    d = smin(d, length(pos - q${i}.xyz) - q${i}.w, k);\n`
    )
  }
  parts.push('    return d;\n}\n')
  return parts.join('')
}

/** Complete WGSL module: `simulate`, `vs_main`, and `fs_main`. */
export function generateShaderCode(numParticles: number): string {
  const mapFunction =
    generateParticleLoad(numParticles) + generateMapFunction(numParticles)

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

// Tetrahedron gradient: four field samples for the normal rather than the six
// a central difference needs, for a normal that differs by at most 11/255 in
// the final image.
fn calcNormal(p: vec3f) -> vec3f {
    let e = 0.005;
    let k0 = vec3f( 1.0, -1.0, -1.0);
    let k1 = vec3f(-1.0, -1.0,  1.0);
    let k2 = vec3f(-1.0,  1.0, -1.0);
    let k3 = vec3f( 1.0,  1.0,  1.0);
    return normalize(
        k0 * map(p + k0 * e) + k1 * map(p + k1 * e) +
        k2 * map(p + k2 * e) + k3 * map(p + k3 * e)
    );
}

// Wax shading at a surface point, composited over the background behind it.
// Separate from the march so a fully covered pixel and a partially covered
// edge pixel are lit by the same code.
fn shadeSurface(p: vec3f, ro: vec3f, pulse: f32, bg: vec3f) -> vec3f {
    let lightPos = vec3f(0.0, -3.0, 0.0);
    let limeLightPos = vec3f(0.0, 5.0, 0.0);

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

    return mix(bg, surfCol, alpha);
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

    let pulse = 1.0 + 0.15 * sin(u.time * 0.75);

    // Half-width of this pixel's footprint at distance t. The ray fan spans
    // 2/resolution.y in uv per pixel and rd is built from fw * 2.0, so a pixel
    // subtends about 1/resolution.y radians. Tracking how close the ray passes
    // to the surface relative to that width gives sub-pixel coverage from a
    // single ray, which resolves the silhouette better than the two jittered
    // rays this replaced, and measured about a third of their cost.
    let coneScale = 1.0 / u.resolution.y;
    var minRatio = 1e9;
    var closest = ro;

    var t = 0.0;
    var prevD = 1000.0;

    for(var step=0; step<30; step++) {
        let p = ro + rd * t;
        let d = map(p);

        // How far outside the pixel footprint this sample sits. Below 1 the
        // surface clips the pixel and owes it partial coverage.
        let ratio = d / max(t * coneScale, 1e-6);
        if (ratio < minRatio) {
            minRatio = ratio;
            closest = p;
        }

        // Early exit if distance is very large and increasing (ray moving away from scene)
        if (d > 3.0 && d > prevD * 1.1) { break; }
        prevD = d;

        if(d < 0.002) { // Slightly relaxed hit threshold
            minRatio = 0.0;
            closest = p;
            break;
        }

        t += d;
        if(t > 10.0) { break; }
    }

    if (minRatio < 1.0) {
        let coverage = clamp(1.0 - minRatio, 0.0, 1.0);
        col = mix(col, shadeSurface(closest, ro, pulse, col), coverage);
    }

    return col;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4f {
    // Aspect Ratio
    let aspect = u.resolution.x / u.resolution.y;
    let uv = in.uv * vec2f(aspect, 1.0);

    loadParticles();

    return vec4f(getPixelColor(uv), 1.0);
}
`.replace('{{MAP_FUNCTION}}', mapFunction)
}
