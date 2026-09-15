import * as THREE from 'three';
import { gsap } from 'gsap';
import { CFG } from '../config.js';
import { TextSprite } from '../utils/canvasTex.js';
import { makeMarkMaterial, tintMaterial } from './vfx/materials.js';

const L = CFG.layout;

// 落点提示：只在拖到合法空位时短暂出现，松手立刻关掉。
// 不再铺整块战场虚线框。
export class DropZone {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.state = 'hidden';
    this._slot = null;

    this.glowMat = makeMarkMaterial({ color: 0x53ffb0 });
    this.glowMat.uniforms.uFade.value = 0;
    this.glowMat.uniforms.uGrown.value = 1.15;
    this.glowMat.uniforms.uQuadSize.value = 2.35;
    this.glowMat.uniforms.uRadius.value = 1.02;
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 2.35), this.glowMat);
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.y = L.dropZone.y + 0.02;
    this.glow.renderOrder = 39;
    this.group.add(this.glow);

    this.ghostMat = new THREE.MeshBasicMaterial({
      color: 0xf2d089, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.ghost = new THREE.Mesh(
      new THREE.PlaneGeometry(CFG.card.w * 0.92, CFG.card.h * 0.92),
      this.ghostMat,
    );
    this.ghost.rotation.x = L.minionTilt;
    this.ghost.visible = false;
    this.group.add(this.ghost);

    this.label = new TextSprite({
      text: '放置于此', font: '700 64px "Microsoft YaHei"', color: '#c8ffe0',
      canvasW: 640, canvasH: 160, worldH: 0.38, strokeWidth: 8,
    });
    this.label.sprite.position.set(0, 1.35, L.rowZ.player);
    this.label.material.opacity = 0;
    this.group.add(this.label.sprite);

    scene.add(this.group);
  }

  slotPos(slot, n) {
    const total = n + 1;
    const spacing = Math.min(L.boardSpacing, 13.2 / Math.max(total, 1));
    const mid = (total - 1) / 2;
    return new THREE.Vector3((slot - mid) * spacing, L.minionY + 0.08, L.rowZ.player);
  }

  hide() {
    if (this.state === 'hidden' && !this.group.visible) return;
    this.state = 'hidden';
    this._slot = null;
    gsap.killTweensOf([this.glowMat.uniforms.uFade, this.ghostMat, this.label.material]);
    this.group.visible = false;
    this.ghost.visible = false;
    this.glowMat.uniforms.uFade.value = 0;
    this.ghostMat.opacity = 0;
    this.label.material.opacity = 0;
  }

  set(state, { slot = null, n = 0 } = {}) {
    if (state === 'hidden' || state === 'cancel') {
      this.hide();
      return;
    }
    if (this.state === state && this._slot === slot) return;

    this.state = state;
    this._slot = slot;
    this.group.visible = true;

    const valid = state === 'valid';
    const cast = state === 'cast';
    const color = valid || cast ? 0x53ffb0 : 0xff6a55;
    tintMaterial(this.glowMat, color);
    this.label.setText(
      valid ? '放置于此' : '松手施放',
      valid || cast ? '#c8ffe0' : '#ffc4b8',
    );

    if (valid && slot != null) {
      const p = this.slotPos(slot, n);
      this.glow.position.set(p.x, L.dropZone.y + 0.02, p.z);
      this.label.sprite.position.set(p.x, 1.42, p.z + 0.15);
      this.ghost.visible = true;
      this.ghost.position.copy(p);
      gsap.to(this.ghostMat, { opacity: 0.34, duration: 0.1, overwrite: 'auto' });
    } else {
      this.glow.position.set(0, L.dropZone.y + 0.02, 0.35);
      this.label.sprite.position.set(0, 1.55, 0.2);
      gsap.to(this.ghostMat, { opacity: 0, duration: 0.08, overwrite: 'auto' });
      this.ghost.visible = false;
    }

    gsap.to(this.glowMat.uniforms.uFade, { value: 0.85, duration: 0.1, overwrite: 'auto' });
    gsap.to(this.label.material, { opacity: 0.92, duration: 0.1, overwrite: 'auto' });
  }

  update(t) {
    if (!this.group.visible) return;
    const base = this.state === 'cast' ? 0.62 : 0.78;
    this.glowMat.uniforms.uFade.value = base + 0.12 * Math.sin(t * 6);
    this.glowMat.uniforms.uPulse.value = 0.08 + 0.1 * Math.sin(t * 4.2);
    this.ghost.position.y = L.minionY + 0.08 + Math.sin(t * 4) * 0.04;
  }

  dispose() {
    this.hide();
    this.group.removeFromParent();
    this.glowMat.dispose();
    this.ghostMat.dispose();
    this.label.dispose();
  }
}
