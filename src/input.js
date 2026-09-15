import * as THREE from 'three';
import { gsap } from 'gsap';
import { CFG } from './config.js';
import { slotFromX, handTransforms, handHoverTransform } from './three/layout.js';
import { makeGlowTexture } from './utils/canvasTex.js';

const L = CFG.layout;
const F = CFG.feel;

// ---------- 指向箭头（能量珠链 + 锥头，避免每帧重建 Tube） ----------
class TargetArrow {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.glowTex = makeGlowTexture();
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xff4a3a, transparent: true, opacity: 0.92,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    this.head = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.52, 12), this.mat);
    this.head.renderOrder = 320;
    this.group.add(this.head);
    this.headGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex, color: 0xff6a4a, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    }));
    this.headGlow.scale.setScalar(0.95);
    this.headGlow.renderOrder = 321;
    this.group.add(this.headGlow);
    this.beads = [];
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, color: 0xff5a3a, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
      }));
      s.renderOrder = 318;
      s.scale.setScalar(0.16 + i * 0.028);
      this.group.add(s);
      this.beads.push(s);
    }
    scene.add(this.group);
    this._up = new THREE.Vector3(0, 1, 0);
    this._pt = new THREE.Vector3();
  }

  setColor(hex) {
    this.mat.color.setHex(hex);
    this.headGlow.material.color.setHex(hex);
    for (const b of this.beads) b.material.color.setHex(hex);
  }

  update(from, to) {
    this.group.visible = true;
    const ctrl = from.clone().add(to).multiplyScalar(0.5).add(new THREE.Vector3(0, 1.7, 0));
    const curve = new THREE.QuadraticBezierCurve3(from, ctrl, to);
    const n = this.beads.length;
    for (let i = 0; i < n; i++) {
      curve.getPoint((i + 1) / (n + 1), this._pt);
      this.beads[i].position.copy(this._pt);
    }
    this.head.position.copy(to);
    this.headGlow.position.copy(to);
    const tan = curve.getTangent(0.98).normalize();
    this.head.quaternion.setFromUnitVectors(this._up, tan);
  }

  pulse(t) {
    if (!this.group.visible) return;
    this.mat.opacity = 0.7 + 0.26 * Math.sin(t * 9);
    this.headGlow.material.opacity = 0.55 + 0.35 * Math.sin(t * 11);
    this.headGlow.scale.setScalar(0.82 + 0.22 * (0.5 + 0.5 * Math.sin(t * 10)));
  }

  hide() {
    this.group.visible = false;
  }
}

// =====================================================================
// 交互：屏幕空间手牌条带拾取 / 拖拽出牌 / 点选或拖拽瞄准 / 结束回合
// =====================================================================
export class InputController {
  constructor(world, game, director, hud, sfx) {
    this.world = world;
    this.game = game;
    this.director = director;
    this.hud = hud;
    this.sfx = sfx;

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this._proj = new THREE.Vector3();
    this.arrow = new TargetArrow(world.scene);

    this.enabled = true;
    this.mode = null;          // null | dragMinion | dragSpellFree | spellTarget | attack
    this.activeInst = null;
    this.validTargets = [];
    this.hoveredTarget = null;
    this.pendingSlot = null;
    this.willCast = false;
    this.dragArmed = false;
    this.gate = null;
    this._down = { x: 0, y: 0 };
    this.pointerId = null;
    this.arrowFrom = new THREE.Vector3();

    this.el = world.renderer.domElement;
    this.el.addEventListener('pointermove', (e) => this.onMove(e));
    this.el.addEventListener('pointerdown', (e) => this.onDown(e));
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', () => this.cancelDrag());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.mode) this.cancelDrag('已收回');
        else if (this.gate) return;
        else if (this.hud.onSettings) this.hud.onSettings();
        return;
      }
      if (!this.enabled) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        const block = this.gateBlock('end');
        if (block) { this.refuse(block); return; }
        this.director.playerEndTurn();
      }
    });
  }

  // ---------- 基础拾取 ----------
  updateNdc(e) {
    this.ndc.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    );
    this.world.setPointer(this.ndc.x, this.ndc.y);
  }

  pick(meshes) {
    if (!meshes.length) return null;
    this.raycaster.setFromCamera(this.ndc, this.world.camera);
    const hits = this.raycaster.intersectObjects(meshes, false);
    return hits.length ? hits[0].object : null;
  }

  planePoint(y) {
    this.raycaster.setFromCamera(this.ndc, this.world.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, out) ? out : null;
  }

  inRowZone(p) {
    const z = L.playerRowZone;
    return p && p.z > z.zMin && p.z < z.zMax && Math.abs(p.x) < z.xMax;
  }

  setCursor(c) { this.el.style.cursor = c; }

  setGate(gate) {
    this.gate = gate || null;
  }

  gateBlock(kind, inst) {
    const g = this.gate;
    if (!g) return null;
    if (kind === 'end') return g.endTurn ? null : (g.hint || '先看完这一步');
    if (kind === 'play') {
      if (!g.play) return g.hint || '先看完这一步';
      if (g.uids?.length && inst && !g.uids.includes(inst.uid)) return '先打出还亮着的牌';
      return null;
    }
    if (kind === 'attack') {
      if (!g.attack) return g.hint || '先看完这一步';
      if (g.uids?.length && inst && !g.uids.includes(inst.uid)) return '先用高亮的随从攻击';
      return null;
    }
    return g.hint || '先看完这一步';
  }

  refuse(msg) {
    if (!msg) return;
    this.hud.toast(msg);
    this.sfx.error();
  }

  movedEnough(e) {
    const dx = e.clientX - this._down.x;
    const dy = e.clientY - this._down.y;
    return dx * dx + dy * dy >= F.dragThreshold * F.dragThreshold;
  }

  capture(e) {
    if (e.pointerId == null) return;
    try { this.el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    this.pointerId = e.pointerId;
  }

  releaseCapture(e) {
    const id = e?.pointerId ?? this.pointerId;
    if (id == null) return;
    try {
      if (this.el.hasPointerCapture?.(id)) this.el.releasePointerCapture(id);
    } catch { /* ignore */ }
    this.pointerId = null;
  }

  // 按屏幕 X 切条带取手牌，带滞回；弹出的牌有更大点击盒
  pickHandInst() {
    const hand = this.game?.player?.hand;
    if (!hand?.length) return null;
    const drag = this.director.dragInst;
    const hover = this.director.hoverInst;
    const visible = [];
    for (const inst of hand) {
      if (inst !== drag) visible.push(inst);
    }
    if (!visible.length) return null;

    const hoverIndex = hover ? visible.indexOf(hover) : -1;
    const ts = handTransforms(visible.length, hoverIndex);
    const cam = this.world.camera;
    const pts = visible.map((inst, i) => {
      this._proj.copy(ts[i].pos).project(cam);
      const rec = { inst, nx: this._proj.x, ny: this._proj.y, hnx: this._proj.x, hny: this._proj.y };
      if (inst === hover) {
        const lifted = handHoverTransform(ts[i], i, visible.length);
        this._proj.copy(lifted.pos).project(cam);
        rec.hnx = this._proj.x;
        rec.hny = this._proj.y;
        const v = this.director.vis.get(inst.uid);
        if (v) {
          this._proj.copy(v.group.position).project(cam);
          rec.hnx = this._proj.x;
          rec.hny = this._proj.y;
        }
      }
      return rec;
    });

    const mx = this.ndc.x;
    const my = this.ndc.y;
    const nys = pts.map((p) => p.ny);
    const minNy = Math.min(...nys) - 0.16;
    const restMaxNy = Math.max(...nys) + 0.18;

    const sliverOf = () => {
      const sorted = pts.slice().sort((a, b) => a.nx - b.nx);
      if (sorted.length === 1) {
        return Math.abs(mx - sorted[0].nx) <= 0.3 ? sorted[0].inst : null;
      }
      if (hoverIndex >= 0) {
        const hi = sorted.findIndex((p) => p.inst === hover);
        const left = hi <= 0 ? -1.25 : (sorted[hi - 1].nx + sorted[hi].nx) * 0.5 - F.hoverSliverSlack;
        const right = hi >= sorted.length - 1 ? 1.25 : (sorted[hi].nx + sorted[hi + 1].nx) * 0.5 + F.hoverSliverSlack;
        if (mx >= left && mx <= right) return hover;
      }
      let chosen = sorted[0];
      for (let k = 0; k < sorted.length - 1; k++) {
        const mid = (sorted[k].nx + sorted[k + 1].nx) * 0.5;
        if (mx >= mid) chosen = sorted[k + 1];
      }
      return chosen.inst;
    };

    // 手牌条带内按屏幕 X 切条，左右移动立刻换牌
    if (my >= minNy && my <= restMaxNy) return sliverOf();

    // 鼠标跟到弹出的大牌上时保持选中，但不吞掉邻牌条带
    if (hoverIndex >= 0) {
      const h = pts[hoverIndex];
      if (Math.abs(mx - h.hnx) < F.hoverCardHalfX && my > restMaxNy && Math.abs(my - h.hny) < F.hoverCardHalfY) {
        return h.inst;
      }
    }
    return null;
  }

  pickBoardInst(side) {
    const sides = side ? [side] : ['player', 'enemy'];
    const meshes = sides.flatMap((s) => this.director.boardMeshes(s));
    const hit = this.pick(meshes);
    return hit?.userData?.cardVisual?.inst || null;
  }

  pickValidTarget() {
    const meshes = this.validTargets.map((t) => this.director.meshOf(t)).filter(Boolean);
    const hit = this.pick(meshes);
    if (!hit) return null;
    return this.validTargets.find((t) => this.director.meshOf(t) === hit) || null;
  }

  hideDropHint() {
    this.director.dropZone.hide();
  }

  // ---------- 悬停 ----------
  onMove(e) {
    this.updateNdc(e);
    const d = this.director;
    if (!this.enabled) { this.setCursor('default'); return; }

    if (this.mode === 'dragMinion' || this.mode === 'dragSpellFree') {
      if (!this.dragArmed && this.movedEnough(e)) this.dragArmed = true;
      const p = this.planePoint(L.dragPlaneY);
      if (p) {
        const v = d.vis.get(this.activeInst.uid);
        if (v) v.group.position.set(p.x, L.dragPlaneY + 0.42, p.z + 0.12);
        if (this.mode === 'dragMinion') {
          if (this.inRowZone(p)) {
            const gap = slotFromX(p.x, this.game.player.board.length);
            if (gap !== this.pendingSlot) {
              this.pendingSlot = gap;
              d.layoutBoard('player', gap);
            }
            d.dropZone.set('valid', { slot: this.pendingSlot, n: this.game.player.board.length });
            this.hud.setAimHint?.('放置于此 · 松开召唤');
          } else {
            if (this.pendingSlot !== null) {
              this.pendingSlot = null;
              d.layoutBoard('player');
            }
            this.hideDropHint();
            this.hud.setAimHint?.(this.dragArmed ? '拖到己方战场' : '拖到战场召唤');
          }
        } else {
          this.willCast = p.z < L.spellCastZ;
          if (this.willCast) {
            d.dropZone.set('cast');
            this.hud.setAimHint?.('松手施放');
          } else {
            this.hideDropHint();
            this.hud.setAimHint?.('拖向战场中央施放');
          }
        }
      }
      return;
    }

    if (this.mode === 'spellTarget' || this.mode === 'attack') {
      if (!this.dragArmed && this.movedEnough(e)) this.dragArmed = true;
      const p = this.planePoint(1.0);
      if (p) this.arrow.update(this.arrowFrom.clone(), new THREE.Vector3(p.x, Math.max(p.y, 0.6), p.z));
      const target = this.pickValidTarget();
      if (target) this.arrow.update(this.arrowFrom.clone(), d.posOf(target));
      if (target !== this.hoveredTarget) {
        if (this.hoveredTarget) d.hoverTargetMark(this.hoveredTarget, false);
        this.hoveredTarget = target;
        if (target) {
          d.hoverTargetMark(target, true);
          this.sfx.hover('target');
          this.updateAimPreview(target);
        } else {
          this.hud.setAimHint?.(this.mode === 'attack' ? '指向或点击合法目标' : '点击或指向法术目标');
        }
      }
      return;
    }

    if (d.busy || !this.game || this.game.over) {
      this.clearIdleHover();
      this.setCursor('default');
      return;
    }

    const endHit = this.pick([d.endTurnBtn.mesh]);
    d.endTurnBtn.hover(!!endHit && d.endTurnBtn.enabled);
    if (endHit && d.endTurnBtn.enabled) this.setCursor('pointer');

    let newHover = null;
    if (this.game.turn === 'player') newHover = this.pickHandInst();
    if (newHover !== d.hoverInst) {
      d.hoverInst = newHover;
      d.layoutHand();
      if (newHover) this.sfx.hover('card');
    }
    if (newHover) {
      d.setBoardHover(null);
      this.setCursor('grab');
      return;
    }

    const bInst = this.pickBoardInst();
    d.setBoardHover(bInst);
    if (bInst) {
      const canHit = bInst.side === 'player' && bInst.canAttack && bInst.attack > 0 && this.game.turn === 'player';
      this.setCursor(canHit ? 'grab' : 'pointer');
      return;
    }
    if (!endHit) this.setCursor('default');
  }

  clearIdleHover() {
    const d = this.director;
    if (d.hoverInst) {
      d.hoverInst = null;
      d.layoutHand();
    }
    d.setBoardHover(null);
  }

  // ---------- 按下 ----------
  onDown(e) {
    if (e.button === 2) {
      e.preventDefault();
      if (this.mode) this.cancelDrag('已取消');
      return;
    }
    if (e.button !== 0) return;
    this.updateNdc(e);
    this._down.x = e.clientX;
    this._down.y = e.clientY;
    const d = this.director;

    if (this.mode === 'spellTarget' || this.mode === 'attack') {
      const target = this.pickValidTarget();
      if (target) this.hoveredTarget = target;
      else this.cancelDrag('已取消');
      return;
    }

    if (!this.enabled || !this.game || this.game.over) return;

    const endHit = this.pick([d.endTurnBtn.mesh]);
    if (endHit) {
      const block = this.gateBlock('end');
      if (block) { this.refuse(block); return; }
      if (d.canAct()) d.playerEndTurn();
      else if (this.game.turn === 'enemy') this.hud.toast('对手正在行动…');
      return;
    }

    if (!d.canAct()) {
      if (this.game.turn === 'enemy') this.hud.toast('对手正在行动…');
      return;
    }

    const handInst = this.pickHandInst();
    if (handInst) {
      const gated = this.gateBlock('play', handInst);
      if (gated) { this.refuse(gated); return; }
      const reason = this.game.playBlockReason(handInst);
      if (reason) {
        this.hud.toast(reason);
        this.sfx.error();
        this.wiggle(d.vis.get(handInst.uid));
        if (reason.includes('法力')) d.flashMana('player');
        return;
      }
      this.beginHandAction(e, handInst);
      return;
    }

    const bInst = this.pickBoardInst('player');
    if (bInst) {
      const gated = this.gateBlock('attack', bInst);
      if (gated) { this.refuse(gated); return; }
      if (!bInst.canAttack || bInst.attack <= 0) {
        if (bInst.attack <= 0) this.hud.toast('这个随从无法攻击');
        else if (bInst.sick) this.hud.toast('随从刚入场，需要休整一回合');
        else this.hud.toast('本回合已经攻击过了');
        this.sfx.error();
        this.wiggle(d.vis.get(bInst.uid));
        return;
      }
      this.beginAttack(e, bInst);
    }
  }

  beginHandAction(e, inst) {
    const d = this.director;
    d.hoverInst = null;
    d.setBoardHover(null);
    this.activeInst = inst;
    this.dragArmed = false;
    this.pendingSlot = null;
    this.willCast = false;
    this.capture(e);
    const def = inst.def;
    const v = d.vis.get(inst.uid);
    d.dragInst = inst;
    if (v) {
      gsap.killTweensOf([v.group.position, v.group.rotation, v.group.scale]);
      v.setLayered(true);
      v.setRenderOrder(95);
    }

    if (def.type === 'minion') {
      this.mode = 'dragMinion';
      this.world.setPlayLane?.(true);
      gsap.to(v.group.rotation, { x: -1.05, y: 0, z: 0, duration: 0.18, overwrite: 'auto' });
      gsap.to(v.group.scale, { x: 1.02, y: 1.02, z: 1, duration: 0.18, overwrite: 'auto' });
      this.setCursor('grabbing');
      this.hud.setAimHint?.('拖到己方战场召唤');
    } else if (this.game.needsTarget(def)) {
      this.mode = 'spellTarget';
      this.arrow.setColor(0xb45cff);
      gsap.to(v.group.position, { x: v.group.position.x * 0.6, y: 3.6, z: 6.15, duration: 0.22, ease: 'power2.out', overwrite: 'auto' });
      gsap.to(v.group.rotation, { x: -0.28, y: 0, z: 0, duration: 0.22, overwrite: 'auto' });
      gsap.to(v.group.scale, { x: 1.15, y: 1.15, z: 1, duration: 0.22, overwrite: 'auto' });
      this.arrowFrom.set(v.group.position.x * 0.6, 3.6, 6.15).add(new THREE.Vector3(0, 0.4, -0.9));
      this.validTargets = this.game.validTargets(inst);
      for (const t of this.validTargets) d.markValidTarget(t, true);
      this.setCursor('crosshair');
      this.hud.setAimHint?.('点击或指向发光目标');
    } else {
      this.mode = 'dragSpellFree';
      this.world.setPlayLane?.(true);
      gsap.to(v.group.rotation, { x: -0.9, y: 0, z: 0, duration: 0.18, overwrite: 'auto' });
      this.setCursor('grabbing');
      this.hud.setAimHint?.('拖向战场中央施放');
    }
    d.layoutHand();
    this.sfx.pickup('card');
  }

  beginAttack(e, inst) {
    const d = this.director;
    this.mode = 'attack';
    this.arrow.setColor(0xff4a3a);
    this.activeInst = inst;
    this.dragArmed = false;
    this.capture(e);
    this.arrowFrom.copy(d.posOf(inst)).add(new THREE.Vector3(0, 0.5, 0));
    this.validTargets = this.game.validAttackTargets(inst);
    for (const t of this.validTargets) d.markValidTarget(t, true);
    this.sfx.pickup('attack');
    this.setCursor('crosshair');
    this.hud.setAimHint?.('点击或指向合法目标攻击');
  }

  // ---------- 松开 ----------
  async onUp(e) {
    this.releaseCapture(e);
    if (!this.mode) return;
    this.updateNdc(e);
    const d = this.director;
    const mode = this.mode;
    const inst = this.activeInst;
    const hovered = this.hoveredTarget;
    const slot = this.pendingSlot;
    const willCast = this.willCast;
    const dragged = this.dragArmed;

    if ((mode === 'spellTarget' || mode === 'attack') && !hovered && !dragged) {
      this.hud.setAimHint?.(mode === 'attack' ? '点击合法目标攻击' : '点击合法目标施放');
      return;
    }

    this.resetMode();

    const finishCancel = (msg) => {
      d.dragInst = null;
      d.clearAllHighlights();
      d.layoutHand();
      d.layoutBoard('player');
      if (dragged || msg) this.sfx.cue('card.drag.return');
      if (msg) this.hud.toast(msg);
    };

    if (mode === 'dragMinion') {
      if (slot !== null) {
        d.dragInst = null;
        d.clearAllHighlights();
        const ok = await d.playerPlay(inst, { slot });
        if (!ok) finishCancel('无法在此召唤');
      } else {
        finishCancel(dragged ? '已收回手牌' : null);
      }
      return;
    }

    if (mode === 'dragSpellFree') {
      if (willCast) {
        d.dragInst = null;
        d.clearAllHighlights();
        const ok = await d.playerPlay(inst, {});
        if (!ok) finishCancel('无法施放');
      } else {
        finishCancel(dragged ? '已收回手牌' : null);
      }
      return;
    }

    if (mode === 'spellTarget') {
      if (hovered) {
        d.dragInst = null;
        d.clearAllHighlights();
        const ok = await d.playerPlay(inst, { target: hovered });
        if (!ok) finishCancel('目标不合法');
      } else {
        finishCancel('已取消施法');
      }
      return;
    }

    if (mode === 'attack') {
      d.clearAllHighlights();
      if (hovered) await d.playerAttack(inst, hovered);
    }
  }

  resetMode() {
    this.mode = null;
    this.activeInst = null;
    this.hoveredTarget = null;
    this.pendingSlot = null;
    this.willCast = false;
    this.dragArmed = false;
    this.arrow.hide();
    this.setCursor('default');
    this.hideDropHint();
    this.world.setPlayLane?.(false);
    this.hud.setAimHint?.('');
  }

  cancelDrag(msg) {
    if (!this.mode) {
      this.hideDropHint();
      return;
    }
    const d = this.director;
    this.releaseCapture();
    this.resetMode();
    d.dragInst = null;
    d.setBoardHover(null);
    d.clearAllHighlights();
    d.layoutHand();
    d.layoutBoard('player');
    if (msg) this.hud.toast(msg);
  }

  updateAimPreview(target) {
    if (!this.activeInst) return;
    if (this.mode === 'attack') {
      const prev = this.game.previewAttack(this.activeInst, target);
      if (!prev) return;
      if (target.kind === 'hero') {
        this.hud.setAimHint?.(prev.lethal ? `斩杀 · ${prev.dmg} 伤` : `造成 ${prev.dmg} 伤${prev.soak ? `（甲抵 ${prev.soak}）` : ''}`);
      } else {
        this.hud.setAimHint?.(prev.lethal ? `击杀 · ${prev.dmg} 伤` : `造成 ${prev.dmg} 伤 · 反伤 ${target.attack}`);
      }
      return;
    }
    const sp = this.activeInst.def?.spell;
    if (sp?.kind === 'damage') {
      const amt = this.game.spellDamage(sp.amount);
      this.hud.setAimHint?.(`造成 ${amt} 点伤害`);
    }
    else if (sp?.kind === 'heal') this.hud.setAimHint?.(`恢复 ${sp.amount} 点生命`);
    else if (sp?.kind === 'buff') this.hud.setAimHint?.(`+${sp.amount} 攻击`);
    else if (sp?.kind === 'debuff') this.hud.setAimHint?.(`-${sp.amount} 攻击`);
    else this.hud.setAimHint?.('松手或点击确认');
  }

  wiggle(v) {
    if (!v) return;
    gsap.fromTo(v.group.rotation, { z: -0.06 }, {
      z: 0, duration: 0.4, ease: 'elastic.out(2.2, 0.3)', overwrite: 'auto',
    });
  }

  update(t) {
    if (!this.mode) {
      this.hideDropHint();
      this.world.setPlayLane?.(false);
    }
    this.arrow.pulse(t);
  }
}
