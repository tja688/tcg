import { personaOf } from './personas.js';
import { boardSnapshot, eventLine, intentLine } from './snapshot.js';
import { mutterOnce, probeLlm, THINK_MUTTER } from './llm.js';

const COOLDOWN = {
  turn_start: 9000,
  phase: 0,
  over: 0,
  kill: 9000,
  hurt: 9000,
  play: 16000,
  attack: 18000,
  player_play: 10000,
  player_attack: 10000,
};

const CHANCE = {
  turn_start: 0.22,
  phase: 1,
  over: 1,
  kill: 0.32,
  hurt: 0.35,
  play: 0.1,
  attack: 0.08,
  player_play: 0.22,
  player_attack: 0.18,
};

const HOLLOW = /^(啊+|嗯+|呃+|哈+|哦+|……+|…+)+[。.!！]?$/;
const HOLLOW_SOFT = /有意思|血[量好太很]少|太少了|继续吧?/;
const SPECIFIC = /[「」]|嘲讽|斩杀|清场|费/;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)] || '';
}

function bare(name) {
  return String(name || '').replace(/[「」]/g, '') || '';
}

function isHollow(s) {
  if (!s) return true;
  const t = String(s).replace(/\s/g, '');
  if (t.length < 3) return true;
  if (HOLLOW.test(t)) return true;
  if (HOLLOW_SOFT.test(t) && !SPECIFIC.test(t)) return true;
  return false;
}

function fallbackLine(persona, ev) {
  if (ev?.type === 'over') return ev.winner === 'enemy' ? '结束了。' : '下次再算。';
  if (ev?.type === 'phase') return pick(['更深了。', '别停。']);
  if (ev?.type === 'hurt') return pick(['还站着。', '这点疼。']);
  if (ev?.type === 'kill' && ev.name) return `「${bare(ev.name)}」倒了。`;
  if (ev?.type === 'play' && ev.card) return `「${bare(ev.card)}」落地。`;
  if (ev?.type === 'attack' && ev.attackerName) {
    return ev.targetName
      ? `「${bare(ev.attackerName)}」打向${ev.targetName}。`
      : `「${bare(ev.attackerName)}」出手。`;
  }
  return pick(persona.ticks.filter((t) => !isHollow(t)).concat(['先走这手。']));
}

function thinkHint(game, intent) {
  const bits = [];
  if (intent?.lethal) bits.push('这一手是斩杀面门');
  if (intent?.kill) bits.push('这一手能击杀目标随从');
  if (intent?.targetTaunt) bits.push('目标带嘲讽');
  if (intent?.aoe) bits.push('这是清场或群伤');
  if (intent?.cost != null) bits.push(`费用${intent.cost}`);
  const taunts = game?.player?.board?.filter((m) => m.taunt) || [];
  if (taunts.length) {
    bits.push(`对手嘲讽：${taunts.map((m) => `${m.def?.name}${m.attack}/${m.health}`).join('、')}`);
  }
  return bits.join('；');
}

function thinkFallback(game, intent) {
  const card = bare(intent?.card);
  const atk = bare(intent?.attackerName) || card;
  const tgt = bare(intent?.targetName);
  const cost = intent?.cost;

  if (intent?.type === 'play') {
    if (intent.lethal && card) {
      return cost != null
        ? pick([`「${card}」能收那个法师。`, `${cost}费「${card}」直取面门。`])
        : `「${card}」能收那个法师。`;
    }
    if (intent.kill && card && tgt) return pick([`「${card}」正好清掉「${tgt}」。`, `「${tgt}」扛不住「${card}」。`]);
    if (intent.targetTaunt && tgt) return pick([`先过「${tgt}」这堵嘲讽。`, `「${card}」去拆嘲讽「${tgt}」。`]);
    if (intent.aoe && card) return pick([`「${card}」该扫这排了。`, `场面交给「${card}」清。`]);
    if (intent.spellKind === 'heal' && card) return pick([`「${card}」先补一口。`, `稳住，出「${card}」。`]);
    if (intent.spellKind === 'draw' && card) return pick([`再摸，「${card}」。`, `手薄，出「${card}」。`]);
    if (intent.spellKind === 'buff' && card && tgt) return `「${card}」先喂给「${tgt}」。`;
    if (intent.spellKind === 'debuff' && card && tgt) return `「${card}」削「${tgt}」。`;
    if (intent.spellKind === 'armor' && card) return `先叠甲，出「${card}」。`;
    if (intent.cardType === 'minion' && card) {
      return cost != null
        ? pick([`放下「${card}」，${cost}费占线。`, `${cost}费，「${card}」进场。`])
        : `「${card}」进场。`;
    }
    if (card && tgt) return pick([`「${card}」点向「${tgt}」。`, `就打「${tgt}」，用「${card}」。`]);
    if (card) return cost != null ? `${cost}费，「${card}」该走了。` : `先出「${card}」。`;
  }

  if (intent?.type === 'attack') {
    if (intent.lethal && atk) return pick([`「${atk}」这一下能斩杀。`, `面门空了，交给「${atk}」。`]);
    if (intent.kill && atk && tgt) return pick([`「${atk}」吃掉「${tgt}」。`, `「${tgt}」残了，用「${atk}」。`]);
    if (intent.targetTaunt && atk && tgt) return pick([`嘲讽「${tgt}」得先拆。`, `「${atk}」去撞「${tgt}」。`]);
    if (atk && tgt) return pick([`「${atk}」打「${tgt}」。`, `让「${atk}」顶「${tgt}」。`]);
    if (atk) return `「${atk}」出手。`;
  }

  const threat = game?.player?.board?.slice().sort((a, b) => b.attack - a.attack)[0];
  if (threat?.def?.name) return `先看着「${threat.def.name}」${threat.attack}/${threat.health}。`;
  return '这手先走。';
}

function buildPrompt(persona, game, ev) {
  const system = [
    `你是卡牌对局里的敌人「${persona.name}」。`,
    persona.title ? `身份：${persona.title}。` : '',
    persona.blurb ? `习性：${persona.blurb}` : '',
    `说话气质：${persona.voice}。`,
    '你只会用角色口吻呢喃一句很短的话，像自言自语，不要解释，不要引号，不要策略分析，不要自称AI。',
    '必须点名牌名、随从或嘲讽/斩杀之一。禁止空泛感叹血量。不超过20个汉字。',
  ].filter(Boolean).join('');

  const user = [
    boardSnapshot(game),
    `刚才：${eventLine(ev)}`,
    '现在请呢喃一句，点名场上的牌或随从。',
  ].join('\n');

  return { system, user };
}

function buildThinkPrompt(persona, game, intent) {
  const system = [
    `你是卡牌对局里的敌人「${persona.name}」。`,
    persona.title ? `身份：${persona.title}。` : '',
    `说话气质：${persona.voice}。`,
    '用角色口吻自语1到2句，像在权衡眼前这一手。',
    '必须点名场面里的具体信息：随从名、攻/血、嘲讽、费用、斩杀或清场，至少占一项。',
    '禁止空泛感叹血量（例如「血好少」「啊血量太少了」「啊啊」），禁止只说「有意思」「……」「继续」。',
    '不要自称AI或模型，不要写攻略或最优策略，不要用引号包裹整句。',
    '不超过28个汉字。',
  ].filter(Boolean).join('');

  const hint = thinkHint(game, intent);
  const user = [
    boardSnapshot(game),
    intentLine(intent),
    hint ? `这一手要点：${hint}` : '',
    '现在请自语一句，必须点名上面的牌名或随从。',
  ].filter(Boolean).join('\n');

  return { system, user };
}

export function createBanter({ hud, director }) {
  let persona = personaOf(null);
  let lastAt = 0;
  let inflight = false;
  let disposed = false;
  let live = false;
  let gen = 0;

  function show(text, holdMs) {
    if (disposed || !text) return;
    const xy = director?.debugScreenPos?.('ehero') || null;
    hud?.showEnemyBanter?.(text, persona.name, xy, { holdMs });
  }

  return {
    bind(encounter) {
      persona = personaOf(encounter);
      lastAt = 0;
      disposed = false;
      gen += 1;
    },
    dispose() {
      disposed = true;
      gen += 1;
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
      const my = ++gen;
      lastAt = now;
      inflight = true;
      try {
        let line = '';
        if (live) {
          try {
            const { system, user } = buildPrompt(persona, game, ev);
            line = await mutterOnce({ system, user });
            if (isHollow(line)) line = '';
          } catch {
            live = false;
          }
        }
        if (!line) line = fallbackLine(persona, ev);
        if (disposed || my !== gen) return '';
        show(line, 3200);
        return line;
      } finally {
        if (my === gen) inflight = false;
      }
    },
    async speakThink(game, intent) {
      if (disposed || !game || !intent) return '';
      const my = ++gen;
      lastAt = performance.now();
      inflight = true;
      try {
        let line = '';
        if (live) {
          try {
            const { system, user } = buildThinkPrompt(persona, game, intent);
            line = await mutterOnce({ system, user, ...THINK_MUTTER });
            if (isHollow(line)) line = '';
          } catch {
            live = false;
          }
        }
        if (!line) line = thinkFallback(game, intent);
        if (disposed || my !== gen) return '';
        show(line, 4500 + Math.random() * 1500);
        return line;
      } finally {
        if (my === gen) inflight = false;
      }
    },
  };
}
