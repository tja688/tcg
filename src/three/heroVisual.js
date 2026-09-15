import * as THREE from 'three';
import { gsap } from 'gsap';
import { CFG } from '../config.js';
import { TextSprite } from '../utils/canvasTex.js';

// 英雄：圆形头像 + 金属描环 + 血量宝珠 + 法力水晶排
export class HeroVisual {
  constructor(assets, side, hero, portraitKey = null) {
    this.side = side;
    this.hero = hero;
    this.assets = assets;

    this.group = new THREE.Group();
    this.group.position.fromArray(CFG.layout.heroPos[side]);

    const tilt = side === 'player' ? -0.34 : -0.16;
    const portraitR = side === 'player' ? 0.9 : 1.08;

    this.portraitCanvas = document.createElement('canvas');
    this.portraitCanvas.width = this.portraitCanvas.height = 512;
    this.portraitTex = new THREE.CanvasTexture(this.portraitCanvas);
    this.portraitTex.colorSpace = THREE.SRGBColorSpace;
    this.portraitTex.anisotropy = 8;
    this.paintPortrait(portraitKey || (side === 'player' ? 'hero_mage' : 'hero_warlock'));

    this.portraitMat = new THREE.MeshBasicMaterial({ map: this.portraitTex, transparent: true });
    this.portrait = new THREE.Mesh(new THREE.CircleGeometry(portraitR, 56), this.portraitMat);
    this.portrait.userData.heroVisual = this;
    this.portrait.castShadow = true;

    this.pivot = new THREE.Group();
    this.pivot.rotation.x = tilt;
    this.pivot.add(this.portrait);
    this.group.add(this.pivot);

    // 金属描环
    const rimColor = side === 'player' ? 0xd9b465 : 0x8f3a2e;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(portraitR + 0.02, 0.05, 12, 72),
      new THREE.MeshStandardMaterial({ color: rimColor, metalness: 0.92, roughness: 0.28 }),
    );
    this.pivot.add(rim);

    // 受击红闪覆盖
    this.hitMat = new THREE.MeshBasicMaterial({
      color: 0xff2a1a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const hitOverlay = new THREE.Mesh(new THREE.CircleGeometry(portraitR, 56), this.hitMat);
    hitOverlay.position.z = 0.01;
    this.pivot.add(hitOverlay);

    // 目标高亮环（被法术/攻击瞄准时）
    this.targetMat = new THREE.MeshBasicMaterial({
      color: CFG.colors.targetGlow, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const targetRing = new THREE.Mesh(new THREE.TorusGeometry(portraitR + 0.14, 0.04, 10, 72), this.targetMat);
    targetRing.position.z = 0.02;
    this.pivot.add(targetRing);

    // ---- 血量宝珠 ----
    this.hpCanvas = document.createElement('canvas');
    this.hpCanvas.width = this.hpCanvas.height = 256;
    this.hpTex = new THREE.CanvasTexture(this.hpCanvas);
    this.hpTex.colorSpace = THREE.SRGBColorSpace;
    this.hpSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.hpTex, transparent: true, depthWrite: false, depthTest: false,
    }));
    this.hpSprite.renderOrder = 60;
    this.hpSprite.scale.set(0.92, 0.92, 1);
    // 玩家血球贴头像左下，避免伸进手牌；敌人仍靠场地一侧
    if (side === 'player') this.hpSprite.position.set(1.08, 0.08, 0.22);
    else this.hpSprite.position.set(-1.62, 0.18, 0.28);
    this._hpPunch = 0;
    // 低血时的红色呼吸光晕
    this.hpGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: assets.glowTex, color: 0xff2a14, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.hpGlow.scale.set(1.7, 1.7, 1);
    this.hpGlow.position.copy(this.hpSprite.position).add(new THREE.Vector3(0, 0, -0.06));
    this.hpGlow.renderOrder = 59;
    this.hpGlow.material.depthTest = false;
    this.group.add(this.hpGlow);
    this.group.add(this.hpSprite);
    this.paintHp();

    // ---- 法力水晶簇（世界坐标锚点，独立于头像位置）----
    const player = side === 'player';
    this.gems = [];
    this.manaGroup = new THREE.Group();
    const anchor = CFG.layout.manaAnchor[side];
    this.manaGroup.position.set(
      anchor[0] - this.group.position.x,
      anchor[1] - CFG.layout.heroPos[side][1],
      anchor[2] - this.group.position.z,
    );
    this.group.add(this.manaGroup);
    this.manaGroup.visible = player;
    const dir = player ? -1 : 1;
    const gemGap = player ? 0.3 : 0.26;
    const gemR = player ? 0.23 : 0.13;
    const gemGeo = new THREE.OctahedronGeometry(gemR);
    const socketGeo = new THREE.RingGeometry(gemR * 0.66, gemR * 1.12, 6);
    if (player && assets.glowTex) {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: assets.glowTex, color: 0x2a9fd8, transparent: true,
        opacity: 0.3, depthWrite: false,
      }));
      glow.scale.set(2.15, 0.82, 1);
      glow.position.set(dir * 1.05, -0.16, -0.08);
      this.manaGroup.add(glow);
    }
    for (let i = 0; i < CFG.rules.maxMana; i++) {
      // 六角石槽：未解锁的水晶位只剩暗槽
      const socket = new THREE.Mesh(socketGeo, new THREE.MeshBasicMaterial({
        color: 0x14283c, transparent: true, opacity: 0.85,
        depthWrite: false, side: THREE.DoubleSide,
      }));
      socket.rotation.x = -Math.PI / 2;
      socket.rotation.z = Math.PI / 6;
      socket.position.set(dir * i * gemGap, -0.1, 0);
      this.manaGroup.add(socket);

      const m = new THREE.Mesh(gemGeo, new THREE.MeshStandardMaterial({
        color: 0x63c8ff, emissive: 0x1f9ae0, emissiveIntensity: 0.5,
        roughness: 0.08, metalness: 0.3, flatShading: true,
        transparent: true, opacity: 0.96,
      }));
      m.position.set(dir * i * gemGap, 0.1, 0);
      m.visible = false;
      m.userData.phase = i * 0.55;
      m.userData.state = 'locked';
      this.manaGroup.add(m);

      let glow = null;
      if (assets.glowTex) {
        glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: assets.glowTex, color: 0x4fd4ff, transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        glow.scale.setScalar(gemR * 3.4);
        glow.position.copy(m.position);
        glow.visible = false;
        this.manaGroup.add(glow);
      }
      this.gems.push({ mesh: m, socket, glow });
    }
    this._manaDir = dir;
    this._manaGap = gemGap;
    this.manaText = new TextSprite({
      text: '0/0',
      font: player ? '800 88px Georgia, "Microsoft YaHei"' : '700 64px Georgia, "Microsoft YaHei"',
      color: '#9ae7ff',
      canvasW: player ? 360 : 256,
      canvasH: player ? 160 : 128,
      worldH: player ? 0.6 : 0.42,
      strokeWidth: player ? 10 : 8,
    });
    this.manaText.sprite.renderOrder = 60;
    this.manaText.sprite.position.set(dir * 0.6, player ? 0.5 : 0.02, 0);
    this.manaGroup.add(this.manaText.sprite);

    // 名字：玩家改由平面 HUD 显示，敌人放在场地头像下方
    this.nameText = new TextSprite({
      text: hero.name, font: '700 48px "Microsoft YaHei"', color: side === 'player' ? '#e8d9ae' : '#f0a89a',
      canvasW: 512, canvasH: 96, worldH: 0.36, strokeWidth: 6,
    });
    this.nameText.sprite.position.set(0, -1.5, side === 'player' ? 0.5 : 0.22);
    this.nameText.material.opacity = side === 'enemy' ? 0.94 : 0;
    this.nameText.sprite.visible = side === 'enemy';
    this.group.add(this.nameText.sprite);
  }

  paintPortrait(key) {
    const size = 512;
    const ctx = this.portraitCanvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    const img = this.assets.images[key] || this.assets.images[this.side === 'player' ? 'hero_mage' : 'hero_warlock'];
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.clip();
    if (img) {
      const s = Math.max(size / img.width, size / img.height);
      ctx.drawImage(img, (size - img.width * s) / 2, (size - img.height * s) / 2, img.width * s, img.height * s);
    } else {
      ctx.fillStyle = this.side === 'player' ? '#27408f' : '#7a1e1e';
      ctx.fillRect(0, 0, size, size);
    }
    const vg = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.5);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
    this.portraitTex.needsUpdate = true;
  }

  setName(name) {
    this.nameText.setText(name);
  }

  flashMana() {
    for (const g of this.gems) {
      const gem = g.mesh;
      if (!gem.visible || gem.userData.state !== 'full') continue;
      gsap.fromTo(gem.material, { emissiveIntensity: 2.2 }, {
        emissiveIntensity: 0.5, duration: 0.5, ease: 'power2.out', overwrite: 'auto',
      });
      gsap.fromTo(gem.scale, { x: 1.35, y: 1.35, z: 1.35 }, {
        x: 1, y: 1, z: 1, duration: 0.4, ease: 'back.out(2.2)', overwrite: 'auto',
      });
    }
  }

  paintHp() {
    const ctx = this.hpCanvas.getContext('2d');
    const S = 256, C = S / 2;
    ctx.clearRect(0, 0, S, S);
    const hp = Math.max(0, this.hero.hp);
    const maxHp = Math.max(1, this.hero.maxHp || 40);
    const frac = Math.min(1, hp / maxHp);
    const low = hp <= 10;

    // 外圈血色光晕（低血更强）
    const aura = ctx.createRadialGradient(C, C, S * 0.3, C, C, S * 0.5);
    aura.addColorStop(0, low ? 'rgba(255,50,30,0.5)' : 'rgba(200,50,30,0.22)');
    aura.addColorStop(1, 'rgba(200,50,30,0)');
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, S, S);

    // 金属外环
    const ringG = ctx.createLinearGradient(0, 0, S, S);
    ringG.addColorStop(0, '#f6e2a8');
    ringG.addColorStop(0.45, '#8a5f24');
    ringG.addColorStop(0.62, '#5e3f14');
    ringG.addColorStop(1, '#e9c87e');
    ctx.beginPath();
    ctx.arc(C, C, S * 0.475, 0, Math.PI * 2);
    ctx.arc(C, C, S * 0.385, 0, Math.PI * 2, true);
    ctx.fillStyle = ringG;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 四颗铆钉
    for (const a of [Math.PI / 4, Math.PI * 3 / 4, Math.PI * 5 / 4, Math.PI * 7 / 4]) {
      const rx = C + Math.cos(a) * S * 0.43;
      const ry = C + Math.sin(a) * S * 0.43;
      const rg = ctx.createRadialGradient(rx - 2, ry - 3, 1, rx, ry, 9);
      rg.addColorStop(0, '#fff3cf');
      rg.addColorStop(1, '#7a5518');
      ctx.beginPath();
      ctx.arc(rx, ry, 8, 0, Math.PI * 2);
      ctx.fillStyle = rg;
      ctx.fill();
    }

    // 内腔底
    ctx.beginPath();
    ctx.arc(C, C, S * 0.375, 0, Math.PI * 2);
    ctx.fillStyle = '#1c0709';
    ctx.fill();

    // 生命液面：随血量比例升降
    const rIn = S * 0.36;
    const surfY = C + rIn - frac * rIn * 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(C, C, rIn, 0, Math.PI * 2);
    ctx.clip();
    const liq = ctx.createLinearGradient(0, surfY, 0, C + rIn);
    liq.addColorStop(0, low ? '#f47a52' : '#d64e2e');
    liq.addColorStop(0.35, low ? '#c62e10' : '#a82208');
    liq.addColorStop(1, '#3f0903');
    ctx.fillStyle = liq;
    ctx.fillRect(C - rIn, surfY, rIn * 2, C + rIn - surfY + 2);
    // 液面高光
    if (frac > 0.02 && frac < 0.98) {
      const men = ctx.createRadialGradient(C, surfY, 1, C, surfY, rIn * 0.95);
      men.addColorStop(0, 'rgba(255,226,200,0.4)');
      men.addColorStop(1, 'rgba(255,226,200,0)');
      ctx.fillStyle = men;
      ctx.beginPath();
      ctx.ellipse(C, surfY, rIn * 0.95, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // 腔内顶部阴影，让球面有深度
    const depth = ctx.createRadialGradient(C, C - rIn * 0.9, rIn * 0.1, C, C, rIn * 1.35);
    depth.addColorStop(0, 'rgba(0,0,0,0.5)');
    depth.addColorStop(0.5, 'rgba(0,0,0,0.12)');
    depth.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = depth;
    ctx.fillRect(C - rIn, C - rIn, rIn * 2, rIn * 2);
    ctx.restore();

    // 玻璃高光
    const glass = ctx.createRadialGradient(C - S * 0.16, C - S * 0.19, 2, C - S * 0.13, C - S * 0.15, S * 0.18);
    glass.addColorStop(0, 'rgba(255,255,255,0.32)');
    glass.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.arc(C, C, rIn, 0, Math.PI * 2);
    ctx.fill();

    // 数字
    ctx.font = '900 104px Georgia, "Microsoft YaHei"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 11;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(28,5,2,0.92)';
    ctx.strokeText(String(hp), C, C + 6);
    ctx.fillStyle = '#fff6ea';
    ctx.fillText(String(hp), C, C + 6);

    const armor = this.hero.armor || 0;
    if (armor > 0) {
      const ax = S * 0.79, ay = S * 0.76;
      const ag = ctx.createRadialGradient(ax - 8, ay - 10, 4, ax, ay, 38);
      ag.addColorStop(0, '#e8f1ff');
      ag.addColorStop(0.5, '#7b96c2');
      ag.addColorStop(1, '#2a3a54');
      ctx.beginPath();
      ctx.arc(ax, ay, 36, 0, Math.PI * 2);
      ctx.fillStyle = ag;
      ctx.shadowColor = 'rgba(130,180,255,0.8)';
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(226,236,255,0.95)';
      ctx.stroke();
      ctx.font = '900 36px Georgia, "Microsoft YaHei"';
      ctx.strokeStyle = 'rgba(10,16,28,0.9)';
      ctx.lineWidth = 6;
      ctx.strokeText(String(armor), ax, ay + 2);
      ctx.fillStyle = '#f2f7ff';
      ctx.fillText(String(armor), ax, ay + 2);
    }
    this.hpTex.needsUpdate = true;
  }

  updateHp() {
    this.paintHp();
    this._hpPunch = 1;
    gsap.to(this, { _hpPunch: 0, duration: 0.45, ease: 'power2.out', overwrite: 'auto' });
  }

  flashHit() {
    gsap.fromTo(this.hitMat, { opacity: 0.88 }, { opacity: 0, duration: 0.42, ease: 'power2.out', overwrite: 'auto' });
    gsap.fromTo(this.pivot.rotation, { z: (Math.random() - 0.5) * 0.28 }, {
      z: 0, duration: 0.46, ease: 'elastic.out(1.25, 0.32)', overwrite: 'auto',
    });
    gsap.fromTo(this.pivot.scale, { x: 1.08, y: 0.92, z: 1 }, {
      x: 1, y: 1, z: 1, duration: 0.36, ease: 'back.out(2.4)', overwrite: 'auto',
    });
  }

  setTargeted(v, strong = true) {
    const opacity = v ? (strong ? 0.9 : 0.32) : 0;
    const scale = v && strong ? 1.08 : 1;
    gsap.to(this.targetMat, { opacity, duration: 0.18, overwrite: 'auto' });
    gsap.to(this.pivot.scale, { x: scale, y: scale, z: 1, duration: 0.2, overwrite: 'auto' });
  }

  updateMana(mana, manaMax) {
    for (let i = 0; i < this.gems.length; i++) {
      const g = this.gems[i];
      const gem = g.mesh;
      const st = i >= manaMax ? 'locked' : (i < mana ? 'full' : 'spent');
      const prev = gem.userData.state;
      gem.userData.state = st;
      gem.visible = st !== 'locked';
      g.socket.visible = true;
      g.socket.material.opacity = st === 'locked' ? 0.45 : 0.85;
      if (g.glow) g.glow.visible = st === 'full';
      if (st === 'full') {
        gem.material.color.setHex(0x63c8ff);
        gem.material.emissive.setHex(0x1f9ae0);
        gem.material.emissiveIntensity = 0.5;
        gem.material.opacity = 0.96;
        gem.scale.setScalar(1);
        if (prev === 'spent' || prev === 'locked') {
          // 回满 / 新槽解锁：水晶弹起点亮
          gsap.fromTo(gem.scale, { x: 0.4, y: 0.4, z: 0.4 }, {
            x: 1, y: 1, z: 1, duration: 0.42, delay: i * 0.04, ease: 'back.out(2.6)', overwrite: 'auto',
          });
        }
      } else if (st === 'spent') {
        gem.material.color.setHex(0x5a8ab0);
        gem.material.emissive.setHex(0x123a55);
        gem.material.emissiveIntensity = 0.5;
        gem.material.opacity = 0.88;
        gem.scale.setScalar(0.82);
        if (prev === 'full') {
          // 消耗：碎光下沉
          gsap.fromTo(gem.position, { y: 0.22 }, { y: 0.02, duration: 0.3, ease: 'power2.in', overwrite: 'auto' });
        }
      }
      if (st !== 'spent') gem.position.y = 0.1;
    }
    // 数字悬于已解锁水晶排上方居中
    this.manaText.sprite.position.x = this._manaDir * (Math.max(manaMax - 1, 0) * this._manaGap) / 2;
    this.manaText.setText(`${mana}/${manaMax}`);
  }

  update(t) {
    // 水晶微旋转 + 满水晶轻微浮动
    for (const g of this.gems) {
      const gem = g.mesh;
      if (!gem.visible) continue;
      gem.rotation.y = t * 1.4 + gem.userData.phase;
      if (gem.userData.state === 'full') {
        gem.position.y = 0.1 + Math.sin(t * 1.8 + gem.userData.phase) * 0.028;
        if (g.glow) g.glow.position.y = gem.position.y;
      }
    }
    // 血球：受击弹跳 + 低血心跳
    const low = this.hero.hp <= 10;
    const beat = low ? Math.max(0, Math.sin(t * 4.8)) ** 2 * 0.05 : 0;
    const s = (this.side === 'player' ? 0.92 : 1.05) * (1 + this._hpPunch * 0.3 + beat);
    this.hpSprite.scale.set(s, s, 1);
    this.hpGlow.material.opacity = low ? 0.22 + Math.max(0, Math.sin(t * 4.8)) * 0.3 : 0;
    // 头像轻微呼吸（法力组反向补偿，保持水晶稳定在台面上）
    const bob = Math.sin(t * 0.9 + (this.side === 'player' ? 0 : 2)) * 0.05;
    this.group.position.y = CFG.layout.heroPos[this.side][1] + bob;
    this.manaGroup.position.y = CFG.layout.manaAnchor[this.side][1] - CFG.layout.heroPos[this.side][1] - bob;
  }
}
