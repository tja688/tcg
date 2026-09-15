import * as THREE from 'three';
import { gsap } from 'gsap';

// 全屏战斗调色：暗角 / 饱和 / 闪光 / 色偏 / 色散 / 冲击波畸变 / 宽银幕
export const CombatGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 1.22 },
    uSat: { value: 1.1 },
    uLift: { value: 0.012 },
    uFlash: { value: 0 },
    uTint: { value: new THREE.Vector3(1, 0.55, 0.28) },
    uTintAmt: { value: 0 },
    uAberration: { value: 0 },
    uShock: { value: 0 },
    uShockRadius: { value: 0.2 },
    uContrast: { value: 0 },
    uLetterbox: { value: 0 },
    uTime: { value: 0 },
    uGrain: { value: 0.028 },
    uTemperature: { value: 0.06 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uSat;
    uniform float uLift;
    uniform float uFlash;
    uniform vec3 uTint;
    uniform float uTintAmt;
    uniform float uAberration;
    uniform float uShock;
    uniform float uShockRadius;
    uniform float uContrast;
    uniform float uLetterbox;
    uniform float uTime;
    uniform float uGrain;
    uniform float uTemperature;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 c = vec2(0.5, 0.46);
      vec2 dir = vUv - c;
      float dist = length(dir);
      vec2 nd = dist > 1e-4 ? dir / dist : vec2(0.0);
      float r2 = dot(dir, dir);

      float ring = 1.0 - smoothstep(0.0, 0.07, abs(dist - uShockRadius));
      vec2 uv = vUv + nd * ring * uShock * 0.042;

      vec2 ca = dir * r2 * uAberration * 0.018 + dir * uAberration * 0.006;
      float r = texture2D(tDiffuse, uv + ca).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - ca).b;
      vec3 col = vec3(r, g, b);

      col *= smoothstep(1.04, 0.30, dist * uVignette);
      col = mix(vec3(0.5), col, 1.0 + uContrast);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat) + uLift;
      col.r += uTemperature * 0.1;
      col.b -= uTemperature * 0.1;
      col = mix(col, col * uTint, clamp(uTintAmt, 0.0, 1.0));
      col += uFlash * vec3(0.92, 0.78, 0.58);

      if (uGrain > 0.0004) {
        float grain = hash12(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 137.0) - 0.5;
        col += grain * uGrain;
      }

      float lb = uLetterbox;
      float mask = step(lb, vUv.y) * step(lb, 1.0 - vUv.y);
      col *= mask;

      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};

function decayToward(cur, target, dt, halfLife) {
  const k = 1 - Math.pow(0.5, dt / Math.max(halfLife, 1e-4));
  return cur + (target - cur) * k;
}

// 镜头创伤震屏 + 全屏后期脉冲 + 受击停顿
export class ScreenFx {
  constructor({ grade, bloom, camera, bleedEl = null }) {
    this.grade = grade;
    this.bloom = bloom;
    this.camera = camera;
    this.bleedEl = bleedEl;
    this.u = grade.uniforms;
    this.base = {
      vignette: 1.22,
      sat: 1.1,
      lift: 0.012,
      bloom: bloom.strength,
      fov: camera.fov,
      grain: 0.028,
      temperature: 0.06,
    };
    this.trauma = 0;
    this.kick = new THREE.Vector3();
    this.dir = new THREE.Vector3();
    this.roll = 0;
    this.fovKick = 0;
    this.time = 0;
    this._stopping = false;
  }

  reset() {
    gsap.killTweensOf([
      this.u.uFlash, this.u.uTintAmt, this.u.uAberration,
      this.u.uShock, this.u.uShockRadius, this.u.uContrast,
      this.u.uLetterbox, this.u.uVignette, this.u.uSat, this.bloom,
    ]);
    this.u.uFlash.value = 0;
    this.u.uTintAmt.value = 0;
    this.u.uAberration.value = 0;
    this.u.uShock.value = 0;
    this.u.uContrast.value = 0;
    this.u.uLetterbox.value = 0;
    this.u.uVignette.value = this.base.vignette;
    this.u.uSat.value = this.base.sat;
    this.u.uGrain.value = this.base.grain;
    this.u.uTemperature.value = this.base.temperature;
    this.bloom.strength = this.base.bloom;
    this.trauma = 0;
    this.kick.set(0, 0, 0);
    this.roll = 0;
    this.fovKick = 0;
    this.camera.fov = this.base.fov;
    this.camera.updateProjectionMatrix();
    if (this.bleedEl) this.bleedEl.style.opacity = '0';
  }

  // mag 沿用旧接口数值（0.15~0.55）；opts.dir 为世界方向
  shake(mag = 0.2, opts = {}) {
    this.trauma = Math.min(1, this.trauma + mag * 2.15);
    if (opts.dir) this.dir.copy(opts.dir).normalize();
    const p = mag * 0.55;
    this.kick.x += (this.dir.x || (Math.random() - 0.5)) * p;
    this.kick.y += 0.35 * p;
    this.kick.z += (this.dir.z || (Math.random() - 0.5)) * p * 0.6;
    this.roll += (Math.random() > 0.5 ? 1 : -1) * mag * 0.22;
    this.fovKick += opts.fov ?? mag * 7.5;
  }

  shockwave(strength = 1) {
    gsap.killTweensOf([this.u.uShock, this.u.uShockRadius]);
    this.u.uShock.value = 0.95 * strength;
    this.u.uShockRadius.value = 0.04;
    gsap.to(this.u.uShockRadius, { value: 0.88, duration: 0.4, ease: 'power2.out' });
    gsap.to(this.u.uShock, { value: 0, duration: 0.4, ease: 'power2.in' });
  }

  setLetterbox(value, duration = 0.45) {
    gsap.to(this.u.uLetterbox, { value, duration, ease: 'power2.inOut', overwrite: 'auto' });
  }

  bleed(amount = 0.55) {
    if (!this.bleedEl || amount <= 0) return;
    gsap.killTweensOf(this.bleedEl);
    gsap.fromTo(this.bleedEl, { opacity: Math.min(0.92, amount) }, {
      opacity: 0, duration: 0.48, ease: 'power2.out', overwrite: 'auto',
    });
  }

  async hitStop(ms = 40) {
    if (ms <= 0 || this._stopping) return;
    this._stopping = true;
    const prev = gsap.globalTimeline.timeScale() || 1;
    gsap.globalTimeline.timeScale(0.06);
    await new Promise((r) => setTimeout(r, ms));
    gsap.globalTimeline.timeScale(prev);
    this._stopping = false;
  }

  punch({
    flash = 0,
    tint = null,
    tintAmt = 0,
    aberration = 0,
    shock = false,
    contrast = 0,
    bloom = 0,
    vignette = 0,
    letterbox = 0,
    shake = 0,
    fov = null,
    bleed = 0,
    hitstop = 0,
    duration = 0.32,
  } = {}) {
    if (flash) {
      gsap.fromTo(this.u.uFlash, { value: Math.min(flash, 0.055) }, {
        value: 0, duration: duration * 0.7, ease: 'power2.out', overwrite: 'auto',
      });
    }
    if (tint) {
      const c = tint.isColor ? tint : new THREE.Color(tint);
      this.u.uTint.value.set(c.r, c.g, c.b);
      gsap.fromTo(this.u.uTintAmt, { value: tintAmt }, {
        value: 0, duration, ease: 'power2.out', overwrite: 'auto',
      });
    }
    if (aberration) {
      gsap.fromTo(this.u.uAberration, { value: aberration }, {
        value: 0, duration: duration * 0.85, ease: 'power2.out', overwrite: 'auto',
      });
    }
    if (contrast) {
      gsap.fromTo(this.u.uContrast, { value: contrast }, {
        value: 0, duration, ease: 'power2.out', overwrite: 'auto',
      });
    }
    if (bloom) {
      gsap.fromTo(this.bloom, { strength: this.base.bloom + Math.min(bloom, 0.14) }, {
        strength: this.base.bloom, duration, ease: 'power2.out', overwrite: 'auto',
      });
    }
    if (vignette) {
      gsap.fromTo(this.u.uVignette, { value: this.base.vignette + vignette }, {
        value: this.base.vignette, duration: duration * 1.2, ease: 'power2.out', overwrite: 'auto',
      });
    }
    if (letterbox) {
      gsap.fromTo(this.u.uLetterbox, { value: letterbox }, {
        value: 0, duration: 0.7, ease: 'power2.inOut', overwrite: 'auto',
      });
    }
    if (shock) this.shockwave(typeof shock === 'number' ? shock : 1);
    if (shake) this.shake(shake, { fov });
    if (bleed) this.bleed(bleed);
    if (hitstop) this.hitStop(hitstop);
  }

  cinematicWin() {
    this.u.uTint.value.set(1.15, 0.88, 0.42);
    gsap.to(this.u.uTintAmt, { value: 0.28, duration: 0.4, overwrite: 'auto' });
    gsap.to(this.u.uLetterbox, { value: 0.09, duration: 0.5, overwrite: 'auto' });
    gsap.to(this.bloom, { strength: this.base.bloom + 0.16, duration: 0.45, overwrite: 'auto' });
    gsap.to(this.u.uSat, { value: 1.22, duration: 0.4, overwrite: 'auto' });
  }

  cinematicLose() {
    gsap.to(this.u.uSat, { value: 0.42, duration: 0.7, overwrite: 'auto' });
    gsap.to(this.u.uVignette, { value: 1.72, duration: 0.7, overwrite: 'auto' });
    gsap.to(this.u.uLetterbox, { value: 0.11, duration: 0.55, overwrite: 'auto' });
    gsap.to(this.u.uContrast, { value: -0.12, duration: 0.6, overwrite: 'auto' });
    this.bleed(0.4);
  }

  applyCamera(camPos, pointerCur, camTarget) {
    const t = this.time * 58;
    const mag = this.trauma * this.trauma * 0.92;
    const nx = Math.sin(t * 1.71) * Math.cos(t * 3.13);
    const ny = Math.sin(t * 2.27) * Math.cos(t * 1.93);
    const nz = Math.sin(t * 2.88) * Math.cos(t * 1.41);
    this.camera.position.set(
      camPos.x + pointerCur.x * 0.55 + this.kick.x + nx * mag + this.dir.x * mag * 0.35,
      camPos.y + pointerCur.y * -0.3 + this.kick.y + ny * mag * 0.62,
      camPos.z + this.kick.z + nz * mag * 0.38 + this.dir.z * mag * 0.2,
    );
    this.camera.lookAt(camTarget);
    this.camera.rotateZ(this.roll);
    const fov = this.base.fov + this.fovKick;
    if (Math.abs(this.camera.fov - fov) > 0.02) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  update(dt) {
    this.time += dt;
    this.u.uTime.value = this.time;
    this.trauma = decayToward(this.trauma, 0, dt, 0.09);
    this.kick.multiplyScalar(Math.pow(0.0016, dt));
    this.roll = decayToward(this.roll, 0, dt, 0.08);
    this.fovKick = decayToward(this.fovKick, 0, dt, 0.07);
  }
}
