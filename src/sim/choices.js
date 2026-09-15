import { CARDS, getCard } from '../game/cards.js';
import { optionDisabled } from '../run/events.js';

export function scoreNode(node, run) {
  switch (node.type) {
    case 'treasure': return 12;
    case 'rest': return 8;
    case 'shop': return run.gold >= 90 ? 10 : run.gold >= 50 ? 7 : 4;
    case 'event': return 6;
    case 'combat': return 5;
    case 'elite': return run.combatsWon >= 3 && run.maxHp >= 48 ? 6 : 1;
    case 'boss': return 1;
    default: return 0;
  }
}

export function pickReachable(ids, run, getNode, rng) {
  if (!ids.length) return null;
  let best = ids[0];
  let bestS = -1e9;
  for (const id of ids) {
    const node = getNode(run.map, id);
    const s = scoreNode(node, run) + rng() * 0.35;
    if (s > bestS) {
      bestS = s;
      best = id;
    }
  }
  return best;
}

export function cardValue(id, packId, deck) {
  const def = getCard(id);
  if (!def) return -10;
  let s = 4 + (4 - Math.min(def.cost, 6)) * 0.6;
  const copies = deck.filter((x) => x === id).length;
  if (copies >= 2) s -= 1.5;
  if (copies >= 3) s -= 2;
  if (id === 'burden') s -= 8;
  if (def.keywords?.includes('taunt') && packId === 'ward') s += 2;
  if (def.keywords?.includes('charge') && packId === 'ember') s += 2;
  if ((def.spell?.kind === 'damage' || def.spell?.kind === 'siphon') && packId === 'ember') s += 2;
  if ((def.spell?.kind === 'draw' || def.spell?.kind === 'siphon') && packId === 'rift') s += 2;
  if ((def.spell?.kind === 'armor' || def.spell?.kind === 'heal') && packId === 'ward') s += 2;
  if (def.rarity === 'legendary' || def.rarity === 'epic') s += 1.2;
  return s;
}

export function worstCard(run) {
  let worst = run.deck[0] || null;
  let score = 1e9;
  for (const id of run.deck) {
    const s = cardValue(id, run.packId, run.deck);
    if (s < score) {
      score = s;
      worst = id;
    }
  }
  return worst;
}

export function pickRewardCard(run, cardIds) {
  let best = cardIds[0] || null;
  let score = -1e9;
  for (const id of cardIds) {
    const s = cardValue(id, run.packId, run.deck);
    if (s > score) {
      score = s;
      best = id;
    }
  }
  return best;
}

const EVENT_PREF = {
  blood_coin: ['safe', 'leave', 'gamble'],
  spring_price: ['heal', 'leave', 'blood'],
  transmute: ['pay', 'transform'],
  relic_altar: ['take', 'pray'],
  ambush_toll: ['fight', 'pay', 'wound'],
  old_shrine: ['bow', 'scribble'],
  purge_well: ['leave', 'remove_gold', 'remove_hp'],
  fate_die: ['buy', 'leave', 'roll'],
  wandering_cart: ['water', 'cheap'],
  shadow_pact: ['sign', 'tear'],
};

export function pickEventOption(ev, run) {
  const live = ev.options.filter((o) => !optionDisabled(run, o));
  if (!live.length) return ev.options[0];
  const pref = EVENT_PREF[ev.id] || [];
  for (const id of pref) {
    const hit = live.find((o) => o.id === id);
    if (!hit) continue;
    if (id === 'take' && run.hp <= 7) continue;
    if (id === 'sign' && run.hp <= 11) continue;
    if (id === 'wound' && run.hp <= 12) continue;
    if (id === 'gamble' && run.hp <= 8) continue;
    if (id === 'roll' && run.hp <= 9) continue;
    if (id === 'blood' && run.hp <= 10) continue;
    if (id === 'fight' && run.combatsWon === 0 && run.maxHp < 44) continue;
    return hit;
  }
  return live[0];
}

const RELIC_PRI = {
  crystal_core: 10,
  sage_quill: 9,
  void_lens: 8,
  war_banner: 8,
  guardian_scale: 7,
  vital_heart: 7,
  ember_coin: 5,
  merchant_seal: 4,
  iron_chalice: 3,
  thorn_sigil: 3,
};

export function shopPlan(run, shop) {
  const acts = [];
  const relic = shop.relic;
  if (relic && !relic.sold && run.gold >= relic.price) {
    const pri = RELIC_PRI[relic.relicId] || 2;
    if (pri >= 7 || run.gold >= relic.price + 40) acts.push({ type: 'relic' });
  }
  const cards = shop.cards
    .filter((c) => !c.sold && run.gold >= c.price)
    .map((c) => ({ c, s: cardValue(c.cardId, run.packId, run.deck) - c.price / 40 }))
    .sort((a, b) => b.s - a.s);
  for (const row of cards.slice(0, 2)) {
    if (row.s >= 3.2) acts.push({ type: 'card', item: row.c });
  }
  const worst = worstCard(run);
  if (worst && !shop.removed && run.gold >= shop.removePrice) {
    if (worst === 'burden' || (run.deck.length >= 16 && cardValue(worst, run.packId, run.deck) < 3)) {
      acts.push({ type: 'remove', cardId: worst });
    }
  }
  if (!shop.refreshed && run.gold >= shop.refreshPrice + 50) {
    const cheap = shop.cards.some((c) => !c.sold && (CARDS[c.cardId]?.cost || 9) <= 3);
    if (!cheap) acts.push({ type: 'refresh' });
  }
  return acts;
}
