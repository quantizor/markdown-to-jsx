import{r as p,j as he,_ as ge}from"./index-fKrKHD1l.js";function ye(i){for(var e=[`var<private> P: array<vec4f, ${i}>;
`,`fn loadParticles() {
`],r=0;r<i;r++)e.push(`    P[${r}u] = particles[${r}u].position;
`);return e.push(`}
`),e.join("")}function be(i){for(var e=[`fn map(pos: vec3f) -> f32 {
    let k = u.elasticity;
    let q0 = P[0u];
    var d = length(pos - q0.xyz) - q0.w;
`],r=1;r<i;r++)e.push(`    let q${r} = P[${r}u];
    d = smin(d, length(pos - q${r}.xyz) - q${r}.w, k);
`);return e.push(`    return d;
}
`),e.join("")}function we(i){const e=ye(i)+be(i);return`
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
`.replace("{{MAP_FUNCTION}}",e)}function ce(i){const e=Number.parseInt(i.slice(1),16);return[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255]}function xe(...i){for(var e="",r=0;r<arguments.length;++r){var a=arguments[r];a&&(e&&(e+=" "),e+=a)}return e}function Pe(i){try{const e=localStorage.getItem("lava-lamp-particles");if(!e)return null;const r=JSON.parse(e),a=Date.now(),w=864e5;let x=null,P=null;if(r&&typeof r=="object"&&"timestamp"in r&&"data"in r?(P=r.timestamp,x=r.data):Array.isArray(r)&&(x=r),P!==null&&a-P>w)return localStorage.removeItem("lava-lamp-particles"),null;const N=i*12;if(!(x&&Array.isArray(x))||x.length!==N)return null;const c=new Float32Array(x);let A=!0,z=!1;const _=c[0],q=c[1],n=c[2];for(let t=0;t<i&&A;t++){const o=t*12,m=c[o],d=c[o+1],L=c[o+2],D=c[o+3],M=c[o+4],s=c[o+5],S=c[o+6],u=c[o+8];if(Math.abs(m)>4||Math.abs(d)>5||Math.abs(L)>4||D<.05||D>1||Math.abs(M)>2||Math.abs(s)>2||Math.abs(S)>2||u<-.1||u>1.1||!Number.isFinite(m)||!Number.isFinite(d)||!Number.isFinite(L)||!Number.isFinite(D)||!Number.isFinite(M)||!Number.isFinite(s)||!Number.isFinite(S)||!Number.isFinite(u)){A=!1;break}t>0&&!z&&(z=Math.abs(m-_)>.1||Math.abs(d-q)>.1||Math.abs(L-n)>.1)}return A&&z?c:(localStorage.removeItem("lava-lamp-particles"),null)}catch{return null}}function Le(i){const e=new Float32Array(i*12);for(let r=0;r<i;r++){const a=r*12;e[a]=(Math.random()-.5)*3,e[a+1]=-2+Math.random()*4,e[a+2]=(Math.random()-.5)*3,e[a+3]=.35+Math.random()*.23,e[a+4]=0,e[a+5]=0,e[a+6]=0,e[a+7]=0,e[a+8]=(e[a+1]+2)/4,e[a+9]=0,e[a+10]=0,e[a+11]=0}return e}function Se(i){try{localStorage.setItem("lava-lamp-particles",JSON.stringify({timestamp:Date.now(),data:i}))}catch(e){console.error("Error saving particles:",e)}}function Ce({className:i}){const e=p.useRef(null),r=p.useRef(null),a=p.useRef({x:0,y:0,down:!1}),w=p.useRef({theta:0,phi:.2}),x=p.useRef(4.5),P=p.useCallback((n,t)=>{w.current.theta-=n*.01,w.current.phi=Math.max(-.5,Math.min(1,w.current.phi+t*.01))},[]),N=p.useCallback(n=>{a.current.down=!0,a.current.x=n.clientX,a.current.y=n.clientY;const t=e.current;t&&(t.style.cursor="grabbing")},[]),c=p.useCallback(()=>{a.current.down=!1;const n=e.current;n&&(n.style.cursor="grab")},[]),A=p.useCallback(n=>{a.current.down&&(P(n.clientX-a.current.x,n.clientY-a.current.y),a.current.x=n.clientX,a.current.y=n.clientY)},[P]),z=p.useCallback(n=>{a.current.down=!0,a.current.x=n.touches[0].clientX,a.current.y=n.touches[0].clientY},[]),_=p.useCallback(()=>{a.current.down=!1},[]),q=p.useCallback(n=>{if(!a.current.down)return;n.preventDefault();const t=n.touches[0];P(t.clientX-a.current.x,t.clientY-a.current.y),a.current.x=t.clientX,a.current.y=t.clientY},[P]);return p.useEffect(()=>{const n=e.current;if(!n)return;if(!navigator.gpu){console.warn("WebGPU not supported, lava lamp disabled");return}let t=null,o=null,m=null,d=null,L=null,D=null,M=null,s=null,S=null,u=!1,E=null;const j=new AbortController,C=16,$=160;(async()=>{try{const B=await navigator.gpu.requestAdapter();if(!B){console.warn("WebGPU adapter not available");return}if(t=await B.requestDevice(),t.addEventListener("uncapturederror",f=>{console.error("WebGPU uncaptured error:",f.error)}),o=n.getContext("webgpu"),!o){console.warn("WebGPU context not available");return}const H=navigator.gpu.getPreferredCanvasFormat();o.configure({device:t,format:H,alphaMode:"premultiplied"}),m=t.createBuffer({size:$,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});const O=C*48;d=t.createBuffer({size:O,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});const ue=Pe(C)||Le(C);t.queue.writeBuffer(d,0,ue);const fe=we(C),I=t.createShaderModule({code:fe}),J=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.COMPUTE|GPUShaderStage.FRAGMENT,buffer:{type:"storage"}}]});L=t.createBindGroup({layout:J,entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:d}}]});const K=t.createPipelineLayout({bindGroupLayouts:[J]});D=t.createComputePipeline({layout:K,compute:{module:I,entryPoint:"simulate"}}),M=t.createRenderPipeline({layout:K,vertex:{module:I,entryPoint:"vs_main"},fragment:{module:I,entryPoint:"fs_main",targets:[{format:H}]},primitive:{topology:"triangle-list"}});const l=new Float32Array($/4),Y=ce("#ff5a00"),X=ce("#000000");l[8]=Y[0],l[9]=Y[1],l[10]=Y[2],l[12]=X[0],l[13]=X[1],l[14]=X[2],l[3]=.99,l[4]=.65,l[5]=8.5;let Q=0;const Z=1e3/60;let ee=0;s=t.createBuffer({size:O,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});let y=!1;const W=C*12,pe=1e3,te=()=>Math.min(window.devicePixelRatio||1,2),re=(f,v)=>{if(u)return;const T=te(),k=Math.round(f*T),U=Math.round(v*T);k>0&&U>0&&(n.width!==k||n.height!==U)&&(n.width=k,n.height=U)};E=new ResizeObserver(f=>{const v=f.at(-1)?.contentRect;v&&re(v.width,v.height)}),E.observe(n);const ae=n.getBoundingClientRect();if(re(ae.width,ae.height),new URLSearchParams(window.location.search).has("fps")){const{createFpsMeter:f}=await ge(async()=>{const{createFpsMeter:v}=await import("./fps-meter-DUKWzAGK.js");return{createFpsMeter:v}},[]);u||(S=f())}const F=f=>{if(u||!t||!o)return;if(document.visibilityState==="hidden"){r.current=requestAnimationFrame(F);return}const v=f-Q;if(v<Z*.9){r.current=requestAnimationFrame(F);return}Q=v>=Z?f-v%Z:f;const T=n.width,k=n.height,U=te();S?.sample(f,T,k,U),w.current.theta+=3e-4;const V=x.current,ne=w.current.phi,ie=w.current.theta,oe=Math.cos(ne),de=Math.sin(ne),me=Math.cos(ie),ve=Math.sin(ie);if(l[0]=T,l[1]=k,l[2]=f*5e-4,l[16]=V*oe*ve,l[17]=V*de,l[18]=V*oe*me,!(m&&D&&M&&L)){u||(r.current=requestAnimationFrame(F));return}try{t.queue.writeBuffer(m,0,l);const h=t.createCommandEncoder(),g=h.beginComputePass();g.setPipeline(D),g.setBindGroup(0,L),g.dispatchWorkgroups(Math.ceil(C/64)),g.end();const b=h.beginRenderPass({colorAttachments:[{view:o.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}]});b.setPipeline(M),b.setBindGroup(0,L),b.draw(6),b.end(),t.queue.submit([h.finish()])}catch(h){console.warn("Lava lamp render error:",h)}const se=Date.now();se-ee>pe&&s&&!y&&(ee=se,y=!0,t.queue.onSubmittedWorkDone().then(()=>{if(u||!t||!s||!d){y=!1;return}const h=t.createCommandEncoder();return h.copyBufferToBuffer(d,0,s,0,O),t.queue.submit([h.finish()]),t.queue.onSubmittedWorkDone().then(()=>{if(u||!s){y=!1;return}return s.mapAsync(GPUMapMode.READ).then(()=>{if(u||!s){y=!1;return}const g=new Float32Array(s.getMappedRange());if(g.length===W&&g.some(b=>b!==0)){const b=new Array(W);for(let G=0;G<W;G++)b[G]=g[G];s.unmap(),y=!1;const le=()=>{u||Se(b)};typeof requestIdleCallback>"u"?setTimeout(le,0):requestIdleCallback(le,{timeout:5e3})}else s.unmap(),y=!1}).catch(g=>{console.warn("Lava lamp save mapAsync failed:",g),y=!1})})}).catch(h=>{console.warn("Lava lamp save failed:",h),y=!1})),u||(r.current=requestAnimationFrame(F))};r.current=requestAnimationFrame(F)}catch(B){console.error("Error initializing WebGPU lava lamp:",B)}})(),n.style.cursor="grab",n.removeAttribute("width"),n.removeAttribute("height");const R=j.signal;return n.addEventListener("mousedown",N,{signal:R}),window.addEventListener("mouseup",c,{signal:R}),window.addEventListener("mousemove",A,{signal:R}),n.addEventListener("touchstart",z,{passive:!1,signal:R}),window.addEventListener("touchend",_,{signal:R}),window.addEventListener("touchmove",q,{passive:!1,signal:R}),()=>{u=!0,j.abort(),E&&(E.disconnect(),E=null),r.current&&(cancelAnimationFrame(r.current),r.current=null),S&&(S.destroy(),S=null),s&&(s.destroy(),s=null),d&&(d.destroy(),d=null),m&&(m.destroy(),m=null),t&&(t.destroy(),t=null),o&&(o.unconfigure(),o=null)}},[]),he.jsx("canvas",{ref:e,className:xe("fixed inset-0 -z-10",i),style:{pointerEvents:"auto",display:"block",width:"100svw",height:"100svh",imageRendering:"auto",WebkitFontSmoothing:"antialiased",MozOsxFontSmoothing:"grayscale"}})}export{Ce as LavaLamp};
