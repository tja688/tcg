import * as THREE from 'three';

// 卡面专用 ShaderMaterial：溶解消亡、受击闪色、传说流光、疲劳去饱和
export function makeCardFaceMaterial(mapTex, noiseTex) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uMap: { value: mapTex },
      uNoise: { value: noiseTex },
      uDissolve: { value: 0 },
      uFlash: { value: 0 },
      uFlashColor: { value: new THREE.Color(1.35, 1.32, 1.2) },
      uFoil: { value: 0 },
      uDesat: { value: 0 },
      uOpacity: { value: 1 },
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
      uniform sampler2D uMap;
      uniform sampler2D uNoise;
      uniform float uDissolve;
      uniform float uFlash;
      uniform vec3 uFlashColor;
      uniform float uFoil;
      uniform float uDesat;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        vec4 tex = texture2D(uMap, vUv);
        if (tex.a < 0.02) discard;

        float n = texture2D(uNoise, vUv * 1.7).r;
        float d = uDissolve * 1.12;
        if (n < d) discard;
        float edge = 1.0 - smoothstep(d, d + 0.09, n);

        vec3 col = tex.rgb;

        if (uFoil > 0.001) {
          float sweep = sin((vUv.x * 1.35 + vUv.y * 0.7) * 6.4 - uTime * 1.85);
          float band = smoothstep(0.28, 0.92, sweep) * smoothstep(1.05, 0.5, sweep);
          float sweep2 = sin((vUv.x - vUv.y) * 9.0 + uTime * 0.95);
          float band2 = smoothstep(0.72, 1.0, sweep2);
          vec3 iri = vec3(
            0.62 + 0.38 * sin(uTime * 0.9 + vUv.y * 7.0),
            0.48 + 0.42 * sin(uTime * 1.15 + vUv.x * 6.0 + 2.0),
            0.88 + 0.12 * sin(uTime * 0.7 + 4.0)
          );
          col += iri * (band * 0.24 + band2 * 0.09) * uFoil;
          float rim = 1.0 - smoothstep(0.0, 0.075, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
          col += vec3(1.0, 0.78, 0.32) * rim * 0.28 * uFoil;
        }

        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(lum) * 0.82, uDesat * 0.6);

        col = mix(col, uFlashColor, uFlash);
        col += edge * vec3(2.6, 1.0, 0.28) * step(0.001, uDissolve);

        gl_FragColor = vec4(col, tex.a * uOpacity);
      }
    `,
  });
}
