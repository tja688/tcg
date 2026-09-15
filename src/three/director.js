import * as THREE from 'three';
import { gsap } from 'gsap';
import { CFG } from '../config.js';
import { sleep } from '../utils/rng.js';
import { TextSprite } from '../utils/canvasTex.js';
import { CardVisual } from './cardVisual.js';
import { HeroVisual } from './heroVisual.js';
import {
  handTransforms, handHoverTransform, enemyHandTransforms,
  boardTransforms, boardTransformsWithGap,
} from './layout.js';
import { DropZone } from './dropZone.js';
import { IntentBadge } from './intentBadge.js';
import { resetThinkHud } from '../pseudoai/think.js';

const L = CFG.layout;

// ---------- 牌库堆 ----------
class DeckStack {
  constructor(assets, side) {
    this.group = new THREE.Group();
    this.group.position.fromArray(L.deckPos[side]);
    this.layers = [];
    const geo = new THREE.PlaneGeometry(CFG.card.w * 0.64, CFG.card.h * 0.64);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: assets.tex.cardBack }));
      m.rotation.set(-Math.PI / 2, 0, (Math.random() - 0.5) * 0.06);
      m.position.y = 0.02 + i * 0.028;
      this.group.add(m);
      this.layers.push(m);
    }
    this.count = new TextSprite({
      text: '30', font: '700 84px Georgia, "Microsoft YaHei"', color: '#cfd8ff',
      canvasW: 256, canvasH: 128, worldH: 0.5, strokeWidth: 8,
    });
    this.count.sprite.position.set(0, 0.85, 0);
    this.group.add(this.count.sprite);
  }
  setCount(n) {
    const vis = Math.min(6, Math.ceil(n / 5));
    this.layers.forEach((m, i) => { m.visible = i < vis; });
    this.count.setText(String(n), n === 0 ? '#5a5470' : undefined);
  }
}

// ---------- 结束回合按钮 ----------
class EndTurnButton {
  constructor() {
    this.group = new THREE.Group();
    this.group.position.fromArray(L.endTurnPos);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0x6b5326, metalness: 0.9, roughness: 0.35,
      emissive: 0xff9d2e, emissiveIntensity: 0.0,
    });
    // 六边形符印 + 金色包边
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.74, 0.16, 6), this.mat);
    this.mesh.castShadow = true;
    this.mesh.userData.endTurn = true;
    this.group.add(this.mesh);
    const rimTorus = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.05, 10, 48),
      new THREE.MeshStandardMaterial({ color: 0xd8ac52, metalness: 0.95, roughness: 0.25 }),
    );
    rimTorus.rotation.x = -Math.PI / 2;
    rimTorus.position.y = 0.05;
    this.group.add(rimTorus);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd98a, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.06, 48), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.group.add(this.ring);

    this.label = new TextSprite({
      text: '结束回合', font: '700 76px "Microsoft YaHei"', color: '#ffe9b8',
      canvasW: 512, canvasH: 160, worldH: 0.5, strokeWidth: 8,
    });
    this.label.sprite.position.set(0, 0.92, 0);
    this.group.add(this.label.sprite);
    this.enabled = false;
  }
  setEnabled(b) {
    this.enabled = b;
    gsap.to(this.mat, { emissiveIntensity: b ? 0.3 : 0.03, duration: 0.4, overwrite: 'auto' });
    gsap.to(this.ring.material, { opacity: b ? 0.42 : 0.05, duration: 0.4, overwrite: 'auto' });
    this.label.setText(b ? '结束回合' : '对方回合', b ? '#ffe9b8' : '#77708f');
  }
  hover(b) {
    gsap.to(this.group.scale, { x: b ? 1.12 : 1, y: b ? 1.12 : 1, z: b ? 1.12 : 1, duration: 0.2, overwrite: 'auto' });
  }
  press() {
    gsap.timeline()
      .to(this.group.position, { y: L.endTurnPos[1] - 0.09, duration: 0.08 })
      .to(this.group.position, { y: L.endTurnPos[1], duration: 0.22, ease: 'back.out(3)' });
  }
  update(t) {
    if (this.enabled) {
      this.mat.emissiveIntensity = 0.16 + 0.12 * (0.5 + 0.5 * Math.sin(t * 2.6));
    }
  }
}

// =====================================================================
// Director：实现 Game 所需的全部 fx 接口 + 玩家操作入口 + 布局管理
// =====================================================================
export class Director {
  constructor(world, assets, particles, effects, hud, sfx) {
    this.world = world;
    this.scene = world.scene;
    this.assets = assets;
    this.particles = particles;
    this.effects = effects;
    this.hud = hud;
    this.sfx = sfx;

    this.game = null;
    this.combatKind = 'combat';
    this.vis = new Map();          // uid -> CardVisual（玩家手牌 + 双方战场）
    this.enemyHandBacks = [];      // 敌方手牌（卡背）
    this.hoverInst = null;
    this.hoverBoardInst = null;
    this.dragInst = null;
    this._busy = 0;
    this._combatEnded = false;
    this.onCombatEnd = null;

    this.dropZone = new DropZone(this.scene);
    this.intentBadge = new IntentBadge(this.scene);

    this.castOrigin = {
      player: new THREE.Vector3(...L.revealPos.player),
      enemy: new THREE.Vector3(...L.revealPos.enemy),
    };

    this.deckVis = {
      player: new DeckStack(assets, 'player'),
      enemy: new DeckStack(assets, 'enemy'),
    };
    this.scene.add(this.deckVis.player.group, this.deckVis.enemy.group);

    this.endTurnBtn = new EndTurnButton();
    this.scene.add(this.endTurnBtn.group);

    this.heroVis = null; // bindGame 后创建
    this._projA = new THREE.Vector3();
    this._projB = new THREE.Vector3();
  }

  bindGame(game) {
    this._combatEnded = false;
    this.game = game;
    const enc = game.encounter;
    this.heroVis = {
      player: new HeroVisual(this.assets, 'player', game.player.hero, 'hero_mage'),
      enemy: new HeroVisual(this.assets, 'enemy', game.enemy.hero, enc?.portrait || 'hero_warlock'),
    };
    this.scene.add(this.heroVis.player.group, this.heroVis.enemy.group);
    this.heroVis.player.updateMana(0, 0);
    this.heroVis.enemy.updateMana(0, 0);
    this.heroVis.enemy.setName(enc?.name || game.enemy.hero.name);
    this.hud?.setPlayerCombat?.(game.player.hero);
    this.syncEnemyHud();
    this.syncEnemyAnchor();
  }

  syncEnemyHud(intent) {
    const hero = this.game?.enemy?.hero;
    if (!hero) {
      this.hud?.setEnemyStatus?.({ name: '', intent: null });
      return;
    }
    const payload = {
      name: hero.name,
      hp: hero.hp,
      maxHp: hero.maxHp,
      armor: hero.armor || 0,
      portrait: this.game.encounter?.portrait || 'hero_warlock',
    };
    if (intent !== undefined) payload.intent = intent;
    this.hud?.setEnemyStatus?.(payload);
  }

  // ---------------- busy / 玩家操作入口 ----------------
  get busy() { return this._busy > 0; }
  canAct() { return !this.busy && this.game && this.game.turn === 'player' && !this.game.over; }

  async run(fn) {
    this._busy++;
    try { return await fn(); }
    finally { this._busy--; if (this.game && !this.game.over) this.refreshIndicators(); }
  }

  teardownCombat() {
    gsap.killTweensOf(this.world.camPos);
    for (const v of this.vis.values()) v.dispose();
    this.vis.clear();
    for (const v of this.enemyHandBacks) v.dispose();
    this.enemyHandBacks = [];
    this.hoverInst = null;
    this.hoverBoardInst = null;
    this.dragInst = null;
    this.dropZone.hide();
    this.world.setPlayLane?.(false);
    this.intentBadge.hide();
    this.hud?.setEnemyStatus?.({ name: '', intent: null });
    this.hud?.anchorEnemy?.(null);
    this.hud?.anchorPlayerHud?.(null);
    resetThinkHud(this.hud);
    this.hud?.hideEnemyBanter?.();
    this.world.screenFx?.reset();
    if (this.heroVis) {
      this.heroVis.player.group.removeFromParent();
      this.heroVis.enemy.group.removeFromParent();
      this.heroVis = null;
    }
    this.game = null;
    this._busy = 0;
    this._combatEnded = false;
    this.onCombatEnd = null;
  }

  async startGame() { return this.run(() => this.game.start()); }
  async playerPlay(inst, opts) {
    if (!this.canAct()) return false;
    this.dropZone.hide();
    return this.run(() => this.game.playCard(inst, opts));
  }
  async playerAttack(attacker, target) {
    if (!this.canAct()) return false;
    return this.run(() => this.game.attack(attacker, target));
  }
  async playerEndTurn() {
    if (!this.canAct()) return false;
    this.endTurnBtn.press();
    this.sfx.cue('ui.confirm');
    return this.run(() => this.game.endTurn('player'));
  }

  // ---------------- 布局 ----------------
  layoutHand() {
    if (!this.game) return;
    const visible = this.game.player.hand.filter((inst) => inst !== this.dragInst);
    const hoverIndex = this.hoverInst ? visible.indexOf(this.hoverInst) : -1;
    const ts = handTransforms(visible.length, hoverIndex);
    const feel = CFG.feel;
    visible.forEach((inst, i) => {
      const v = this.vis.get(inst.uid);
      if (!v) return;
      const hovered = inst === this.hoverInst;
      const t = hovered ? handHoverTransform(ts[i], i, visible.length) : ts[i];
      v.setLayered(hovered);
      v.setRenderOrder(hovered ? 90 : 10 + i);
      const dur = hovered ? feel.handHoverDur : feel.handRestDur;
      gsap.to(v.group.position, { x: t.pos.x, y: t.pos.y, z: t.pos.z, duration: dur, ease: 'power3.out', overwrite: 'auto' });
      gsap.to(v.group.rotation, { x: t.rot.x, y: t.rot.y, z: t.rot.z, duration: dur, ease: 'power3.out', overwrite: 'auto' });
      gsap.to(v.group.scale, { x: t.scale, y: t.scale, z: 1, duration: dur, ease: 'power3.out', overwrite: 'auto' });
    });
  }

  setBoardHover(inst) {
    if (this.hoverBoardInst === inst) return;
    const prev = this.hoverBoardInst;
    this.hoverBoardInst = inst;
    if (prev) {
      const v = this.vis.get(prev.uid);
      if (v) gsap.to(v.group.scale, { x: 1, y: 1, duration: 0.16, overwrite: 'auto' });
    }
    if (inst) {
      const v = this.vis.get(inst.uid);
      if (v) gsap.to(v.group.scale, { x: 1.07, y: 1.07, duration: 0.16, overwrite: 'auto' });
      this.sfx.cue('card.ground.hover');
    }
  }

  layoutEnemyHand() {
    const ts = enemyHandTransforms(this.enemyHandBacks.length);
    this.enemyHandBacks.forEach((v, i) => {
      const t = ts[i];
      v.setRenderOrder(10 + i);
      gsap.to(v.group.position, { x: t.pos.x, y: t.pos.y, z: t.pos.z, duration: 0.36, ease: 'power3.out', overwrite: 'auto' });
      gsap.to(v.group.rotation, { x: t.rot.x, y: t.rot.y, z: t.rot.z, duration: 0.36, ease: 'power3.out', overwrite: 'auto' });
      gsap.to(v.group.scale, { x: t.scale, y: t.scale, z: 1, duration: 0.36, ease: 'power3.out', overwrite: 'auto' });
    });
  }

  layoutBoard(side, gapIndex = null) {
    if (!this.game) return;
    const board = this.game.sideOf(side).board;
    const ts = gapIndex === null
      ? boardTransforms(board.length, side)
      : boardTransformsWithGap(board.length, side, gapIndex);
    board.forEach((m, i) => {
      const v = this.vis.get(m.uid);
      if (!v) return;
      const t = ts[i];
      v.setLayered(false);
      v.setRenderOrder(10 + i);
      v.syncBoardDecor();
      gsap.to(v.group.position, { x: t.pos.x, y: t.pos.y, z: t.pos.z, duration: 0.32, ease: 'power3.out', overwrite: 'auto' });
      gsap.to(v.group.rotation, { x: t.rot.x, y: t.rot.y, z: t.rot.z, duration: 0.32, ease: 'power3.out', overwrite: 'auto' });
      gsap.to(v.group.scale, { x: t.scale, y: t.scale, z: 1, duration: 0.32, ease: 'power3.out', overwrite: 'auto' });
    });
  }

  // ---------------- 实体定位 / 拾取 ----------------
  posOf(entity) {
    if (entity.kind === 'hero') {
      return this.heroVis[entity.side].group.position.clone().add(new THREE.Vector3(0, 0.15, 0.1));
    }
    const v = this.vis.get(entity.uid);
    return v ? v.group.position.clone() : new THREE.Vector3(0, 1, 0);
  }

  meshOf(entity) {
    if (entity.kind === 'hero') return this.heroVis[entity.side].portrait;
    return this.vis.get(entity.uid)?.face || null;
  }

  boardMeshes(side) {
    return this.game.sideOf(side).board.map((c) => this.vis.get(c.uid)?.face).filter(Boolean);
  }

  // 合法目标：弱高亮（红圈 / 红光）
  markValidTarget(entity, on) {
    if (entity.kind === 'hero') {
      this.heroVis[entity.side].setTargeted(on, false);
    } else {
      const v = this.vis.get(entity.uid);
      if (v) v.setGlow(on ? 'target' : 'none');
    }
  }

  // 悬停目标：强高亮（放大 + 高亮圈）
  hoverTargetMark(entity, on) {
    if (entity.kind === 'hero') {
      this.heroVis[entity.side].setTargeted(true, on);
    } else {
      const v = this.vis.get(entity.uid);
      if (v) {
        v.setGlow('target');
        gsap.to(v.group.scale, { x: on ? 1.1 : 1, y: on ? 1.1 : 1, duration: 0.16, overwrite: 'auto' });
      }
    }
  }

  clearAllHighlights() {
    this.heroVis.player.setTargeted(false);
    this.heroVis.enemy.setTargeted(false);
    for (const side of ['player', 'enemy']) {
      for (const m of this.game.sideOf(side).board) {
        const v = this.vis.get(m.uid);
        if (v) {
          v.setGlow('none');
          gsap.to(v.group.scale, { x: 1, y: 1, duration: 0.18, overwrite: 'auto' });
        }
      }
    }
    this.refreshIndicators();
  }

  // =====================================================================
  //  fx 接口实现（供 Game 调用）
  // =====================================================================
  async intro() {
    this.world.screenFx?.reset();
    this.world.screenFx?.setLetterbox(0.13, 0.01);
    this.world.camPos.y = 22;
    this.world.camPos.z = 24;
    this.hud.setTurnPill(0, 'none', false);
    this.sfx.cue('card.lifecycle.shuffle');
    if (this.combatKind === 'boss') this.sfx.cue('flow.combat.boss');
    else if (this.combatKind === 'elite') this.sfx.cue('flow.combat.elite');
    else this.sfx.cue('flow.combat.start');
    await gsap.to(this.world.camPos, {
      y: 13.2, z: 12.2, duration: 2.0, ease: 'power3.inOut', delay: 0.15,
    });
    this.world.screenFx?.setLetterbox(0, 0.7);
  }

  async turnBanner(side, turnNo) {
    this.sfx.turn(side === 'player');
    this.hud.banner(side === 'player' ? '你的回合' : '对手回合', side);
    await sleep(1050);
  }

  refreshIndicators() {
    const g = this.game;
    if (!g || !this.heroVis) return;
    for (const inst of g.player.hand) {
      const v = this.vis.get(inst.uid);
      if (v) v.setGlow(g.turn === 'player' && !g.over && g.canPlay(inst) ? 'playable' : 'none');
    }
    for (const side of ['player', 'enemy']) {
      for (const m of g.sideOf(side).board) {
        const v = this.vis.get(m.uid);
        if (!v) continue;
        v.syncBoardDecor();
        if (g.turn === side && !g.over) {
          v.setRing(m.canAttack && m.attack > 0 ? 'ready' : 'exhausted');
        } else {
          v.setRing(m.taunt ? 'taunt' : 'hidden');
        }
      }
    }
    this.endTurnBtn.setEnabled(g.turn === 'player' && !g.over);
    this.hud.setTurnPill(g.turnNo, g.turn, g.over);
    this.updatePiles('player');
    this.updateStrength();
    this.syncEnemyHud();
    this.hud?.setPlayerCombat?.(g.player.hero);
  }

  updateDeck(side) {
    const s = this.game.sideOf(side);
    this.deckVis[side].setCount(s.deck.length);
    this.updatePiles(side);
  }
  updatePiles(side) {
    if (!this.game || side !== 'player' || !this.hud.setPiles) return;
    const s = this.game.player;
    this.hud.setPiles(s.deck.length, s.discard.length, s.hand.length);
  }
  updateArmor(hero) { this.heroVis[hero.side]?.updateHp(); }
  updateStrength() {
    if (!this.game) return;
    this.hud.setStrength?.(this.game.player.strength, this.game.enemy.strength);
  }
  flashMana(side) { this.heroVis[side]?.flashMana(); }
  updateMana(side) {
    const s = this.game.sideOf(side);
    this.heroVis[side].updateMana(s.mana, s.manaMax);
  }
  updateHp(hero) {
    this.heroVis[hero.side].updateHp();
    if (hero.side === 'enemy') this.syncEnemyHud();
    if (hero.side === 'player') this.hud?.setPlayerCombat?.(hero);
  }
  updateStats(inst) { this.vis.get(inst.uid)?.updateStats(); }

  async drawCard(side, inst) {
    if (side === 'player') {
      const v = new CardVisual(this.assets, inst);
      const dp = L.deckPos.player;
      v.group.position.set(dp[0], dp[1] + 0.4, dp[2]);
      v.group.rotation.set(-0.66, Math.PI, 0);
      v.group.scale.setScalar(0.6);
      this.scene.add(v.group);
      this.vis.set(inst.uid, v);
      this.sfx.draw();
      this.layoutHand();
      await sleep(430);
    } else {
      const v = new CardVisual(this.assets, null, null);
      const dp = L.deckPos.enemy;
      v.group.position.set(dp[0], dp[1] + 0.4, dp[2]);
      v.group.rotation.set(0.5, Math.PI, 0);
      v.group.scale.setScalar(0.72);
      this.scene.add(v.group);
      this.enemyHandBacks.push(v);
      this.sfx.draw();
      this.layoutEnemyHand();
      await sleep(320);
    }
  }

  async drawFail(side) {
    this.hud.toast(side === 'player' ? '牌库抽空，受到疲劳伤害！' : '对手受到疲劳伤害');
    this.sfx.cue('ui.reject');
    const dp = L.deckPos[side];
    this.particles.burst(new THREE.Vector3(dp[0], 0.6, dp[2]), {
      count: 8, speed: 1.4, color: 0x777799, size: 0.2, life: 0.7, gravity: 0.5,
    });
    await sleep(240);
  }

  async burnCard(side, def) {
    this.hud.toast(side === 'player' ? '手牌已满，卡牌被焚毁了！' : '对手手牌已满，烧掉了一张牌');
    const v = new CardVisual(this.assets, null, def);
    const dp = L.deckPos[side];
    v.group.position.set(dp[0] * 0.82, dp[1] + 1.7, dp[2] * 0.86);
    v.group.rotation.set(-0.5, 0, 0);
    v.group.scale.setScalar(0.85);
    this.scene.add(v.group);
    this.sfx.burn();
    await sleep(420);
    await this.effects.dissolve(v, { fast: true });
  }

  async summon(inst, slot) {
    const side = inst.side;
    const board = this.game.sideOf(side).board;
    const ts = boardTransforms(board.length, side)[slot];

    if (side === 'player') {
      const v = this.vis.get(inst.uid);
      this.layoutHand();
      v.setRenderOrder(70);
      const tl = gsap.timeline();
      tl.to(v.group.rotation, { x: L.minionTilt, y: 0, z: 0, duration: 0.24, ease: 'power2.out' }, 0);
      tl.to(v.group.scale, { x: 1, y: 1, z: 1, duration: 0.24 }, 0);
      tl.to(v.group.position, { x: ts.pos.x, z: ts.pos.z, duration: 0.26, ease: 'power2.inOut' }, 0);
      tl.to(v.group.position, { y: ts.pos.y + 0.8, duration: 0.15, ease: 'power1.out' }, 0);
      tl.to(v.group.position, { y: ts.pos.y, duration: 0.14, ease: 'power3.in' }, 0.15);
      await tl;
      v.setLayered(false);
      this.effects.summonImpact(ts.pos, inst.def.tint || 0x9fd4ff);
      if (inst.def.rarity === 'legendary') {
        this.world.screenFx?.punch({
          letterbox: 0.06, bloom: 0.24, tint: inst.def.tint || 0xffa726, tintAmt: 0.2,
        });
      }
      v.syncBoardDecor();
      this.layoutBoard(side);
    } else {
      const v = await this.revealEnemy(inst, inst.def, 760);
      this.vis.set(inst.uid, v);
      const tl = gsap.timeline();
      tl.to(v.group.position, { x: ts.pos.x, z: ts.pos.z, duration: 0.3, ease: 'power2.inOut' }, 0);
      tl.to(v.group.rotation, { x: L.minionTilt, y: 0, z: 0, duration: 0.3 }, 0);
      tl.to(v.group.scale, { x: 1, y: 1, z: 1, duration: 0.3 }, 0);
      tl.to(v.group.position, { y: ts.pos.y + 0.7, duration: 0.16, ease: 'power1.out' }, 0.05);
      tl.to(v.group.position, { y: ts.pos.y, duration: 0.14, ease: 'power3.in' }, 0.21);
      await tl;
      this.effects.summonImpact(ts.pos, inst.def.tint || 0x9fd4ff);
      if (inst.def.rarity === 'legendary') {
        this.world.screenFx?.punch({
          letterbox: 0.06, bloom: 0.24, tint: inst.def.tint || 0xffa726, tintAmt: 0.2,
        });
      }
      v.syncBoardDecor();
      this.layoutBoard(side);
    }
  }

  // 敌方卡牌翻示（召唤 / 施法共用）
  async revealEnemy(instOrNull, def, holdMs) {
    const back = this.enemyHandBacks.pop();
    const v = new CardVisual(this.assets, instOrNull, def);
    if (back) {
      v.group.position.copy(back.group.position);
      v.group.rotation.copy(back.group.rotation);
      v.group.scale.copy(back.group.scale);
      back.dispose();
    } else {
      v.group.position.set(0, 2.4, -7.0);
      v.group.rotation.set(0.5, Math.PI, 0);
      v.group.scale.setScalar(0.72);
    }
    this.scene.add(v.group);
    this.layoutEnemyHand();
    v.setRenderOrder(75);
    const rp = L.revealPos.enemy;
    this.sfx.reveal();
    const tl = gsap.timeline();
    tl.to(v.group.position, { x: rp[0], y: rp[1], z: rp[2], duration: 0.45, ease: 'power2.out' }, 0);
    tl.to(v.group.rotation, { x: -0.5, y: 0, z: 0, duration: 0.45, ease: 'power2.inOut' }, 0);
    tl.to(v.group.scale, { x: 1.3, y: 1.3, z: 1, duration: 0.45 }, 0);
    await tl;
    await sleep(holdMs);
    return v;
  }

  async castSpell(inst, target) {
    const side = inst.side;
    if (side === 'player') {
      const v = this.vis.get(inst.uid);
      this.vis.delete(inst.uid);
      this.layoutHand();
      const rp = L.revealPos.player;
      this.castOrigin.player.set(rp[0], rp[1], rp[2]);
      if (v) {
        v.setRenderOrder(75);
        const tl = gsap.timeline();
        tl.to(v.group.position, { x: rp[0], y: rp[1], z: rp[2], duration: 0.26, ease: 'power2.out' }, 0);
        tl.to(v.group.rotation, { x: -0.45, y: 0, z: 0, duration: 0.26 }, 0);
        tl.to(v.group.scale, { x: 1.18, y: 1.18, z: 1, duration: 0.26 }, 0);
        await tl;
        this.sfx.cue('sfx.spell.prep');
        this.particles.burst(v.group.position.clone(), {
          count: 18, speed: 2.8, color: inst.def.tint || 0xb45cff, size: 0.26, life: 0.6, gravity: 0.4,
        });
        this.world.screenFx?.punch({ tint: inst.def.tint || 0xb45cff, tintAmt: 0.12, bloom: 0.12 });
        const t2 = gsap.timeline();
        t2.to(v.faceMat.uniforms.uOpacity, { value: 0, duration: 0.3 }, 0.05);
        t2.to(v.backMat, { opacity: 0, duration: 0.3 }, 0.05);
        t2.to(v.glowMat, { opacity: 0, duration: 0.2 }, 0);
        t2.to(v.group.position, { y: rp[1] + 0.7, duration: 0.35 }, 0);
        await t2;
        v.dispose();
      }
    } else {
      const v = await this.revealEnemy(null, inst.def, 800);
      const rp = L.revealPos.enemy;
      this.castOrigin.enemy.set(rp[0], rp[1], rp[2]);
      this.sfx.cue('sfx.spell.prep');
      this.particles.burst(v.group.position.clone(), {
        count: 18, speed: 2.8, color: inst.def.tint || 0xb45cff, size: 0.26, life: 0.6, gravity: 0.4,
      });
      this.world.screenFx?.punch({ tint: inst.def.tint || 0xb45cff, tintAmt: 0.12, bloom: 0.12 });
      const t2 = gsap.timeline();
      t2.to(v.faceMat.uniforms.uOpacity, { value: 0, duration: 0.32 }, 0);
      t2.to(v.backMat, { opacity: 0, duration: 0.32 }, 0);
      t2.to(v.group.position, { y: rp[1] + 0.7, duration: 0.36 }, 0);
      await t2;
      v.dispose();
    }
  }

  async projectile(vfx, side, target) {
    const to = this.posOf(target);
    const from = this.castOrigin[side].clone();
    await this.effects.castBolt(vfx, from, to);
  }

  async aoeStorm(targetSideName) {
    const board = this.game.sideOf(targetSideName).board;
    const positions = board.map((m) => this.posOf(m));
    await this.effects.firestorm(positions);
  }

  async healEffect(target) {
    await this.effects.heal(this.posOf(target));
  }

  async arcaneFlourish(side) {
    await this.effects.flourish(this.posOf(this.game.sideOf(side).hero), 0xb45cff);
  }

  async roar(inst) {
    await this.effects.roar(this.posOf(inst), inst.def.tint || 0xff5040);
  }

  damagePop(entity, n) {
    const pos = this.posOf(entity).add(new THREE.Vector3(0, 0.7, 0.3));
    const heavy = n >= 6;
    this.effects.damageNumber(pos, `-${n}`, heavy ? '#ffe08a' : '#ff6a55', n);
    this.sfx.cue('battle.combat.hp_damage');
    const away = new THREE.Vector3(0, 0.05, entity.side === 'player' ? 0.22 : -0.22);
    if (entity.kind === 'hero') {
      this.heroVis[entity.side].flashHit();
      this.world.screenFx?.punch({
        flash: n >= 5 ? 0.16 : 0.07,
        aberration: n >= 4 ? 0.48 : 0.2,
        shake: 0.1 + n * 0.026,
        bleed: entity.side === 'player' ? Math.min(0.88, 0.26 + n * 0.07) : 0,
        tint: 0xff4028,
        tintAmt: entity.side === 'player' ? 0.14 : 0.06,
      });
    } else {
      const v = this.vis.get(entity.uid);
      v?.flash(0xffe6c8);
      v?.recoil(away);
    }
  }

  healPop(entity, n) {
    if (n <= 0) return;
    const pos = this.posOf(entity).add(new THREE.Vector3(0, 0.7, 0.3));
    this.effects.damageNumber(pos, `+${n}`, '#7dff9e', n);
  }

  async attackLunge(attacker, target) {
    const v = this.vis.get(attacker.uid);
    if (!v) return;
    const side = attacker.side;
    const board = this.game.sideOf(side).board;
    const idx = board.indexOf(attacker);
    const t = boardTransforms(board.length, side)[Math.max(0, idx)];
    v._home = t;
    await this.effects.attackLunge(v, this.posOf(target), {
      tint: attacker.def.tint || 0xffcf8a,
      power: attacker.attack,
    });
  }

  async attackRecover(attacker) {
    const v = this.vis.get(attacker.uid);
    if (!v || !v._home) return;
    await this.effects.attackRecover(v, v._home.pos, v._home.rot);
  }

  async deaths(deadList) {
    await sleep(120);
    await Promise.all(deadList.map((m) => {
      const v = this.vis.get(m.uid);
      this.vis.delete(m.uid);
      return v ? this.effects.dissolve(v) : Promise.resolve();
    }));
    this.layoutBoard('player');
    this.layoutBoard('enemy');
  }

  async spawnMinion(inst, slot) {
    const side = inst.side;
    const board = this.game.sideOf(side).board;
    const ts = boardTransforms(board.length, side)[slot];
    const v = new CardVisual(this.assets, inst);
    v.group.position.set(ts.pos.x, ts.pos.y + 1.4, ts.pos.z);
    v.group.rotation.set(L.minionTilt, 0, 0);
    v.group.scale.setScalar(0.2);
    this.scene.add(v.group);
    this.vis.set(inst.uid, v);
    const tl = gsap.timeline();
    tl.to(v.group.scale, { x: 1, y: 1, z: 1, duration: 0.28, ease: 'back.out(2.2)' }, 0);
    tl.to(v.group.position, { y: ts.pos.y, duration: 0.28, ease: 'power3.out' }, 0);
    await tl;
    this.effects.summonImpact(ts.pos, inst.def.tint || 0x9fd4ff);
    v.syncBoardDecor();
    this.layoutBoard(side);
  }

  async showIntent(intent) { this.syncEnemyHud(intent); }
  async intentResolve(intent) { this.hud.toast(intent?.label || '预兆应验'); }
  async phaseChange(banner, intent) {
    this.hud.banner(banner, 'enemy');
    this.sfx.cue('flow.intent');
    this.world.screenFx?.punch({
      letterbox: 0.055, shake: 0.24, vignette: 0.16, tint: 0xff5040, tintAmt: 0.14, bloom: 0.12,
    });
    if (intent) this.syncEnemyHud(intent);
    await sleep(900);
  }
  async buffEffect(target) {
    await this.effects.flourish(this.posOf(target), 0xffd166, { cue: 'sfx.effect.buff' });
  }
  async debuffEffect(target) {
    await this.effects.shadowDrain(this.posOf(target));
  }
  async armorEffect(hero, n) {
    this.blockPop(hero, n, false);
    await this.effects.frostShield(this.posOf(hero));
  }
  blockPop(entity, n, absorbSfx = true) {
    const pos = this.posOf(entity).add(new THREE.Vector3(0.2, 0.55, 0.2));
    this.effects.damageNumber(pos, `甲${n}`, '#9fd0ff', n);
    if (absorbSfx) this.sfx.cue('battle.combat.armor_absorb');
  }
  async heroPowerVfx(kind, target) {
    const pos = this.posOf(target);
    if (kind === 'attack') {
      await this.effects.projectile(this.posOf(this.game.enemy.hero), pos, {
        color: 0xff6a55, size: 0.95, arc: 1.6, element: 'fire',
      });
    } else if (kind === 'defend') {
      await this.effects.frostShield(this.posOf(this.game.enemy.hero));
    } else if (kind === 'debuff') {
      await this.effects.shadowDrain(pos);
    } else {
      await this.effects.flourish(pos, 0xffd166);
    }
  }

  async gameOver(winner) {
    if (this._combatEnded) return;
    this._combatEnded = true;
    this.refreshIndicators();
    this.clearAllHighlightsSafe();
    this.intentBadge.hide();
    if (winner === 'player') {
      if (this.combatKind !== 'boss') this.sfx.cue('flow.victory.combat');
      this.effects.victoryBurst();
    } else {
      this.sfx.cue('flow.defeat');
      this.world.screenFx?.cinematicLose();
    }
    await sleep(650);
    if (this.onCombatEnd) await this.onCombatEnd(winner);
    else this.hud.gameOver(winner === 'player');
  }

  clearAllHighlightsSafe() {
    try { this.clearAllHighlights(); } catch (e) { /* 收尾期容错 */ }
  }

  toast(msg) { this.hud.toast(msg); }

  // ---------------- 帧更新 ----------------
  projectWorld(vec, out = this._projA) {
    out.copy(vec).project(this.world.camera);
    return {
      x: (out.x * 0.5 + 0.5) * window.innerWidth,
      y: (-out.y * 0.5 + 0.5) * window.innerHeight,
      z: out.z,
    };
  }

  syncEnemyAnchor() {
    const vis = this.heroVis?.enemy;
    if (!vis || !this.game) {
      this.hud?.anchorEnemy?.(null);
      return;
    }
    vis.portrait.getWorldPosition(this._projA);
    const center = this.projectWorld(this._projA, this._projB);
    this._projA.x += 1.12;
    const edge = this.projectWorld(this._projA, this._projB);
    const radius = Math.max(26, Math.abs(edge.x - center.x));
    vis.hpSprite.getWorldPosition(this._projA);
    const hp = this.projectWorld(this._projA, this._projB);
    this.hud?.anchorEnemy?.({
      skillX: hp.x - 28,
      skillY: hp.y,
      speechX: center.x + radius + 16,
      speechY: center.y,
    });
  }

  syncPlayerHudClearance() {
    const vis = this.heroVis?.player;
    if (!vis || !this.game) {
      this.hud?.anchorPlayerHud?.(null);
      return;
    }
    vis.hpSprite.getWorldPosition(this._projA);
    const hp = this.projectWorld(this._projA, this._projB);
    this._projA.x += 0.52;
    const edge = this.projectWorld(this._projA, this._projB);
    this.hud?.anchorPlayerHud?.({
      hpX: hp.x,
      hpR: Math.max(22, Math.abs(edge.x - hp.x)),
    });
  }

  update(dt, t) {
    if (this.heroVis) {
      this.heroVis.player.update(t);
      this.heroVis.enemy.update(t);
      this.syncEnemyAnchor();
      this.syncPlayerHudClearance();
    }
    this.endTurnBtn.update(t);
    this.dropZone.update(t);
    for (const v of this.vis.values()) {
      v.faceMat.uniforms.uTime.value = t;
    }
  }

  // ---------------- 调试辅助 ----------------
  resolveSel(sel) {
    if (sel === 'phero') return this.heroVis.player.group;
    if (sel === 'ehero') return this.heroVis.enemy.group;
    if (sel === 'endturn') return this.endTurnBtn.group;
    if (typeof sel === 'string' && sel.startsWith('hand')) {
      const i = parseInt(sel.slice(4), 10);
      const inst = this.game.player.hand[i];
      return inst ? this.vis.get(inst.uid)?.group : null;
    }
    if (typeof sel === 'number') return this.vis.get(sel)?.group || null;
    return null;
  }

  debugScreenPos(sel) {
    const obj = this.resolveSel(sel);
    if (!obj) return null;
    const v = obj.position.clone().project(this.world.camera);
    return {
      x: Math.round((v.x * 0.5 + 0.5) * window.innerWidth),
      y: Math.round((-v.y * 0.5 + 0.5) * window.innerHeight),
    };
  }
}
