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

const sources = { llm: 0, fake: 0 };
let hudRef = null;
let pulseId = null;
let dots = 3;
let sidecarLive = false;

function prefersReduce() {
  return globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

export function thinkSpan(kind, firstOfTurn) {
  const reduce = prefersReduce();
  const table = reduce ? THINK.reduce : THINK;
  const pair = firstOfTurn ? table.first : (table[kind] || table.other);
  const ms = pair[0] + Math.random() * pair[1];
  return reduce ? ms : Math.max(THINK.minMs, ms);
}

export function thinkSources() {
  return {
    llm: sources.llm,
    fake: sources.fake,
    active: sources.llm > 0 || sources.fake > 0,
    sidecarLive,
  };
}

export function setLlmThinkHud(on) {
  sidecarLive = !!on;
  syncThinkHud();
}

export function bindThinkHud(hud) {
  hudRef = hud || null;
}

function paintThink() {
  if (!hudRef) return;
  if (!thinkSources().active) {
    hudRef.showLlmThink?.('');
    return;
  }
  hudRef.showLlmThink?.(`${THINK.label}${'.'.repeat(dots)}`);
}

function startPulse() {
  if (pulseId) return;
  dots = 3;
  paintThink();
  pulseId = setInterval(() => {
    dots = (dots + 1) % 4;
    paintThink();
  }, THINK.dotsMs);
}

function stopPulse() {
  if (pulseId) {
    clearInterval(pulseId);
    pulseId = null;
  }
  dots = 3;
}

function syncThinkHud() {
  if (sidecarLive && thinkSources().active) startPulse();
  else {
    stopPulse();
    hudRef?.showLlmThink?.('');
  }
}

export function beginThink(source, hud) {
  if (hud) hudRef = hud;
  if (source !== 'llm' && source !== 'fake') return;
  sources[source] += 1;
  syncThinkHud();
}

export function endThink(source) {
  if (source !== 'llm' && source !== 'fake') return;
  sources[source] = Math.max(0, sources[source] - 1);
  syncThinkHud();
}

export function resetThinkHud(hud) {
  sources.llm = 0;
  sources.fake = 0;
  sidecarLive = false;
  stopPulse();
  (hud || hudRef)?.showLlmThink?.('');
}

export async function fakeThink(hud, kind, firstOfTurn, ctx = {}) {
  const delay = thinkSpan(kind, firstOfTurn);
  beginThink('fake', hud);
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
    endThink('fake');
  }
}
