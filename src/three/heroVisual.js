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

    this.portraitCanvas = document.createElement('canvas');
    this.portraitCanvas.width = this.portraitCanvas.height = 512;
    this.portraitTex = new THREE.CanvasTexture(this.portraitCanvas);
    this.portraitTex.colorSpace = THREE.SRGBColorSpace;
    this.portraitTex.anisotropy = 8;
    this.paintPortrait(portraitKey || (side === 'player' ? 'hero_mage' : 'hero_warlock'));

    this.portraitMat = new THREE.MeshBasicMaterial({ map: this.portraitTex, transparent: true });
    this.portrait = new THREE.Mesh(new THREE.CircleGeometry(1.08, 56), this.portraitMat);
    this.portrait.userData.heroVisual = this;
    this.portrait.castShadow = true;

    this.pivot = new THREE.Group();
    this.pivot.rotation.x = tilt;
    this.pivot.add(this.portrait);
    this.group.add(this.pivot);

    // 金属描环
    const rimColor = side === 'player' ? 0xd9b465 : 0x8f3a2e;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.055, 12, 72),
      new THREE.MeshStandardMaterial({ color: rimColor, metalness: 0.92, roughness: 0.28 }),
    );
    this.pivot.add(rim);

    // 受击红闪覆盖
    this.hitMat = new THREE.MeshBasicMaterial({
      color: 0xff2a1a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const hitOverlay = new THREE.Mesh(new THREE.CircleGeometry(1.08, 56), this.hitMat);
    hitOverlay.position.z = 0.01;
    this.pivot.add(hitOverlay);

    // 目标高亮环（被法术/攻击瞄准时）
    this.targetMat = new THREE.MeshBasicMaterial({
      color: CFG.colors.targetGlow, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const targetRing = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.045, 10, 72), this.targetMat);
    targetRing.position.z = 0.02;
    this.pivot.add(targetRing);

    // ---- 血量宝珠 ----
    this.hpCanvas = document.createElement('canvas');
    this.hpCanvas.width = this.hpCanvas.height = 256;
    this.hpTex = new THREE.CanvasTexture(this.hpCanvas);
    this.hpTex.colorSpace = THREE.SRGBColorSpace;
    this.hpSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.hpTex, transparent: true, depthWrite: false,
    }));
    this.hpSprite.scale.set(1.05, 1.05, 1);
    if (side === 'player') this.hpSprite.position.set(-1.55, 0.3, 0.25);
    else this.hpSprite.position.set(1.42, -0.42, 0.3);
    this.group.add(this.hpSprite);
    this.paintHp();

    // ---- 法力水晶 ----
    // ---- 法力水晶（世界坐标锚点，独立于头像位置）----
    this.gems = [];
    this.manaGroup = new THREE.Group();
    const anchor = CFG.layout.manaAnchor[side];
    this.manaGroup.position.set(
      anchor[0] - this.group.position.x,
      anchor[1] - CFG.layout.heroPos[side][1],
      anchor[2] - this.group.position.z,
    );
    this.group.add(this.manaGroup);
    const dir = side === 'player' ? 1 : -1;
    const gemGeo = new THREE.OctahedronGeometry(0.13);
    for (let i = 0; i < CFG.rules.maxMana; i++) {
      const m = new THREE.Mesh(gemGeo, new THREE.MeshBasicMaterial({
        color: 0x39c9ff, transparent: true, opacity: 0.95,
      }));
      m.position.set(dir * i * 0.27, 0, 0);
      m.scale.setScalar(1.12);
      m.visible = false;
      m.userData.phase = i * 0.55;
      this.manaGroup.add(m);
      this.gems.push(m);
    }
    this._manaDir = dir;
    this.manaText = new TextSprite({
      text: '0/0', font: '700 64px Georgia, "Microsoft YaHei"', color: '#8fdcff',
      canvasW: 256, canvasH: 128, worldH: 0.42, strokeWidth: 8,
    });
    this.manaText.sprite.position.set(dir * 0.6, 0.02, 0);
    this.manaGroup.add(this.manaText.sprite);

    // 名字
    this.nameText = new TextSprite({
      text: hero.name, font: '600 44px "Microsoft YaHei"', color: side === 'player' ? '#e8d9ae' : '#f0a89a',
      canvasW: 512, canvasH: 96, worldH: 0.3, strokeWidth: 6,
    });
    this.nameText.sprite.position.set(0, side === 'player' ? -1.5 : 1.62, side === 'player' ? 0.5 : 0.2);
    this.nameText.material.opacity = 0.9;
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
    for (const gem of this.gems) {
      if (!gem.visible) continue;
      gsap.fromTo(gem.scale, { x: 1.45, y: 1.45, z: 1.45 }, {
        x: 1.12, y: 1.12, z: 1.12, duration: 0.35, ease: 'back.out(2)', overwrite: 'auto',
      });
      gsap.fromTo(gem.material.color, { r: 1, g: 0.25, b: 0.2 }, {
        r: 0.22, g: 0.79, b: 1, duration: 0.45, overwrite: 'auto',
      });
    }
  }

  paintHp() {
    const ctx = this.hpCanvas.getContext('2d');
    const S = 256;
    ctx.clearRect(0, 0, S, S);
    const low = this.hero.hp <= 10;
    const g = ctx.createRadialGradient(S * 0.42, S * 0.36, S * 0.06, S / 2, S / 2, S * 0.42);
    g.addColorStop(0, low ? '#ffd0c0' : '#ffb9a8');
    g.addColorStop(0.45, low ? '#e03a20' : '#c33520');
    g.addColorStop(1, low ? '#5e0d02' : '#4e130a');
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(255,70,40,0.8)';
    ctx.shadowBlur = 22;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(242,208,137,0.95)';
    ctx.stroke();
    // 顶部高光
    ctx.beginPath();
    ctx.ellipse(S / 2, S * 0.33, S * 0.22, S * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.fill();
    // 数字
    ctx.font = '900 108px Georgia, "Microsoft YaHei"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(30,6,2,0.9)';
    ctx.strokeText(String(this.hero.hp), S / 2, S / 2 + 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(this.hero.hp), S / 2, S / 2 + 6);
    const armor = this.hero.armor || 0;
    if (armor > 0) {
      const ax = S * 0.78, ay = S * 0.78;
      const ag = ctx.createRadialGradient(ax - 8, ay - 10, 4, ax, ay, 38);
      ag.addColorStop(0, '#dce8ff');
      ag.addColorStop(0.5, '#6a88b8');
      ag.addColorStop(1, '#24324a');
      ctx.beginPath();
      ctx.arc(ax, ay, 36, 0, Math.PI * 2);
      ctx.fillStyle = ag;
      ctx.shadowColor = 'rgba(120,170,255,0.8)';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(220,230,255,0.95)';
      ctx.stroke();
      ctx.font = '900 36px Georgia, "Microsoft YaHei"';
      ctx.strokeStyle = 'rgba(10,16,28,0.9)';
      ctx.lineWidth = 6;
      ctx.strokeText(String(armor), ax, ay + 2);
      ctx.fillStyle = '#eef4ff';
      ctx.fillText(String(armor), ax, ay + 2);
    }
    this.hpTex.needsUpdate = true;
  }

  updateHp() {
    this.paintHp();
    gsap.fromTo(this.hpSprite.scale, { x: 1.35, y: 1.35 }, {
      x: 1.05, y: 1.05, duration: 0.4, ease: 'back.out(2.5)', overwrite: 'auto',
    });
  }

  flashHit() {
    gsap.fromTo(this.hitMat, { opacity: 0.75 }, { opacity: 0, duration: 0.45, ease: 'power2.out', overwrite: 'auto' });
    gsap.fromTo(this.pivot.rotation, { z: (Math.random() - 0.5) * 0.2 }, {
      z: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.35)', overwrite: 'auto',
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
      const gem = this.gems[i];
      gem.visible = i < manaMax;
      if (i < mana) {
        gem.material.color.setHex(0x39c9ff);
        gem.material.opacity = 0.95;
        gem.scale.setScalar(1.12);
      } else {
        gem.material.color.setHex(0x14384f);
        gem.material.opacity = 0.55;
        gem.scale.setScalar(0.8);
      }
    }
    // 数字紧跟在水晶行末尾
    this.manaText.sprite.position.x = this._manaDir * (Math.max(manaMax - 1, 0) * 0.27 + 0.62);
    this.manaText.setText(`${mana}/${manaMax}`);
  }

  update(t) {
    // 水晶微旋转
    for (const gem of this.gems) {
      if (gem.visible) gem.rotation.y = t * 1.4 + gem.userData.phase;
    }
    // 头像轻微呼吸（法力组反向补偿，保持水晶稳定在台面上）
    const bob = Math.sin(t * 0.9 + (this.side === 'player' ? 0 : 2)) * 0.05;
    this.group.position.y = CFG.layout.heroPos[this.side][1] + bob;
    this.manaGroup.position.y = CFG.layout.manaAnchor[this.side][1] - CFG.layout.heroPos[this.side][1] - bob;
  }
}
