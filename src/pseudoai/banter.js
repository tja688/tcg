import { personaOf } from './personas.js';
import { boardSnapshot, eventLine } from './snapshot.js';
import { mutterOnce, probeLlm } from './llm.js';

const COOLDOWN = {
  turn_start: 0,
  phase: 0,
  over: 0,
  kill: 2200,
  hurt: 7000,
  play: 5200,
  attack: 6400,
  player_play: 8000,
  player_attack: 8000,
};

const CHANCE = {
  turn_start: 1,
  phase: 1,
  over: 1,
  kill: 0.85,
  hurt: 0.55,
  play: 0.42,
  attack: 0.28,
  player_play: 0.35,
  player_attack: 0.28,
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)] || '';
}

function fallbackLine(persona, ev) {
  if (ev?.type === 'over') return ev.winner === 'enemy' ? '结束了。' : '……下次。';
  if (ev?.type === 'phase') return pick(['更深了。', '别停。', persona.ticks[0]]);
  if (ev?.type === 'hurt') return pick(['疼？很好。', '还站着。', '……']);
  return pick(persona.ticks);
}

function buildPrompt(persona, game, ev) {
  const system = [
    `你是卡牌对局里的敌人「${persona.name}」。`,
    persona.title ? `身份：${persona.title}。` : '',
    persona.blurb ? `习性：${persona.blurb}` : '',
    `说话气质：${persona.voice}。`,
    '你只会用角色口吻呢喃一句很短的话，像自言自语，不要解释，不要引号，不要策略分析，不要自称AI。',
    '不超过20个汉字。可以残缺、可以停顿。',
  ].filter(Boolean).join('');

  const user = [
    boardSnapshot(game),
    `刚才：${eventLine(ev)}`,
    '现在请呢喃一句。',
  ].join('\n');

  return { system, user };
}

export function createBanter({ hud, director }) {
  let persona = personaOf(null);
  let lastAt = 0;
  let inflight = false;
  let disposed = false;
  let live = false;

  function show(text) {
    if (disposed || !text) return;
    const xy = director?.debugScreenPos?.('ehero') || null;
    hud?.showEnemyBanter?.(text, persona.name, xy);
  }

  return {
    bind(encounter) {
      persona = personaOf(encounter);
      lastAt = 0;
      disposed = false;
    },
    dispose() {
      disposed = true;
      hud?.hideEnemyBanter?.();
    },
    get persona() { return persona; },
    async prepare() {
      live = await probeLlm(800);
      return live;
    },
    async speak(game, ev, { force = false } = {}) {
      if (disposed || !game) return '';
      const type = ev?.type || 'idle';
      const now = performance.now();
      const cd = COOLDOWN[type] ?? 6000;
      if (!force && now - lastAt < cd) return '';
      if (!force && Math.random() > (CHANCE[type] ?? 0.3)) return '';
      if (inflight) return '';
      lastAt = now;
      inflight = true;
      try {
        let line = '';
        if (live) {
          try {
            const { system, user } = buildPrompt(persona, game, ev);
            line = await mutterOnce({ system, user });
          } catch {
            live = false;
          }
        }
        if (!line) line = fallbackLine(persona, ev);
        show(line);
        return line;
      } finally {
        inflight = false;
      }
    },
  };
}
