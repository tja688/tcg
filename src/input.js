import * as THREE from 'three';
import { gsap } from 'gsap';
import { CFG } from './config.js';
import { slotFromX } from './three/layout.js';

const L = CFG.layout;

// ---------- 指向箭头（贝塞尔管道 + 箭头锥） ----------
class TargetArrow {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xff4a3a, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    this.head = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.6, 12), this.mat);
    this.head.renderOrder = 320;
    this.group.add(this.head);
    this.tube = null;
    scene.add(this.group);
    this._up = new THREE.Vector3(0, 1, 0);
  }

  update(from, to) {
    this.group.visible = true;
    const ctrl = from.clone().add(to).multiplyScalar(0.5).add(new THREE.Vector3(0, 1.7, 0));
    const curve = new THREE.QuadraticBezierCurve3(from, ctrl, to);
    if (this.tube) {
      this.tube.geometry.dispose();
      this.group.remove(this.tube);
    }
    this.tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 22, 0.055, 8, false), this.mat);
    this.tube.renderOrder = 319;
    this.group.add(this.tube);
    this.head.position.copy(to);
    const tan = curve.getTangent(0.98).normalize();
    this.head.quaternion.setFromUnitVectors(this._up, tan);
  }

  hide() {
    this.group.visible = false;
    if (this.tube) {
      this.tube.geometry.dispose();
      this.group.remove(this.tube);
      this.tube = null;
    }
  }
}

// =====================================================================
// 交互控制器：悬停 / 拖拽出牌 / 指向攻击 / 结束回合
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
    this.arrow = new TargetArrow(world.scene);

    this.enabled = true;
    this.mode = null;          // null | dragMinion | dragSpellFree | spellTarget | attack
    this.activeInst = null;    // 被拖拽/施法的牌 或 攻击者
    this.validTargets = [];
    this.hoveredTarget = null;
    this.pendingSlot = null;
    this.willCast = false;
    this.arrowFrom = new THREE.Vector3();

    const el = world.renderer.domElement;
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.mode) this.cancelDrag('已收回');
        return;
      }
      if (!this.enabled) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.director.playerEndTurn();
      }
    });
  }

  instFromHit(hit) {
    return hit?.userData?.inst || hit?.userData?.cardVisual?.inst || null;
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

  setCursor(c) { this.world.renderer.domElement.style.cursor = c; }

  // ---------- 悬停 ----------
  onMove(e) {
    this.updateNdc(e);
    const d = this.director;
    if (!this.enabled) { this.setCursor('default'); return; }

    if (this.mode === 'dragMinion' || this.mode === 'dragSpellFree') {
      const p = this.planePoint(L.dragPlaneY);
      if (p) {
        const v = d.vis.get(this.activeInst.uid);
        if (v) v.group.position.set(p.x, L.dragPlaneY + 0.35, p.z);
        if (this.mode === 'dragMinion') {
          if (this.inRowZone(p)) {
            const gap = slotFromX(p.x, this.game.player.board.length);
            if (gap !== this.pendingSlot) {
              this.pendingSlot = gap;
              d.layoutBoard('player', gap);
            }
            d.dropZone.set('valid', { slot: this.pendingSlot, n: this.game.player.board.length });
            this.hud.setAimHint?.('放置于此 · 松开召唤');
          } else if (this.pendingSlot !== null) {
            this.pendingSlot = null;
            d.layoutBoard('player');
            d.dropZone.set('cancel');
            this.hud.setAimHint?.('松手取消');
          } else {
            d.dropZone.set('cancel');
            this.hud.setAimHint?.('松手取消');
          }
        } else {
          this.willCast = p.z < L.spellCastZ;
          d.dropZone.set(this.willCast ? 'cast' : 'cancel');
          this.hud.setAimHint?.(this.willCast ? '松手施放' : '松手取消');
        }
      }
      return;
    }

    if (this.mode === 'spellTarget' || this.mode === 'attack') {
      const p = this.planePoint(1.0);
      if (p) this.arrow.update(this.arrowFrom.clone(), new THREE.Vector3(p.x, Math.max(p.y, 0.6), p.z));
      // 检测悬停目标
      const meshes = this.validTargets.map((t) => d.meshOf(t)).filter(Boolean);
      const hit = this.pick(meshes);
      let target = null;
      if (hit) {
        target = this.validTargets.find((t) => d.meshOf(t) === hit) || null;
        if (target) this.arrow.update(this.arrowFrom.clone(), d.posOf(target));
      }
      if (target !== this.hoveredTarget) {
        if (this.hoveredTarget) d.hoverTargetMark(this.hoveredTarget, false);
        this.hoveredTarget = target;
        if (target) {
          d.hoverTargetMark(target, true);
          this.sfx.hover();
          this.updateAimPreview(target);
        } else {
          this.hud.setAimHint?.(this.mode === 'attack' ? '指向合法目标' : '选择法术目标');
        }
      }
      return;
    }

    // ---- 无模式：悬停反馈 ----
    if (d.busy || !this.game || this.game.over) { this.setCursor('default'); return; }

    // 结束回合按钮
    const endHit = this.pick([d.endTurnBtn.mesh]);
    d.endTurnBtn.hover(!!endHit && d.endTurnBtn.enabled);
    if (endHit && d.endTurnBtn.enabled) { this.setCursor('pointer'); }

    // 手牌悬停
    let newHover = null;
    if (this.game.turn === 'player') {
      const hit = this.pick(d.handMeshes());
      if (hit) newHover = this.instFromHit(hit);
    }
    if (newHover !== d.hoverInst) {
      d.hoverInst = newHover;
      d.layoutHand();
      if (newHover) this.sfx.hover();
    }
    if (newHover) { this.setCursor('grab'); return; }

    // 己方可攻击随从悬停
    const bHit = this.pick(d.boardMeshes('player'));
    if (bHit) {
      const inst = bHit.userData.cardVisual?.inst;
      if (inst && inst.canAttack && inst.attack > 0 && this.game.turn === 'player') {
        this.setCursor('grab');
        return;
      }
    }
    if (!endHit) this.setCursor('default');
  }

  // ---------- 按下 ----------
  onDown(e) {
    if (e.button !== 0) return;
    this.updateNdc(e);
    const d = this.director;
    if (!this.enabled || !this.game || this.game.over) return;

    // 结束回合
    const endHit = this.pick([d.endTurnBtn.mesh]);
    if (endHit) {
      if (d.canAct()) d.playerEndTurn();
      else if (this.game.turn === 'enemy') this.hud.toast('对手正在行动…');
      return;
    }

    if (!d.canAct()) {
      if (this.game.turn === 'enemy') this.hud.toast('对手正在行动…');
      return;
    }

    // 手牌
    const handHit = this.pick(d.handMeshes());
    if (handHit) {
      const inst = this.instFromHit(handHit);
      const reason = this.game.playBlockReason(inst);
      if (reason) {
        this.hud.toast(reason);
        this.sfx.error();
        this.wiggle(d.vis.get(inst.uid));
        if (reason.includes('法力')) d.flashMana('player');
        return;
      }
      d.hoverInst = null;
      this.activeInst = inst;
      const def = inst.def;
      if (def.type === 'minion') {
        this.mode = 'dragMinion';
        d.dragInst = inst;
        this.pendingSlot = null;
        const v = d.vis.get(inst.uid);
        v.setRenderOrder(65);
        gsap.to(v.group.rotation, { x: -1.05, y: 0, z: 0, duration: 0.2, overwrite: 'auto' });
        gsap.to(v.group.scale, { x: 1.02, y: 1.02, z: 1, duration: 0.2, overwrite: 'auto' });
        this.setCursor('grabbing');
        d.dropZone.set('cancel');
        this.hud.setAimHint?.('拖到发光区域召唤');
      } else if (this.game.needsTarget(def)) {
        this.mode = 'spellTarget';
        d.dragInst = inst; // 固定住不参与布局
        const v = d.vis.get(inst.uid);
        // 施法卡抬起到手牌上方中央
        gsap.to(v.group.position, { x: v.group.position.x * 0.6, y: 3.6, z: 6.0, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
        gsap.to(v.group.rotation, { x: -0.45, y: 0, z: 0, duration: 0.25, overwrite: 'auto' });
        gsap.to(v.group.scale, { x: 1.15, y: 1.15, z: 1, duration: 0.25, overwrite: 'auto' });
        v.setRenderOrder(65);
        this.arrowFrom.set(v.group.position.x * 0.6, 3.6, 6.0).add(new THREE.Vector3(0, 0.4, -0.9));
        this.validTargets = this.game.validTargets(inst);
        for (const t of this.validTargets) d.markValidTarget(t, true);
        this.setCursor('crosshair');
        this.hud.setAimHint?.('指向发光目标');
      } else {
        this.mode = 'dragSpellFree';
        d.dragInst = inst;
        this.willCast = false;
        const v = d.vis.get(inst.uid);
        v.setRenderOrder(65);
        gsap.to(v.group.rotation, { x: -0.9, y: 0, z: 0, duration: 0.2, overwrite: 'auto' });
        this.setCursor('grabbing');
        d.dropZone.set('cancel');
        this.hud.setAimHint?.('拖向战场中央施放');
      }
      this.sfx.pickup();
      return;
    }

    // 己方随从 → 攻击指向
    const bHit = this.pick(d.boardMeshes('player'));
    if (bHit) {
      const inst = bHit.userData.cardVisual.inst;
      if (!inst.canAttack || inst.attack <= 0) {
        if (inst.attack <= 0) this.hud.toast('这个随从无法攻击');
        else if (inst.sick) this.hud.toast('随从刚入场，需要休整一回合');
        else this.hud.toast('本回合已经攻击过了');
        this.sfx.error();
        this.wiggle(d.vis.get(inst.uid));
        return;
      }
      this.mode = 'attack';
      this.activeInst = inst;
      this.arrowFrom.copy(d.posOf(inst)).add(new THREE.Vector3(0, 0.5, 0));
      this.validTargets = this.game.validAttackTargets(inst);
      for (const t of this.validTargets) d.markValidTarget(t, true);
      this.sfx.pickup();
      this.setCursor('crosshair');
      this.hud.setAimHint?.('指向合法目标攻击');
      return;
    }
  }

  // ---------- 松开 ----------
  async onUp(e) {
    if (!this.mode) return;
    this.updateNdc(e);
    const d = this.director;
    const mode = this.mode;
    const inst = this.activeInst;
    const hovered = this.hoveredTarget;
    const slot = this.pendingSlot;
    const willCast = this.willCast;

    // 清理交互态
    this.mode = null;
    this.activeInst = null;
    this.hoveredTarget = null;
    this.pendingSlot = null;
    this.willCast = false;
    this.arrow.hide();
    this.setCursor('default');
    d.dropZone.set('hidden');
    this.hud.setAimHint?.('');

    const finishCancel = (msg) => {
      d.dragInst = null;
      d.clearAllHighlights();
      d.layoutHand();
      d.layoutBoard('player');
      if (msg) this.hud.toast(msg);
    };

    if (mode === 'dragMinion') {
      if (slot !== null) {
        d.dragInst = null;
        d.clearAllHighlights();
        const ok = await d.playerPlay(inst, { slot });
        if (!ok) { finishCancel('无法在此召唤'); }
      } else {
        finishCancel('已收回手牌');
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
        finishCancel('已收回手牌');
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
      if (hovered) {
        await d.playerAttack(inst, hovered);
      }
      return;
    }
  }

  cancelDrag(msg) {
    if (!this.mode) return;
    const d = this.director;
    this.mode = null;
    this.activeInst = null;
    this.hoveredTarget = null;
    this.pendingSlot = null;
    this.willCast = false;
    this.arrow.hide();
    this.setCursor('default');
    d.dropZone.set('hidden');
    d.dragInst = null;
    d.clearAllHighlights();
    d.layoutHand();
    d.layoutBoard('player');
    this.hud.setAimHint?.('');
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
    if (sp?.kind === 'damage') this.hud.setAimHint?.(`造成 ${sp.amount} 点伤害`);
    else if (sp?.kind === 'heal') this.hud.setAimHint?.(`恢复 ${sp.amount} 点生命`);
    else if (sp?.kind === 'buff') this.hud.setAimHint?.(`+${sp.amount} 攻击`);
    else if (sp?.kind === 'debuff') this.hud.setAimHint?.(`-${sp.amount} 攻击`);
    else this.hud.setAimHint?.('松手确认');
  }

  wiggle(v) {
    if (!v) return;
    gsap.fromTo(v.group.rotation, { z: -0.06 }, {
      z: 0, duration: 0.4, ease: 'elastic.out(2.2, 0.3)', overwrite: 'auto',
    });
  }

  update(t) {
    if (this.arrow.group.visible) {
      this.arrow.mat.opacity = 0.72 + 0.22 * Math.sin(t * 9);
    }
  }
}
