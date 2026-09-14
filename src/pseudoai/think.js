import { sleep } from '../utils/rng.js';

/** 可调：假思考等待。reduce 可低于 800ms，其余不低于 minMs。 */
export const THINK = {
  label: '本地模型：Qwen3.5-2B 思考中',
  first: [2200, 1800],
  play: [1600, 1400],
  attack: [1400, 1200],
  other: [1000, 800],
  reduce: {
    first: [640, 360],
    play: [520, 300],
    attack: [480, 280],
    other: [400, 220],
  },
  minMs: 800,
  lineHold: 720,
  dotsMs: 380,
};

function prefersReduce() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

export function thinkSpan(kind, firstOfTurn) {
  const reduce = prefersReduce();
  const table = reduce ? THINK.reduce : THINK;
  const pair = firstOfTurn ? table.first : (table[kind] || table.other);
  const ms = pair[0] + Math.random() * pair[1];
  return reduce ? ms : Math.max(THINK.minMs, ms);
}

function startThinkPulse(hud) {
  const base = THINK.label;
  let n = 3;
  hud?.showLlmThink?.(`${base}...`);
  const id = setInterval(() => {
    n = (n + 1) % 4;
    hud?.showLlmThink?.(`${base}${'.'.repeat(n)}`);
  }, THINK.dotsMs);
  return () => clearInterval(id);
}

export async function fakeThink(hud, kind, firstOfTurn, ctx = {}) {
  const delay = thinkSpan(kind, firstOfTurn);
  const stopPulse = startThinkPulse(hud);
  let shownAt = 0;

  const speakP = (async () => {
    try {
      const line = await ctx.session?.speakThink?.(ctx.game, ctx.intent);
      if (line) shownAt = performance.now();
      return line || '';
    } catch {
      return '';
    }
  })();

  try {
    await Promise.all([sleep(delay), speakP]);
    if (shownAt) {
      const remain = THINK.lineHold - (performance.now() - shownAt);
      if (remain > 0) await sleep(remain);
    }
  } finally {
    stopPulse();
    hud?.showLlmThink?.('');
  }
}
