import * as THREE from 'three';
import { gsap } from 'gsap';
import { loadAssets } from './utils/assets.js';
import { createWorld } from './three/sceneSetup.js';
import { ParticleSystem } from './three/particles.js';
import { Effects } from './three/effects.js';
import { Director } from './three/director.js';
import { InputController } from './input.js';
import { Hud } from './ui/hud.js';
import { Sfx } from './audio/sfx.js';
import { RunController } from './run/controller.js';
import { grantRelic } from './run/state.js';

const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));

async function boot() {
  const hud = new Hud();
  const params = new URLSearchParams(location.search);
  const seed = parseInt(params.get('seed'), 10) || ((Date.now() % 900000000) + 7);

  const fast = parseFloat(params.get('fast'));
  if (fast) gsap.globalTimeline.timeScale(fast);

  const assets = await loadAssets((p) => hud.loadProgress(p));

  const world = createWorld(document.getElementById('app'), assets);
  const sfx = new Sfx();
  hud.bindSfx(sfx);
  const particles = new ParticleSystem(world.scene, assets);
  const effects = new Effects(world, particles, assets, sfx);
  const director = new Director(world, assets, particles, effects, hud, sfx);
  const input = new InputController(world, null, director, hud, sfx);
  input.enabled = false;

  const run = new RunController({ director, input, hud, sfx, assets, seed });

  const resolveT = (sel) => {
    const game = run.game;
    if (!game) return null;
    if (sel === 'ehero') return game.enemy.hero;
    if (sel === 'phero') return game.player.hero;
    if (sel && typeof sel === 'object' && 'side' in sel) return game.sideOf(sel.side).board[sel.i] || null;
    if (typeof sel === 'number') return game.findMinion(sel);
    return null;
  };

  window.__tcg = {
    director, world, seed, errors, run,
    get game() { return run.game; },
    state() {
      const game = run.game;
      if (!game) return { turn: 'none', over: true, run: run.debug() };
      const sideState = (s) => ({
        hp: s.hero.hp, armor: s.hero.armor, mana: s.mana, manaMax: s.manaMax,
        deck: s.deck.length, discard: s.discard.length, strength: s.strength,
        hand: s.hand.map((c) => ({ uid: c.uid, name: c.def.name, cost: c.def.cost })),
        board: s.board.map((c) => ({
          uid: c.uid, name: c.def.name, atk: c.attack, hp: c.health, canAttack: c.canAttack, taunt: c.taunt,
        })),
      });
      return {
        turn: game.turn, turnNo: game.turnNo, over: game.over, winner: game.winner,
        busy: director.busy, intent: game.lockedIntent,
        player: sideState(game.player), enemy: sideState(game.enemy),
        run: run.debug(),
      };
    },
    pos(sel) {
      if (typeof sel === 'string' && (sel.startsWith('pboard') || sel.startsWith('eboard'))) {
        const game = run.game;
        if (!game) return null;
        const side = sel[0] === 'p' ? 'player' : 'enemy';
        const i = parseInt(sel.slice(6), 10);
        const m = game.sideOf(side).board[i];
        return m ? director.debugScreenPos(m.uid) : null;
      }
      return director.debugScreenPos(sel);
    },
    posW(x, y, z) {
      const v = new THREE.Vector3(x, y, z).project(world.camera);
      return {
        x: Math.round((v.x * 0.5 + 0.5) * window.innerWidth),
        y: Math.round((-v.y * 0.5 + 0.5) * window.innerHeight),
      };
    },
    play(i, opts = {}) {
      const game = run.game;
      if (!game) return Promise.resolve(false);
      const inst = game.player.hand[i];
      if (!inst) return Promise.resolve(false);
      return director.playerPlay(inst, {
        slot: opts.slot ?? game.player.board.length,
        target: resolveT(opts.target),
      });
    },
    attack(i, targetSel) {
      const game = run.game;
      if (!game) return Promise.resolve(false);
      const m = game.player.board[i];
      if (!m) return Promise.resolve(false);
      return director.playerAttack(m, resolveT(targetSel));
    },
    end() { return director.playerEndTurn(); },
    setHp(sideName, n) {
      const game = run.game;
      if (!game) return;
      const h = game.sideOf(sideName).hero;
      h.hp = n;
      director.updateHp(h);
    },
  };

  window.__run = {
    ctrl: run,
    state: () => run.debug(),
    gold(n) { if (run.run) { run.run.gold = n; hud.refreshRun(run.run); } },
    hp(n) { if (run.run) { run.run.hp = n; hud.refreshRun(run.run); } },
    relic(id) { if (run.run) { grantRelic(run.run, id); hud.refreshRun(run.run); } },
    win() {
      if (run.game && !run.game.over) {
        run.game.enemy.hero.hp = 0;
        run.game.checkWin();
        return director.gameOver('player');
      }
    },
    lose() {
      if (run.game && !run.game.over) {
        run.game.player.hero.hp = 0;
        run.game.checkWin();
        return director.gameOver('enemy');
      }
    },
    jump: (type) => run.debugJump(type),
  };

  hud.hideLoading();

  let last = performance.now();
  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = world.time;
    world.update(dt);
    particles.update(dt);
    director.update(dt, t);
    input.update(t);
    world.render();
  }
  loop();

  await run.boot(params.get('autostart') === '1');
}

boot();
