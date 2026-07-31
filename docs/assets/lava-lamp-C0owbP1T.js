import{r as c,j as ge}from"./index-CbwxCpPm.js";function be(i){for(var n=[`fn map(pos: vec3f) -> f32 {
    let k = u.elasticity;
    let p0 = particles[0u];
    let delta0 = pos - p0.position.xyz;
    var d = length(delta0) - p0.position.w;
`],r=1;r<i;r++)n.push(`    let p${r} = particles[${r}u];
    let delta${r} = pos - p${r}.position.xyz;
    d = smin(d, length(delta${r}) - p${r}.position.w, k);
`);return n.push(`    return d;
}
`),n.join("")}function ye(i){const n=be(i);return`
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

// Ray-march a single ray through the blob field as a translucent volume.
// Front-to-back compositing: each sample contributes (1 - alphaAcc) * sample,
// so a blob in front occludes proportionally rather than fully, and blobs
// behind it remain visible through the front one. No surface, no normal,
// no lighting model: density alone produces the look.
fn getPixelColor(uv: vec2f) -> vec3f {
    let ro = u.cameraPos;
    let ta = vec3f(0.0, 0.0, 0.0);
    let fw = normalize(ta - ro);
    let rt = normalize(cross(fw, vec3f(0.0, 1.0, 0.0)));
    let up = normalize(cross(rt, fw));
    let rd = normalize(fw * 2.0 + rt * uv.x + up * uv.y);

    // Background gradient. Foreground alpha fades onto this.
    let bgTop = u.glowColor * 0.3;
    let bgBot = u.glowColor * 1.2;
    var col = mix(bgBot, bgTop, uv.y * 0.5 + 0.5);

    // Analytic bounding-volume early-out. The blob field lives near the
    // origin; rays that miss the bound never sample a single map().
    let boundR = 5.6;
    let b = dot(ro, rd);
    let c = dot(ro, ro) - boundR * boundR;
    let disc = b * b - c;
    if (disc < 0.0) {
        return col;
    }
    let sqrtDisc = sqrt(disc);
    let tStart = max(-b - sqrtDisc, 0.0);
    let tEnd = -b + sqrtDisc;
    let marchLen = tEnd - tStart;

    // Fixed-step front-to-back compositing. 16 samples over the bound is
    // past the discretization threshold at glancing angles for this scene.
    // Early-out at 0.98 keeps blob-free regions cheap inside the bound too.
    const STEP_COUNT = 16;
    let dt = marchLen / f32(STEP_COUNT);
    var t = tStart + dt * 0.5; // midpoint of the first cell
    var alphaAcc = 0.0;
    // Density-to-alpha gain. Tuned for the actual scene scale: peak density
    // inside a blob is ~0.4 (sphere radius) and a march cell is ~0.7, so
    // gain 0.5 gives a per-sample alpha around 0.13. A ray passing through
    // one blob (~2 cells) hits ~0.25 alpha, through two stacked blobs
    // (~4 cells) ~0.45. That leaves the back blob clearly visible through
    // the front, which is the look the effect is meant to have.
    let absorb = 0.5;

    for (var i = 0; i < STEP_COUNT; i = i + 1) {
        if (alphaAcc > 0.98) { break; }
        let p = ro + rd * t;
        let d = map(p);
        // Density is positive inside the smoothed union, negative outside.
        let density = max(-d, 0.0);
        let aSample = 1.0 - exp(-density * absorb * dt);
        let contrib = u.baseColor * aSample;
        col += contrib * (1.0 - alphaAcc);
        alphaAcc += aSample * (1.0 - alphaAcc);
        t = t + dt;
    }

    return col;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4f {
    // Aspect Ratio
    let aspect = u.resolution.x / u.resolution.y;
    let uv = in.uv * vec2f(aspect, 1.0);

    // Anti-aliasing: 4-tap rotated-grid supersampling. Each tap is one full
    // volumetric march on this thread; 4x is justified because the inner loop
    // has no branches or normal computation, so per-tap cost stays low.
    let px = 1.0 / u.resolution;
    let o0 = vec2f(-0.375, -0.125) * px;
    let o1 = vec2f( 0.125, -0.375) * px;
    let o2 = vec2f( 0.375,  0.125) * px;
    let o3 = vec2f(-0.125,  0.375) * px;

    let c0 = getPixelColor(uv + o0);
    let c1 = getPixelColor(uv + o1);
    let c2 = getPixelColor(uv + o2);
    let c3 = getPixelColor(uv + o3);

    let finalColor = (c0 + c1 + c2 + c3) * 0.25;

    return vec4f(finalColor, 1.0);
}
`.replace("{{MAP_FUNCTION}}",n)}function ue(i){const n=Number.parseInt(i.slice(1),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}function we(...i){for(var n="",r=0;r<arguments.length;++r){var o=arguments[r];o&&(n&&(n+=" "),n+=o)}return n}function xe(i){try{const n=localStorage.getItem("lava-lamp-particles");if(!n)return null;const r=JSON.parse(n),o=Date.now(),a=864e5;let d=null,U=null;if(r&&typeof r=="object"&&"timestamp"in r&&"data"in r?(U=r.timestamp,d=r.data):Array.isArray(r)&&(d=r),U!==null&&o-U>a)return localStorage.removeItem("lava-lamp-particles"),null;const S=i*12;if(!(d&&Array.isArray(d))||d.length!==S)return null;const u=new Float32Array(d);let M=!0,E=!1;const k=u[0],B=u[1],L=u[2];for(let e=0;e<i&&M;e++){const t=e*12,p=u[t],h=u[t+1],f=u[t+2],x=u[t+3],A=u[t+4],C=u[t+5],s=u[t+6],P=u[t+8];if(Math.abs(p)>4||Math.abs(h)>5||Math.abs(f)>4||x<.05||x>1||Math.abs(A)>2||Math.abs(C)>2||Math.abs(s)>2||P<-.1||P>1.1||!Number.isFinite(p)||!Number.isFinite(h)||!Number.isFinite(f)||!Number.isFinite(x)||!Number.isFinite(A)||!Number.isFinite(C)||!Number.isFinite(s)||!Number.isFinite(P)){M=!1;break}e>0&&!E&&(E=Math.abs(p-k)>.1||Math.abs(h-B)>.1||Math.abs(f-L)>.1)}return M&&E?u:(localStorage.removeItem("lava-lamp-particles"),null)}catch{return null}}function Pe(i){const n=new Float32Array(i*12);for(let r=0;r<i;r++){const o=r*12;n[o]=(Math.random()-.5)*3,n[o+1]=-2+Math.random()*4,n[o+2]=(Math.random()-.5)*3,n[o+3]=.35+Math.random()*.23,n[o+4]=0,n[o+5]=0,n[o+6]=0,n[o+7]=0,n[o+8]=(n[o+1]+2)/4,n[o+9]=0,n[o+10]=0,n[o+11]=0}return n}function Se(i){try{localStorage.setItem("lava-lamp-particles",JSON.stringify({timestamp:Date.now(),data:i}))}catch(n){console.error("Error saving particles:",n)}}function Ae({className:i}){const n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),a=c.useRef({x:0,y:0,down:!1}),d=c.useRef({theta:0,phi:.2}),U=c.useRef(4.5);c.useRef(!1),c.useRef({device:null,context:null,uniformBuffer:null,particleBuffer:null,bindGroup:null,computePipeline:null,renderPipeline:null,stagingBuffer:null});const S=c.useCallback((e,t)=>{d.current.theta-=e*.01,d.current.phi=Math.max(-.5,Math.min(1,d.current.phi+t*.01))},[]),u=c.useCallback(e=>{a.current.down=!0,a.current.x=e.clientX,a.current.y=e.clientY;const t=n.current;t&&(t.style.cursor="grabbing")},[]),M=c.useCallback(()=>{a.current.down=!1;const e=n.current;e&&(e.style.cursor="grab")},[]),E=c.useCallback(e=>{a.current.down&&(S(e.clientX-a.current.x,e.clientY-a.current.y),a.current.x=e.clientX,a.current.y=e.clientY)},[S]),k=c.useCallback(e=>{a.current.down=!0,a.current.x=e.touches[0].clientX,a.current.y=e.touches[0].clientY},[]),B=c.useCallback(()=>{a.current.down=!1},[]),L=c.useCallback(e=>{if(!a.current.down)return;e.preventDefault();const t=e.touches[0];S(t.clientX-a.current.x,t.clientY-a.current.y),a.current.x=t.clientX,a.current.y=t.clientY},[S]);return c.useEffect(()=>{const e=n.current;if(!e)return;if(!navigator.gpu){console.warn("WebGPU not supported, lava lamp disabled");return}let t=null,p=null,h=null,f=null,x=null,A=null,C=null,s=null,P=null,j=null,N=null,g=!1;const R=16,J=160;return(async()=>{try{const O=await navigator.gpu.requestAdapter();if(!O){console.warn("WebGPU adapter not available");return}if(t=await O.requestDevice(),t.addEventListener("uncapturederror",y=>{console.error("WebGPU uncaptured error:",y.error)}),p=e.getContext("webgpu"),!p){console.warn("WebGPU context not available");return}const K=navigator.gpu.getPreferredCanvasFormat();p.configure({device:t,format:K,alphaMode:"premultiplied"}),h=t.createBuffer({size:J,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});const q=R*48;f=t.createBuffer({size:q,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});const de=xe(R)||Pe(R);t.queue.writeBuffer(f,0,de);const pe=ye(R),Y=t.createShaderModule({code:pe}),Q=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.COMPUTE|GPUShaderStage.FRAGMENT,buffer:{type:"storage"}}]});x=t.createBindGroup({layout:Q,entries:[{binding:0,resource:{buffer:h}},{binding:1,resource:{buffer:f}}]});const ee=t.createPipelineLayout({bindGroupLayouts:[Q]});A=t.createComputePipeline({layout:ee,compute:{module:Y,entryPoint:"simulate"}}),C=t.createRenderPipeline({layout:ee,vertex:{module:Y,entryPoint:"vs_main"},fragment:{module:Y,entryPoint:"fs_main",targets:[{format:K}]},primitive:{topology:"triangle-list"}});const l=new Float32Array(J/4),I=ue("#ff5a00"),W=ue("#000000");l[8]=I[0],l[9]=I[1],l[10]=I[2],l[12]=W[0],l[13]=W[1],l[14]=W[2],l[3]=.99,l[4]=.65,l[5]=8.5;let te=0;const ne=1e3/60;let re=0;s=t.createBuffer({size:q,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});let b=!1;const X=R*12,fe=1e3,oe=()=>{if(g)return;const y=window.visualViewport?.width||window.innerWidth,T=window.visualViewport?.height||window.innerHeight;if(y>0&&T>0){const z=Math.min(window.devicePixelRatio||1,2),D=Math.round(y*z),G=Math.round(T*z);(e.width!==D||e.height!==G)&&(e.width=D,e.height=G,e.style.width=`${y}px`,e.style.height=`${T}px`)}};oe(),P=()=>{oe()},window.addEventListener("resize",P);let Z=!1;j=()=>{Z=!0,N!==null&&clearTimeout(N),N=setTimeout(()=>{Z=!1,N=null},150)},window.addEventListener("scroll",j,{passive:!0});const F=y=>{if(g||!t||!p)return;if(document.visibilityState==="hidden"){r.current=requestAnimationFrame(F);return}const T=y-te;if(T<ne){r.current=requestAnimationFrame(F);return}te=y-T%ne;const z=window.visualViewport?.width||window.innerWidth,D=window.visualViewport?.height||window.innerHeight,G=Z?1:Math.min(window.devicePixelRatio||1,2),V=Math.round(z*G),$=Math.round(D*G);(e.width!==V||e.height!==$)&&(e.width=V,e.height=$,e.style.width=`${z}px`,e.style.height=`${D}px`),d.current.theta+=3e-4;const H=U.current,ae=d.current.phi,ie=d.current.theta,se=Math.cos(ae),he=Math.sin(ae),me=Math.cos(ie),ve=Math.sin(ie);if(l[0]=V,l[1]=$,l[2]=y*5e-4,l[16]=H*se*ve,l[17]=H*he,l[18]=H*se*me,!(h&&A&&C&&x)){g||(r.current=requestAnimationFrame(F));return}try{t.queue.writeBuffer(h,0,l);const m=t.createCommandEncoder(),v=m.beginComputePass();v.setPipeline(A),v.setBindGroup(0,x),v.dispatchWorkgroups(Math.ceil(R/64)),v.end();const w=m.beginRenderPass({colorAttachments:[{view:p.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}]});w.setPipeline(C),w.setBindGroup(0,x),w.draw(6),w.end(),t.queue.submit([m.finish()])}catch(m){console.warn("Lava lamp render error:",m)}const le=Date.now();le-re>fe&&s&&!b&&(re=le,b=!0,t.queue.onSubmittedWorkDone().then(()=>{if(g||!t||!s||!f){b=!1;return}const m=t.createCommandEncoder();return m.copyBufferToBuffer(f,0,s,0,q),t.queue.submit([m.finish()]),t.queue.onSubmittedWorkDone().then(()=>{if(g||!s){b=!1;return}return s.mapAsync(GPUMapMode.READ).then(()=>{if(g||!s){b=!1;return}const v=new Float32Array(s.getMappedRange());if(v.length===X&&v.some(w=>w!==0)){const w=new Array(X);for(let _=0;_<X;_++)w[_]=v[_];s.unmap(),b=!1;const ce=()=>{g||Se(w)};typeof requestIdleCallback>"u"?setTimeout(ce,0):requestIdleCallback(ce,{timeout:5e3})}else s.unmap(),b=!1}).catch(v=>{console.warn("Lava lamp save mapAsync failed:",v),b=!1})})}).catch(m=>{console.warn("Lava lamp save failed:",m),b=!1})),g||(r.current=requestAnimationFrame(F))};r.current=requestAnimationFrame(F)}catch(O){console.error("Error initializing WebGPU lava lamp:",O)}})(),e.style.cursor="grab",e.removeAttribute("width"),e.removeAttribute("height"),e.addEventListener("mousedown",u),window.addEventListener("mouseup",M),window.addEventListener("mousemove",E),e.addEventListener("touchstart",k,{passive:!1}),window.addEventListener("touchend",B),window.addEventListener("touchmove",L,{passive:!1}),()=>{g=!0,P&&window.removeEventListener("resize",P),e.removeEventListener("mousedown",u),window.removeEventListener("mouseup",M),window.removeEventListener("mousemove",E),e.removeEventListener("touchstart",k),window.removeEventListener("touchend",B),window.removeEventListener("touchmove",L),r.current&&(cancelAnimationFrame(r.current),r.current=null),o.current!==null&&(clearTimeout(o.current),o.current=null),s&&(s.destroy(),s=null),f&&(f.destroy(),f=null),h&&(h.destroy(),h=null),t&&(t.destroy(),t=null),p&&(p.unconfigure(),p=null)}},[]),ge.jsx("canvas",{ref:n,className:we("fixed inset-0 -z-10",i),style:{pointerEvents:"auto",display:"block",width:"100svw",height:"100svh",imageRendering:"auto",WebkitFontSmoothing:"antialiased",MozOsxFontSmoothing:"grayscale"}})}export{Ae as LavaLamp};
