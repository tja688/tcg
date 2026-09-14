import * as THREE from 'three';
import { gsap } from 'gsap';
import { TextSprite } from '../utils/canvasTex.js';

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

  // ---- 伤害 / 治疗数字 ----
  damageNumber(pos, text, color = '#ff5a4a') {
    const ts = new TextSprite({
      text, color,
      font: '900 120px Georgia, "Microsoft YaHei"',
      canvasW: 384, canvasH: 256, worldH: 1.05, strokeWidth: 14,
    });
    ts.sprite.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.35, 0.25));
    ts.sprite.renderOrder = 900;
    this.scene.add(ts.sprite);
    const tl = gsap.timeline({
      onComplete: () => { ts.sprite.removeFromParent(); ts.dispose(); },
    });
    tl.fromTo(ts.sprite.scale, { x: 0.3, y: 0.2 }, {
      x: ts.sprite.scale.x, y: ts.sprite.scale.y, duration: 0.22, ease: 'back.out(3)',
    }, 0);
    tl.to(ts.sprite.position, { y: '+=1.15', duration: 1.05, ease: 'power1.out' }, 0);
    tl.to(ts.material, { opacity: 0, duration: 0.4, ease: 'power2.in' }, 0.62);
  }

  // ---- 冲击命中 ----
  impact(pos, color = 0xffb066, strength = 1) {
    // 冲击环
    const ringMat = new THREE.SpriteMaterial({
      map: this.assets.ringTex, color, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const ring = new THREE.Sprite(ringMat);
    ring.position.copy(pos);
    ring.renderOrder = 600;
    ring.scale.setScalar(0.4);
    this.scene.add(ring);
    gsap.to(ring.scale, { x: 2.6 * strength, y: 2.6 * strength, duration: 0.38, ease: 'power2.out' });
    gsap.to(ringMat, {
      opacity: 0, duration: 0.38, ease: 'power1.out',
      onComplete: () => { ring.removeFromParent(); ringMat.dispose(); },
    });
    // 闪光
    const flashMat = new THREE.SpriteMaterial({
      map: this.assets.glowTex, color: 0xffffff, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const flash = new THREE.Sprite(flashMat);
    flash.position.copy(pos);
    flash.scale.setScalar(1.6 * strength);
    flash.renderOrder = 601;
    this.scene.add(flash);
    gsap.to(flashMat, {
      opacity: 0, duration: 0.22,
      onComplete: () => { flash.removeFromParent(); flashMat.dispose(); },
    });
    // 火花
    this.particles.burst(pos, {
      count: Math.round(14 * strength), speed: 4.2 * strength, color,
      size: 0.24, life: 0.5, gravity: -6, spread: 1,
    });
    this.world.shake(0.22 * strength);
  }

  // ---- 近战突进（在命中瞬间 resolve）----
  async attackLunge(visual, targetPos) {
    const g = visual.group;
    const from = g.position.clone();
    const dir = targetPos.clone().sub(from);
    const hitPoint = from.clone().addScaledVector(dir, 0.72);
    visual.setRenderOrder(80);
    this.sfx.whoosh();
    const tl = gsap.timeline();
    // 后拉蓄力
    tl.to(g.position, {
      x: from.x - dir.x * 0.12, y: from.y + 0.25, z: from.z - dir.z * 0.12,
      duration: 0.16, ease: 'power2.out',
    });
    // 突进
    tl.to(g.position, {
      x: hitPoint.x, y: hitPoint.y + 0.15, z: hitPoint.z,
      duration: 0.13, ease: 'power3.in',
    });
    await tl;
    this.impact(targetPos, 0xffcf8a, 1.15);
    this.sfx.hit();
  }

  async attackRecover(visual, homePos, homeRot) {
    const g = visual.group;
    await gsap.to(g.position, {
      x: homePos.x, y: homePos.y, z: homePos.z, duration: 0.4, ease: 'power2.out',
    });
    g.rotation.set(homeRot.x, homeRot.y, homeRot.z);
    visual.setRenderOrder(10);
  }

  // ---- 弹道（火球 / 奥术飞弹）----
  async projectile(from, to, { color = 0xff7a26, size = 1, arc = 2.1 } = {}) {
    const group = new THREE.Group();
    const coreMat = new THREE.SpriteMaterial({
      map: this.assets.glowTex, color: 0xfff2cc, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const core = new THREE.Sprite(coreMat);
    core.scale.setScalar(0.55 * size);
    core.renderOrder = 700;
    const haloMat = new THREE.SpriteMaterial({
      map: this.assets.glowTex, color, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(1.35 * size);
    halo.renderOrder = 699;
    group.add(halo, core);
    group.position.copy(from);

    const light = new THREE.PointLight(color, 34, 9, 1.9);
    group.add(light);
    this.scene.add(group);
    this.sfx.cast();

    const ctrl = from.clone().add(to).multiplyScalar(0.5).add(new THREE.Vector3(0, arc, 0));
    const curve = new THREE.QuadraticBezierCurve3(from.clone(), ctrl, to.clone());
    const state = { t: 0 };
    await gsap.to(state, {
      t: 1, duration: 0.55, ease: 'power1.in',
      onUpdate: () => {
        curve.getPoint(state.t, group.position);
        if (Math.random() < 0.8) {
          this.particles.spawn({
            pos: group.position.clone(), vel: new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)),
            life: 0.4, size: 0.3 * size, sizeEnd: 0.02, color, gravity: 0.5, drag: 0.9,
          });
        }
      },
    });

    this.impact(to, color, 1.5 * size);
    this.sfx.boom();
    gsap.to(light, {
      intensity: 0, duration: 0.3,
      onComplete: () => {
        group.removeFromParent();
        coreMat.dispose(); haloMat.dispose();
      },
    });
  }

  // ---- 闪电打击 ----
  async lightning(to) {
    this.sfx.zap();
    const bolts = [];
    const mkBolt = (radius, opacity) => {
      const pts = [];
      const top = to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 8.5, (Math.random() - 0.5) * 1.2));
      const segs = 9;
      for (let i = 0; i <= segs; i++) {
        const k = i / segs;
        const p = top.clone().lerp(to, k);
        if (i > 0 && i < segs) {
          p.x += (Math.random() - 0.5) * 1.1 * (1 - k * 0.5);
          p.z += (Math.random() - 0.5) * 0.7;
        }
        pts.push(p);
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 40, radius, 6, false);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xcfe8ff, transparent: true, opacity,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 700;
      this.scene.add(mesh);
      bolts.push({ mesh, mat, geo });
    };
    mkBolt(0.06, 1);
    mkBolt(0.16, 0.35);
    mkBolt(0.04, 0.9);

    const flashMat = new THREE.SpriteMaterial({
      map: this.assets.glowTex, color: 0xbfe0ff, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const flash = new THREE.Sprite(flashMat);
    flash.position.copy(to);
    flash.scale.setScalar(3);
    flash.renderOrder = 701;
    this.scene.add(flash);

    this.world.shake(0.4);
    this.impact(to, 0x9fd4ff, 1.3);

    const state = { o: 1 };
    await gsap.to(state, {
      o: 0, duration: 0.42, ease: 'power2.in',
      onUpdate: () => {
        const flicker = state.o * (0.55 + 0.45 * Math.sin(state.o * 40));
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

  // ---- 治疗 ----
  async heal(pos) {
    this.sfx.chime();
    const glowMat = new THREE.SpriteMaterial({
      map: this.assets.glowTex, color: 0xffe9a8, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.position.copy(pos);
    glow.scale.setScalar(2.2);
    glow.renderOrder = 600;
    this.scene.add(glow);
    this.particles.rise(pos, { count: 18, color: 0xffe08a, size: 0.24, life: 1.2, speed: 1.6 });
    await gsap.timeline()
      .to(glowMat, { opacity: 0.75, duration: 0.28, ease: 'power2.out' })
      .to(glowMat, { opacity: 0, duration: 0.55, ease: 'power1.in' });
    glow.removeFromParent();
    glowMat.dispose();
  }

  // ---- 流星火雨（AOE）----
  async firestorm(positions) {
    if (!positions.length) return;
    this.sfx.rumble();
    const jobs = positions.map((p, i) => (async () => {
      await new Promise((r) => setTimeout(r, i * 130 + Math.random() * 60));
      const from = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.5, 8.2, -1.2));
      await this.projectile(from, p, { color: 0xff6a22, size: 0.85, arc: 0.4 });
    })());
    await Promise.all(jobs);
  }

  // ---- 战吼冲击波 ----
  async roar(pos, color = 0xff5040) {
    this.sfx.roar();
    this.world.shake(0.5);
    const ringGeo = new THREE.TorusGeometry(1, 0.14, 10, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.15, pos.z);
    this.scene.add(ring);
    this.particles.burst(pos, { count: 22, speed: 5, color, size: 0.3, life: 0.7, gravity: -3, spread: 1.4 });
    await gsap.timeline()
      .to(ring.scale, { x: 7, y: 7, z: 1.5, duration: 0.55, ease: 'power2.out' }, 0)
      .to(ringMat, { opacity: 0, duration: 0.55, ease: 'power1.in' }, 0);
    ring.removeFromParent();
    ringGeo.dispose(); ringMat.dispose();
  }

  // ---- 召唤落场 ----
  summonImpact(pos, color = 0x9fd4ff) {
    this.impact(new THREE.Vector3(pos.x, 0.25, pos.z), color, 0.9);
    this.particles.burst(new THREE.Vector3(pos.x, 0.2, pos.z), {
      count: 10, speed: 2.2, color: 0xcbb8ff, size: 0.22, life: 0.5, gravity: -2, spread: 1.2,
    });
    this.sfx.place();
  }

  // ---- 死亡溶解 ----
  async dissolve(visual, { fast = false } = {}) {
    this.sfx.death();
    const pos = visual.group.position.clone();
    this.particles.rise(pos, { count: 16, color: 0xff8a4d, size: 0.2, life: 1.0, speed: 1.4 });
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
    this.particles.burst(pos, { count: 16, speed: 2.6, color, size: 0.24, life: 0.7, gravity: 0.5, spread: 1 });
    await new Promise((r) => setTimeout(r, 260));
  }

  // ---- 胜利金雨 ----
  victoryBurst() {
    const positions = [
      new THREE.Vector3(-3, 2, 1), new THREE.Vector3(3, 2.5, 0), new THREE.Vector3(0, 3, -2),
      new THREE.Vector3(-1.5, 2.2, -3.5), new THREE.Vector3(2, 2.8, 2.5),
    ];
    positions.forEach((p, i) => {
      setTimeout(() => {
        this.particles.burst(p, {
          count: 26, speed: 5.5, color: [0xffd166, 0xff8fab, 0x8fd3ff][i % 3],
          size: 0.3, life: 1.4, gravity: -4.5, spread: 1, up: 1.2,
        });
      }, i * 220);
    });
  }
}
