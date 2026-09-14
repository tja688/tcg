import * as THREE from 'three';

// 卡面专用 ShaderMaterial：支持溶解消亡、受击闪白、传说流光、疲劳去饱和
export function makeCardFaceMaterial(mapTex, noiseTex) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uMap: { value: mapTex },
      uNoise: { value: noiseTex },
      uDissolve: { value: 0 },
      uFlash: { value: 0 },
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
      uniform float uFoil;
      uniform float uDesat;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        vec4 tex = texture2D(uMap, vUv);
        if (tex.a < 0.02) discard;

        // 溶解
        float n = texture2D(uNoise, vUv * 1.7).r;
        float d = uDissolve * 1.12;
        if (n < d) discard;
        float edge = 1.0 - smoothstep(d, d + 0.09, n);

        vec3 col = tex.rgb;

        // 传说卡流光
        if (uFoil > 0.001) {
          float sweep = sin((vUv.x + vUv.y) * 5.0 - uTime * 1.6);
          float band = smoothstep(0.55, 0.98, sweep);
          vec3 iri = vec3(
            0.55 + 0.45 * sin(uTime * 0.9 + vUv.y * 7.0),
            0.5 + 0.4 * sin(uTime * 1.1 + vUv.x * 6.0 + 2.0),
            0.9
          );
          col += iri * band * 0.16 * uFoil;
        }

        // 疲劳去饱和
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(lum) * 0.82, uDesat * 0.6);

        // 受击闪白
        col = mix(col, vec3(1.35), uFlash);

        // 溶解边缘灼烧
        col += edge * vec3(2.6, 1.0, 0.28) * step(0.001, uDissolve);

        gl_FragColor = vec4(col, tex.a * uOpacity);
      }
    `,
  });
}
