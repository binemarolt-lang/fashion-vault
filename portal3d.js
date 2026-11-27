// VAULT X — Igloo + Lusion + Codrops Circular + KPRverse + Active Theory 3D WebGL Portal (Three.js r170)
import * as THREE from './vendor/three.module.min.js';

const BG_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

const BG_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uScroll;
  uniform float uWarp;
  uniform vec2 uMouse;
  uniform vec2 uRes;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = rot * p * 2.02 + vec2(0.17, -0.11);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 aspect = vec2(uRes.x / max(uRes.y, 1.0), 1.0);
    vec2 p = (uv - 0.5) * aspect;

    vec2 drift = vec2(uTime * 0.025, -uTime * 0.018 - uScroll * 0.65) + uMouse * 0.12;
    float n1 = fbm(p * 1.65 + drift);
    float n2 = fbm(p * 3.1 - drift * 0.7 + vec2(n1 * 0.85));
    float mist = smoothstep(0.18, 0.88, n1 * 0.6 + n2 * 0.45);

    vec3 deepObsidian = vec3(0.024, 0.032, 0.048);
    vec3 slateFog     = vec3(0.085, 0.112, 0.158);
    vec3 glacialGlow  = vec3(0.62, 0.72, 0.84);

    vec2 coreCenter = vec2(0.0, 0.08) + uMouse * vec2(0.12, -0.07);
    float dist = length(p - coreCenter);
    float halo = exp(-dist * 2.35) * (0.42 + uScroll * 0.25);

    vec3 col = mix(deepObsidian, slateFog, mist * 0.75);
    col += glacialGlow * halo * (0.55 + n2 * 0.45);

    float pulse = exp(-length(p - vec2(0.28, -0.18)) * 3.4) * (0.06 + 0.03 * sin(uTime * 1.4));
    col += vec3(0.78, 0.19, 0.10) * pulse;

    float vig = smoothstep(1.32, 0.28, length(p));
    col *= mix(0.45, 1.0, vig);
    col += vec3(0.82, 0.88, 0.96) * pow(uWarp, 2.2) * 0.85;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const CRYSTAL_VERT = /* glsl */ `
  attribute vec3 aFaceCenter;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying vec3 vLocalPos;
  uniform float uTime;
  uniform float uWarp;
  uniform float uPulse;
  uniform float uSpread;

  void main() {
    vLocalPos = position;
    float breathe = sin(uTime * 1.15 + position.y * 2.2 + position.x * 1.7) * 0.018;
    vec3 facetDir = normalize(aFaceCenter + vec3(0.0001));
    // Rigid per-facet explosion (Lusion physics) + normal pulse
    vec3 displaced = position + facetDir * (uSpread * 0.24 + uWarp * 0.42) + normal * (breathe + uPulse * 0.07);
    vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const CRYSTAL_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying vec3 vLocalPos;
  uniform float uTime;
  uniform float uScroll;
  uniform float uWarp;
  uniform float uPulse;

  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i + vec3(0,0,0)), hash3(i + vec3(1,0,0)), f.x),
          mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
          mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(vViewDir);
    float ndotv = clamp(dot(N, V), 0.0, 1.0);

    float fR = pow(1.0 - clamp(ndotv - 0.045, 0.0, 1.0), 2.7);
    float fG = pow(1.0 - ndotv, 2.9);
    float fB = pow(1.0 - clamp(ndotv + 0.045, 0.0, 1.0), 3.1);
    vec3 fresnel = vec3(fR * 0.92, fG * 0.98, fB * 1.12);

    float veins = noise3(vLocalPos * 2.4 + vec3(0.0, uTime * 0.14, uScroll * 1.8));
    float veinLine = smoothstep(0.46, 0.78, veins);

    vec3 L1 = normalize(vec3(0.65, 0.85, 0.75));
    vec3 L2 = normalize(vec3(-0.75, -0.35, 0.55));
    float diff1 = max(dot(N, L1), 0.0);
    float diff2 = max(dot(N, L2), 0.0);
    float spec1 = pow(max(dot(reflect(-L1, N), V), 0.0), 42.0);
    float spec2 = pow(max(dot(reflect(-L2, N), V), 0.0), 22.0);

    vec3 obsidianCore = vec3(0.045, 0.062, 0.092);
    vec3 iceTint      = vec3(0.66, 0.77, 0.90);
    vec3 silverRim    = vec3(0.92, 0.96, 1.00);

    vec3 col = obsidianCore * (0.65 + diff1 * 0.9 + diff2 * 0.45);
    col += iceTint * veinLine * (0.28 + 0.25 * (1.0 - ndotv));
    col += fresnel * mix(iceTint, silverRim, 0.55) * 1.15;
    col += silverRim * spec1 * 0.95 + iceTint * spec2 * 0.45;
    col += vec3(0.78, 0.20, 0.10) * pow(1.0 - ndotv, 5.5) * 0.28;

    // Interactive click/drag impulse flash
    col += mix(silverRim, vec3(0.86, 0.24, 0.14), 0.35) * uPulse * fresnel.b * 0.65;

    // Warp surge
    col += silverRim * uWarp * (0.55 + fresnel.b * 0.8);

    gl_FragColor = vec4(col, 0.94);
  }
`;

const PARTICLE_VERT = /* glsl */ `
  attribute float aScale;
  attribute float aPhase;
  uniform float uTime;
  uniform float uScroll;
  uniform float uWarp;
  uniform float uVel;
  uniform float uPixelRatio;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    float zRange = 24.0;
    pos.z = mod(pos.z + uTime * 0.45 + uScroll * 11.0 + uWarp * 14.0 + 18.0, zRange) - 18.0;
    pos.x += sin(uTime * 0.35 + aPhase) * 0.18;
    pos.y += cos(uTime * 0.28 + aPhase * 1.3) * 0.15;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    float depthFade = smoothstep(-18.0, -3.0, pos.z) * smoothstep(6.0, 1.5, pos.z);
    vAlpha = depthFade * (0.45 + 0.35 * sin(uTime * 1.2 + aPhase));

    float velBoost = 1.0 + min(abs(uVel), 1.5) * 0.35 + uWarp * 1.4;
    gl_PointSize = aScale * uPixelRatio * (18.0 / max(-mvPos.z, 1.2)) * velBoost;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  precision mediump float;
  uniform float uTemp;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float glow = pow(1.0 - d * 2.0, 2.0);
    vec3 coldCol = vec3(0.76, 0.88, 1.00);
    vec3 midCol  = vec3(0.90, 0.93, 0.97);
    vec3 hotCol  = vec3(0.95, 0.40, 0.26);
    vec3 col = uTemp < 0.5
      ? mix(coldCol, midCol, uTemp * 2.0)
      : mix(midCol, hotCol, (uTemp - 0.5) * 2.0);
    gl_FragColor = vec4(col, glow * vAlpha);
  }
`;

function buildCrystalGeometry() {
  const base = new THREE.IcosahedronGeometry(1.48, 2);
  const pos = base.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n =
      Math.sin(v.x * 2.3 + 0.4) * Math.cos(v.y * 2.1 - 0.3) * 0.18 +
      Math.sin(v.z * 3.1 + v.y * 1.7) * 0.11;
    v.multiplyScalar(1.0 + n);
    v.y *= 1.24;
    v.x *= 0.86;
    v.z *= 0.86;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const faceted = base.toNonIndexed();
  base.dispose();
  faceted.computeVertexNormals();

  // Compute per-face centroid for rigid Lusion facet spread
  const fPos = faceted.attributes.position;
  const centers = new Float32Array(fPos.count * 3);
  for (let i = 0; i < fPos.count; i += 3) {
    const cx = (fPos.getX(i) + fPos.getX(i + 1) + fPos.getX(i + 2)) / 3;
    const cy = (fPos.getY(i) + fPos.getY(i + 1) + fPos.getY(i + 2)) / 3;
    const cz = (fPos.getZ(i) + fPos.getZ(i + 1) + fPos.getZ(i + 2)) / 3;
    for (let k = 0; k < 3; k++) {
      centers[(i + k) * 3] = cx;
      centers[(i + k) * 3 + 1] = cy;
      centers[(i + k) * 3 + 2] = cz;
    }
  }
  faceted.setAttribute('aFaceCenter', new THREE.BufferAttribute(centers, 3));
  return faceted;
}

function createAmbientAudio() {
  let ctx = null;
  let master = null;
  let osc1 = null;
  let osc2 = null;
  let enabled = false;
  let lastHover = 0;

  function init() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0.0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;

    osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 55;

    osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 82.41;

    const g2 = ctx.createGain();
    g2.gain.value = 0.32;

    osc1.connect(filter);
    osc2.connect(g2);
    g2.connect(filter);
    filter.connect(master);
    master.connect(ctx.destination);

    osc1.start();
    osc2.start();
    return true;
  }

  return {
    toggle() {
      if (!ctx && !init()) return false;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      enabled = !enabled;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(enabled ? 0.06 : 0.0, now, 0.18);
      return enabled;
    },
    tick(freq = 520) {
      if (!enabled || !ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.035, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.1);
    },
    hoverTick() {
      if (!enabled || !ctx) return;
      const nowMs = performance.now();
      if (nowMs - lastHover < 55) return;
      lastHover = nowMs;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(920, t);
      o.frequency.exponentialRampToValueAtTime(1240, t + 0.032);
      g.gain.setValueAtTime(0.014, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.034);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.036);
    },
    dispose() {
      if (ctx) {
        try { osc1 && osc1.stop(); osc2 && osc2.stop(); ctx.close(); } catch {}
      }
      ctx = null;
      enabled = false;
    }
  };
}

function mountFallback2D({ canvas, onProgress }) {
  let raf = 0;
  let disposed = false;
  const ctx = canvas.getContext('2d');
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  const draw = (t) => {
    if (disposed || !ctx) return;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    ctx.fillStyle = '#070A10';
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.5, cy = h * 0.42, r = Math.min(w, h) * 0.24;
    const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 1.8);
    g.addColorStop(0, 'rgba(165,190,220,0.22)');
    g.addColorStop(1, 'rgba(7,10,16,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(205,220,240,0.38)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t * 0.0003;
      const px = cx + Math.cos(a) * r * 0.72;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    if (onProgress) onProgress(0, 0, { x: 0, y: 0, z: 5.4 }, 0);
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return {
    setTargetProgress() {},
    getTargetProgress() { return 0; },
    setItems() {},
    enterWarp(cb) { if (cb) setTimeout(cb, 320); },
    toggleSound() { return false; },
    resize,
    dispose() { disposed = true; cancelAnimationFrame(raf); }
  };
}

export function mountPortal3D({
  gate,
  canvas,
  cardsLayer,
  onPickItem,
  onProgress,
  onEnterAuto
}) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePtr = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isMobile = window.innerWidth < 768;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: !isMobile,
      powerPreference: 'high-performance',
      stencil: false
    });
  } catch {
    return mountFallback2D({ canvas, onProgress });
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, (canvas.clientWidth || window.innerWidth) / Math.max(canvas.clientHeight || window.innerHeight, 1), 0.1, 60);
  camera.position.set(0, 0.15, 5.5);

  // 1) Fullscreen volumetric mist background
  const bgGeo = new THREE.PlaneGeometry(2, 2);
  const bgMat = new THREE.ShaderMaterial({
    vertexShader: BG_VERT,
    fragmentShader: BG_FRAG,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uWarp: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uRes: { value: new THREE.Vector2(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight) }
    }
  });
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  bgMesh.frustumCulled = false;
  bgMesh.renderOrder = -10;
  scene.add(bgMesh);

  // 2) Hero VAULT X faceted crystal monolith + wireframe cage + dual orbital rings
  const heroGroup = new THREE.Group();
  heroGroup.position.set(0, 0.25, 0);
  scene.add(heroGroup);

  const crystalGeo = buildCrystalGeometry();
  const crystalMat = new THREE.ShaderMaterial({
    vertexShader: CRYSTAL_VERT,
    fragmentShader: CRYSTAL_FRAG,
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uWarp: { value: 0 },
      uPulse: { value: 0 },
      uSpread: { value: 0 }
    }
  });
  const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
  heroGroup.add(crystalMesh);

  const edgeGeo = new THREE.EdgesGeometry(crystalGeo, 14);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xcfe3f5, transparent: true, opacity: 0.24 });
  const cageMesh = new THREE.LineSegments(edgeGeo, edgeMat);
  cageMesh.scale.setScalar(1.022);
  heroGroup.add(cageMesh);

  const ringGeo1 = new THREE.TorusGeometry(2.35, 0.008, 8, 96);
  const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x9fb8d4, transparent: true, opacity: 0.32 });
  const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
  ring1.rotation.set(Math.PI * 0.38, 0.2, 0);
  heroGroup.add(ring1);

  const ringGeo2 = new THREE.TorusGeometry(2.85, 0.005, 8, 96);
  const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xcfe3f5, transparent: true, opacity: 0.16 });
  const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
  ring2.rotation.set(-Math.PI * 0.28, -0.45, 0.3);
  heroGroup.add(ring2);

  // 3) Codrops Circular 3D Gallery — 7 orbiting archive frames (Station 02)
  const CARD_COUNT = 7;
  const ARC_RADIUS = isMobile ? 3.1 : 4.2;
  const ARC_CENTER_Y = -1.55;
  const ARC_CENTER_Z = -6.8;
  const frameGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.55, 1.95));
  const frameMat = new THREE.LineBasicMaterial({ color: 0xb8cee6, transparent: true, opacity: 0.22 });
  const frameMeshes = [];
  for (let i = 0; i < CARD_COUNT; i++) {
    const m = new THREE.LineSegments(frameGeo, frameMat);
    scene.add(m);
    frameMeshes.push(m);
  }

  // 4) Volumetric GPU particle tunnel with reactive temperature
  const pCount = isMobile ? 360 : 880;
  const pPos = new Float32Array(pCount * 3);
  const pScale = new Float32Array(pCount);
  const pPhase = new Float32Array(pCount);
  for (let i = 0; i < pCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const rad = 1.6 + Math.random() * 6.8;
    pPos[i * 3] = Math.cos(angle) * rad;
    pPos[i * 3 + 1] = Math.sin(angle) * rad * 0.72;
    pPos[i * 3 + 2] = -18.0 + Math.random() * 24.0;
    pScale[i] = 0.6 + Math.random() * 2.1;
    pPhase[i] = Math.random() * Math.PI * 2;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('aScale', new THREE.BufferAttribute(pScale, 1));
  pGeo.setAttribute('aPhase', new THREE.BufferAttribute(pPhase, 1));
  const pMat = new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uWarp: { value: 0 },
      uVel: { value: 0 },
      uTemp: { value: 0 },
      uPixelRatio: { value: dpr }
    }
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // 5) Camera spline across 3 stations
  const camCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.22, 5.55),
    new THREE.Vector3(0.55, -0.35, 2.35),
    new THREE.Vector3(-0.25, -1.45, -1.4),
    new THREE.Vector3(0.15, -1.55, -6.2),
    new THREE.Vector3(0.0, -1.55, -12.6)
  ]);
  const lookCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.2, 0.0),
    new THREE.Vector3(0.0, -0.45, -2.2),
    new THREE.Vector3(0.0, -1.55, -6.8),
    new THREE.Vector3(0.0, -1.55, -10.8),
    new THREE.Vector3(0.0, -1.55, -16.5)
  ]);

  const audio = createAmbientAudio();
  let domCards = [];
  let targetP = 0;
  let currentP = 0;
  let prevP = 0;
  let scrollVel = 0;
  let warpTarget = 0;
  let warpVal = 0;
  let lastStation = 0;
  let autoEntered = false;
  let disposed = false;
  let raf = 0;
  let lastTime = performance.now();
  let nmx = 0, nmy = 0, lmx = 0, lmy = 0;

  // Lusion interactive drag physics + Codrops circular arc state
  let dragging = false;
  let lastPtrX = 0, lastPtrY = 0;
  let dragVelX = 0, dragVelY = 0;
  let dragRotX = 0, dragRotY = 0;
  let pulseVal = 0;
  let spreadVal = 0;
  let spreadTarget = 0;
  let arcAngle = 0;
  let arcVel = 0;
  let tempVal = 0;

  const tmpCam = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const tmpProj = new THREE.Vector3();

  function setItems(items) {
    if (!cardsLayer) return;
    cardsLayer.innerHTML = '';
    domCards = [];
    const list = (items || []).slice(0, CARD_COUNT);
    list.forEach((it, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gate-3d-card';
      const safeTitle = (it.naslov || 'Artikel iz arhiva').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      btn.setAttribute('aria-label', (it.brand ? it.brand + ': ' : '') + (it.naslov || 'Artikel'));
      btn.innerHTML =
        '<div class="gate-3d-card-img"><img src="' + it.img.replace(/"/g, '&quot;') + '" alt="' + safeTitle + '" loading="lazy" referrerpolicy="no-referrer"></div>' +
        '<div class="gate-3d-card-meta">' +
          '<span class="gate-3d-card-idx num">0' + (idx + 1) + '</span>' +
          '<span class="gate-3d-card-brand">' + (it.brand || it.kat || 'VAULT X').replace(/</g, '&lt;') + '</span>' +
          '<span class="gate-3d-card-price num">' + it.priceStr + '</span>' +
        '</div>';
      btn.addEventListener('click', () => {
        audio.tick(680);
        if (onPickItem) onPickItem(it.id);
      });
      cardsLayer.appendChild(btn);
      domCards.push({ el: btn });
    });
  }

  function onPointerMove(e) {
    if (finePtr) {
      nmx = (e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      nmy = -((e.clientY / Math.max(window.innerHeight, 1)) * 2 - 1);
    }
    if (dragging) {
      const dx = e.clientX - lastPtrX;
      const dy = e.clientY - lastPtrY;
      lastPtrX = e.clientX;
      lastPtrY = e.clientY;
      if (lastStation === 0) {
        dragVelY += dx * 0.012;
        dragVelX += dy * 0.010;
      } else if (lastStation === 1) {
        arcVel -= dx * 0.008;
      }
    }
  }

  function onPointerDown(e) {
    if (e.target.closest('button, a')) return;
    dragging = true;
    lastPtrX = e.clientX;
    lastPtrY = e.clientY;
    pulseVal = 1.0;
    audio.tick(lastStation === 1 ? 480 : 390);
  }

  function onPointerUp() {
    dragging = false;
  }

  function onPointerOver(e) {
    if (e.target.closest('button, .gate-3d-card')) {
      audio.hoverTick();
    }
  }

  window.addEventListener('mousemove', onPointerMove, { passive: true });
  gate.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  gate.addEventListener('pointerover', onPointerOver, { passive: true });

  function onVisibility() {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!document.hidden && !disposed && !raf) {
      lastTime = performance.now();
      raf = requestAnimationFrame(animate);
    }
  }
  document.addEventListener('visibilitychange', onVisibility);

  function resize() {
    if (disposed) return;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    bgMat.uniforms.uRes.value.set(w, h);
  }

  function animate(now) {
    if (disposed) return;
    const dt = Math.min((now - lastTime) * 0.001, 0.05);
    lastTime = now;
    const t = now * 0.001;

    const damp = 1 - Math.exp(-6.2 * dt);
    prevP = currentP;
    currentP += (targetP - currentP) * damp;
    const instVel = (currentP - prevP) / Math.max(dt, 0.001);
    scrollVel += (instVel - scrollVel) * (1 - Math.exp(-8.0 * dt));

    warpVal += (warpTarget - warpVal) * (1 - Math.exp(-7.5 * dt));
    lmx += (nmx - lmx) * (1 - Math.exp(-5.0 * dt));
    lmy += (nmy - lmy) * (1 - Math.exp(-5.0 * dt));

    // Lusion crystal drag inertia & facet spread
    const dragDecay = Math.exp(-4.5 * dt);
    dragVelX *= dragDecay;
    dragVelY *= dragDecay;
    dragRotX += dragVelX * dt;
    dragRotY += dragVelY * dt;
    pulseVal *= Math.exp(-5.5 * dt);

    const dragMag = Math.hypot(dragVelX, dragVelY);
    const desiredSpread = warpTarget > 0 ? 1.25 : Math.min(1.0, dragMag * 0.18 + Math.min(0.45, Math.abs(scrollVel) * 0.35));
    spreadTarget = desiredSpread;
    spreadVal += (spreadTarget - spreadVal) * (1 - Math.exp(-6.5 * dt));

    // Codrops circular arc orbit velocity
    arcVel *= Math.exp(-4.2 * dt);
    if (!reduced) {
      arcAngle += arcVel * dt + scrollVel * 1.45 * dt + 0.11 * dt;
    }

    // Reactive particle temperature (cold -> silver -> crimson/amber on warp or fast scroll)
    const pClamped = Math.max(0, Math.min(1, currentP));
    const station = pClamped < 0.34 ? 0 : pClamped < 0.74 ? 1 : 2;
    const targetTemp = Math.min(1.0, (station === 0 ? 0.0 : station === 1 ? 0.45 : 0.85) + warpVal * 0.9 + Math.min(0.55, Math.abs(scrollVel) * 0.45));
    tempVal += (targetTemp - tempVal) * (1 - Math.exp(-5.0 * dt));

    // Update shaders
    bgMat.uniforms.uTime.value = t;
    bgMat.uniforms.uScroll.value = currentP;
    bgMat.uniforms.uWarp.value = warpVal;
    bgMat.uniforms.uMouse.value.set(lmx, lmy);

    crystalMat.uniforms.uTime.value = t;
    crystalMat.uniforms.uScroll.value = currentP;
    crystalMat.uniforms.uWarp.value = warpVal;
    crystalMat.uniforms.uPulse.value = pulseVal;
    crystalMat.uniforms.uSpread.value = spreadVal;

    pMat.uniforms.uTime.value = t;
    pMat.uniforms.uScroll.value = currentP;
    pMat.uniforms.uWarp.value = warpVal;
    pMat.uniforms.uVel.value = scrollVel;
    pMat.uniforms.uTemp.value = tempVal;

    if (!reduced) {
      heroGroup.rotation.y = t * 0.16 + lmx * 0.38 + currentP * 2.4 + dragRotY;
      heroGroup.rotation.x = Math.sin(t * 0.24) * 0.08 - lmy * 0.22 + currentP * 0.5 + dragRotX;
      ring1.rotation.z = t * 0.22 + dragRotY * 0.5;
      ring2.rotation.z = -t * 0.15 - dragRotX * 0.4;
      cageMesh.scale.setScalar(1.022 + spreadVal * 0.08);
    }

    camCurve.getPoint(pClamped, tmpCam);
    lookCurve.getPoint(pClamped, tmpLook);
    camera.position.set(tmpCam.x + lmx * 0.34, tmpCam.y + lmy * 0.22, tmpCam.z);
    camera.lookAt(tmpLook);

    const targetFov = 45 + warpVal * 34 + Math.max(0, pClamped - 0.72) * 45;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    if (station !== lastStation) {
      lastStation = station;
      audio.tick(station === 1 ? 440 : station === 2 ? 660 : 340);
    }

    // Project 7 orbiting 3D archive cards with velocity-reactive tilt/skew
    if (domCards.length) {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      const showFactor = Math.max(0, Math.min(1, (pClamped - 0.20) * 4.5)) *
                         Math.max(0, Math.min(1, (0.86 - pClamped) * 5.0));
      const tiltY = Math.max(-22, Math.min(22, scrollVel * 26 + arcVel * 14));
      const skewY = Math.max(-5, Math.min(5, scrollVel * 6.5));

      for (let i = 0; i < domCards.length; i++) {
        const theta = (i / domCards.length) * Math.PI * 2 + arcAngle;
        const ax = Math.sin(theta) * ARC_RADIUS;
        const az = ARC_CENTER_Z + Math.cos(theta) * ARC_RADIUS;
        const ay = ARC_CENTER_Y + Math.sin(t * 0.9 + i * 1.1) * 0.08;

        frameMeshes[i].position.set(ax, ay, az);
        frameMeshes[i].rotation.y = theta;

        tmpProj.set(ax, ay, az);
        const distZ = camera.position.z - az;
        tmpProj.project(camera);
        const visible = showFactor > 0.04 && distZ > 1.2 && distZ < 12.0 && tmpProj.z < 1;
        const el = domCards[i].el;
        if (!visible) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
        } else {
          const sx = (tmpProj.x * 0.5 + 0.5) * w;
          const sy = (-tmpProj.y * 0.5 + 0.5) * h;
          const sc = Math.max(0.52, Math.min(1.06, 4.5 / distZ));
          const distFade = Math.min(1, (distZ - 1.2) * 0.9) * Math.min(1, (12.0 - distZ) * 0.32);
          el.style.transform =
            'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0) translate(-50%,-50%) ' +
            'perspective(900px) rotateY(' + tiltY.toFixed(1) + 'deg) skewY(' + skewY.toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')';
          el.style.opacity = (showFactor * distFade).toFixed(3);
          el.style.pointerEvents = showFactor > 0.45 ? 'auto' : 'none';
        }
      }
    }

    renderer.render(scene, camera);

    if (onProgress) {
      onProgress(pClamped, station, camera.position, scrollVel);
    }

    if (pClamped > 0.95 && !autoEntered && warpTarget === 0) {
      autoEntered = true;
      if (onEnterAuto) onEnterAuto();
    }

    raf = requestAnimationFrame(animate);
  }

  raf = requestAnimationFrame(animate);

  return {
    setTargetProgress(nextP) {
      targetP = Math.max(0, Math.min(1, nextP));
    },
    getTargetProgress() {
      return targetP;
    },
    setItems,
    toggleSound() {
      return audio.toggle();
    },
    enterWarp(onDone) {
      warpTarget = 1;
      spreadTarget = 1.25;
      audio.tick(740);
      if (reduced) {
        if (onDone) onDone();
      } else {
        setTimeout(() => { if (onDone) onDone(); }, 520);
      }
    },
    resize,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onPointerMove);
      gate.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      gate.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('visibilitychange', onVisibility);
      audio.dispose();
      bgGeo.dispose(); bgMat.dispose();
      crystalGeo.dispose(); crystalMat.dispose();
      edgeGeo.dispose(); edgeMat.dispose();
      ringGeo1.dispose(); ringMat1.dispose();
      ringGeo2.dispose(); ringMat2.dispose();
      frameGeo.dispose(); frameMat.dispose();
      pGeo.dispose(); pMat.dispose();
      renderer.dispose();
    }
  };
}
