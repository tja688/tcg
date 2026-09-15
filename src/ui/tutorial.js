import * as THREE from 'three';
import { gsap } from 'gsap';
import { CFG } from '../config.js';
import { markTutorialDone, resetTutorialProgress, shouldArmTutorial } from './tutorialStore.js';
import {
  TUTORIAL_PHASES,
  gateForStep,
  nextPhase,
  stepForPhase,
} from './tutorialFlow.js';
import './tutorial.css';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

function reduceMotion() {
  return globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

function clampBox(box) {
  if (!box) return null;
  const pad = 8;
  const x = Math.max(pad, box.x);
  const y = Math.max(pad, box.y);
  const r = Math.min(window.innerWidth - pad, box.x + box.w);
  const b = Math.min(window.innerHeight - pad, box.y + box.h);
  if (r - x < 20 || b - y < 20) return null;
  return { x, y, w: r - x, h: b - y, r: box.r ?? 18 };
}

function elBox(el, pad = 10) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  return clampBox({
    x: r.left - pad,
    y: r.top - pad,
    w: r.width + pad * 2,
    h: r.height + pad * 2,
    r: Math.min(22, Math.round(Math.min(r.width, r.height) * 0.35)),
  });
}

function sphereBox(director, pos, radius, pad = 14) {
  const c = director.projectWorld(pos);
  _b.copy(pos).x += radius;
  const edge = director.projectWorld(_b);
  const pr = Math.max(26, Math.abs(edge.x - c.x)) + pad;
  return clampBox({ x: c.x - pr, y: c.y - pr, w: pr * 2, h: pr * 2, r: pr });
}

function unionBoxes(boxes) {
  const list = boxes.filter(Boolean);
  if (!list.length) return null;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const b of list) {
    x1 = Math.min(x1, b.x);
    y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.w);
    y2 = Math.max(y2, b.y + b.h);
  }
  return clampBox({ x: x1, y: y1, w: x2 - x1, h: y2 - y1, r: 22 });
}

function overlapArea(a, b) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

export class Tutorial {
  constructor({ director, input, hud, sfx }) {
    this.director = director;
    this.input = input;
    this.hud = hud;
    this.sfx = sfx;
    this.pending = false;
    this.active = false;
    this.phase = null;
    this.step = null;
    this._holes = [];
    this._advancing = false;
    this._cardPinned = false;
    this.buildDom();
    director.onPlayerAct = (kind) => this.onAct(kind);
  }

  buildDom() {
    document.getElementById('tutorialRoot')?.remove();
    this.root = document.createElement('div');
    this.root.id = 'tutorialRoot';
    this.root.dataset.testid = 'tutorial';
    this.root.hidden = true;
    this.root.innerHTML = `
      <svg class="tutShade" aria-hidden="true">
        <defs>
          <mask id="tutMask">
            <rect width="100%" height="100%" fill="white"/>
            <g data-holes></g>
          </mask>
        </defs>
        <rect class="tutFill" width="100%" height="100%" mask="url(#tutMask)"/>
        <g data-halos></g>
      </svg>
      <svg class="tutHit" aria-hidden="true">
        <path data-hit fill="transparent" fill-rule="evenodd"/>
      </svg>
      <div class="tutSpots" data-spots></div>
      <div class="tutArrow" data-arrow hidden>
        <svg viewBox="0 0 24 24"><path fill="currentColor" d="M14 4l8 8-8 8v-5H2v-6h12V4z"/></svg>
      </div>
      <aside class="tutCard" role="dialog" aria-modal="true" aria-labelledby="tutTitle" aria-describedby="tutBody">
        <p class="tutEyebrow" data-eye></p>
        <h3 id="tutTitle" data-title></h3>
        <p class="tutBody" id="tutBody" data-body></p>
        <button class="tutNext" type="button" data-next data-testid="tutorial-next">继续</button>
        <p class="tutHint" data-hint hidden></p>
      </aside>
    `;
    document.body.appendChild(this.root);
    this.shade$ = this.root.querySelector('.tutShade');
    this.hit$ = this.root.querySelector('.tutHit');
    this.holes$ = this.root.querySelector('[data-holes]');
    this.halos$ = this.root.querySelector('[data-halos]');
    this.hitPath$ = this.root.querySelector('[data-hit]');
    this.spots$ = this.root.querySelector('[data-spots]');
    this.arrow$ = this.root.querySelector('[data-arrow]');
    this.card$ = this.root.querySelector('.tutCard');
    this.eye$ = this.root.querySelector('[data-eye]');
    this.title$ = this.root.querySelector('[data-title]');
    this.body$ = this.root.querySelector('[data-body]');
    this.next$ = this.root.querySelector('[data-next]');
    this.hint$ = this.root.querySelector('[data-hint]');
    this.next$.onclick = () => this.advance('continue');
  }

  armOnRunStart() {
    this.pending = shouldArmTutorial();
  }

  willStart() {
    return this.pending && !this.active;
  }

  async maybeBegin() {
    if (!this.pending || this.active) return false;
    const game = this.director.game;
    if (!game || game.over) return false;
    this.pending = false;
    markTutorialDone();
    this.start();
    return true;
  }

  start() {
    this.active = true;
    this.root.hidden = false;
    document.body.classList.add('tutorial-lock');
    this.showPhase('goal');
    this.sfx?.cue?.('ui.menu.open');
  }

  cancelForReset() {
    resetTutorialProgress();
    this.pending = false;
    if (this.active) this.stop();
  }

  onLeaveCombat() {
    if (this.active) this.stop();
  }

  stop() {
    this.clearMarks();
    this.active = false;
    this.phase = null;
    this.step = null;
    this._holes = [];
    this.root.hidden = true;
    this.root.classList.remove('lock', 'gate');
    document.body.classList.remove('tutorial-lock', 'tutorial-gate');
    this.input.setGate(null);
    if (this.director.game && !this.director.game.over) this.input.enabled = true;
  }

  showPhase(phase) {
    const step = stepForPhase(phase, this.director.game);
    if (!step) {
      this.stop();
      return;
    }
    this.phase = phase;
    this.step = step;
    this._cardPinned = false;
    this.applyStep(step);
  }

  applyStep(step) {
    this.clearMarks();
    const idx = Math.max(0, TUTORIAL_PHASES.indexOf(this.phase)) + 1;
    this.eye$.textContent = `初次引导 · ${idx}/${TUTORIAL_PHASES.length}`;
    this.title$.textContent = step.title;
    this.body$.textContent = step.body;
    const gated = !!gateForStep(step);
    this.hint$.textContent = gated ? '或按提示做一次' : '';
    this.hint$.hidden = !gated;
    this.next$.textContent = '继续';

    const gate = gateForStep(step);
    this.input.setGate(gate);
    this.input.enabled = !!gate;
    this.root.classList.toggle('lock', !gate);
    this.root.classList.toggle('gate', !!gate);
    document.body.classList.toggle('tutorial-gate', !!gate);

    this.hud.hideEnemyBanter?.();
    this.paintMarks(step);
    this.layoutOverlay(true);
    if (!reduceMotion()) {
      gsap.fromTo(this.card$, { y: 10, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.28, ease: 'power2.out', overwrite: 'auto',
      });
    }
    if (!gate) this.next$.focus();
    if (step.id === 'mana') this.director.flashMana?.('player');
  }

  paintMarks(step) {
    const d = this.director;
    const g = d.game;
    if (!d.heroVis || !g) return;
    if (step.id === 'goal' || step.id === 'hp') {
      d.heroVis.player.setTargeted(true, step.id === 'goal');
      d.heroVis.enemy.setTargeted(true, step.id === 'goal');
    }
    if (step.wait === 'attack') {
      const ready = (g.player.board || []).filter((m) => m.canAttack && m.attack > 0);
      const src = ready[0];
      if (src) {
        for (const t of g.validAttackTargets(src)) d.markValidTarget(t, true);
      }
    }
  }

  clearMarks() {
    const d = this.director;
    if (d.heroVis && d.game) d.clearAllHighlights();
  }

  advance(reason) {
    if (!this.active || this._advancing) return;
    this._advancing = true;
    if (reason === 'continue') this.sfx?.cue?.('ui.confirm');
    const nxt = nextPhase(this.phase);
    if (!nxt) {
      this.stop();
      this._advancing = false;
      return;
    }
    this.showPhase(nxt);
    this._advancing = false;
  }

  onAct(kind) {
    if (!this.active || !this.step) return;
    if (this.step.wait !== kind) return;
    if (kind === 'endturn') {
      this.stop();
      return;
    }
    this.advance('action');
  }

  focusBoxes(keys) {
    const d = this.director;
    const g = d.game;
    const vis = d.heroVis;
    if (!d || !g || !vis) return [];
    const out = [];
    const push = (box) => { if (box) out.push(box); };

    for (const key of keys || []) {
      if (key === 'phero') {
        vis.player.group.getWorldPosition(_a);
        push(sphereBox(d, _a.clone(), 1.18, 8));
      } else if (key === 'ehero') {
        vis.enemy.group.getWorldPosition(_a);
        push(sphereBox(d, _a.clone(), 1.18, 8));
      } else if (key === 'php') {
        vis.player.hpSprite.getWorldPosition(_a);
        push(sphereBox(d, _a.clone(), 0.62, 10));
      } else if (key === 'ehp') {
        vis.enemy.hpSprite.getWorldPosition(_a);
        push(sphereBox(d, _a.clone(), 0.62, 10));
      } else if (key === 'hudhp') {
        push(elBox(document.getElementById('runHp')?.closest('.playerHudRow'), 8));
      } else if (key === 'mana') {
        vis.player.manaGroup.getWorldPosition(_a);
        const n = Math.max(1, g.player.manaMax);
        push(sphereBox(d, _a.clone(), 0.7 + n * 0.18, 16));
      } else if (key === 'hand') {
        const parts = [];
        for (const inst of g.player.hand) {
          const grp = d.vis.get(inst.uid)?.group;
          if (!grp) continue;
          grp.getWorldPosition(_a);
          parts.push(sphereBox(d, _a.clone(), 1.28, 6));
        }
        push(unionBoxes(parts) || clampBox({
          x: window.innerWidth * 0.18,
          y: window.innerHeight * 0.68,
          w: window.innerWidth * 0.64,
          h: window.innerHeight * 0.28,
          r: 24,
        }));
      } else if (key === 'pboard' || key === 'lane') {
        const z = CFG.layout.rowZ.player;
        const y = 0.2;
        const half = key === 'lane' ? 3.4 : 5.2;
        const depth = key === 'lane' ? 0.85 : 1.15;
        const corners = [
          new THREE.Vector3(-half, y, z - depth),
          new THREE.Vector3(half, y, z - depth),
          new THREE.Vector3(-half, y, z + depth),
          new THREE.Vector3(half, y, z + depth),
        ].map((p) => d.projectWorld(p));
        push(unionBoxes(corners.map((c) => ({ x: c.x - 16, y: c.y - 16, w: 32, h: 32, r: 18 }))));
      } else if (key === 'pminion') {
        const parts = [];
        for (const m of g.player.board) {
          const grp = d.vis.get(m.uid)?.group;
          if (!grp) continue;
          grp.getWorldPosition(_a);
          parts.push(sphereBox(d, _a.clone(), 1.15, 8));
        }
        push(unionBoxes(parts));
      } else if (key === 'skill') {
        push(elBox(document.getElementById('enemySkills'), 14));
      } else if (key === 'endturn') {
        d.endTurnBtn.group.getWorldPosition(_a);
        push(sphereBox(d, _a.clone(), 1.35, 16));
      }
    }
    return out;
  }

  layoutOverlay(pinCard = false) {
    if (!this.active || !this.step) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.shade$.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.hit$.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.shade$.setAttribute('width', String(w));
    this.shade$.setAttribute('height', String(h));
    this.hit$.setAttribute('width', String(w));
    this.hit$.setAttribute('height', String(h));

    const holes = this.focusBoxes(this.step.focus);
    this._holes = holes;
    this.syncHoles(holes, w, h);
    if (pinCard || !this._cardPinned) this.placeCard(holes);
    this.placeArrow(holes);
  }

  syncHoles(holes, w, h) {
    const ns = 'http://www.w3.org/2000/svg';
    while (this.holes$.childNodes.length > holes.length) this.holes$.lastChild.remove();
    while (this.holes$.childNodes.length < holes.length) {
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('fill', 'black');
      this.holes$.appendChild(rect);
    }
    while (this.halos$.childNodes.length > holes.length * 2) this.halos$.lastChild.remove();
    while (this.halos$.childNodes.length < holes.length * 2) {
      const soft = document.createElementNS(ns, 'rect');
      soft.setAttribute('class', 'tutHaloSoft');
      const hard = document.createElementNS(ns, 'rect');
      hard.setAttribute('class', 'tutHalo');
      this.halos$.appendChild(soft);
      this.halos$.appendChild(hard);
    }
    holes.forEach((b, i) => {
      const rx = Math.min(b.r, 28);
      const hole = this.holes$.childNodes[i];
      hole.setAttribute('x', String(b.x));
      hole.setAttribute('y', String(b.y));
      hole.setAttribute('width', String(b.w));
      hole.setAttribute('height', String(b.h));
      hole.setAttribute('rx', String(rx));
      const soft = this.halos$.childNodes[i * 2];
      const hard = this.halos$.childNodes[i * 2 + 1];
      soft.setAttribute('x', String(b.x - 4));
      soft.setAttribute('y', String(b.y - 4));
      soft.setAttribute('width', String(b.w + 8));
      soft.setAttribute('height', String(b.h + 8));
      soft.setAttribute('rx', String(rx + 4));
      hard.setAttribute('x', String(b.x));
      hard.setAttribute('y', String(b.y));
      hard.setAttribute('width', String(b.w));
      hard.setAttribute('height', String(b.h));
      hard.setAttribute('rx', String(rx));
    });
    const holePath = holes.map((b) => `M${b.x},${b.y}h${b.w}v${b.h}h${-b.w}z`).join('');
    this.hitPath$.setAttribute('d', `M0,0H${w}V${h}H0Z${holePath}`);

    while (this.spots$.childNodes.length > holes.length) this.spots$.lastChild.remove();
    while (this.spots$.childNodes.length < holes.length) {
      const spot = document.createElement('div');
      spot.className = 'tutSpot';
      this.spots$.appendChild(spot);
    }
    holes.forEach((b, i) => {
      const spot = this.spots$.childNodes[i];
      spot.style.left = `${b.x}px`;
      spot.style.top = `${b.y}px`;
      spot.style.width = `${b.w}px`;
      spot.style.height = `${b.h}px`;
      spot.style.borderRadius = `${Math.min(b.r, 28)}px`;
    });
  }

  placeCard(holes) {
    const card = this.card$;
    const cw = card.offsetWidth || 352;
    const ch = card.offsetHeight || 196;
    const pad = 18;
    const left = { left: pad, top: Math.max(pad, (window.innerHeight - ch) * 0.38) };
    const right = { left: Math.max(pad, window.innerWidth - cw - pad), top: Math.max(pad, (window.innerHeight - ch) * 0.34) };
    const top = { left: Math.max(pad, (window.innerWidth - cw) / 2), top: pad };
    const topLeft = { left: pad, top: pad };
    const topRight = { left: Math.max(pad, window.innerWidth - cw - pad), top: pad };
    const bottom = { left: Math.max(pad, (window.innerWidth - cw) / 2), top: Math.max(pad, window.innerHeight - ch - pad) };
    const preferred = this.step?.dock === 'top' ? [top] : this.step?.dock === 'left' ? [left] : [];
    const spots = [...preferred, left, right, top, topLeft, topRight, bottom];
    let best = spots[0];
    let bestScore = Infinity;
    for (const s of spots) {
      const rect = { x: s.left, y: s.top, w: cw, h: ch };
      let score = 0;
      for (const hole of holes) score += overlapArea(rect, hole);
      if (s.left < 8 || s.top < 8) score += 400;
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    card.style.left = `${Math.round(best.left)}px`;
    card.style.top = `${Math.round(best.top)}px`;
    this._cardPinned = true;
  }

  placeArrow(holes) {
    if (!holes.length) {
      this.arrow$.hidden = true;
      return;
    }
    const cr = this.card$.getBoundingClientRect();
    const cx = cr.left + cr.width / 2;
    const cy = cr.top + cr.height / 2;
    let hole = holes[0];
    let best = Infinity;
    for (const h of holes) {
      const hx = h.x + h.w / 2;
      const hy = h.y + h.h / 2;
      const d = (hx - cx) ** 2 + (hy - cy) ** 2;
      if (d < best) {
        best = d;
        hole = h;
      }
    }
    const hx = hole.x + hole.w / 2;
    const hy = hole.y + hole.h / 2;
    const ang = Math.atan2(hy - cy, hx - cx);
    const x = cx + (hx - cx) * 0.58;
    const y = cy + (hy - cy) * 0.58;
    this.arrow$.hidden = false;
    this.arrow$.style.left = `${Math.round(x)}px`;
    this.arrow$.style.top = `${Math.round(y)}px`;
    this.arrow$.style.setProperty('--tut-rot', `${ang}deg`);
    this.arrow$.style.transform = `translate(-50%, -50%) rotate(${ang}deg)`;
  }

  update() {
    if (!this.active) return;
    this.layoutOverlay(false);
  }

  debug() {
    return {
      pending: this.pending,
      active: this.active,
      phase: this.phase,
      step: this.step?.id || null,
      wait: this.step?.wait || null,
    };
  }
}
