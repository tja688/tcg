import * as THREE from 'three';

const MAX_ALIVE = 180;
const _dir = new THREE.Vector3();

// 轻量精灵粒子池：爆裂、拖尾、星芒、灰烬、治疗光点
export class ParticleSystem {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.alive = [];
    this.pool = [];
  }

  _alloc() {
    if (this.pool.length) return this.pool.pop();
    const mat = new THREE.SpriteMaterial({
      map: this.assets.glowTex,
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 500;
    sprite.visible = false;
    this.scene.add(sprite);
    return {
      sprite,
      vel: new THREE.Vector3(),
      life: 1, age: 0, size: 0.3, sizeEnd: 0,
      stretch: 1, gravity: 0, drag: 1, opacity: 1,
    };
  }

  _release(p) {
    p.sprite.visible = false;
    this.pool.push(p);
  }

  spawn({
    pos, vel = null, life = 0.8, size = 0.3, sizeEnd = 0,
    color = 0xffffff, opacity = 1, gravity = 0, drag = 1, tex = null,
    blending = THREE.AdditiveBlending, stretch = 1,
  }) {
    if (this.alive.length >= MAX_ALIVE) {
      const old = this.alive.shift();
      this._release(old);
    }
    const p = this._alloc();
    const mat = p.sprite.material;
    mat.map = tex || this.assets.glowTex;
    mat.color.setHex(typeof color === 'number' ? color : 0xffffff);
    if (color && color.isColor) mat.color.copy(color);
    mat.opacity = opacity;
    mat.blending = blending;
    mat.needsUpdate = true;
    p.sprite.position.copy(pos);
    p.sprite.scale.set(size * stretch, size, 1);
    p.sprite.visible = true;
    p.vel.copy(vel || _dir.set(0, 0, 0));
    p.life = life;
    p.age = 0;
    p.size = size;
    p.sizeEnd = sizeEnd;
    p.stretch = stretch;
    p.gravity = gravity;
    p.drag = drag;
    p.opacity = opacity;
    this.alive.push(p);
    return p;
  }

  burst(pos, {
    count = 14, speed = 3, color = 0xffcc66, size = 0.28, sizeEnd = 0.02,
    life = 0.55, gravity = -4, spread = 1, up = 0.4, tex = null, opacity = 1,
    stretch = 1,
  } = {}) {
    for (let i = 0; i < count; i++) {
      _dir.set(
        (Math.random() - 0.5) * 2 * spread,
        Math.random() * up + 0.25,
        (Math.random() - 0.5) * 2 * spread,
      ).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      this.spawn({
        pos, tex, opacity, stretch,
        vel: _dir.clone(),
        life: life * (0.6 + Math.random() * 0.8),
        size: size * (0.6 + Math.random() * 0.9),
        sizeEnd, color, gravity,
        drag: 0.92,
      });
    }
  }

  sparks(pos, {
    count = 10, speed = 6, color = 0xffe6b0, size = 0.22, life = 0.38,
  } = {}) {
    for (let i = 0; i < count; i++) {
      _dir.set(
        (Math.random() - 0.5) * 2,
        0.15 + Math.random() * 0.9,
        (Math.random() - 0.5) * 2,
      ).normalize().multiplyScalar(speed * (0.55 + Math.random() * 0.7));
      this.spawn({
        pos,
        tex: this.assets.streakTex,
        vel: _dir.clone(),
        life: life * (0.65 + Math.random() * 0.5),
        size: size * (0.7 + Math.random() * 0.6),
        sizeEnd: 0.01, color, gravity: -8, drag: 0.9, stretch: 2.6,
      });
    }
  }

  stars(pos, {
    count = 8, speed = 2.4, color = 0xfff2c8, size = 0.32, life = 0.55,
  } = {}) {
    for (let i = 0; i < count; i++) {
      _dir.set(
        (Math.random() - 0.5) * 2,
        0.4 + Math.random() * 1.1,
        (Math.random() - 0.5) * 2,
      ).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      this.spawn({
        pos,
        tex: this.assets.sparkTex,
        vel: _dir.clone(),
        life: life * (0.7 + Math.random() * 0.5),
        size: size * (0.6 + Math.random() * 0.8),
        sizeEnd: 0.02, color, gravity: -1.2, drag: 0.94, stretch: 1,
      });
    }
  }

  rise(pos, {
    count = 12, color = 0xffe08a, size = 0.2, life = 1.1, speed = 1.3, spread = 0.8,
  } = {}) {
    for (let i = 0; i < count; i++) {
      this.spawn({
        pos: new THREE.Vector3(
          pos.x + (Math.random() - 0.5) * spread * 2,
          pos.y + (Math.random() - 0.5) * 0.8,
          pos.z + (Math.random() - 0.5) * spread,
        ),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.4,
          speed * (0.6 + Math.random() * 0.8),
          (Math.random() - 0.5) * 0.4,
        ),
        life: life * (0.7 + Math.random() * 0.6),
        size: size * (0.6 + Math.random() * 0.8),
        sizeEnd: 0.01, color, gravity: 0.4, drag: 0.99,
      });
    }
  }

  sink(pos, {
    count = 10, color = 0x8a4cff, size = 0.18, life = 0.85, speed = 1.1, spread = 0.7,
  } = {}) {
    for (let i = 0; i < count; i++) {
      this.spawn({
        pos: new THREE.Vector3(
          pos.x + (Math.random() - 0.5) * spread * 2,
          pos.y + 0.4 + Math.random() * 0.6,
          pos.z + (Math.random() - 0.5) * spread,
        ),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          -speed * (0.5 + Math.random() * 0.7),
          (Math.random() - 0.5) * 0.3,
        ),
        life: life * (0.7 + Math.random() * 0.5),
        size: size * (0.6 + Math.random() * 0.8),
        sizeEnd: 0.01, color, gravity: -0.6, drag: 0.98,
      });
    }
  }

  update(dt) {
    for (let i = this.alive.length - 1; i >= 0; i--) {
      const p = this.alive[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.alive.splice(i, 1);
        this._release(p);
        continue;
      }
      const k = p.age / p.life;
      p.vel.y += p.gravity * dt;
      p.vel.multiplyScalar(Math.pow(p.drag, dt * 60));
      p.sprite.position.addScaledVector(p.vel, dt);
      const s = THREE.MathUtils.lerp(p.size, p.sizeEnd, k);
      p.sprite.scale.set(s * p.stretch, s, 1);
      p.sprite.material.opacity = p.opacity * (1 - k * k);
    }
  }
}
