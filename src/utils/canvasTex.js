import * as THREE from 'three';

// ---------- 基础画布工具 ----------
export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function canvasOf(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// ---------- 程序化贴图 ----------
// 柔和径向光斑（粒子 / 辉光通用）
export function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const c = canvasOf(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, inner.replace(/,1\)$/, ',0.55)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// 光环（冲击波）
export function makeRingTexture(size = 256) {
  const c = canvasOf(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.72, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.86, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// 噪声（溶解用）
export function makeNoiseTexture(size = 256) {
  const c = canvasOf(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// 卡牌矩形底光（手牌可用提示）
export function makeCardGlowTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = size; c.height = Math.floor(size * 1.35);
  const ctx = c.getContext('2d');
  const w = c.width, h = c.height;
  ctx.filter = 'blur(18px)';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  roundRectPath(ctx, w * 0.14, h * 0.11, w * 0.72, h * 0.78, 30);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

// 细长拖尾（火花 / 弹道余烬）
export function makeStreakTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = Math.floor(size * 0.4);
  const ctx = c.getContext('2d');
  const w = c.width, h = c.height;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(0.65, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const vg = ctx.createLinearGradient(0, 0, 0, h);
  vg.addColorStop(0, 'rgba(0,0,0,0.85)');
  vg.addColorStop(0.5, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  return new THREE.CanvasTexture(c);
}

// 四角星芒（命中火花）
export function makeSparkTexture(size = 128) {
  const c = canvasOf(size);
  const ctx = c.getContext('2d');
  const m = size / 2;
  ctx.translate(m, m);
  const spike = (len, thick) => {
    ctx.beginPath();
    ctx.moveTo(-thick, 0);
    ctx.lineTo(0, -len);
    ctx.lineTo(thick, 0);
    ctx.lineTo(0, len);
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 10;
  spike(m * 0.92, m * 0.08);
  ctx.rotate(Math.PI / 2);
  spike(m * 0.92, m * 0.08);
  ctx.rotate(Math.PI / 4);
  spike(m * 0.48, m * 0.045);
  ctx.rotate(Math.PI / 2);
  spike(m * 0.48, m * 0.045);
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, m * 0.22);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.shadowBlur = 0;
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, m * 0.22, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

// 弧形斩击
export function makeSlashTexture(size = 256) {
  const c = canvasOf(size);
  const ctx = c.getContext('2d');
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-0.55);
  ctx.lineCap = 'round';
  const g = ctx.createLinearGradient(-size * 0.42, 0, size * 0.42, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = g;
  ctx.lineWidth = size * 0.09;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.4, size * 0.16, 0, 0.15, Math.PI - 0.15);
  ctx.stroke();
  ctx.lineWidth = size * 0.035;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.stroke();
  return new THREE.CanvasTexture(c);
}

// 盾徽（嘲讽标识）
export function makeShieldTexture(size = 128) {
  const c = canvasOf(size);
  const ctx = c.getContext('2d');
  const s = size;
  ctx.translate(s / 2, s / 2);
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.36);
  ctx.bezierCurveTo(s * 0.2, -s * 0.32, s * 0.32, -s * 0.28, s * 0.34, -s * 0.22);
  ctx.bezierCurveTo(s * 0.34, s * 0.06, s * 0.2, s * 0.28, 0, s * 0.4);
  ctx.bezierCurveTo(-s * 0.2, s * 0.28, -s * 0.34, s * 0.06, -s * 0.34, -s * 0.22);
  ctx.bezierCurveTo(-s * 0.32, -s * 0.28, -s * 0.2, -s * 0.32, 0, -s * 0.36);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -s * 0.4, 0, s * 0.4);
  g.addColorStop(0, '#ffe9ad');
  g.addColorStop(1, '#c8922e');
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(255,200,90,0.9)';
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#6b4a12';
  ctx.stroke();
  return new THREE.CanvasTexture(c);
}

// ---------- 文字精灵 ----------
export class TextSprite {
  constructor({
    text = '', font = '900 96px Georgia, "Microsoft YaHei"', color = '#ffffff',
    stroke = 'rgba(20,8,4,0.9)', strokeWidth = 10, shadow = 'rgba(0,0,0,0.65)',
    canvasW = 512, canvasH = 256, worldH = 0.8, depthTest = false,
  } = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = canvasW; this.canvas.height = canvasH;
    this.ctx = this.canvas.getContext('2d');
    this.opts = { font, color, stroke, strokeWidth, shadow };
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.SpriteMaterial({
      map: this.texture, transparent: true, depthTest, depthWrite: false,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.worldH = worldH;
    this.sprite.scale.set(worldH * (canvasW / canvasH), worldH, 1);
    this.setText(text);
  }

  setText(text, colorOverride) {
    const { ctx, canvas } = this;
    const o = this.opts;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = o.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = o.shadow;
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 5;
    if (o.strokeWidth > 0) {
      ctx.lineWidth = o.strokeWidth;
      ctx.strokeStyle = o.stroke;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    }
    ctx.shadowBlur = 8;
    ctx.fillStyle = colorOverride || o.color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
    this.material.dispose();
  }
}

// 图像按 cover 模式绘制进矩形
export function drawImageCover(ctx, img, x, y, w, h) {
  if (!img) return;
  const s = Math.max(w / img.width, h / img.height);
  const iw = img.width * s, ih = img.height * s;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
