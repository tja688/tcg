import { habitHint } from './personas.js';
import { boardSnapshot, eventLine } from './snapshot.js';
import { counterHint, formatPlan } from './tactics.js';

const HOLLOW = /^(啊+|嗯+|呃+|哈+|哦+|…+)+[。.!！]?$/;
const STRATEGY = /建议|应该出|推荐|最优|策略|分析|作为AI|作为人工智能|语言模型|Thinking Process/;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)] || '';
}

function bare(name) {
  return String(name || '').replace(/[「」]/g, '') || '';
}

export function isUsableLine(s, ev) {
  if (!s) return false;
  const t = String(s).replace(/\s/g, '');
  if (STRATEGY.test(t)) return false;
  if (ev?.type === 'idle') return t.length >= 1;
  if (t.length < 2) return false;
  if (HOLLOW.test(t)) return false;
  return true;
}

/** 只收完整句子。超长就停在上一个句号，绝不从词中间切断。 */
export function takeSpoken(raw) {
  if (!raw) return '';
  let s = String(raw).replace(/\s+/g, ' ').trim().replace(/[….]{2,}/g, '…').replace(/[。！？!?]{2,}/g, (m) => m[0]);
  if (!s) return '';

  const parts = [];
  let buf = '';
  for (const ch of s) {
    buf += ch;
    if ('。！？!?'.includes(ch)) {
      parts.push(buf);
      buf = '';
    }
  }
  if (buf) parts.push(buf);

  let out = '';
  let done = 0;
  for (const part of parts) {
    const next = out + part;
    if (done >= 2) break;
    if (out && next.length > 48 && done >= 1) break;
    if (next.length > 96) {
      if (out) break;
      return part;
    }
    out = next;
    if (/[。！？!?]/.test(part)) done += 1;
  }
  return out;
}

function personaBlock(persona) {
  return [
    `你是卡牌对局里坐在对面的「${persona.name}」${persona.title ? `（${persona.title}）` : ''}。`,
    persona.blurb ? `习性：${persona.blurb}` : '',
    `语气：${persona.voice}。`,
    `说话习惯：${habitHint(persona.habit)}`,
    persona.tic ? `口癖：${persona.tic}大约三句里用一次，不要每句都加。` : '',
  ].filter(Boolean).join('');
}

const COMMON_RULES = [
  '用第一人称跟对面那个法师说话，像桌上真有个魔物在打牌。',
  '说完整的一两句口语，听得懂、有来由。个性只体现在语气和口癖上，不要写成诗、电报、旁白或攻略。',
  '大约十到三十五个字。说完就停。不要半句话，不要一串省略号。',
  '可以提场上的牌，但别堆名词，别为了点名而点名。',
  '不要自称AI或模型，不要用引号包整句，不要列要点，不要用自己的名字自称，用我。',
].join('');

export function buildSpeechPrompt(persona, game, ev, extras = {}) {
  const system = personaBlock(persona) + COMMON_RULES;
  const user = [
    boardSnapshot(game),
    `刚才：${eventLine(ev)}`,
    extras.hint ? `可以顺口提自己：${extras.hint}。不要编造对手手里有什么。` : '',
    extras.plan ? formatPlan(extras.plan) : '',
    beatCue(ev?.type),
  ].filter(Boolean).join('\n');
  return { system, user };
}

export function buildThinkPrompt(persona, game, intent, plan) {
  const system = [
    personaBlock(persona),
    COMMON_RULES,
    '现在轮到你出牌。像自己在想下一步，可以说一点打算，但要像说话，不要报操作清单。',
  ].join('');

  const user = [
    boardSnapshot(game),
    formatPlan(plan || { now: intent ? eventLine({ type: 'think', ...intent }) : '', next: [] }),
    '现在说一句完整的人话，带着你接下来想做什么。',
  ].filter(Boolean).join('\n');
  return { system, user };
}

function beatCue(type) {
  switch (type) {
    case 'idle':
      return '对面还在想。来一句很短的闲话：可以是嗯、调侃，或随口说说场面。';
    case 'player_play':
      return '对面刚出了牌。反应一句，可以小看它，也可以提自己手里怎么治。';
    case 'player_attack':
      return '对面刚打了一下。反应一句。';
    case 'draw':
      return '你刚摸到牌。可以很短地嘀咕一声，不要报出所有手牌。';
    case 'hurt':
      return '你挨打了。承认疼也可以，硬撑也可以，要像人在说话。';
    case 'kill':
      return '有随从倒下了。说一句完整的话。';
    case 'phase':
      return '你变了形态。短短宣布一下。';
    case 'over':
      return '对局结束。说一句收场的话。';
    default:
      return '现在说一句完整的人话。';
  }
}

export function holdFor(text, base = 2800) {
  const n = String(text || '').replace(/\s/g, '').length;
  return Math.min(7600, Math.max(1600, base + n * 70));
}

function withTic(persona, line) {
  if (!line || !persona?.tic || Math.random() > 0.28) return line;
  if (line.includes(persona.tic.replace(/[。！？]/g, ''))) return line;
  return `${line.replace(/[。！？!?]$/, '')}，${persona.tic}`;
}

function pickIdle(persona, game) {
  const threat = game?.player?.board?.slice().sort((a, b) => b.attack - a.attack)[0];
  const mine = game?.enemy?.board?.[0];
  const lines = [
    '嗯…',
    pick(persona.ticks),
    threat ? `场上那只${bare(threat.def?.name)}，我看着呢。` : '现在轮到你了。',
    mine ? `${bare(mine.def?.name)}还在，你先想清楚。` : '',
    '怕了？',
  ].filter(Boolean);
  return withTic(persona, pick(lines));
}

export function fallbackLine(persona, ev, game) {
  if (ev?.type === 'idle') return pickIdle(persona, game);
  if (ev?.type === 'over') return ev.winner === 'enemy' ? '结束了。' : '下次再算。';
  if (ev?.type === 'phase') return withTic(persona, ev.banner ? `${ev.banner}。` : '更深了。');
  if (ev?.type === 'hurt') return withTic(persona, pick(['还站着。', '这点疼。', '就这？']));
  if (ev?.type === 'draw' && ev.card) return withTic(persona, pick(['又摸到一张。', `「${bare(ev.card)}」，正好。`]));
  if (ev?.type === 'kill' && ev.name) return withTic(persona, `「${bare(ev.name)}」倒了。`);
  if (ev?.type === 'player_play' && ev.card) {
    return withTic(persona, pick([
      `打了个${bare(ev.card)}？小场面。`,
      `${bare(ev.card)}啊，我记下了。`,
    ]));
  }
  if (ev?.type === 'player_attack' && ev.attackerName) {
    return withTic(persona, pick([
      `${bare(ev.attackerName)}打过来了。`,
      '这一下我接着。',
    ]));
  }
  if (ev?.type === 'play' && ev.card) return withTic(persona, `先出「${bare(ev.card)}」。`);
  if (ev?.type === 'attack' && ev.attackerName) {
    return ev.targetName
      ? withTic(persona, `「${bare(ev.attackerName)}」打向${ev.targetName}。`)
      : withTic(persona, `「${bare(ev.attackerName)}」出手。`);
  }
  return withTic(persona, pick(persona.ticks.concat(['先走这手。'])));
}

export function thinkFallback(persona, game, intent, plan) {
  const card = bare(intent?.card);
  const atk = bare(intent?.attackerName) || card;
  const tgt = bare(intent?.targetName);
  const follow = plan?.next?.[0] ? `再${plan.next[0].replace(/^接着可能/, '')}` : '';

  if (intent?.type === 'play') {
    if (intent.lethal && card) return withTic(persona, `「${card}」能收那个法师。`);
    if (intent.kill && card && tgt) return withTic(persona, `「${card}」正好清掉「${tgt}」。`);
    if (intent.targetTaunt && tgt) return withTic(persona, `先过「${tgt}」这堵嘲讽。`);
    if (intent.aoe && card) return withTic(persona, `场面交给「${card}」清。`);
    if (card && follow) return withTic(persona, `让我想想…先出「${card}」，${follow}。`);
    if (card) return withTic(persona, `先出「${card}」。`);
  }

  if (intent?.type === 'attack') {
    if (intent.lethal && atk) return withTic(persona, `「${atk}」这一下能斩杀。`);
    if (intent.kill && atk && tgt) return withTic(persona, `「${atk}」吃掉「${tgt}」。`);
    if (atk && tgt) return withTic(persona, `让「${atk}」顶「${tgt}」。`);
    if (atk) return withTic(persona, `「${atk}」出手。`);
  }

  if (follow) return withTic(persona, `让我想想…${follow}。`);
  const threat = game?.player?.board?.slice().sort((a, b) => b.attack - a.attack)[0];
  if (threat?.def?.name) return withTic(persona, `先看着「${threat.def.name}」。`);
  return withTic(persona, '这手先走。');
}

export function speechExtras(game, ev) {
  return {
    hint: counterHint(game, ev),
  };
}
