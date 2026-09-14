import * as THREE from 'three';
import { gsap } from 'gsap';
import { TextSprite } from '../utils/canvasTex.js';

const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();

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

  // ---- 地面灼痕 ----
  scorch(pos, color = 0xff6a22, scale = 1.7) {
    const mat = new THREE.MeshBasicMaterial({
      map: this.assets.ringTex, color, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.55, 28), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, 0.035, pos.z);
    mesh.renderOrder = 8;
    this.scene.add(mesh);
    gsap.to(mesh.scale, { x: scale, y: scale, z: 1, duration: 0.22, ease: 'power2.out' });
    gsap.to(mat, {
      opacity: 0, duration: 1.45, delay: 0.18, ease: 'power1.in',
      onComplete: () => { mesh.removeFromParent(); mat.dispose(); },
    });
  }

  // ---- 近战斩击弧 ----
  slash(from, to, color = 0xffe0a8) {
    const mid = _mid.copy(from).lerp(to, 0.64);
    mid.y += 0.22;
    const mat = new THREE.MeshBasicMaterial({
      map: this.assets.slashTex, color, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, depthTest: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.62), mat);
    mesh.position.copy(mid);
    mesh.lookAt(to);
    mesh.renderOrder = 720;
    this.scene.add(mesh);
    mesh.scale.set(0.15, 0.7, 1);
    gsap.timeline({
      onComplete: () => { mesh.removeFromParent(); mat.dispose(); },
    })
      .to(mesh.scale, { x: 1, y: 1, duration: 0.1, ease: 'power3.out' }, 0)
      .to(mat, { opacity: 0, duration: 0.22, ease: 'power2.in' }, 0.08);
    this.particles.sparks(to, { count: 8, color, speed: 5.5 });
  }

  // ---- 冲击命中 ----
  impact(pos, color = 0xffb066, strength = 1, { feel = true, element = 'phys' } = {}) {
    const ringMat = new THREE.SpriteMaterial({
      map: this.assets.ringTex, color, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const ring = new THREE.Sprite(ringMat);
    ring.position.copy(pos);
    ring.renderOrder = 600;
    ring.scale.setScalar(0.35);
    this.scene.add(ring);
    gsap.to(ring.scale, { x: 2.7 * strength, y: 2.7 * strength, duration: 0.36, ease: 'power2.out' });
    gsap.to(ringMat, {
      opacity: 0, duration: 0.36, ease: 'power1.out',
      onComplete: () => { ring.removeFromParent(); ringMat.dispose(); },
    });

    const flashMat = new THREE.SpriteMaterial({
      map: this.assets.glowTex, color: 0xffffff, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const flash = new THREE.Sprite(flashMat);
    flash.position.copy(pos);
    flash.scale.setScalar(1.75 * strength);
    flash.renderOrder = 601;
    this.scene.add(flash);
    gsap.to(flashMat, {
      opacity: 0, duration: 0.2,
      onComplete: () => { flash.removeFromParent(); flashMat.dispose(); },
    });

    this.particles.burst(pos, {
      count: Math.round(12 * strength), speed: 4.4 * strength, color,
      size: 0.24, life: 0.48, gravity: -6, spread: 1,
    });
    this.particles.sparks(pos, {
      count: Math.round(7 * strength), color, speed: 6 * strength,
    });
    if (strength >= 0.85) this.scorch(pos, color, 1.35 + strength * 0.45);

    if (feel) {
      const dir = _dir.set(pos.x * 0.15, 0, pos.z * 0.1);
      this.world.shake(0.2 * strength, { dir });
      this.world.pulseArena?.(0.35 * strength);
      const tintMap = {
        fire: 0xff6a22, lightning: 0xbfe8ff, holy: 0xffe08a,
        shadow: 0x7a3cff, arcane: 0xb45cff, frost: 0x8fe4ff, phys: color,
      };
      this.screen()?.punch({
        flash: 0.08 * strength,
        tint: tintMap[element] || color,
        tintAmt: element === 'phys' ? 0.08 : 0.16 * strength,
        aberration: 0.28 * strength,
        bloom: 0.16 * strength,
        shock: strength >= 1.25,
        contrast: 0.08 * strength,
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
    const group = new THREE.Group();
    const coreMat = new THREE.SpriteMaterial({
      map: this.assets.glowTex, color: 0xfff2cc, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const core = new THREE.Sprite(coreMat);
    core.scale.setScalar(0.55 * size);
    core.renderOrder = 700;
    const haloMat = new THREE.SpriteMaterial({
      map: this.assets.glowTex, color, transparent: true, opacity: 0.88,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(1.4 * size);
    halo.renderOrder = 699;
    group.add(halo, core);
    group.position.copy(from);

    const light = new THREE.PointLight(color, element === 'shadow' ? 18 : 36, 9, 1.9);
    group.add(light);
    this.scene.add(group);
    this.sfx.cast();

    const ctrl = from.clone().add(to).multiplyScalar(0.5).add(new THREE.Vector3(0, arc, 0));
    const curve = new THREE.QuadraticBezierCurve3(from.clone(), ctrl, to.clone());
    const state = { t: 0 };
    let trailAcc = 0;
    await gsap.to(state, {
      t: 1, duration, ease: 'power1.in',
      onUpdate: () => {
        curve.getPoint(state.t, group.position);
        const pulse = 1 + 0.12 * Math.sin(state.t * 28);
        core.scale.setScalar(0.55 * size * pulse);
        halo.scale.setScalar(1.4 * size * pulse);
        trailAcc += 1;
        if (trailAcc % 2 === 0) {
          this.particles.spawn({
            pos: group.position.clone(),
            vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8),
            life: 0.38, size: 0.28 * size, sizeEnd: 0.02, color, gravity: 0.4, drag: 0.9,
            tex: this.assets.streakTex, stretch: 2.1,
          });
        }
      },
    });

    this.impact(to, color, 1.45 * size, { element });
    this.sfx.boom();
    if (size >= 1.1) await this.screen()?.hitStop(40);
    gsap.to(light, {
      intensity: 0, duration: 0.28,
      onComplete: () => {
        group.removeFromParent();
        coreMat.dispose(); haloMat.dispose();
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
    const top = to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 8.5, (Math.random() - 0.5) * 1.2));
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
    const geo = new THREE.TubeGeometry(curve, 36, radius, 6, false);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 700;
    this.scene.add(mesh);
    return { mesh, mat, geo };
  }

  // ---- 闪电打击 ----
  async lightning(to) {
    this.sfx.zap();
    const bolts = [
      this._mkBolt(to, { radius: 0.06, opacity: 1, color: 0xe8f4ff }),
      this._mkBolt(to, { radius: 0.16, opacity: 0.32, color: 0x8ec8ff }),
      this._mkBolt(to, { radius: 0.035, opacity: 0.95, color: 0xffffff }),
      this._mkBolt(to, { radius: 0.028, opacity: 0.7, color: 0xb8e0ff, jitter: 2.1, segs: 7 }),
    ];

    const flashMat = new THREE.SpriteMaterial({
      map: this.assets.glowTex, color: 0xbfe0ff, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const flash = new THREE.Sprite(flashMat);
    flash.position.copy(to);
    flash.scale.setScalar(3.3);
    flash.renderOrder = 701;
    this.scene.add(flash);

    this.world.shake(0.42);
    this.world.pulseArena?.(0.7);
    this.impact(to, 0x9fd4ff, 1.35, { element: 'lightning', feel: false });
    this.particles.stars(to, { count: 10, color: 0xd8f0ff, speed: 3.2 });
    this.screen()?.punch({
      flash: 0.16, tint: 0xb8e6ff, tintAmt: 0.2, aberration: 0.72,
      bloom: 0.34, contrast: 0.14, shock: 0.85, shake: 0.12, hitstop: 48,
    });

    const state = { o: 1 };
    await gsap.to(state, {
      o: 0, duration: 0.4, ease: 'power2.in',
      onUpdate: () => {
        const flicker = state.o * (0.45 + 0.55 * Math.sin(state.o * 52));
        for (const b of bolts) b.mat.opacity = flicker;
        flashMat.opacity = state.o;
      },
    });
    for (const b of bolts) {
      b.mesh.removeFromParent(); b.mat.dispose(); b.geo.dispose();
    }
    flash.removeFromParent();
    flashMat.dispose();
  }

  // ---- 圣击（金光落雷）----
  async holyBolt(to) {
    this.sfx.zap();
    const bolts = [
      this._mkBolt(to, { radius: 0.05, opacity: 1, color: 0xfff4c8, jitter: 0.45, segs: 6 }),
      this._mkBolt(to, { radius: 0.14, opacity: 0.3, color: 0xffd166, jitter: 0.55, segs: 6 }),
    ];
    this.particles.stars(to, { count: 12, color: 0xffe08a, speed: 2.6 });
    this.impact(to, 0xffe08a, 1.15, { element: 'holy' });
    this.screen()?.punch({
      flash: 0.18, tint: 0xffe08a, tintAmt: 0.2, bloom: 0.32, aberration: 0.35, hitstop: 30,
    });
    const state = { o: 1 };
    await gsap.to(state, {
      o: 0, duration: 0.38, ease: 'power2.in',
      onUpdate: () => {
        for (const b of bolts) b.mat.opacity = state.o * (0.6 + 0.4 * Math.sin(state.o * 24));
      },
    });
    for (const b of bolts) {
      b.mesh.removeFromParent(); b.mat.dispose(); b.geo.dispose();
    }
  }

  // ---- 治疗 ----
  async heal(pos) {
    this.sfx.chime();
    const glowMat = new THREE.SpriteMaterial({
      map: this.assets.glowTex, color: 0xffe9a8, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.position.copy(pos);
    glow.scale.setScalar(2.3);
    glow.renderOrder = 600;
    this.scene.add(glow);

    for (let i = 0; i < 2; i++) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffe08a, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.28, 40), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pos.x, 0.08 + i * 0.04, pos.z);
      this.scene.add(ring);
      gsap.timeline({
        onComplete: () => { ring.removeFromParent(); ringMat.dispose(); },
      })
        .to(ring.scale, { x: 3.6, y: 3.6, duration: 0.7, ease: 'power2.out' }, 0)
        .to(ringMat, { opacity: 0, duration: 0.7, ease: 'power1.in' }, 0)
        .delay(i * 0.08);
    }

    this.particles.rise(pos, { count: 22, color: 0xffe08a, size: 0.24, life: 1.25, speed: 1.7 });
    this.particles.stars(pos, { count: 6, color: 0xfff3c4, speed: 1.4, life: 0.7 });
    this.screen()?.punch({ tint: 0xffe08a, tintAmt: 0.14, bloom: 0.22, flash: 0.06 });
    await gsap.timeline()
      .to(glowMat, { opacity: 0.8, duration: 0.26, ease: 'power2.out' })
      .to(glowMat, { opacity: 0, duration: 0.55, ease: 'power1.in' });
    glow.removeFromParent();
    glowMat.dispose();
  }

  // ---- 霜盾 / 护甲 ----
  async frostShield(pos) {
    this.sfx.chime();
    const ringGeo = new THREE.TorusGeometry(0.85, 0.07, 8, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x8fe4ff, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.2, pos.z);
    this.scene.add(ring);
    this.particles.burst(pos, {
      count: 16, speed: 2.4, color: 0xa8ecff, size: 0.2, life: 0.7, gravity: -1, spread: 1.1,
    });
    this.particles.stars(pos, { count: 7, color: 0xd8f6ff, speed: 1.8 });
    this.screen()?.punch({ tint: 0x8fe4ff, tintAmt: 0.16, bloom: 0.16, flash: 0.05 });
    await gsap.timeline()
      .to(ring.scale, { x: 2.4, y: 2.4, z: 1.2, duration: 0.45, ease: 'power2.out' }, 0)
      .to(ringMat, { opacity: 0, duration: 0.45, ease: 'power1.in' }, 0);
    ring.removeFromParent();
    ringGeo.dispose(); ringMat.dispose();
  }

  // ---- 流星火雨（AOE）----
  async firestorm(positions) {
    this.sfx.rumble();
    this.screen()?.punch({
      tint: 0xff4a14, tintAmt: 0.32, vignette: 0.28, letterbox: 0.055,
      bloom: 0.18, contrast: 0.1,
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
    this.screen()?.punch({ shock: 1.1, shake: 0.22, flash: 0.12, bloom: 0.2 });
  }

  // ---- 战吼冲击波 ----
  async roar(pos, color = 0xff5040) {
    this.sfx.roar();
    this.world.shake(0.52);
    this.world.pulseArena?.(1);
    this.screen()?.punch({
      tint: color, tintAmt: 0.28, letterbox: 0.07, shock: 1.15,
      bloom: 0.28, contrast: 0.14, aberration: 0.4, hitstop: 55,
    });
    const ringGeo = new THREE.TorusGeometry(1, 0.14, 10, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.15, pos.z);
    this.scene.add(ring);
    this.particles.burst(pos, { count: 26, speed: 5.4, color, size: 0.3, life: 0.75, gravity: -3, spread: 1.4 });
    this.particles.sparks(pos, { count: 12, color, speed: 7 });
    await gsap.timeline()
      .to(ring.scale, { x: 7, y: 7, z: 1.5, duration: 0.55, ease: 'power2.out' }, 0)
      .to(ringMat, { opacity: 0, duration: 0.55, ease: 'power1.in' }, 0);
    ring.removeFromParent();
    ringGeo.dispose(); ringMat.dispose();
  }

  // ---- 召唤落场 ----
  summonImpact(pos, color = 0x9fd4ff) {
    this.impact(new THREE.Vector3(pos.x, 0.25, pos.z), color, 0.85, { feel: true, element: 'arcane' });
    this.particles.burst(new THREE.Vector3(pos.x, 0.2, pos.z), {
      count: 12, speed: 2.3, color: 0xcbb8ff, size: 0.22, life: 0.5, gravity: -2, spread: 1.2,
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
  async flourish(pos, color = 0xb45cff) {
    this.sfx.cast();
    const ringMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.36, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.06, pos.z);
    this.scene.add(ring);
    this.particles.burst(pos, { count: 18, speed: 2.7, color, size: 0.24, life: 0.7, gravity: 0.5, spread: 1 });
    this.particles.stars(pos, { count: 5, color, speed: 1.8, life: 0.55 });
    this.screen()?.punch({ tint: color, tintAmt: 0.14, bloom: 0.14, flash: 0.04 });
    await gsap.timeline()
      .to(ring.scale, { x: 3.2, y: 3.2, duration: 0.42, ease: 'power2.out' }, 0)
      .to(ringMat, { opacity: 0, duration: 0.42, ease: 'power1.in' }, 0);
    ring.removeFromParent();
    ringMat.dispose();
  }

  async shadowDrain(pos) {
    this.sfx.cast();
    this.particles.sink(pos, { count: 16, color: 0x8a4cff, size: 0.2, life: 0.9, speed: 1.3 });
    this.screen()?.punch({ tint: 0x6a2cff, tintAmt: 0.2, vignette: 0.12, flash: 0.03 });
    await new Promise((r) => setTimeout(r, 280));
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
        this.particles.burst(p, {
          count: 28, speed: 5.6, color: [0xffd166, 0xff8fab, 0x8fd3ff][i % 3],
          size: 0.3, life: 1.45, gravity: -4.5, spread: 1, up: 1.2,
        });
        this.particles.stars(p, { count: 8, color: 0xfff0c0, speed: 3.2, life: 0.9 });
      }, i * 200);
    });
  }
}

