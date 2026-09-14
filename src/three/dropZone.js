import * as THREE from 'three';
import { gsap } from 'gsap';
import { CFG } from '../config.js';
import { TextSprite } from '../utils/canvasTex.js';

const L = CFG.layout;

function dashedTex() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 256);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 10;
  ctx.setLineDash([22, 16]);
  ctx.strokeRect(18, 18, 476, 220);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(28, 28, 456, 200);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class DropZone {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.state = 'hidden';

    this.tex = dashedTex();
    this.mat = new THREE.MeshBasicMaterial({
      map: this.tex, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const dz = L.dropZone;
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(dz.w, dz.d), this.mat);
    this.plane.rotation.x = -Math.PI / 2;
    this.plane.position.set(0, dz.y, dz.z);
    this.plane.renderOrder = 40;
    this.group.add(this.plane);

    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0x53ffb0, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(dz.w * 0.96, dz.d * 0.9), this.glowMat);
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.set(0, dz.y + 0.01, dz.z);
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
      text: '放置于此', font: '700 72px "Microsoft YaHei"', color: '#c8ffe0',
      canvasW: 640, canvasH: 160, worldH: 0.48, strokeWidth: 8,
    });
    this.label.sprite.position.set(0, 1.55, L.rowZ.player);
    this.group.add(this.label.sprite);

    scene.add(this.group);
  }

  slotPos(slot, n) {
    const total = n + 1;
    const spacing = Math.min(L.boardSpacing, 13.2 / Math.max(total, 1));
    const mid = (total - 1) / 2;
    return new THREE.Vector3((slot - mid) * spacing, L.minionY + 0.08, L.rowZ.player);
  }

  set(state, { slot = null, n = 0 } = {}) {
    if (state === 'hidden') {
      this.state = 'hidden';
      this.group.visible = false;
      this.ghost.visible = false;
      return;
    }
    this.group.visible = true;
    this.state = state;
    const valid = state === 'valid';
    const cast = state === 'cast';
    const color = valid || cast ? 0x53ffb0 : 0xff6a55;
    this.mat.color.setHex(color);
    this.glowMat.color.setHex(color);
    gsap.to(this.mat, { opacity: 0.72, duration: 0.16, overwrite: 'auto' });
    gsap.to(this.glowMat, { opacity: valid || cast ? 0.18 : 0.1, duration: 0.16, overwrite: 'auto' });
    this.label.setText(
      valid ? '放置于此' : cast ? '松手施放' : '松手取消',
      valid || cast ? '#c8ffe0' : '#ffc4b8',
    );

    if (valid && slot != null) {
      const p = this.slotPos(slot, n);
      this.ghost.visible = true;
      this.ghost.position.copy(p);
      gsap.to(this.ghostMat, { opacity: 0.38, duration: 0.12, overwrite: 'auto' });
    } else {
      gsap.to(this.ghostMat, { opacity: 0, duration: 0.12, overwrite: 'auto' });
      this.ghost.visible = false;
    }
  }

  update(t) {
    if (!this.group.visible) return;
    this.glowMat.opacity = (this.state === 'cancel' ? 0.08 : 0.14) + 0.06 * Math.sin(t * 5);
    this.ghost.position.y = L.minionY + 0.08 + Math.sin(t * 4) * 0.04;
  }

  dispose() {
    this.group.removeFromParent();
    this.tex.dispose();
    this.mat.dispose();
    this.glowMat.dispose();
    this.ghostMat.dispose();
    this.label.dispose();
  }
}
