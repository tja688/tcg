import * as THREE from 'three';
import { noiseGLSL } from '../shaders/noise.glsl.js';
import { commonGLSL } from '../shaders/common.glsl.js';
import { vfxClock, toColor } from './clock.js';

function shared(extra) {
  return { uTime: vfxClock.uTime, ...extra };
}

function baseMat(opts) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
    ...opts,
  });
}

const STAU = '6.283185307179586';

// =====================================================================
// 地面符文法阵（NatureSigil 精简版）：轨、星、符文、光池
// =====================================================================
const SIGIL_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SIGIL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uQuadSize;
  uniform float uRadius;
  uniform float uGrown;
  uniform float uFront;
  uniform float uFade;
  uniform float uSeed;
  uniform float uOpacity;
  uniform float uGlow;
  uniform float uPulse;
  uniform float uRuneSpin;
  uniform vec3  uColorLine;
  uniform vec3  uColorCore;
  uniform vec3  uColorRune;
  uniform vec3  uColorPool;
  uniform vec3  uColorFront;
  varying vec2  vUv;
  ${noiseGLSL}

  #define STAU ${STAU}

  float rail(float r, float radius, float width, float aa) {
    float w = max(width, aa);
    return (1.0 - smoothstep(0.0, w, abs(r - radius))) * (width / w);
  }

  float polygonEdge(float r, float ang, float sides, float apothem, float rot) {
    float sector = STAU / max(sides, 3.0);
    float a = mod(ang - rot + sector * 0.5, sector) - sector * 0.5;
    return abs(r * cos(a) - apothem);
  }

  float segment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
  }

  float glyph(vec2 p, float id) {
    float d = 1e3;
    if (hash11(id * 1.7 + 0.11) < 0.75) d = min(d, segment(p, vec2(0.0, -0.42), vec2(0.0, 0.42)));
    if (hash11(id * 2.3 + 0.27) < 0.55) d = min(d, segment(p, vec2(-0.3, -0.34), vec2(-0.3, 0.2)));
    if (hash11(id * 3.1 + 0.43) < 0.55) d = min(d, segment(p, vec2(0.3, -0.2), vec2(0.3, 0.34)));
    if (hash11(id * 4.7 + 0.59) < 0.5) d = min(d, segment(p, vec2(-0.32, 0.24), vec2(0.32, 0.24)));
    if (hash11(id * 5.3 + 0.71) < 0.5) d = min(d, segment(p, vec2(-0.32, -0.24), vec2(0.32, -0.24)));
    if (hash11(id * 6.1 + 0.83) < 0.45) d = min(d, segment(p, vec2(-0.3, -0.3), vec2(0.0, 0.05)));
    if (hash11(id * 8.3 + 1.13) < 0.4) d = min(d, segment(p, vec2(-0.28, 0.32), vec2(0.06, -0.02)));
    if (hash11(id * 9.7 + 1.31) < 0.35) d = min(d, abs(length(p - vec2(0.0, -0.12)) - 0.17));
    return 1.0 - smoothstep(0.028, 0.055, d);
  }

  void main() {
    vec2 p = vec2(vUv.x - 0.5, 0.5 - vUv.y) * uQuadSize;
    float r = length(p);
    float ang = atan(p.y, p.x);
    float aa = fwidth(r) + 1e-4;
    float footprint = max(fwidth(p.x), fwidth(p.y));
    float detail = 1.0 - smoothstep(0.02, 0.16, footprint);
    float outer = uRadius;
    if (r > outer + aa * 6.0 + 0.4) discard;

    float open = 1.0 - smoothstep(uGrown - 0.28, uGrown + 0.12, r);
    if (open < 0.002) discard;

    float beat = 1.0 + uPulse;
    float spin = uTime * uRuneSpin * STAU;
    float lines = 0.0;
    lines += rail(r, outer, 0.055, aa) * 1.85;
    lines += rail(r, uRadius * 0.82, 0.07, aa) * 1.45;
    lines += rail(r, uRadius * 0.22, 0.04, aa) * 1.05;

    float tickPhase = fract((ang + spin * 0.35) / STAU * 64.0);
    float tickMask = 1.0 - smoothstep(0.16, 0.34, abs(tickPhase - 0.5) * 2.0);
    lines += tickMask * rail(r, outer - uRadius * 0.028, uRadius * 0.028, aa) * 0.7 * detail;

    float apothem = uRadius * 0.32;
    float rot = uTime * -0.08 * STAU;
    float triA = polygonEdge(r, ang, 3.0, apothem, rot);
    float triB = polygonEdge(r, ang, 3.0, apothem, rot + 1.04719755);
    float star = 1.0 - smoothstep(0.0, max(0.026, aa), min(triA, triB));
    star *= 1.0 - smoothstep(uRadius * 0.62, uRadius * 0.68, r);
    lines += star * 0.95;

    float fa = ang + uTime * 0.12 * STAU;
    float fil = rail(r, uRadius * 0.5 + uRadius * 0.06 * sin(fa * 6.0 + uSeed), 0.018, aa);
    fil += rail(r, uRadius * 0.4 + uRadius * 0.04 * sin(fa * -5.0 + uSeed * 2.0), 0.014, aa) * 0.75;
    lines += fil * 0.85;

    float band = uRadius * 0.9;
    float runes = 0.0;
    if (abs(r - band) < 0.16 && detail > 0.02) {
      float cells = 28.0;
      float around = fract((ang + spin) / STAU) * cells;
      float id = floor(around) + uSeed * 17.0;
      float cellWidth = STAU * band / cells;
      vec2 q = vec2((fract(around) - 0.5) * cellWidth / 0.28, (r - band) / 0.28);
      runes = glyph(q, id) * detail;
      float head = fract((ang + spin) / STAU - uTime * 0.16);
      head = 1.0 - smoothstep(0.0, 0.08, min(head, 1.0 - head));
      runes *= 0.75 + head * 1.1;
    }

    float pool = pow(clamp(1.0 - r / max(uRadius, 0.05), 0.0, 1.0), 2.2) * 0.22;
    pool *= 1.0 + (snoise01(vec3(p * 2.4, uSeed * 3.0 + uTime * 0.18)) - 0.5) * 0.45 * detail;
    float front = (1.0 - smoothstep(0.0, 0.48, abs(r - uGrown))) * uFront;

    vec3 color = mix(uColorLine, uColorCore, clamp(lines * 0.35, 0.0, 1.0)) * lines * beat;
    color += uColorRune * runes * 1.4 * beat;
    color += uColorPool * pool * beat;
    color += uColorFront * front * 1.1;
    color *= uGlow;
    color /= 1.0 + color * 0.05;

    float alpha = clamp(lines * 0.85 + runes * 0.9 + pool + front, 0.0, 1.0);
    alpha *= open * uFade * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

export function makeSigilMaterial({
  color = 0xb45cff, radius = 1.8, seed = Math.random() * 20,
} = {}) {
  const line = toColor(color);
  const core = line.clone().lerp(new THREE.Color(0xfff4dc), 0.28);
  const rune = line.clone().lerp(new THREE.Color(0xfff4c8), 0.25);
  const pool = line.clone().multiplyScalar(0.45);
  const front = line.clone().lerp(new THREE.Color(0xfff4dc), 0.38);
  return baseMat({
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    uniforms: shared({
      uQuadSize: { value: radius * 2.4 },
      uRadius: { value: radius },
      uGrown: { value: 0 },
      uFront: { value: 1 },
      uFade: { value: 1 },
      uSeed: { value: seed },
      uOpacity: { value: 1 },
      uGlow: { value: 1.15 },
      uPulse: { value: 0 },
      uRuneSpin: { value: 0.035 },
      uColorLine: { value: line },
      uColorCore: { value: core },
      uColorRune: { value: rune },
      uColorPool: { value: pool },
      uColorFront: { value: front },
    }),
    vertexShader: SIGIL_VERT,
    fragmentShader: SIGIL_FRAG,
  });
}

// 持续脚环 / 落点：轻量法阵，少符文多轨
export function makeMarkMaterial({ color = 0x59ffb4 } = {}) {
  const mat = makeSigilMaterial({ color, radius: 1.05, seed: 3.7 });
  mat.uniforms.uGrown.value = 1.2;
  mat.uniforms.uFront.value = 0.15;
  mat.uniforms.uGlow.value = 1.25;
  mat.uniforms.uRuneSpin.value = 0.02;
  return mat;
}

// =====================================================================
// 冲击波环（CosmicShock 精简版）：起伏前锋 + 辐条 + 尾迹
// =====================================================================
const SHOCK_VERT = /* glsl */ `
  uniform float uReach;
  uniform float uFront;
  uniform float uWidth;
  uniform float uLift;
  varying vec2  vLocal;
  varying float vPacket;
  void main() {
    vec2 plane = position.xy * uReach;
    float r = length(plane);
    float d = r - uFront;
    float w = max(uWidth, 0.05);
    float packet = exp(-(d * d) / (w * w));
    vLocal = plane;
    vPacket = packet;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(plane, packet * uLift, 1.0);
  }
`;

const SHOCK_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uFront;
  uniform float uWidth;
  uniform float uFade;
  uniform float uSeed;
  uniform float uGlow;
  uniform vec3  uColorHot;
  uniform vec3  uColorBody;
  uniform vec3  uColorCool;
  varying vec2  vLocal;
  varying float vPacket;
  ${noiseGLSL}

  void main() {
    float r = length(vLocal);
    if (r < 0.001) discard;
    vec2 dir = vLocal / r;
    float ang = atan(dir.y, dir.x);
    float footprint = max(fwidth(vLocal.x), fwidth(vLocal.y));
    float detail = 1.0 - smoothstep(0.02, 0.16, footprint);
    float wobble = snoise(vec3(dir * 2.8, uSeed)) * 0.28 * detail;
    float d = r - (uFront + wobble);
    float want = max(uWidth, 0.05);
    float w = max(want, footprint * 1.5);
    float window = exp(-(d * d) / (w * w)) * (want / w);
    if (window < 0.004) discard;

    float drift = uTime * 0.9 + uSeed * 4.0;
    float spokeNoise = snoise(vec3(dir * 3.4, uTime * 0.6 + uSeed)) * 1.6;
    float spokeGain = 0.25 + 1.4 * snoise01(vec3(dir * 6.2, uSeed * 3.0));
    float spokes = pow(0.5 + 0.5 * cos(ang * 22.0 + drift + spokeNoise), 2.3);
    spokes = mix(1.0, 0.28 + spokes * spokeGain * 1.5, detail);
    float lead = exp(-pow((d - w * 0.4) / (w * 0.32), 2.0)) * 1.25 * detail;
    float behind = d < 0.0 ? 0.22 * exp(d / max(uWidth * 2.4, 0.05)) : 0.0;
    behind *= 0.5 + snoise01(vec3(vLocal * 1.7, uSeed * 7.0)) * 0.7;
    float energy = window * spokes + lead + behind;
    if (energy < 0.003) discard;

    vec3 color = mix(uColorCool, uColorBody, clamp(window * spokes * 1.5, 0.0, 1.0));
    color = mix(color, uColorHot, clamp(lead + vPacket * 0.12, 0.0, 1.0));
    color *= uGlow * uFade;
    float alpha = clamp(energy * 0.92, 0.0, 1.0) * uFade;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color * energy, alpha);
  }
`;

export function makeShockMaterial({ color = 0xffb066 } = {}) {
  const body = toColor(color);
  const hot = body.clone().lerp(new THREE.Color(0xfff2d6), 0.38);
  const cool = body.clone().multiplyScalar(0.28);
  return baseMat({
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    uniforms: shared({
      uReach: { value: 6 },
      uFront: { value: 0.15 },
      uWidth: { value: 0.7 },
      uLift: { value: 0.22 },
      uFade: { value: 1 },
      uSeed: { value: Math.random() * 12 },
      uGlow: { value: 2.05 },
      uColorHot: { value: hot },
      uColorBody: { value: body },
      uColorCool: { value: cool },
    }),
    vertexShader: SHOCK_VERT,
    fragmentShader: SHOCK_FRAG,
  });
}

// =====================================================================
// 能量核：沸腾置换球体 + 丝状核心（ArcaneBloom core）
// =====================================================================
const ORB_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uBoil;
  uniform float uBoilScale;
  varying vec3  vLocal;
  varying vec3  vNormalW;
  varying vec3  vViewDir;
  varying float vDisp;
  ${noiseGLSL}
  void main() {
    vec3 sample_ = normal * uBoilScale + vec3(uSeed * 5.3) - vec3(0.0, uTime * 0.7, 0.0);
    float n = fbm4(sample_) * 0.7 + ridged(sample_ * 1.6, 4) * 0.3;
    vDisp = n;
    vec3 displaced = position + normal * n * uBoil;
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vLocal = normalize(position);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const ORB_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uFade;
  uniform float uIntensity;
  uniform vec3  uColorCore;
  uniform vec3  uColorMid;
  uniform vec3  uColorEdge;
  varying vec3  vLocal;
  varying vec3  vNormalW;
  varying vec3  vViewDir;
  varying float vDisp;
  ${noiseGLSL}
  ${commonGLSL}
  void main() {
    float ndv = clamp(dot(normalize(vNormalW), normalize(vViewDir)), 0.0, 1.0);
    float depth = pow(ndv, 1.55);
    float rim = pow(1.0 - ndv, 2.1) * 0.95;
    vec3 q = vLocal * 4.4 + vec3(0.0, uTime * 0.55, uSeed * 3.1);
    float fil = pow(clamp(ridged(q, 4) * 0.52, 0.0, 1.0), 3.0);
    float energy = depth + rim + fil + vDisp * 0.18;
    vec3 color = gradient4(uColorCore, uColorCore, uColorMid, uColorEdge, 1.0 - depth);
    color *= energy * uIntensity * uFade;
    float alpha = clamp(energy * 0.88, 0.0, 1.0) * uFade;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

export function makeOrbMaterial({ color = 0xff7a26 } = {}) {
  const mid = toColor(color);
  const core = mid.clone().lerp(new THREE.Color(0xfff4dc), 0.38);
  const edge = mid.clone().multiplyScalar(0.35);
  return baseMat({
    uniforms: shared({
      uSeed: { value: Math.random() * 8 },
      uBoil: { value: 0.16 },
      uBoilScale: { value: 2.4 },
      uFade: { value: 1 },
      uIntensity: { value: 1.55 },
      uColorCore: { value: core },
      uColorMid: { value: mid },
      uColorEdge: { value: edge },
    }),
    vertexShader: ORB_VERT,
    fragmentShader: ORB_FRAG,
  });
}

// =====================================================================
// 光晕：射线 + 计时环（ArcaneBloom halo）
// =====================================================================
const HALO_VERT = /* glsl */ `
  uniform float uSize;
  varying vec2 vUv;
  void main() {
    vUv = position.xy;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy * uSize;
    gl_Position = projectionMatrix * mv;
  }
`;

const HALO_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  uniform float uGlow;
  uniform float uOpen;
  uniform vec3  uColorHalo;
  uniform vec3  uColorRing;
  varying vec2  vUv;
  #define HTAU ${STAU}
  void main() {
    vec2 p = vUv * 2.0;
    float r = length(p);
    if (r > 1.0) discard;
    float ang = atan(p.y, p.x);
    float halo = exp(-pow((r - 0.42) / 0.3, 2.0)) * 0.82;
    halo *= smoothstep(0.04, 0.2, r);
    float sweep = ang + uTime * 0.18 * HTAU;
    float ray = pow(clamp(0.5 + 0.5 * cos(sweep * 14.0), 0.0, 1.0), 3.8);
    ray *= smoothstep(0.1, 0.26, r) * (1.0 - smoothstep(0.52, 1.0, r));
    float aa = fwidth(r) + 1e-4;
    float w = max(0.014, aa * 1.5);
    float ringA = (1.0 - smoothstep(0.0, w, abs(r - 0.5))) * (0.014 / w);
    float ringB = (1.0 - smoothstep(0.0, w, abs(r - 0.76))) * (0.014 / w);
    float tick = step(0.55, abs(fract((ang + uTime * -0.08 * HTAU) / HTAU * 40.0) * 2.0 - 1.0));
    ringB *= mix(1.0, tick, 0.75);
    vec3 color = uColorHalo * halo * 0.72;
    color += uColorHalo * ray * 0.55;
    color += uColorRing * (ringA + ringB);
    float alpha = clamp(halo + ray * 0.7 + (ringA + ringB) * 0.8, 0.0, 1.0);
    alpha *= uFade * smoothstep(0.0, 0.28, uOpen);
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color * uGlow, alpha);
  }
`;

export function makeHaloMaterial({ color = 0xffe08a, size = 2.4 } = {}) {
  const halo = toColor(color);
  const ring = halo.clone().lerp(new THREE.Color(0xffffff), 0.35);
  return baseMat({
    depthTest: false,
    uniforms: shared({
      uSize: { value: size },
      uFade: { value: 1 },
      uGlow: { value: 0.82 },
      uOpen: { value: 1 },
      uColorHalo: { value: halo },
      uColorRing: { value: ring },
    }),
    vertexShader: HALO_VERT,
    fragmentShader: HALO_FRAG,
  });
}

// =====================================================================
// 斩击刃：噪声脉络 + 热刃锋
// =====================================================================
const SLASH_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SLASH_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  uniform float uSeed;
  uniform vec3  uColorHot;
  uniform vec3  uColorBody;
  varying vec2  vUv;
  ${noiseGLSL}
  void main() {
    vec2 uv = vUv;
    float x = uv.x;
    float y = uv.y * 2.0 - 1.0;
    float envelope = smoothstep(0.0, 0.12, x) * (1.0 - smoothstep(0.72, 1.0, x));
    float halfW = mix(0.08, 0.42, pow(sin(x * 3.14159), 0.85));
    float blade = 1.0 - smoothstep(0.0, halfW, abs(y));
    if (blade * envelope < 0.01) discard;
    float vein = ridged(vec3(x * 6.5, y * 3.2, uSeed + uTime * 2.4), 4);
    vein = pow(clamp(vein, 0.0, 1.0), 2.6);
    float edge = 1.0 - smoothstep(0.0, 0.18, abs(abs(y) / max(halfW, 1e-3) - 0.82));
    vec3 color = mix(uColorBody, uColorHot, clamp(vein * 0.7 + edge * 0.85 + (1.0 - abs(y)) * 0.25, 0.0, 1.0));
    float alpha = blade * envelope * uFade;
    gl_FragColor = vec4(color * (1.2 + vein * 0.8), alpha);
  }
`;

export function makeSlashMaterial({ color = 0xffe0a8 } = {}) {
  const body = toColor(color);
  const hot = body.clone().lerp(new THREE.Color(0xfff2d6), 0.36);
  return baseMat({
    depthTest: false,
    uniforms: shared({
      uFade: { value: 1 },
      uSeed: { value: Math.random() * 6 },
      uColorHot: { value: hot },
      uColorBody: { value: body },
    }),
    vertexShader: SLASH_VERT,
    fragmentShader: SLASH_FRAG,
  });
}

// =====================================================================
// 闪电管：沿 UV 闪烁的芯 + 外晕
// =====================================================================
const BOLT_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BOLT_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  uniform float uSeed;
  uniform vec3  uColorCore;
  uniform vec3  uColorGlow;
  varying vec2  vUv;
  ${noiseGLSL}
  void main() {
    float along = vUv.x;
    float across = abs(vUv.y * 2.0 - 1.0);
    float flicker = 0.55 + 0.45 * sin(uTime * 62.0 + along * 28.0 + uSeed * 7.0);
    flicker *= 0.7 + 0.3 * snoise01(vec3(along * 18.0, uTime * 9.0, uSeed));
    float core = pow(1.0 - across, 5.5) * flicker;
    float glow = pow(1.0 - across, 1.8) * 0.62 * flicker;
    vec3 color = uColorCore * core * 1.85 + uColorGlow * glow;
    float alpha = clamp(core + glow, 0.0, 1.0) * uFade;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

export function makeBoltMaterial({ color = 0xe8f4ff } = {}) {
  const glow = toColor(color);
  const core = glow.clone().lerp(new THREE.Color(0xf4fbff), 0.36);
  return baseMat({
    depthTest: false,
    uniforms: shared({
      uFade: { value: 1 },
      uSeed: { value: Math.random() * 10 },
      uColorCore: { value: core },
      uColorGlow: { value: glow },
    }),
    vertexShader: BOLT_VERT,
    fragmentShader: BOLT_FRAG,
  });
}

// =====================================================================
// 霜盾膜：菲涅尔冰壳 + voronoi 裂纹
// =====================================================================
const BARRIER_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uThrob;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vWorld;
  void main() {
    vec3 pos = position * (1.0 + uThrob);
    vec4 world = modelMatrix * vec4(pos, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = cameraPosition - world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const BARRIER_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  uniform vec3  uColorIce;
  uniform vec3  uColorCrack;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vWorld;
  ${noiseGLSL}
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewDir);
    float fres = pow(1.0 - abs(dot(N, V)), 2.4);
    vec2 cell = voronoi2(vWorld.xz * 2.8 + vWorld.y * 1.4);
    float crack = 1.0 - smoothstep(0.02, 0.09, cell.x);
    float frost = snoise01(vWorld * 1.8 + vec3(0.0, uTime * 0.15, 0.0));
    vec3 color = uColorIce * (0.18 + fres * 1.35 + frost * 0.12);
    color += uColorCrack * crack * 1.6;
    float alpha = clamp(0.12 + fres * 0.72 + crack * 0.28, 0.0, 1.0) * uFade;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

export function makeBarrierMaterial({ color = 0x8fe4ff } = {}) {
  const ice = toColor(color);
  const crack = ice.clone().lerp(new THREE.Color(0xffffff), 0.55);
  return baseMat({
    blending: THREE.NormalBlending,
    uniforms: shared({
      uThrob: { value: 0 },
      uFade: { value: 1 },
      uColorIce: { value: ice },
      uColorCrack: { value: crack },
    }),
    vertexShader: BARRIER_VERT,
    fragmentShader: BARRIER_FRAG,
  });
}

// =====================================================================
// 暗影墨柱：漏斗噪声，吸收感（非加色）
// =====================================================================
const INK_VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const INK_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  uniform vec3  uColorInk;
  uniform vec3  uColorEdge;
  varying vec3 vWorld;
  varying vec2 vUv;
  ${noiseGLSL}
  void main() {
    float h = vUv.y;
    vec2 q = vWorld.xz * 1.15;
    float ang = atan(q.y, q.x) + uTime * 1.1 + h * 2.4;
    vec2 swirl = rot2(ang * 0.35) * q;
    float n = ridged(vec3(swirl * 1.8, h * 2.2 - uTime * 0.9), 4);
    float dens = pow(clamp(n, 0.0, 1.0), 1.8) * (0.25 + 0.75 * (1.0 - h));
    dens *= smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.78, 1.0, h));
    vec3 color = mix(uColorInk, uColorEdge, clamp(n * 0.55, 0.0, 1.0));
    color += uColorEdge * dens * 0.55;
    float alpha = clamp(dens * 1.05, 0.0, 0.88) * uFade;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

export function makeInkMaterial({ color = 0x8a4cff } = {}) {
  const ink = toColor(color).multiplyScalar(0.7);
  const edge = toColor(color).lerp(new THREE.Color(0xd8b0ff), 0.35);
  return baseMat({
    blending: THREE.NormalBlending,
    uniforms: shared({
      uFade: { value: 1 },
      uColorInk: { value: ink },
      uColorEdge: { value: edge },
    }),
    vertexShader: INK_VERT,
    fragmentShader: INK_FRAG,
  });
}

// =====================================================================
// 垂直光柱：相机对齐，俯视也能读出体积
// =====================================================================
const BEAM_VERT = /* glsl */ `
  uniform vec2 uSize;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += (uv - 0.5) * uSize;
    gl_Position = projectionMatrix * mv;
  }
`;

const BEAM_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  uniform float uSeed;
  uniform vec3  uColorCore;
  uniform vec3  uColorGlow;
  varying vec2  vUv;
  ${noiseGLSL}
  void main() {
    float x = abs(vUv.x - 0.5) * 2.0;
    float y = vUv.y;
    float head = smoothstep(0.0, 0.1, y) * (1.0 - smoothstep(0.62, 1.0, y));
    float n = snoise01(vec3(vUv.x * 3.6, y * 5.4 - uTime * 2.8, uSeed));
    float shaft = pow(max(0.0, 1.0 - x), 3.6) * (0.62 + n * 0.4);
    float glow = pow(max(0.0, 1.0 - x), 1.35) * 0.42;
    float energy = (shaft + glow) * head;
    if (energy < 0.012) discard;
    vec3 color = uColorCore * shaft * 0.82 + uColorGlow * glow;
    float alpha = clamp(energy, 0.0, 1.0) * uFade;
    gl_FragColor = vec4(color, alpha);
  }
`;

export function makeBeamMaterial({ color = 0xbfe8ff, width = 1.35, height = 3.6 } = {}) {
  const glow = toColor(color);
  const core = glow.clone().lerp(new THREE.Color(0xfff6e2), 0.34);
  return baseMat({
    depthTest: false,
    uniforms: shared({
      uSize: { value: new THREE.Vector2(width, height) },
      uFade: { value: 1 },
      uSeed: { value: Math.random() * 8 },
      uColorCore: { value: core },
      uColorGlow: { value: glow },
    }),
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
  });
}

// =====================================================================
// 篝火广告牌
// =====================================================================
const FLAME_VERT = /* glsl */ `
  uniform vec2 uSize;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 world = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 toCam = cameraPosition - world;
    toCam.y = 0.0;
    vec3 right = length(toCam) > 0.001
      ? normalize(cross(vec3(0.0, 1.0, 0.0), normalize(toCam)))
      : vec3(1.0, 0.0, 0.0);
    vec3 offset = right * (uv.x - 0.5) * uSize.x + vec3(0.0, uv.y * uSize.y, 0.0);
    gl_Position = projectionMatrix * viewMatrix * vec4(world + offset, 1.0);
  }
`;

const FLAME_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  uniform vec3  uColorHot;
  uniform vec3  uColorMid;
  uniform vec3  uColorCool;
  varying vec2  vUv;
  ${noiseGLSL}
  ${commonGLSL}
  void main() {
    vec2 uv = vUv;
    float n = ridged(vec3(uv.x * 2.4, uv.y * 1.5 - uTime * 1.55, 0.4), 4);
    float shape = smoothstep(0.62, 0.12, length(vec2((uv.x - 0.5) * 2.05, uv.y * 0.52)));
    float fire = clamp(n * shape * (1.12 - uv.y * 0.86), 0.0, 1.0);
    if (fire < 0.02) discard;
    vec3 color = gradient4(uColorHot, uColorMid, uColorCool, vec3(0.12, 0.03, 0.02), 1.0 - fire);
    float alpha = fire * uFade * 0.9;
    gl_FragColor = vec4(color * (0.92 + fire * 0.42), alpha);
  }
`;

export function makeFlameMaterial({ color = 0xff7a2a } = {}) {
  const mid = toColor(color);
  return baseMat({
    uniforms: shared({
      uSize: { value: new THREE.Vector2(0.82, 1.4) },
      uFade: { value: 1 },
      uColorHot: { value: new THREE.Color(1.0, 0.78, 0.42) },
      uColorMid: { value: mid },
      uColorCool: { value: mid.clone().multiplyScalar(0.35) },
    }),
    vertexShader: FLAME_VERT,
    fragmentShader: FLAME_FRAG,
  });
}

// =====================================================================
// GPU 尘埃（DustMotes 精简）
// =====================================================================
const MOTE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec3  uVolume;
  attribute float aSeed;
  varying float vAlpha;
  ${noiseGLSL}
  void main() {
    vec3 p = position;
    float t = uTime * (0.05 + aSeed * 0.06);
    p.y += mod(uTime * (0.1 + aSeed * 0.22), uVolume.y);
    p.y = mod(p.y, uVolume.y);
    p += curlNoise(p * 0.07 + vec3(0.0, t, 0.0)) * 1.15;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    float twinkle = 0.5 + 0.5 * sin(uTime * (1.1 + aSeed * 2.4) + aSeed * 40.0);
    vAlpha = twinkle * smoothstep(42.0, 8.0, dist) * smoothstep(0.4, 3.2, dist);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (0.35 + aSeed * 0.85) / max(dist, 1.0);
  }
`;

const MOTE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAmount;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float a = vAlpha * uAmount * (1.0 - smoothstep(0.12, 0.5, length(d)));
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export function makeMoteMaterial({ color = 0xc8b090 } = {}) {
  return baseMat({
    uniforms: shared({
      uSize: { value: 18 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.75) },
      uVolume: { value: new THREE.Vector3(28, 10, 26) },
      uAmount: { value: 1 },
      uColor: { value: toColor(color) },
    }),
    vertexShader: MOTE_VERT,
    fragmentShader: MOTE_FRAG,
  });
}

// =====================================================================
// 台面符文覆层
// =====================================================================
const ARENA_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ARENA_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uPulse;
  uniform float uOpacity;
  uniform vec3  uColor;
  varying vec2  vUv;
  ${noiseGLSL}
  #define STAU ${STAU}
  float rail(float r, float radius, float width, float aa) {
    float w = max(width, aa);
    return (1.0 - smoothstep(0.0, w, abs(r - radius))) * (width / w);
  }
  void main() {
    vec2 p = (vUv - 0.5) * 18.8;
    float r = length(p);
    float ang = atan(p.y, p.x);
    float aa = fwidth(r) + 1e-4;
    float lines = 0.0;
    lines += rail(r, 8.55, 0.035, aa) * 0.9;
    lines += rail(r, 5.84, 0.028, aa) * 1.1;
    lines += rail(r, 3.1, 0.02, aa) * 0.55;
    float tick = 1.0 - smoothstep(0.18, 0.4, abs(fract((ang + uTime * 0.04) / STAU * 72.0) * 2.0 - 1.0));
    lines += tick * rail(r, 8.42, 0.06, aa) * 0.45;
    float grain = snoise01(vec3(p * 0.35, uTime * 0.08)) * 0.12;
    float alpha = (lines * 0.55 + grain * 0.08) * (0.22 + uPulse * 0.55) * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColor * (0.8 + lines * 0.6), alpha);
  }
`;

export function makeArenaOverlayMaterial({ color = 0x3fe8ff } = {}) {
  return baseMat({
    uniforms: shared({
      uPulse: { value: 0 },
      uOpacity: { value: 1 },
      uColor: { value: toColor(color) },
    }),
    vertexShader: ARENA_VERT,
    fragmentShader: ARENA_FRAG,
  });
}

export function tintMaterial(mat, color) {
  const c = toColor(color);
  const u = mat.uniforms;
  if (u.uColor) u.uColor.value.copy(c);
  if (u.uColorLine) u.uColorLine.value.copy(c);
  if (u.uColorCore) u.uColorCore.value.copy(c.clone().lerp(new THREE.Color(0xfff4dc), 0.28));
  if (u.uColorRune) u.uColorRune.value.copy(c.clone().lerp(new THREE.Color(0xfff4c8), 0.2));
  if (u.uColorPool) u.uColorPool.value.copy(c.clone().multiplyScalar(0.45));
  if (u.uColorFront) u.uColorFront.value.copy(c.clone().lerp(new THREE.Color(0xfff4dc), 0.32));
  if (u.uColorHot) u.uColorHot.value.copy(c.clone().lerp(new THREE.Color(0xfff2d6), 0.34));
  if (u.uColorBody) u.uColorBody.value.copy(c);
  if (u.uColorCool) u.uColorCool.value.copy(c.clone().multiplyScalar(0.3));
  if (u.uColorHalo) u.uColorHalo.value.copy(c);
  if (u.uColorRing) u.uColorRing.value.copy(c.clone().lerp(new THREE.Color(0xffffff), 0.35));
  if (u.uColorMid) u.uColorMid.value.copy(c);
  if (u.uColorEdge) u.uColorEdge.value.copy(c.clone().multiplyScalar(0.35));
  if (u.uColorIce) u.uColorIce.value.copy(c);
  if (u.uColorCrack) u.uColorCrack.value.copy(c.clone().lerp(new THREE.Color(0xffffff), 0.55));
  if (u.uColorInk) u.uColorInk.value.copy(c.clone().multiplyScalar(0.35));
  if (u.uColorGlow) u.uColorGlow.value.copy(c);
  return mat;
}
