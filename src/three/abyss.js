import * as THREE from 'three';

// 远景板下沿接一段噪波裙边，溶进深渊，避免矩形切边。

function hash21Glsl() {
  return /* glsl */`
    float abHash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float abNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = abHash(i);
      float b = abHash(i + vec2(1.0, 0.0));
      float c = abHash(i + vec2(0.0, 1.0));
      float d = abHash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    float abFbm(vec2 p) {
      return abNoise(p) * 0.57 + abNoise(p * 2.17 + 3.1) * 0.29 + abNoise(p * 5.3) * 0.14;
    }
  `;
}

export function addBackdropFadeY(geo) {
  const pos = geo.attributes.position;
  const fade = new Float32Array(pos.count);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(1e-4, maxY - minY);
  for (let i = 0; i < pos.count; i++) fade[i] = (pos.getY(i) - minY) / span;
  geo.setAttribute('fadeY', new THREE.BufferAttribute(fade, 1));
  return geo;
}

export function bindBackdropAbyssFade(mesh, env) {
  const mat = mesh.material;
  const uAbyss = { value: new THREE.Color(env?.bg ?? 0x05030c) };
  const uTime = { value: 0 };
  mat.userData.uAbyss = uAbyss;
  mat.userData.uTime = uTime;
  mat.customProgramCacheKey = () => 'backdrop-abyss-fade-v4';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uAbyss = uAbyss;
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float fadeY;\nvarying float vFadeY;',
      )
      .replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\nvFadeY = fadeY;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uAbyss;
        varying float vFadeY;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float fade = smoothstep(0.0, 0.055, vFadeY);
          diffuseColor.rgb = mix(uAbyss, diffuseColor.rgb, fade);
        }`,
      );
    mat.userData.shader = shader;
  };
}

export function tintBackdropAbyss(mesh, env) {
  mesh?.material?.userData?.uAbyss?.value.setHex(env.bg);
}

export function tickBackdropAbyss(mesh, t) {
  if (mesh?.material?.userData?.uTime) mesh.material.userData.uTime.value = t;
}

function lipColor(env) {
  const a = new THREE.Color(env.fog);
  const b = new THREE.Color(env.bg);
  return a.lerp(b, 0.28);
}

function makeSkirt() {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      uAbyss: { value: new THREE.Color(0x05030c) },
      uLip: { value: new THREE.Color(0x1a1224) },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      uniform vec3 uAbyss;
      uniform vec3 uLip;
      uniform float uTime;
      ${hash21Glsl()}
      void main() {
        float n = abFbm(vec2(vUv.x * 4.6, vUv.y * 1.8 + uTime * 0.035));
        float n2 = abNoise(vec2(vUv.x * 11.0 + 2.4, vUv.y * 4.8));
        float ridge = 0.82 + (n - 0.5) * 0.26 + (n2 - 0.5) * 0.1;
        float fade = smoothstep(0.0, max(0.22, ridge), vUv.y);
        fade = pow(clamp(fade, 0.0, 1.0), 1.15);
        vec3 col = mix(uAbyss, uLip, fade);
        float alpha = mix(0.0, 1.0, smoothstep(0.0, 0.14 + n * 0.08, vUv.y));
        alpha *= mix(0.4, 1.0, fade);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(112, 24), mat);
  mesh.position.set(0, -24.6, -12.8);
  mesh.rotation.x = -0.2;
  mesh.renderOrder = -9;
  return mesh;
}

function makeWellDisc() {
  const geo = new THREE.CircleGeometry(46, 80);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      uAbyss: { value: new THREE.Color(0x05030c) },
      uRim: { value: new THREE.Color(0x2a1824) },
    },
    vertexShader: /* glsl */`
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec2 vLocal;
      uniform vec3 uAbyss;
      uniform vec3 uRim;
      void main() {
        float r = length(vLocal);
        float rim = smoothstep(9.0, 11.2, r) * (1.0 - smoothstep(12.0, 21.0, r));
        float pit = smoothstep(8.6, 16.0, r);
        vec3 col = mix(uAbyss, uRim, rim * 0.72);
        float alpha = pit * (0.18 + rim * 0.32);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.05;
  mesh.renderOrder = -8;
  return mesh;
}

function makeMotes(assets) {
  const n = 96;
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 10.6 + Math.random() * 15;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = -0.4 - Math.random() * 13;
    pos[i * 3 + 2] = Math.sin(a) * r * 0.72 - 1.2;
    vel[i] = 0.22 + Math.random() * 0.55;
    seed[i] = Math.random() * Math.PI * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(g, new THREE.PointsMaterial({
    map: assets.glowTex,
    color: 0x6a4058,
    size: 0.14,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    fog: true,
  }));
  points.userData = { vel, seed };
  points.renderOrder = -7;
  return points;
}

export function createAbyssLayer(scene, assets) {
  const group = new THREE.Group();
  group.name = 'abyssLayer';
  const disc = makeWellDisc();
  const skirt = makeSkirt();
  const motes = makeMotes(assets);
  group.add(disc, skirt, motes);
  scene.add(group);

  return {
    group,
    applyEnv(env) {
      const abyss = env.bg;
      disc.material.uniforms.uAbyss.value.setHex(abyss);
      disc.material.uniforms.uRim.value.setHex(env.fog);
      skirt.material.uniforms.uAbyss.value.setHex(abyss);
      skirt.material.uniforms.uLip.value.copy(lipColor(env));
      motes.material.color.setHex(env.ember);
    },
    update(dt, t) {
      skirt.material.uniforms.uTime.value = t;
      const p = motes.geometry.attributes.position;
      const vel = motes.userData.vel;
      const seed = motes.userData.seed;
      for (let i = 0; i < vel.length; i++) {
        let y = p.getY(i) - vel[i] * dt;
        if (y < -14.5) {
          const a = Math.random() * Math.PI * 2;
          const r = 10.6 + Math.random() * 15;
          y = -0.35;
          p.setX(i, Math.cos(a) * r);
          p.setZ(i, Math.sin(a) * r * 0.72 - 1.2);
        }
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t * 0.55 + seed[i]) * dt * 0.08);
      }
      p.needsUpdate = true;
      motes.material.opacity = 0.34 + 0.1 * Math.sin(t * 0.7);
    },
  };
}
