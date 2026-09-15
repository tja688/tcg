import * as THREE from 'three';
import { gsap } from 'gsap';
import {
  makeSigilMaterial, makeShockMaterial, makeOrbMaterial, makeHaloMaterial,
  makeSlashMaterial, makeBoltMaterial, makeBarrierMaterial, makeInkMaterial,
  makeBeamMaterial, tintMaterial,
} from './materials.js';

const _mid = new THREE.Vector3();

let _sigilGeo;
let _shockGeo;
let _orbGeo;
let _haloGeo;
let _slashGeo;
let _barrierGeo;
let _inkGeo;

function sigilGeo() {
  if (!_sigilGeo) _sigilGeo = new THREE.PlaneGeometry(1, 1);
  return _sigilGeo;
}
function shockGeo() {
  if (!_shockGeo) _shockGeo = new THREE.RingGeometry(0.05, 1, 80, 10);
  return _shockGeo;
}
function orbGeo() {
  if (!_orbGeo) _orbGeo = new THREE.IcosahedronGeometry(1, 3);
  return _orbGeo;
}
function haloGeo() {
  if (!_haloGeo) _haloGeo = new THREE.PlaneGeometry(1, 1);
  return _haloGeo;
}
function slashGeo() {
  if (!_slashGeo) _slashGeo = new THREE.PlaneGeometry(1, 1);
  return _slashGeo;
}
function barrierGeo() {
  if (!_barrierGeo) _barrierGeo = new THREE.SphereGeometry(1, 36, 24);
  return _barrierGeo;
}
function inkGeo() {
  if (!_inkGeo) _inkGeo = new THREE.CylinderGeometry(1, 0.42, 1, 24, 1, true);
  return _inkGeo;
}

function disposeLater(mesh, mat, extra = []) {
  mesh.removeFromParent();
  mat.dispose();
  extra.forEach((m) => m?.dispose?.());
}

export function spawnSigil(scene, pos, color, {
  radius = 1.8, duration = 0.72, y = 0.04, seed,
} = {}) {
  const mat = makeSigilMaterial({ color, radius, seed });
  const mesh = new THREE.Mesh(sigilGeo(), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(pos.x, y, pos.z);
  const quad = radius * 2.4;
  mesh.scale.set(quad, quad, 1);
  mesh.renderOrder = 12;
  scene.add(mesh);
  const u = mat.uniforms;
  u.uGrown.value = 0.05;
  const tl = gsap.timeline({
    onComplete: () => disposeLater(mesh, mat),
  });
  tl.to(u.uGrown, { value: radius, duration: duration * 0.55, ease: 'power2.out' }, 0);
  tl.to(u.uFront, { value: 0, duration: duration * 0.7, ease: 'power1.in' }, 0.08);
  tl.to(u.uFade, { value: 0, duration: duration * 0.5, ease: 'power2.in' }, duration * 0.5);
  return { mesh, mat, tl };
}

export function spawnShock(scene, pos, color, {
  reach = 4.2, duration = 0.42, lift = 0.22, y = 0.03,
} = {}) {
  const mat = makeShockMaterial({ color });
  const mesh = new THREE.Mesh(shockGeo(), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(pos.x, y, pos.z);
  mesh.renderOrder = 14;
  scene.add(mesh);
  const u = mat.uniforms;
  u.uReach.value = reach;
  u.uFront.value = 0.12;
  u.uLift.value = lift;
  const tl = gsap.timeline({
    onComplete: () => disposeLater(mesh, mat),
  });
  tl.to(u.uFront, { value: reach * 0.92, duration, ease: 'power2.out' }, 0);
  tl.to(u.uFade, { value: 0, duration: duration * 0.42, ease: 'power2.in' }, duration * 0.52);
  return { mesh, mat, tl };
}

export function spawnOrb(scene, pos, color, { size = 0.32 } = {}) {
  const mat = makeOrbMaterial({ color });
  const mesh = new THREE.Mesh(orbGeo(), mat);
  mesh.position.copy(pos);
  mesh.scale.setScalar(size);
  mesh.renderOrder = 700;
  scene.add(mesh);
  return {
    mesh,
    mat,
    dispose() { disposeLater(mesh, mat); },
  };
}

export function spawnHalo(scene, pos, color, {
  size = 2.6, duration = 0.7,
} = {}) {
  const mat = makeHaloMaterial({ color, size });
  const mesh = new THREE.Mesh(haloGeo(), mat);
  mesh.position.copy(pos);
  mesh.renderOrder = 610;
  scene.add(mesh);
  const u = mat.uniforms;
  u.uOpen.value = 0.05;
  const tl = gsap.timeline({
    onComplete: () => disposeLater(mesh, mat),
  });
  tl.to(u.uOpen, { value: 1, duration: duration * 0.35, ease: 'power2.out' }, 0);
  tl.to(u.uFade, { value: 0, duration: duration * 0.55, ease: 'power2.in' }, duration * 0.4);
  return { mesh, mat, tl };
}

export function spawnSlash(scene, from, to, color) {
  const mid = _mid.copy(from).lerp(to, 0.64);
  mid.y += 0.22;
  const mat = makeSlashMaterial({ color });
  const mesh = new THREE.Mesh(slashGeo(), mat);
  mesh.position.copy(mid);
  mesh.lookAt(to);
  mesh.scale.set(2.85, 0.72, 1);
  mesh.renderOrder = 720;
  scene.add(mesh);
  mesh.scale.x = 0.18;
  const tl = gsap.timeline({
    onComplete: () => disposeLater(mesh, mat),
  });
  tl.to(mesh.scale, { x: 2.85, y: 0.72, duration: 0.1, ease: 'power3.out' }, 0);
  tl.to(mat.uniforms.uFade, { value: 0, duration: 0.24, ease: 'power2.in' }, 0.08);
  return { mesh, mat, tl };
}

export function spawnBoltMesh(scene, geo, color, opacity = 1) {
  const mat = makeBoltMaterial({ color });
  mat.uniforms.uFade.value = opacity;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 700;
  scene.add(mesh);
  return { mesh, mat, geo };
}

export function spawnBarrier(scene, pos, color, {
  radius = 1.15, duration = 0.7,
} = {}) {
  const mat = makeBarrierMaterial({ color });
  const mesh = new THREE.Mesh(barrierGeo(), mat);
  mesh.position.copy(pos);
  mesh.scale.setScalar(0.25);
  mesh.renderOrder = 80;
  scene.add(mesh);
  const tl = gsap.timeline({
    onComplete: () => disposeLater(mesh, mat),
  });
  tl.to(mesh.scale, { x: radius, y: radius * 0.92, z: radius, duration: 0.38, ease: 'power2.out' }, 0);
  tl.to(mat.uniforms.uThrob, { value: 0.06, duration: 0.2, yoyo: true, repeat: 1 }, 0);
  tl.to(mat.uniforms.uFade, { value: 0, duration: 0.38, ease: 'power1.in' }, duration * 0.45);
  return { mesh, mat, tl };
}

export function spawnBeam(scene, pos, color, {
  width = 1.45, height = 3.6, duration = 0.48, y = 0,
} = {}) {
  const mat = makeBeamMaterial({ color, width, height });
  const mesh = new THREE.Mesh(haloGeo(), mat);
  mesh.position.set(pos.x, pos.y + y, pos.z);
  mesh.renderOrder = 680;
  scene.add(mesh);
  const u = mat.uniforms;
  u.uSize.value.set(width * 0.2, height * 0.35);
  const tl = gsap.timeline({
    onComplete: () => disposeLater(mesh, mat),
  });
  tl.to(u.uSize.value, { x: width, y: height, duration: duration * 0.28, ease: 'power2.out' }, 0);
  tl.to(u.uFade, { value: 0, duration: duration * 0.55, ease: 'power2.in' }, duration * 0.4);
  return { mesh, mat, tl };
}

export function spawnPulse(scene, pos, color, {
  size = 0.42, duration = 0.5,
} = {}) {
  const orb = spawnOrb(scene, pos, color, { size: size * 0.35 });
  const tl = gsap.timeline({
    onComplete: () => orb.dispose(),
  });
  tl.to(orb.mesh.scale, {
    x: size, y: size, z: size, duration: duration * 0.35, ease: 'power2.out',
  }, 0);
  tl.to(orb.mat.uniforms.uFade, { value: 0, duration: duration * 0.55, ease: 'power2.in' }, duration * 0.38);
  return { ...orb, tl };
}

export function spawnInk(scene, pos, color, {
  height = 1.8, radius = 0.85, duration = 0.85,
} = {}) {
  const mat = makeInkMaterial({ color });
  const mesh = new THREE.Mesh(inkGeo(), mat);
  mesh.position.set(pos.x, pos.y + height * 0.35, pos.z);
  mesh.scale.set(radius, height, radius);
  mesh.renderOrder = 70;
  scene.add(mesh);
  const tl = gsap.timeline({
    onComplete: () => disposeLater(mesh, mat),
  });
  tl.fromTo(mesh.scale, { x: radius * 0.35, y: height * 0.4, z: radius * 0.35 }, {
    x: radius, y: height, z: radius, duration: 0.32, ease: 'power2.out',
  }, 0);
  tl.to(mat.uniforms.uFade, { value: 0, duration: 0.4, ease: 'power1.in' }, duration * 0.5);
  return { mesh, mat, tl };
}

export function waitTl(tl) {
  return new Promise((resolve) => {
    if (!tl) return resolve();
    const prev = tl.eventCallback('onComplete');
    tl.eventCallback('onComplete', () => {
      prev?.();
      resolve();
    });
  });
}

export { tintMaterial };
