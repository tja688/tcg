import { sleep } from '../utils/rng.js';

const LABEL = '本地模型：Qwen3.5-2B 思考中...';

export function thinkSpan(kind, firstOfTurn) {
  if (firstOfTurn) return 760 + Math.random() * 820;
  if (kind === 'play') return 460 + Math.random() * 620;
  if (kind === 'attack') return 400 + Math.random() * 520;
  return 320 + Math.random() * 360;
}

export async function fakeThink(hud, kind, firstOfTurn) {
  const ms = thinkSpan(kind, firstOfTurn);
  hud?.showLlmThink?.(LABEL);
  try {
    await sleep(ms);
  } finally {
    hud?.showLlmThink?.('');
  }
}
