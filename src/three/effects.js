import * as THREE from 'three';
import { gsap } from 'gsap';
import { TextSprite } from '../utils/canvasTex.js';
import {
  spawnSigil, spawnShock, spawnOrb, spawnHalo, spawnSlash,
  spawnBoltMesh, spawnBarrier, spawnInk, spawnBeam, spawnPulse, waitTl,
} from './vfx/kit.js';

const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();

const ELEMENT_TINT = {
  fire: 0xff6a22, lightning: 0xbfe8ff, holy: 0xffe08a,
  shadow: 0x7a3cff, arcane: 0xb45cff, frost: 0x8fe4ff, phys: 0xffb066,
};

function elementColor(element, fallback) {
  return ELEMENT_TINT[element] ?? fallback;
}

// =====================================================================
// 战斗演出特效库。所有 async 方法返回 Promise，供规则引擎串联时序。
// =====================================================================
export class Effects {
  constructor(world, particles, assets, sfx) {
    this.world = world;
    this.scene = world.scene;
    this.particles = particles;
    this.assets = assets;
    this.sfx = sfx;
  }

  screen() { return this.world.screenFx; }

  // ---- 伤害 / 治疗数字 ----
  damageNumber(pos, text, color = '#ff5a4a', amount = 1) {
    const big = amount >= 6;
    const mid = amount >= 4;
    const worldH = big ? 1.38 : mid ? 1.18 : 1.05;
    const ts = new TextSprite({
      text, color,
      font: big ? '900 148px Georgia, "Microsoft YaHei"' : '900 120px Georgia, "Microsoft YaHei"',
      canvasW: 384, canvasH: 256, worldH, strokeWidth: big ? 16 : 14,
    });
    ts.sprite.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.35, 0.35, 0.25));
    ts.sprite.renderOrder = 900;
    this.scene.add(ts.sprite);
    const peakX = ts.sprite.scale.x;
    const peakY = ts.sprite.scale.y;
    const tl = gsap.timeline({
      onComplete: () => { ts.sprite.removeFromParent(); ts.dispose(); },
    });
    tl.fromTo(ts.sprite.scale, { x: 0.22, y: 0.16 }, {
      x: peakX * (big ? 1.18 : 1), y: peakY * (big ? 1.18 : 1),
      duration: 0.18, ease: 'back.out(4)',
    }, 0);
    if (big) {
      tl.to(ts.sprite.scale, { x: peakX, y: peakY, duration: 0.12, ease: 'power2.in' }, 0.18);
    }
    tl.to(ts.sprite.position, {
      y: `+=${big ? 1.35 : 1.15}`,
      x: `+=${(Math.random() - 0.5) * 0.35}`,
      duration: 1.05, ease: 'power1.out',
    }, 0);
    tl.to(ts.material, { opacity: 0, duration: 0.38, ease: 'power2.in' }, 0.64);
  }

  // ---- 地面灼痕 / 法阵残影 ----
  scorch(pos, color = 0xff6a22, scale = 1.7) {
    spawnSigil(this.scene, pos, color, {
      radius: 0.55 + scale * 0.42, duration: 1.35, y: 0.032,
    });
  }

  // ---- 近战斩击弧 ----
  slash(from, to, color = 0xffe0a8) {
    spawnSlash(this.scene, from, to, color);
    const mid = _mid.copy(from).lerp(to, 0.7);
    mid.y += 0.1;
    this.particles.sparks(to, { count: 10, color, speed: 6.2 });
    this.particles.debris(to, { count: 5, color, speed: 3.4 });
    spawnShock(this.scene, to, color, { reach: 2.1, duration: 0.28, lift: 0.12 });
  }

  // ---- 冲击命中 ----
  impact(pos, color = 0xffb066, strength = 1, { feel = true, element = 'phys' } = {}) {
    const tint = elementColor(element, color);
    spawnShock(this.scene, pos, tint, {
      reach: 2.2 + strength * 1.1, duration: 0.38, lift: 0.16 + strength * 0.08,
    });
    if (strength >= 0.7) {
      spawnSigil(this.scene, pos, tint, {
        radius: 0.7 + strength * 0.45, duration: 0.7, y: 0.03,
      });
    }

    if (feel) {
      const flashMat = new THREE.SpriteMaterial({
        map: this.assets.glowTex, color: tint, transparent: true, opacity: 0.28,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const flash = new THREE.Sprite(flashMat);
      flash.position.copy(pos);
      flash.scale.setScalar(0.95 * strength);
      flash.renderOrder = 601;
      this.scene.add(flash);
      gsap.to(flashMat, {
        opacity: 0, duration: 0.22,
        onComplete: () => { flash.removeFromParent(); flashMat.dispose(); },
      });
    }

    this.particles.burst(pos, {
      count: Math.round(14 * strength), speed: 4.6 * strength, color: tint,
      size: 0.24, life: 0.5, gravity: -6, spread: 1,
    });
    this.particles.sparks(pos, {
      count: Math.round(8 * strength), color: tint, speed: 6.4 * strength,
    });
    if (strength >= 1.0) this.particles.smoke(pos, { count: 5, color: tint, size: 0.42 });
    if (strength >= 0.85) this.scorch(pos, tint, 1.2 + strength * 0.4);

    if (feel) {
      const dir = _dir.set(pos.x * 0.15, 0, pos.z * 0.1);
      this.world.shake(0.2 * strength, { dir });
      this.world.pulseArena?.(0.35 * strength);
      this.screen()?.punch({
        flash: 0.03 * strength,
        tint,
        tintAmt: element === 'phys' ? 0.05 : 0.09 * strength,
        aberration: 0.16 * strength,
        bloom: 0.07 * strength,
        shock: strength >= 1.25,
        contrast: 0.04 * strength,
      });
    }
  }

  // ---- 近战突进（在命中瞬间 resolve）----
  async attackLunge(visual, targetPos, { tint = 0xffcf8a, power = 3 } = {}) {
    const g = visual.group;
    const from = g.position.clone();
    const dir = targetPos.clone().sub(from);
    const hitPoint = from.clone().addScaledVector(dir, 0.72);
    visual.setRenderOrder(80);
    this.sfx.whoosh();
    const tl = gsap.timeline();
    tl.to(g.position, {
      x: from.x - dir.x * 0.16, y: from.y + 0.32, z: from.z - dir.z * 0.16,
      duration: 0.15, ease: 'power2.out',
    });
    tl.to(g.rotation, { z: dir.x > 0 ? -0.12 : 0.12, duration: 0.15, ease: 'power2.out' }, 0);
    tl.to(g.position, {
      x: hitPoint.x, y: hitPoint.y + 0.12, z: hitPoint.z,
      duration: 0.11, ease: 'power4.in',
    });
    tl.to(g.rotation, { z: 0, duration: 0.11 }, '<');
    await tl;
    this.slash(from, targetPos, tint);
    this.impact(targetPos, tint, 1.0 + power * 0.05, { element: 'phys' });
    this.sfx.hit();
    if (power >= 6) await this.screen()?.hitStop(52);
    else if (power >= 4) await this.screen()?.hitStop(36);
    else await this.screen()?.hitStop(22);
  }

  async attackRecover(visual, homePos, homeRot) {
    const g = visual.group;
    await gsap.to(g.position, {
      x: homePos.x, y: homePos.y, z: homePos.z, duration: 0.38, ease: 'power2.out',
    });
    g.rotation.set(homeRot.x, homeRot.y, homeRot.z);
    visual.setRenderOrder(10);
  }

  // ---- 弹道（火球 / 暗影 / 奥术）----
  async projectile(from, to, {
    color = 0xff7a26, size = 1, arc = 2.1, element = 'fire', duration = 0.55,
  } = {}) {
    const orb = spawnOrb(this.scene, from, color, { size: 0.28 * size });
    const haloMat = new THREE.SpriteMaterial({
      map: this.assets.glowTex, color, transparent: true, opacity: 0.88,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(1.45 * size);
    halo.renderOrder = 699;
    orb.mesh.add(halo);

    const light = new THREE.PointLight(color, element === 'shadow' ? 12 : 20, 8, 1.9);
    orb.mesh.add(light);
    this.sfx.cue('sfx.effect.whoosh');

    const ctrl = from.clone().add(to).multiplyScalar(0.5).add(new THREE.Vector3(0, arc, 0));
    const curve = new THREE.QuadraticBezierCurve3(from.clone(), ctrl, to.clone());
    const state = { t: 0 };
    let trailAcc = 0;
    await gsap.to(state, {
      t: 1, duration, ease: 'power1.in',
      onUpdate: () => {
        curve.getPoint(state.t, orb.mesh.position);
        const pulse = 1 + 0.14 * Math.sin(state.t * 28);
        orb.mesh.scale.setScalar(0.28 * size * pulse);
        halo.scale.setScalar(1.45 * size * pulse);
        trailAcc += 1;
        if (trailAcc % 2 === 0) {
          this.particles.spawn({
            pos: orb.mesh.position.clone(),
            vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8),
            life: 0.4, size: 0.3 * size, sizeEnd: 0.02, color, gravity: 0.4, drag: 0.9,
            tex: this.assets.streakTex, stretch: 2.2,
          });
        }
        if (element === 'fire' && trailAcc % 5 === 0) {
          this.particles.smoke(orb.mesh.position, { count: 1, color, size: 0.28 * size, life: 0.45 });
        }
      },
    });

    this.impact(to, color, 1.45 * size, { element });
    const impactCue = {
      fire: 'sfx.spell.fire',
      shadow: 'sfx.spell.shadow',
      lightning: 'sfx.spell.lightning',
      holy: 'sfx.spell.holy',
      frost: 'battle.combat.armor_gain',
    }[element] || 'sfx.spell.explode';
    this.sfx.cue(impactCue);
    if (size >= 1.1) await this.screen()?.hitStop(40);
    gsap.to(light, {
      intensity: 0, duration: 0.22,
      onComplete: () => {
        halo.removeFromParent();
        haloMat.dispose();
        orb.dispose();
      },
    });
  }

  async castBolt(kind, from, to) {
    switch (kind) {
      case 'lightning': return this.lightning(to);
      case 'holy': return this.holyBolt(to);
      case 'fireball': return this.projectile(from, to, { color: 0xff7a26, size: 1.22, arc: 2.4, element: 'fire' });
      case 'shadow': return this.projectile(from, to, {
        color: 0x8a4cff, size: 1.05, arc: 1.55, element: 'shadow', duration: 0.66,
      });
      default: return this.projectile(from, to, { color: 0xb45cff, size: 0.88, arc: 1.8, element: 'arcane' });
    }
  }

  _mkBolt(to, { radius, opacity, color = 0xcfe8ff, jitter = 1.1, segs = 9 }) {
    const pts = [];
    const top = to.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 3.8,
      3.4 + Math.random() * 1.2,
      4.2 + Math.random() * 1.4,
    ));
    for (let i = 0; i <= segs; i++) {
      const k = i / segs;
      const p = top.clone().lerp(to, k);
      if (i > 0 && i < segs) {
        p.x += (Math.random() - 0.5) * jitter * (1 - k * 0.5);
        p.z += (Math.random() - 0.5) * jitter * 0.65;
      }
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 40, radius, 7, false);
    return spawnBoltMesh(this.scene, geo, color, opacity);
  }

  // ---- 闪电打击 ----
  async lightning(to) {
    this.sfx.cue('sfx.spell.lightning');
    const bolts = [
      this._mkBolt(to, { radius: 0.07, opacity: 0.88, color: 0xcfe6ff }),
      this._mkBolt(to, { radius: 0.18, opacity: 0.32, color: 0x8ec8ff }),
      this._mkBolt(to, { radius: 0.04, opacity: 0.7, color: 0xd8ecff }),
      this._mkBolt(to, { radius: 0.034, opacity: 0.55, color: 0xb8e0ff, jitter: 2.1, segs: 7 }),
      this._mkBolt(to, { radius: 0.028, opacity: 0.42, color: 0x9fd4ff, jitter: 2.6, segs: 8 }),
    ];

    spawnHalo(this.scene, to, 0x7fb4e6, { size: 1.2, duration: 0.36 });
    spawnSigil(this.scene, to, 0x9fd4ff, { radius: 1.35, duration: 0.58 });
    spawnShock(this.scene, to, 0x9fd4ff, { reach: 2.6, duration: 0.34, lift: 0.16 });

    this.world.shake(0.42);
    this.world.pulseArena?.(0.7);
    this.impact(to, 0x9fd4ff, 1.35, { element: 'lightning', feel: false });
    this.particles.stars(to, { count: 12, color: 0xd8f0ff, speed: 3.4 });
    this.particles.sparks(to, { count: 10, color: 0xe8f4ff, speed: 7 });
    this.screen()?.punch({
      flash: 0.03, tint: 0x9ec8ee, tintAmt: 0.1, aberration: 0.32,
      bloom: 0.1, contrast: 0.05, shock: 0.5, shake: 0.08, hitstop: 28,
    });

    const state = { o: 1 };
    await gsap.to(state, {
      o: 0, duration: 0.42, ease: 'power2.in',
      onUpdate: () => {
        const flicker = state.o * (0.4 + 0.6 * Math.sin(state.o * 58));
        for (const b of bolts) b.mat.uniforms.uFade.value = flicker;
      },
    });
    for (const b of bolts) {
      b.mesh.removeFromParent(); b.mat.dispose(); b.geo.dispose();
    }
  }

  // ---- 圣击（金光落雷）----
  async holyBolt(to) {
    this.sfx.cue('sfx.spell.holy');
    const bolts = [
      this._mkBolt(to, { radius: 0.042, opacity: 0.78, color: 0xf2d080, jitter: 0.7, segs: 6 }),
      this._mkBolt(to, { radius: 0.1, opacity: 0.24, color: 0xe0b24a, jitter: 0.8, segs: 6 }),
    ];
    spawnSigil(this.scene, to, 0xffd166, { radius: 1.05, duration: 0.55 });
    this.particles.stars(to, { count: 12, color: 0xffe08a, speed: 2.4 });
    this.impact(to, 0xffe08a, 1.05, { element: 'holy', feel: false });
    this.screen()?.punch({
      flash: 0.035, tint: 0xf2c86a, tintAmt: 0.12, bloom: 0.1, aberration: 0.2, hitstop: 22,
    });
    const state = { o: 1 };
    await gsap.to(state, {
      o: 0, duration: 0.4, ease: 'power2.in',
      onUpdate: () => {
        for (const b of bolts) {
          b.mat.uniforms.uFade.value = state.o * (0.55 + 0.45 * Math.sin(state.o * 24));
        }
      },
    });
    for (const b of bolts) {
      b.mesh.removeFromParent(); b.mat.dispose(); b.geo.dispose();
    }
  }

  // ---- 治疗 ----
  async heal(pos) {
    this.sfx.cue('battle.combat.heal');
    spawnHalo(this.scene, pos, 0xffe9a8, { size: 1.8, duration: 0.8 });
    const sigil = spawnSigil(this.scene, pos, 0xffe08a, { radius: 1.7, duration: 0.85 });
    spawnBeam(this.scene, pos, 0xfff0c0, { width: 0.85, height: 2.4, duration: 0.65, y: 0.5 });
    this.particles.rise(pos, { count: 24, color: 0xffe08a, size: 0.24, life: 1.25, speed: 1.7 });
    this.particles.stars(pos, { count: 8, color: 0xfff3c4, speed: 1.5, life: 0.75 });
    this.particles.wisps(pos, { count: 8, color: 0xffe08a, speed: 1.1 });
    this.screen()?.punch({ tint: 0xffe08a, tintAmt: 0.08, bloom: 0.08, flash: 0.018 });
    await waitTl(sigil.tl);
  }

  // ---- 霜盾 / 护甲 ----
  async frostShield(pos) {
    this.sfx.cue('battle.combat.armor_gain');
    const barrier = spawnBarrier(this.scene, pos.clone().add(new THREE.Vector3(0, 0.15, 0)), 0x8fe4ff, {
      radius: 1.2, duration: 0.72,
    });
    spawnSigil(this.scene, pos, 0x8fe4ff, { radius: 1.45, duration: 0.7 });
    this.particles.burst(pos, {
      count: 16, speed: 2.4, color: 0xa8ecff, size: 0.2, life: 0.7, gravity: -1, spread: 1.1,
    });
    this.particles.stars(pos, { count: 8, color: 0xd8f6ff, speed: 1.8 });
    this.particles.debris(pos, { count: 6, color: 0xc8f4ff, speed: 2.2 });
    this.screen()?.punch({ tint: 0x8fe4ff, tintAmt: 0.1, bloom: 0.07, flash: 0.016 });
    await waitTl(barrier.tl);
  }

  // ---- 流星火雨（AOE）----
  async firestorm(positions) {
    this.sfx.rumble();
    this.screen()?.punch({
      tint: 0xff4a14, tintAmt: 0.18, vignette: 0.2, letterbox: 0.04,
      bloom: 0.08, contrast: 0.05,
    });
    this.world.shake(0.28);
    this.world.pulseArena?.(0.55);
    if (!positions.length) {
      await new Promise((r) => setTimeout(r, 280));
      return;
    }
    const jobs = positions.map((p, i) => (async () => {
      await new Promise((r) => setTimeout(r, i * 110 + Math.random() * 50));
      const from = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.5, 8.2, -1.2));
      await this.projectile(from, p, { color: 0xff6a22, size: 0.82, arc: 0.35, element: 'fire', duration: 0.42 });
    })());
    await Promise.all(jobs);
    this.screen()?.punch({ shock: 0.85, shake: 0.16, flash: 0.035, bloom: 0.08 });
  }

  // ---- 战吼冲击波 ----
  async roar(pos, color = 0xff5040) {
    this.sfx.roar();
    this.world.shake(0.52);
    this.world.pulseArena?.(1);
    this.screen()?.punch({
      tint: color, tintAmt: 0.16, letterbox: 0.05, shock: 0.9,
      bloom: 0.1, contrast: 0.06, aberration: 0.22, hitstop: 36,
    });
    const shock = spawnShock(this.scene, pos, color, { reach: 8.2, duration: 0.62, lift: 0.46 });
    spawnSigil(this.scene, pos, color, { radius: 3.1, duration: 0.78 });
    spawnBeam(this.scene, pos, color, { width: 1.55, height: 2.8, duration: 0.5, y: 0.4 });
    this.particles.burst(pos, { count: 28, speed: 5.6, color, size: 0.3, life: 0.75, gravity: -3, spread: 1.4 });
    this.particles.sparks(pos, { count: 14, color, speed: 7.2 });
    this.particles.smoke(pos, { count: 8, color, size: 0.55 });
    await waitTl(shock.tl);
  }

  // ---- 召唤落场 ----
  summonImpact(pos, color = 0x9fd4ff) {
    spawnSigil(this.scene, pos, color, { radius: 1.25, duration: 0.62 });
    this.impact(new THREE.Vector3(pos.x, 0.25, pos.z), color, 0.85, { feel: true, element: 'arcane' });
    this.particles.burst(new THREE.Vector3(pos.x, 0.2, pos.z), {
      count: 14, speed: 2.4, color: 0xcbb8ff, size: 0.22, life: 0.5, gravity: -2, spread: 1.2,
    });
    this.sfx.place();
  }

  // ---- 死亡溶解 ----
  async dissolve(visual, { fast = false } = {}) {
    this.sfx.death();
    const pos = visual.group.position.clone();
    this.particles.rise(pos, { count: 18, color: 0xff8a4d, size: 0.2, life: 1.05, speed: 1.45 });
    this.particles.burst(pos, {
      count: 8, speed: 1.6, color: 0x4a3040, size: 0.18, life: 0.7, gravity: -2, spread: 0.9,
    });
    this.particles.smoke(pos, { count: 6, color: 0x4a3040, size: 0.4 });
    this.particles.debris(pos, { count: 7, color: 0xff8a4d, speed: 2.4 });
    visual.setRing('hidden');
    visual.tauntIcon.visible = false;
    gsap.to(visual.backMat, { opacity: 0, duration: fast ? 0.4 : 0.7, ease: 'power1.in' });
    gsap.to(visual.glowMat, { opacity: 0, duration: 0.3 });
    await gsap.to(visual.faceMat.uniforms.uDissolve, {
      value: 1, duration: fast ? 0.45 : 0.75, ease: 'power1.in',
    });
    visual.dispose();
  }

  // ---- 奥术施法涟漪 ----
  async flourish(pos, color = 0xb45cff, { cue = 'sfx.spell.arcane' } = {}) {
    if (cue) this.sfx.cue(cue);
    const sigil = spawnSigil(this.scene, pos, color, { radius: 2.25, duration: 0.68 });
    spawnHalo(this.scene, pos.clone().add(new THREE.Vector3(0, 0.35, 0)), color, { size: 1.7, duration: 0.55 });
    spawnShock(this.scene, pos, color, { reach: 3.4, duration: 0.4, lift: 0.18 });
    spawnPulse(this.scene, pos.clone().add(new THREE.Vector3(0, 0.5, 0)), color, { size: 0.32, duration: 0.48 });
    this.particles.burst(pos, { count: 18, speed: 2.7, color, size: 0.24, life: 0.7, gravity: 0.5, spread: 1 });
    this.particles.stars(pos, { count: 6, color, speed: 1.8, life: 0.55 });
    this.particles.wisps(pos, { count: 6, color, speed: 1.2 });
    this.screen()?.punch({ tint: color, tintAmt: 0.08, bloom: 0.06, flash: 0.014 });
    await waitTl(sigil.tl);
  }

  async shadowDrain(pos) {
    this.sfx.cue('sfx.spell.shadow');
    spawnInk(this.scene, pos, 0x8a4cff, { height: 1.9, radius: 0.95, duration: 0.9 });
    spawnSigil(this.scene, pos, 0x6a2cff, { radius: 1.35, duration: 0.75 });
    spawnHalo(this.scene, pos.clone().add(new THREE.Vector3(0, 0.45, 0)), 0x8a4cff, { size: 2.2, duration: 0.7 });
    this.particles.sink(pos, { count: 18, color: 0x8a4cff, size: 0.2, life: 0.9, speed: 1.3 });
    this.particles.wisps(pos, { count: 8, color: 0x6a2cff, speed: 0.7 });
    this.screen()?.punch({ tint: 0x6a2cff, tintAmt: 0.12, vignette: 0.1, flash: 0.012 });
    await new Promise((r) => setTimeout(r, 320));
  }

  // ---- 胜利金雨 ----
  victoryBurst() {
    this.screen()?.cinematicWin();
    const positions = [
      new THREE.Vector3(-3, 2, 1), new THREE.Vector3(3, 2.5, 0), new THREE.Vector3(0, 3, -2),
      new THREE.Vector3(-1.5, 2.2, -3.5), new THREE.Vector3(2, 2.8, 2.5),
    ];
    positions.forEach((p, i) => {
      setTimeout(() => {
        spawnHalo(this.scene, p, [0xffd166, 0xff8fab, 0x8fd3ff][i % 3], { size: 2.4, duration: 0.9 });
        this.particles.burst(p, {
          count: 28, speed: 5.6, color: [0xffd166, 0xff8fab, 0x8fd3ff][i % 3],
          size: 0.3, life: 1.45, gravity: -4.5, spread: 1, up: 1.2,
        });
        this.particles.stars(p, { count: 8, color: 0xfff0c0, speed: 3.2, life: 0.9 });
      }, i * 200);
    });
  }
}
