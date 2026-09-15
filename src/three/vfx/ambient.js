import * as THREE from 'three';
import { CFG } from '../../config.js';
import { makeFlameMaterial, makeMoteMaterial, makeArenaOverlayMaterial } from './materials.js';

const VOLUME = new THREE.Vector3(28, 10, 26);

export function createAmbient(scene, assets) {
  const motes = makeDust(scene);
  const flames = makeBraziers(scene);
  const overlay = makeOverlay(scene);
  const sparks = makeSparkPoints(scene, assets);

  return {
    motes,
    flames,
    overlay,
    sparks,
    applyEnv(env) {
      motes.material.uniforms.uColor.value.setHex(env.mote ?? env.ember ?? 0xc8b090);
      overlay.material.uniforms.uColor.value.setHex(env.rune);
      for (const f of flames) {
        const mid = new THREE.Color(env.flame);
        f.material.uniforms.uColorMid.value.copy(mid);
        f.material.uniforms.uColorCool.value.copy(mid).multiplyScalar(0.35);
      }
      if (sparks?.material) sparks.material.color.setHex(env.ember);
    },
    update(dt, t, arenaPulse) {
      overlay.material.uniforms.uPulse.value = arenaPulse;
      overlay.rotation.z = t * 0.018;
      for (const f of flames) {
        const wobble = 0.94 + 0.06 * Math.sin(t * 11 + f.userData.phase);
        f.material.uniforms.uSize.value.set(0.58 * wobble, 1.28 + 0.12 * Math.sin(t * 7 + f.userData.phase));
      }
      if (sparks) tickSparks(sparks, dt, t);
    },
  };
}

function makeDust(scene) {
  const n = 420;
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * VOLUME.x;
    pos[i * 3 + 1] = Math.random() * VOLUME.y;
    pos[i * 3 + 2] = (Math.random() - 0.5) * VOLUME.z - 1.2;
    seed[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = makeMoteMaterial({ color: 0xc8b090 });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 3;
  scene.add(points);
  return points;
}

function makeBraziers(scene) {
  const list = [];
  const { x, z, bowlY } = CFG.layout.brazier;
  for (const sx of [-1, 1]) {
    const mat = makeFlameMaterial({ color: 0xff7a2a });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.position.set(sx * x, bowlY + 0.02, z);
    mesh.renderOrder = 20;
    mesh.userData.phase = sx > 0 ? 1.7 : 0.4;
    scene.add(mesh);
    list.push(mesh);
  }
  return list;
}

function makeOverlay(scene) {
  const mat = makeArenaOverlayMaterial({ color: 0x3fe8ff });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(9.4, 96), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.018;
  mesh.renderOrder = 4;
  scene.add(mesh);
  return mesh;
}

function makeSparkPoints(scene, assets) {
  const n = 48;
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const sx = i < 24 ? -CFG.layout.brazier.x : CFG.layout.brazier.x;
    pos[i * 3] = sx + (Math.random() - 0.5) * 0.22;
    pos[i * 3 + 1] = CFG.layout.brazier.bowlY + Math.random() * 0.85;
    pos[i * 3 + 2] = CFG.layout.brazier.z + (Math.random() - 0.5) * 0.22;
    vel[i] = 0.9 + Math.random() * 1.1;
    seed[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(g, new THREE.PointsMaterial({
    map: assets.glowTex, size: 0.12, transparent: true, opacity: 0.7,
    color: 0xffa04d, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  points.userData = { vel, seed };
  points.renderOrder = 21;
  scene.add(points);
  return points;
}

function tickSparks(points, dt, t) {
  const p = points.geometry.attributes.position;
  const vel = points.userData.vel;
  const seed = points.userData.seed;
  for (let i = 0; i < vel.length; i++) {
    let y = p.getY(i) + vel[i] * dt;
    const sx = i < 24 ? -CFG.layout.brazier.x : CFG.layout.brazier.x;
    if (y > CFG.layout.brazier.bowlY + 1.35) {
      y = CFG.layout.brazier.bowlY + 0.04;
      p.setX(i, sx + (Math.random() - 0.5) * 0.2);
      p.setZ(i, CFG.layout.brazier.z + (Math.random() - 0.5) * 0.2);
    }
    p.setY(i, y);
    p.setX(i, p.getX(i) + Math.sin(t * 3.2 + seed[i] * 8) * dt * 0.08);
  }
  p.needsUpdate = true;
}
