import{r as c,j as de}from"./index-CT2SLd-p.js";function me(a){for(var n=[`fn map(pos: vec3f) -> f32 {
    let k = u.elasticity;
    let p0 = particles[0u];
    let delta0 = pos - p0.position.xyz;
    var d = length(delta0) - p0.position.w;
`],i=1;i<a;i++)n.push(`    let p${i} = particles[${i}u];
    let delta${i} = pos - p${i}.position.xyz;
    d = smin(d, length(delta${i}) - p${i}.position.w, k);
`);return n.push(`    return d;
}
`),n.join("")}function ve(a){const n=me(a);return`
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
`.replace("{{MAP_FUNCTION}}",n)}function le(a){const n=parseInt(a.slice(1),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}function he(...a){for(var n="",i=0;i<arguments.length;++i){var r=arguments[i];r&&(n&&(n+=" "),n+=r)}return n}function ge(a){try{const n=localStorage.getItem("lava-lamp-particles");if(!n)return null;const i=JSON.parse(n),r=Date.now(),o=864e5;let p=null,z=null;if(i&&typeof i=="object"&&"timestamp"in i&&"data"in i?(z=i.timestamp,p=i.data):Array.isArray(i)&&(p=i),z!==null&&r-z>o)return localStorage.removeItem("lava-lamp-particles"),null;const P=a*12;if(!p||!Array.isArray(p)||p.length!==P)return null;const u=new Float32Array(p);let S=!0,D=!1;const G=u[0],T=u[1],F=u[2];for(let e=0;e<a&&S;e++){const t=e*12,f=u[t],m=u[t+1],d=u[t+2],x=u[t+3],C=u[t+4],M=u[t+5],l=u[t+6],L=u[t+8];if(Math.abs(f)>4||Math.abs(m)>5||Math.abs(d)>4||x<.05||x>1||Math.abs(C)>2||Math.abs(M)>2||Math.abs(l)>2||L<-.1||L>1.1||!isFinite(f)||!isFinite(m)||!isFinite(d)||!isFinite(x)||!isFinite(C)||!isFinite(M)||!isFinite(l)||!isFinite(L)){S=!1;break}e>0&&!D&&(D=Math.abs(f-G)>.1||Math.abs(m-T)>.1||Math.abs(d-F)>.1)}return S&&D?u:(localStorage.removeItem("lava-lamp-particles"),null)}catch{return null}}function we(a){const n=new Float32Array(a*12);for(let i=0;i<a;i++){const r=i*12;n[r]=(Math.random()-.5)*3,n[r+1]=-2+Math.random()*4,n[r+2]=(Math.random()-.5)*3,n[r+3]=.35+Math.random()*.23,n[r+4]=0,n[r+5]=0,n[r+6]=0,n[r+7]=0,n[r+8]=(n[r+1]+2)/4,n[r+9]=0,n[r+10]=0,n[r+11]=0}return n}function ye(a){try{localStorage.setItem("lava-lamp-particles",JSON.stringify({timestamp:Date.now(),data:a}))}catch(n){console.error("Error saving particles:",n)}}function Le({className:a}){const n=c.useRef(null),i=c.useRef(null),r=c.useRef(null),o=c.useRef({x:0,y:0,down:!1}),p=c.useRef({theta:0,phi:.2}),z=c.useRef(4.5);c.useRef(!1),c.useRef({device:null,context:null,uniformBuffer:null,particleBuffer:null,bindGroup:null,computePipeline:null,renderPipeline:null,stagingBuffer:null});const P=c.useCallback((e,t)=>{p.current.theta-=e*.01,p.current.phi=Math.max(-.5,Math.min(1,p.current.phi+t*.01))},[]),u=c.useCallback(e=>{o.current.down=!0,o.current.x=e.clientX,o.current.y=e.clientY;const t=n.current;t&&(t.style.cursor="grabbing")},[]),S=c.useCallback(()=>{o.current.down=!1;const e=n.current;e&&(e.style.cursor="grab")},[]),D=c.useCallback(e=>{o.current.down&&(P(e.clientX-o.current.x,e.clientY-o.current.y),o.current.x=e.clientX,o.current.y=e.clientY)},[P]),G=c.useCallback(e=>{o.current.down=!0,o.current.x=e.touches[0].clientX,o.current.y=e.touches[0].clientY},[]),T=c.useCallback(()=>{o.current.down=!1},[]),F=c.useCallback(e=>{if(!o.current.down)return;e.preventDefault();const t=e.touches[0];P(t.clientX-o.current.x,t.clientY-o.current.y),o.current.x=t.clientX,o.current.y=t.clientY},[P]);return c.useEffect(()=>{const e=n.current;if(!e)return;if(!navigator.gpu){console.warn("WebGPU not supported, lava lamp disabled");return}let t=null,f=null,m=null,d=null,x=null,C=null,M=null,l=null,L=null,g=!1,A=16;const H=160;return(async()=>{try{const k=await navigator.gpu.requestAdapter();if(!k){console.warn("WebGPU adapter not available");return}if(t=await k.requestDevice(),t.addEventListener("uncapturederror",y=>{console.error("WebGPU uncaptured error:",y.error)}),f=e.getContext("webgpu"),!f){console.warn("WebGPU context not available");return}const $=navigator.gpu.getPreferredCanvasFormat();f.configure({device:t,format:$,alphaMode:"premultiplied"}),m=t.createBuffer({size:H,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});const _=A*48;d=t.createBuffer({size:_,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});const se=ge(A)||we(A);t.queue.writeBuffer(d,0,se);const ce=ve(A),Y=t.createShaderModule({code:ce}),j=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.COMPUTE|GPUShaderStage.FRAGMENT,buffer:{type:"storage"}}]});x=t.createBindGroup({layout:j,entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:d}}]});const J=t.createPipelineLayout({bindGroupLayouts:[j]});C=t.createComputePipeline({layout:J,compute:{module:Y,entryPoint:"simulate"}}),M=t.createRenderPipeline({layout:J,vertex:{module:Y,entryPoint:"vs_main"},fragment:{module:Y,entryPoint:"fs_main",targets:[{format:$}]},primitive:{topology:"triangle-list"}});const s=new Float32Array(H/4),W=le("#ff5a00"),X=le("#000000");s[8]=W[0],s[9]=W[1],s[10]=W[2],s[12]=X[0],s[13]=X[1],s[14]=X[2],s[3]=.99,s[4]=.65,s[5]=8.5;let K=0;const Q=1e3/60;let ee=0;l=t.createBuffer({size:_,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});let w=!1;const q=A*12,te=()=>{if(g)return;const y=window.visualViewport?.width||window.innerWidth,R=window.visualViewport?.height||window.innerHeight;if(y>0&&R>0){const E=Math.min(window.devicePixelRatio||1,1.5),B=y*E,U=R*E;(e.width!==B||e.height!==U)&&(e.width=B,e.height=U,e.style.width=y+"px",e.style.height=R+"px")}};te(),L=()=>{te()},window.addEventListener("resize",L);const N=y=>{if(g||!t||!f)return;const R=y-K;if(R<Q){i.current=requestAnimationFrame(N);return}K=y-R%Q;const E=window.visualViewport?.width||window.innerWidth,B=window.visualViewport?.height||window.innerHeight,U=Math.min(window.devicePixelRatio||1,1.5),I=E*U,Z=B*U;(e.width!==I||e.height!==Z)&&(e.width=I,e.height=Z,e.style.width=E+"px",e.style.height=B+"px"),p.current.theta+=3e-4;const V=z.current,ne=p.current.phi,ie=p.current.theta,re=Math.cos(ne),ue=Math.sin(ne),pe=Math.cos(ie),fe=Math.sin(ie);if(s[0]=I,s[1]=Z,s[2]=y*5e-4,s[16]=V*re*fe,s[17]=V*ue,s[18]=V*re*pe,!m||!C||!M||!x){g||(i.current=requestAnimationFrame(N));return}try{t.queue.writeBuffer(m,0,s);const v=t.createCommandEncoder(),h=v.beginComputePass();h.setPipeline(C),h.setBindGroup(0,x),h.dispatchWorkgroups(Math.ceil(A/64)),h.end();const b=v.beginRenderPass({colorAttachments:[{view:f.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}]});b.setPipeline(M),b.setBindGroup(0,x),b.draw(6),b.end(),t.queue.submit([v.finish()])}catch(v){console.warn("Lava lamp render error:",v)}const oe=Date.now();oe-ee>100&&l&&!w&&(ee=oe,w=!0,t.queue.onSubmittedWorkDone().then(()=>{if(g||!t||!l||!d){w=!1;return}const v=t.createCommandEncoder();return v.copyBufferToBuffer(d,0,l,0,_),t.queue.submit([v.finish()]),t.queue.onSubmittedWorkDone().then(()=>{if(g||!l){w=!1;return}return l.mapAsync(GPUMapMode.READ).then(()=>{if(g||!l){w=!1;return}const h=new Float32Array(l.getMappedRange());if(h.length===q&&h.some(b=>b!==0)){const b=new Array(q);for(let O=0;O<q;O++)b[O]=h[O];l.unmap(),w=!1;const ae=()=>{g||ye(b)};typeof requestIdleCallback<"u"?requestIdleCallback(ae,{timeout:5e3}):setTimeout(ae,0)}else l.unmap(),w=!1}).catch(h=>{console.warn("Lava lamp save mapAsync failed:",h),w=!1})})}).catch(v=>{console.warn("Lava lamp save failed:",v),w=!1})),g||(i.current=requestAnimationFrame(N))};i.current=requestAnimationFrame(N)}catch(k){console.error("Error initializing WebGPU lava lamp:",k)}})(),e.style.cursor="grab",e.removeAttribute("width"),e.removeAttribute("height"),e.addEventListener("mousedown",u),window.addEventListener("mouseup",S),window.addEventListener("mousemove",D),e.addEventListener("touchstart",G,{passive:!1}),window.addEventListener("touchend",T),window.addEventListener("touchmove",F,{passive:!1}),()=>{g=!0,L&&window.removeEventListener("resize",L),e.removeEventListener("mousedown",u),window.removeEventListener("mouseup",S),window.removeEventListener("mousemove",D),e.removeEventListener("touchstart",G),window.removeEventListener("touchend",T),window.removeEventListener("touchmove",F),i.current&&(cancelAnimationFrame(i.current),i.current=null),r.current!==null&&(clearTimeout(r.current),r.current=null),l&&(l.destroy(),l=null),d&&(d.destroy(),d=null),m&&(m.destroy(),m=null),t&&(t.destroy(),t=null),f&&(f.unconfigure(),f=null)}},[]),de.jsx("canvas",{ref:n,className:he("fixed inset-0 -z-10",a),style:{pointerEvents:"auto",display:"block",width:"100svw",height:"100svh",imageRendering:"auto",WebkitFontSmoothing:"antialiased",MozOsxFontSmoothing:"grayscale"}})}export{Le as LavaLamp};
