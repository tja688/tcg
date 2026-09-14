import * as THREE from 'three';

// 轻量精灵粒子池：爆裂、火花、灰烬、治疗光点等
export class ParticleSystem {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.alive = [];
  }

  spawn({
    pos, vel = new THREE.Vector3(), life = 0.8, size = 0.3, sizeEnd = 0,
    color = 0xffffff, opacity = 1, gravity = 0, drag = 1, tex = null,
    blending = THREE.AdditiveBlending,
  }) {
    const mat = new THREE.SpriteMaterial({
      map: tex || this.assets.glowTex, color, transparent: true, opacity,
      blending, depthWrite: false,
    });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    s.scale.setScalar(size);
    s.renderOrder = 500;
    this.scene.add(s);
    this.alive.push({
      sprite: s, vel: vel.clone(), life, age: 0, size, sizeEnd, gravity, drag, opacity,
    });
  }

  burst(pos, {
    count = 14, speed = 3, color = 0xffcc66, size = 0.28, sizeEnd = 0.02,
    life = 0.55, gravity = -4, spread = 1, up = 0.4, tex = null, opacity = 1,
  } = {}) {
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2 * spread,
        Math.random() * up + 0.25,
        (Math.random() - 0.5) * 2 * spread,
      ).normalize();
      this.spawn({
        pos, tex, opacity,
        vel: dir.multiplyScalar(speed * (0.4 + Math.random() * 0.8)),
        life: life * (0.6 + Math.random() * 0.8),
        size: size * (0.6 + Math.random() * 0.9),
        sizeEnd, color, gravity,
        drag: 0.92,
      });
    }
  }

  // 向上飘散（灰烬 / 治疗）
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
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, speed * (0.6 + Math.random() * 0.8), (Math.random() - 0.5) * 0.4),
        life: life * (0.7 + Math.random() * 0.6),
        size: size * (0.6 + Math.random() * 0.8),
        sizeEnd: 0.01, color, gravity: 0.4, drag: 0.99,
      });
    }
  }

  update(dt) {
    for (let i = this.alive.length - 1; i >= 0; i--) {
      const p = this.alive[i];
      p.age += dt;
      if (p.age >= p.life) {
        p.sprite.removeFromParent();
        p.sprite.material.dispose();
        this.alive.splice(i, 1);
        continue;
      }
      const k = p.age / p.life;
      p.vel.y += p.gravity * dt;
      p.vel.multiplyScalar(Math.pow(p.drag, dt * 60));
      p.sprite.position.addScaledVector(p.vel, dt);
      p.sprite.scale.setScalar(THREE.MathUtils.lerp(p.size, p.sizeEnd, k));
      p.sprite.material.opacity = p.opacity * (1 - k * k);
    }
  }
}
