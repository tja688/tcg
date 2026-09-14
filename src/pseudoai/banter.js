import { personaOf } from './personas.js';
import {
  buildSpeechPrompt,
  buildThinkPrompt,
  fallbackLine,
  holdFor,
  isUsableLine,
  speechExtras,
  thinkFallback,
} from './voice.js';
import { IDLE_MUTTER, mutterOnce, probeLlm, REACT_MUTTER, THINK_MUTTER } from './llm.js';
import { peekPlan } from './tactics.js';

const COOLDOWN = {
  idle: 7000,
  draw: 11000,
  turn_start: 9000,
  phase: 0,
  over: 0,
  kill: 8000,
  hurt: 8000,
  play: 16000,
  attack: 18000,
  player_play: 6500,
  player_attack: 7500,
};

const CHANCE = {
  idle: 0.62,
  draw: 0.34,
  turn_start: 0.18,
  phase: 1,
  over: 1,
  kill: 0.4,
  hurt: 0.38,
  play: 0.08,
  attack: 0.08,
  player_play: 0.48,
  player_attack: 0.36,
};

const PRIORITY = {
  over: 5,
  phase: 5,
  think: 4,
  player_play: 3,
  player_attack: 3,
  hurt: 3,
  kill: 3,
  draw: 2,
  turn_start: 2,
  play: 2,
  attack: 2,
  idle: 1,
};

export function createBanter({ hud, director }) {
  let persona = personaOf(null);
  let lastAt = 0;
  let inflight = false;
  let currentPri = 0;
  let disposed = false;
  let live = false;
  let gen = 0;
  let thoughtGen = 0;
  let idleId = 0;
  let lastTouch = 0;

  function show(text, baseHold) {
    if (disposed || !text) return;
    hud?.showEnemyBanter?.(text, persona.name, null, { holdMs: holdFor(text, baseHold) });
  }

  function stopIdle() {
    if (idleId) {
      clearTimeout(idleId);
      idleId = 0;
    }
  }

  function touch() {
    lastTouch = performance.now();
  }

  function canIdle(game) {
    if (disposed || !game || game.over || game.turn !== 'player') return false;
    if (director?.busy) return false;
    return true;
  }

  function scheduleIdle(game) {
    stopIdle();
    if (!canIdle(game)) return;
    idleId = setTimeout(() => {
      idleId = 0;
      if (!canIdle(game)) {
        if (!disposed && game && !game.over && game.turn === 'player') scheduleIdle(game);
        return;
      }
      if (performance.now() - lastTouch < 4200) {
        scheduleIdle(game);
        return;
      }
      touch();
      void api.speak(game, { type: 'idle' });
      scheduleIdle(game);
    }, 4800 + Math.random() * 4200);
  }

  const api = {
    bind(encounter) {
      persona = personaOf(encounter);
      lastAt = 0;
      currentPri = 0;
      thoughtGen = 0;
      disposed = false;
      gen += 1;
      touch();
    },
    dispose() {
      disposed = true;
      gen += 1;
      stopIdle();
      hud?.hideEnemyBanter?.();
    },
    get persona() { return persona; },
    startIdle(game) {
      touch();
      scheduleIdle(game);
    },
    stopIdle,
    async prepare() {
      live = await probeLlm(800);
      return live;
    },
    async speak(game, ev, { force = false } = {}) {
      if (disposed || !game) return '';
      const type = ev?.type || 'idle';
      const pri = PRIORITY[type] ?? 2;
      const now = performance.now();
      const cd = COOLDOWN[type] ?? 6000;
      if (!force && type !== 'idle' && now - lastAt < cd) return '';
      if (!force && Math.random() > (CHANCE[type] ?? 0.3)) return '';
      if (inflight && pri <= currentPri && !force) return '';

      const my = ++gen;
      currentPri = pri;
      lastAt = now;
      inflight = true;
      touch();
      try {
        let line = '';
        const useLocalIdle = type === 'idle' && (!live || Math.random() < 0.42);
        if (useLocalIdle) {
          line = fallbackLine(persona, ev, game);
        } else if (live) {
          try {
            const extras = speechExtras(game, ev);
            const { system, user } = buildSpeechPrompt(persona, game, ev, extras);
            const spec = type === 'idle' ? IDLE_MUTTER : REACT_MUTTER;
            line = await mutterOnce({ system, user, ...spec });
            if (!isUsableLine(line, ev)) line = '';
          } catch {
            live = false;
          }
        }
        if (!line) line = fallbackLine(persona, ev, game);
        if (disposed || my !== gen) return '';
        show(line, type === 'idle' ? 2000 : 2800);
        return line;
      } finally {
        if (my === gen) {
          inflight = false;
          currentPri = 0;
        }
      }
    },
    async speakThink(game, intent) {
      if (disposed || !game || !intent) return '';
      const my = ++gen;
      currentPri = PRIORITY.think;
      lastAt = performance.now();
      inflight = true;
      touch();
      try {
        const plan = peekPlan(game, intent);
        let line = '';
        if (live) {
          try {
            const { system, user } = buildThinkPrompt(persona, game, intent, plan);
            line = await mutterOnce({ system, user, ...THINK_MUTTER });
            if (!isUsableLine(line, { type: 'think' })) line = '';
          } catch {
            live = false;
          }
        }
        if (!line) line = thinkFallback(persona, game, intent, plan);
        if (disposed || my !== gen) return '';
        thoughtGen = my;
        show(line, 3600);
        return line;
      } finally {
        if (my === gen) {
          inflight = false;
          currentPri = 0;
        }
      }
    },
    skipActed() {
      if (!thoughtGen) return false;
      thoughtGen = 0;
      return true;
    },
  };

  return api;
}
