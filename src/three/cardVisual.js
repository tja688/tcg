import * as THREE from 'three';
import { gsap } from 'gsap';
import { CFG } from '../config.js';
import { roundRectPath, drawImageCover } from '../utils/canvasTex.js';
import { makeCardFaceMaterial } from './cardMaterial.js';

const { w: CW, h: CH, texW: TW, texH: TH, radius: R } = CFG.card;

let cardGeo = null;
function getCardGeo() {
  if (!cardGeo) cardGeo = new THREE.PlaneGeometry(CW, CH);
  return cardGeo;
}

// ============ 卡面绘制 ============
export function paintCardFace(ctx, def, stats, assets) {
  ctx.clearRect(0, 0, TW, TH);
  ctx.save();
  roundRectPath(ctx, 3, 3, TW - 6, TH - 6, R);
  ctx.clip();

  // 原画铺满
  const img = assets.images[def.art];
  if (img) {
    drawImageCover(ctx, img, 0, 0, TW, TH);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, TH);
    g.addColorStop(0, '#2a2150');
    g.addColorStop(1, '#0d0a1c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TW, TH);
  }

  // 底部压暗便于读字
  const shade = ctx.createLinearGradient(0, TH * 0.42, 0, TH);
  shade.addColorStop(0, 'rgba(6,4,14,0)');
  shade.addColorStop(0.55, 'rgba(6,4,14,0.55)');
  shade.addColorStop(1, 'rgba(6,4,14,0.9)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, TH * 0.4, TW, TH * 0.6);

  // 顶部轻压暗
  const topShade = ctx.createLinearGradient(0, 0, 0, 130);
  topShade.addColorStop(0, 'rgba(4,3,10,0.55)');
  topShade.addColorStop(1, 'rgba(4,3,10,0)');
  ctx.fillStyle = topShade;
  ctx.fillRect(0, 0, TW, 130);

  // ---- 名牌 ----
  const nameY = 452, nameH = 62;
  const band = ctx.createLinearGradient(0, nameY, 0, nameY + nameH);
  band.addColorStop(0, 'rgba(22,16,40,0.92)');
  band.addColorStop(1, 'rgba(10,7,22,0.92)');
  ctx.fillStyle = band;
  roundRectPath(ctx, 34, nameY, TW - 68, nameH, 16);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(214,172,90,0.85)';
  roundRectPath(ctx, 34, nameY, TW - 68, nameH, 16);
  ctx.stroke();

  const nameGrad = ctx.createLinearGradient(0, nameY + 8, 0, nameY + nameH - 8);
  nameGrad.addColorStop(0, '#fff3d8');
  nameGrad.addColorStop(1, '#e3b45e');
  ctx.font = '700 36px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = nameGrad;
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 6;
  ctx.fillText(def.name, TW / 2, nameY + nameH / 2 + 2);
  ctx.shadowBlur = 0;

  // 稀有度宝石
  const rc = CFG.colors.rarity[def.rarity] || '#c2c9d6';
  ctx.beginPath();
  ctx.arc(TW / 2, nameY + nameH + 13, 8, 0, Math.PI * 2);
  ctx.fillStyle = rc;
  ctx.shadowColor = rc;
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(20,14,30,0.9)';
  ctx.stroke();

  // ---- 描述区 ----
  const descY = 540, descH = 130;
  ctx.fillStyle = 'rgba(8,6,18,0.74)';
  roundRectPath(ctx, 40, descY, TW - 80, descH, 14);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(214,172,90,0.35)';
  roundRectPath(ctx, 40, descY, TW - 80, descH, 14);
  ctx.stroke();

  // 描述文字（【关键词】金色高亮，手动换行）
  ctx.font = '400 26px "KaiTi", "STKaiti", "Microsoft YaHei", serif';
  ctx.textAlign = 'center';
  const maxW = TW - 120;
  const segs = def.desc.split(/(【[^】]*】)/).filter(Boolean);
  const chars = [];
  for (const seg of segs) {
    const gold = seg.startsWith('【');
    for (const ch of seg) chars.push({ ch, gold });
  }
  const lines = [];
  let line = [];
  let lw = 0;
  for (const c of chars) {
    const w = ctx.measureText(c.ch).width;
    if (lw + w > maxW && line.length) { lines.push(line); line = []; lw = 0; }
    line.push(c); lw += w;
  }
  if (line.length) lines.push(line);
  const lh = 34;
  let ty = descY + descH / 2 - ((lines.length - 1) * lh) / 2;
  for (const ln of lines) {
    const total = ln.reduce((s, c) => s + ctx.measureText(c.ch).width, 0);
    let tx = TW / 2 - total / 2;
    for (const c of ln) {
      const w = ctx.measureText(c.ch).width;
      ctx.fillStyle = c.gold ? '#ffd685' : '#ddd5c4';
      ctx.textAlign = 'left';
      ctx.fillText(c.ch, tx, ty);
      tx += w;
    }
    ty += lh;
  }
  ctx.textAlign = 'center';

  // 种族 / 法术标签
  ctx.font = '400 20px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = 'rgba(226,209,168,0.8)';
  ctx.fillText(def.type === 'spell' ? '· 法术 ·' : `· ${def.tribe} ·`, TW / 2, TH - 26);

  // ---- 外框 ----
  const frame = ctx.createLinearGradient(0, 0, TW, TH);
  frame.addColorStop(0, '#f4dd9d');
  frame.addColorStop(0.5, '#966a2f');
  frame.addColorStop(1, '#e9c87e');
  ctx.lineWidth = 9;
  ctx.strokeStyle = frame;
  roundRectPath(ctx, 6, 6, TW - 12, TH - 12, R - 4);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,240,205,0.5)';
  roundRectPath(ctx, 14, 14, TW - 28, TH - 28, R - 10);
  ctx.stroke();

  // 传说卡描橙边
  if (def.rarity === 'legendary') {
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(255,167,38,0.9)';
    roundRectPath(ctx, 10, 10, TW - 20, TH - 20, R - 7);
    ctx.stroke();
  }

  // ---- 费用宝石 ----
  drawGem(ctx, 62, 64, 46, ['#9fe0ff', '#2f6fd6', '#123063'], String(def.cost), 54);

  // ---- 攻血 ----
  if (def.type === 'minion') {
    const atk = stats ? stats.attack : def.attack;
    const hp = stats ? stats.health : def.health;
    const hpMax = stats ? stats.maxHealth : def.health;
    drawGem(ctx, 62, TH - 64, 44, ['#ffd27f', '#e07818', '#5e2c04'], String(atk), 50);
    const hpColors = hp < hpMax ? ['#ff9d8a', '#d43222', '#5c0f08'] : ['#ff9d8a', '#c8402e', '#571209'];
    drawGem(ctx, TW - 62, TH - 64, 44, hpColors, String(hp), 50, hp < hpMax ? '#ffb3a6' : '#ffffff');
  }

  ctx.restore();
}

function drawGem(ctx, x, y, r, [c0, c1, c2], text, fontSize, textColor = '#ffffff') {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, c0);
  g.addColorStop(0.55, c1);
  g.addColorStop(1, c2);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(240,214,150,0.9)';
  ctx.stroke();
  // 高光
  ctx.beginPath();
  ctx.ellipse(x - r * 0.22, y - r * 0.4, r * 0.42, r * 0.22, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();

  ctx.font = `900 ${fontSize}px Georgia, "Microsoft YaHei"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(25,10,5,0.85)';
  ctx.strokeText(text, x, y + 3);
  ctx.fillStyle = textColor;
  ctx.fillText(text, x, y + 3);
}

// ============ 卡牌可视对象 ============
// 结构：group（世界定位）> pivot（翻面/倾斜）> [face, back, glow]
//        group > ring（战场脚环，平贴地面）> tauntIcon
export class CardVisual {
  constructor(assets, inst = null, def = null) {
    this.assets = assets;
    this.inst = inst;
    this.def = def || (inst ? inst.def : null);
    this.uid = inst ? inst.uid : null;

    this.group = new THREE.Group();
    this.pivot = new THREE.Group();
    this.group.add(this.pivot);

    // 卡面画布
    this.canvas = document.createElement('canvas');
    this.canvas.width = TW;
    this.canvas.height = TH;
    this.ctx = this.canvas.getContext('2d');
    this.faceTex = new THREE.CanvasTexture(this.canvas);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    this.faceTex.anisotropy = 8;

    this.faceMat = makeCardFaceMaterial(this.faceTex, assets.noiseTex);
    this.face = new THREE.Mesh(getCardGeo(), this.faceMat);
    this.face.castShadow = true;
    this.face.userData.cardVisual = this;
    this.pivot.add(this.face);

    // 卡背
    this.backMat = new THREE.MeshBasicMaterial({
      map: assets.tex.cardBack, transparent: true, opacity: 1,
    });
    this.back = new THREE.Mesh(getCardGeo(), this.backMat);
    this.back.rotation.y = Math.PI;
    this.back.position.z = -0.006;
    this.back.castShadow = true;
    this.pivot.add(this.back);

    // 底光（可出牌 / 目标提示）
    this.glowMat = new THREE.MeshBasicMaterial({
      map: assets.cardGlowTex, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
      color: CFG.colors.playableGlow,
    });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(CW * 1.45, CH * 1.34), this.glowMat);
    this.glow.position.z = -0.012;
    this.glow.renderOrder = -1;
    this.pivot.add(this.glow);

    // 战场脚环
    this.ringMat = new THREE.MeshBasicMaterial({
      color: CFG.colors.readyRing, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1.02, 48), this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.group.add(this.ring);

    // 嘲讽盾徽
    this.tauntIcon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: assets.shieldTex, transparent: true, depthWrite: false, opacity: 0.95,
    }));
    this.tauntIcon.scale.set(0.52, 0.52, 1);
    this.tauntIcon.visible = false;
    this.group.add(this.tauntIcon);

    this._ringState = 'hidden';
    this._glowState = 'none';

    if (this.def) this.paint();
    if (this.def && this.def.rarity === 'legendary') this.faceMat.uniforms.uFoil.value = 1;
  }

  paint() {
    paintCardFace(this.ctx, this.def, this.inst, this.assets);
    this.faceTex.needsUpdate = true;
  }

  updateStats() {
    if (!this.def) return;
    this.paint();
    gsap.fromTo(this.pivot.scale, { x: 1.14, y: 1.14 }, {
      x: 1, y: 1, duration: 0.32, ease: 'back.out(2.2)', overwrite: 'auto',
    });
  }

  flash() {
    const u = this.faceMat.uniforms.uFlash;
    gsap.fromTo(u, { value: 0.9 }, { value: 0, duration: 0.32, ease: 'power2.out', overwrite: 'auto' });
  }

  setFaceDown(v) {
    this.pivot.rotation.y = v ? Math.PI : 0;
  }

  // 底光状态：none | playable | target
  setGlow(state) {
    if (this._glowState === state) return;
    this._glowState = state;
    gsap.killTweensOf(this.glowMat);
    if (state === 'none') {
      gsap.to(this.glowMat, { opacity: 0, duration: 0.25, overwrite: 'auto' });
    } else {
      const color = state === 'playable' ? CFG.colors.playableGlow : CFG.colors.targetGlow;
      this.glowMat.color.setHex(color);
      gsap.to(this.glowMat, { opacity: 0.55, duration: 0.3, overwrite: 'auto' });
      gsap.to(this.glowMat, {
        opacity: 0.32, duration: 0.85, yoyo: true, repeat: -1, delay: 0.3, ease: 'sine.inOut',
      });
    }
  }

  // 脚环状态：hidden | ready | exhausted | taunt
  setRing(state) {
    if (this._ringState === state) return;
    this._ringState = state;
    gsap.killTweensOf(this.ringMat);
    if (state === 'hidden') {
      this.ring.visible = false;
      return;
    }
    this.ring.visible = true;
    if (state === 'ready') {
      this.ringMat.color.setHex(CFG.colors.readyRing);
      this.ringMat.opacity = 0.5;
      gsap.to(this.ringMat, { opacity: 0.22, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    } else if (state === 'taunt') {
      this.ringMat.color.setHex(CFG.colors.tauntRing);
      this.ringMat.opacity = 0.4;
      gsap.to(this.ringMat, { opacity: 0.2, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    } else {
      this.ringMat.color.setHex(CFG.colors.exhaustRing);
      this.ringMat.opacity = 0.28;
    }
    // 疲劳去饱和（保持克制，避免压暗原画）
    gsap.to(this.faceMat.uniforms.uDesat, {
      value: state === 'exhausted' ? 0.5 : 0, duration: 0.4, overwrite: 'auto',
    });
  }

  syncBoardDecor() {
    // 站立于战场时：脚环放到卡牌底部地面，盾徽悬于底缘
    this.ring.position.set(0, -CFG.layout.minionY + 0.03, 0.42);
    this.tauntIcon.position.set(0, -CFG.layout.minionY + 0.62, 0.75);
    this.tauntIcon.visible = !!(this.inst && this.inst.taunt && this.inst.onBoard);
  }

  setRenderOrder(n) {
    this.face.renderOrder = n;
    this.back.renderOrder = n;
    this.glow.renderOrder = n - 1;
  }

  dispose() {
    gsap.killTweensOf([this.group.position, this.group.rotation, this.group.scale]);
    gsap.killTweensOf([this.pivot.rotation, this.pivot.scale, this.glowMat, this.ringMat]);
    this.group.removeFromParent();
    this.faceTex.dispose();
    this.faceMat.dispose();
    this.backMat.dispose();
    this.glowMat.dispose();
    this.ringMat.dispose();
  }
}
