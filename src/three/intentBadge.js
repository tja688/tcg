import * as THREE from 'three';
import { gsap } from 'gsap';

const COLORS = {
  attack: '#ff6a55',
  defend: '#7ec8ff',
  buff: '#ffd166',
  debuff: '#c86bff',
  summon: '#9fe0a8',
  special: '#f2d089',
};

const ICONS = {
  attack: '⚔',
  defend: '🛡',
  buff: '▲',
  debuff: '▼',
  summon: '✦',
  special: '✶',
};

export class IntentBadge {
  constructor(scene) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 384;
    this.canvas.height = 192;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.SpriteMaterial({
      map: this.tex, transparent: true, depthWrite: false, opacity: 0,
    });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.scale.set(2.15, 1.08, 1);
    this.sprite.position.set(0, 3.15, -5.35);
    this.sprite.renderOrder = 80;
    this.sprite.visible = false;
    scene.add(this.sprite);
    this.intent = null;
  }

  paint(intent) {
    const ctx = this.ctx;
    const W = 384, H = 192;
    ctx.clearRect(0, 0, W, H);
    const color = COLORS[intent.type] || '#f2d089';
    ctx.fillStyle = 'rgba(8,6,18,0.82)';
    round(ctx, 18, 16, W - 36, H - 32, 22);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = color;
    round(ctx, 18, 16, W - 36, H - 32, 22);
    ctx.stroke();

    ctx.font = '900 54px "Microsoft YaHei"';
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(ICONS[intent.type] || '•', 40, 62);

    ctx.font = '700 28px "Microsoft YaHei"';
    ctx.fillStyle = '#efe6d0';
    ctx.fillText(intent.title || '意图', 108, 50);

    ctx.font = '600 26px "Microsoft YaHei"';
    ctx.fillStyle = color;
    ctx.fillText(intent.label || '', 40, 118);

    if (intent.value != null && (intent.type === 'attack' || intent.type === 'defend')) {
      ctx.font = '900 44px Georgia, "Microsoft YaHei"';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff8e8';
      ctx.fillText(String(intent.value), W - 40, 62);
    }
    this.tex.needsUpdate = true;
  }

  show(intent) {
    this.intent = intent;
    if (!intent) { this.hide(); return; }
    this.paint(intent);
    this.sprite.visible = true;
    gsap.fromTo(this.mat, { opacity: 0 }, { opacity: 1, duration: 0.28, overwrite: 'auto' });
    gsap.fromTo(this.sprite.scale, { x: 1.6, y: 0.8 }, {
      x: 2.15, y: 1.08, duration: 0.32, ease: 'back.out(2)', overwrite: 'auto',
    });
  }

  hide() {
    this.intent = null;
    gsap.to(this.mat, {
      opacity: 0, duration: 0.2, overwrite: 'auto',
      onComplete: () => { this.sprite.visible = false; },
    });
  }

  pulse() {
    gsap.fromTo(this.sprite.scale, { x: 2.4, y: 1.2 }, {
      x: 2.15, y: 1.08, duration: 0.35, ease: 'power2.out', overwrite: 'auto',
    });
  }

  dispose() {
    this.sprite.removeFromParent();
    this.tex.dispose();
    this.mat.dispose();
  }
}

function round(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
