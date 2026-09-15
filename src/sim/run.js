import { createRun, grantRelic } from '../run/state.js';
import { enterNode, completeCurrent, getNode, nextHighlightIds } from '../run/map.js';
import { addMaxHp, getEvent, restMaxHpAmount } from '../run/events.js';
import { getEncounter } from '../run/encounters.js';
import { generateShop, buyShopCard, buyShopRelic, shopRemoveCard, refreshShopCards } from '../run/shop.js';
import { makeCombatReward, makeTreasureReward, applyGold, addCardToDeck } from '../run/rewards.js';
import { randomRelic } from '../run/relics.js';
import { mulberry32 } from '../utils/rng.js';
import { playCombat } from './combat.js';
import { pickEventOption, pickReachable, pickRewardCard, shopPlan, worstCard } from './choices.js';

async function fight(run, encounterId, kind, rng, log) {
  const encounter = getEncounter(encounterId);
  const fight = await playCombat(run, encounter, rng);
  log.push({
    floor: run.floor,
    type: kind,
    encounterId,
    winner: fight.winner,
    turns: fight.turns,
    stall: fight.stall,
  });
  if (fight.winner !== 'player') {
    run.alive = false;
    run.hp = Math.max(0, fight.playerHp);
    return fight;
  }
  run.combatsWon += 1;
  run.hp = run.maxHp;
  if (kind === 'boss') {
    run.won = true;
    return fight;
  }
  const reward = makeCombatReward(run, kind, rng);
  applyGold(run, reward.gold);
  if (reward.relic) grantRelic(run, reward.relic);
  const take = pickRewardCard(run, reward.cards || []);
  if (take) addCardToDeck(run, take);
  return fight;
}

async function doEvent(run, eventId, rng, log) {
  const ev = getEvent(eventId);
  const opt = pickEventOption(ev, run);
  const ctx = {
    rng,
    picked: opt.needPick === 'deck' ? worstCard(run) : null,
    grantRelic: () => {
      const id = randomRelic(rng, run.relics);
      grantRelic(run, id);
      return id;
    },
  };
  const out = await opt.apply(run, ctx);
  log.push({ floor: run.floor, type: 'event', eventId, option: opt.id });
  if (run.hp <= 0) {
    run.alive = false;
    return out;
  }
  if (out?.combat) {
    completeCurrent(run);
    await fight(run, out.combat, 'event', rng, log);
  }
  return out;
}

function doShop(run, rng, log) {
  let shop = generateShop(run, rng);
  let spent = 0;
  for (let i = 0; i < 6; i++) {
    const acts = shopPlan(run, shop);
    const act = acts[0];
    if (!act) break;
    if (act.type === 'relic') {
      const r = buyShopRelic(run, shop);
      if (r.ok) spent += 1;
      else break;
    } else if (act.type === 'card') {
      const r = buyShopCard(run, act.item);
      if (r.ok) spent += 1;
      else break;
    } else if (act.type === 'remove') {
      const r = shopRemoveCard(run, shop, act.cardId);
      if (r.ok) spent += 1;
      else break;
    } else if (act.type === 'refresh') {
      const r = refreshShopCards(run, shop, rng);
      if (!r.ok) break;
    } else break;
  }
  log.push({ floor: run.floor, type: 'shop', spent });
}

export async function simulateRun(seed, packId) {
  const rng = mulberry32(seed);
  const run = createRun(rng, seed, packId);
  const log = [];
  let guard = 0;
  while (run.alive && !run.won && guard++ < 24) {
    const ids = nextHighlightIds(run);
    const id = pickReachable(ids, run, getNode, rng);
    if (!id) break;
    enterNode(run, id);
    const node = getNode(run.map, id);
    if (node.type === 'combat' || node.type === 'elite' || node.type === 'boss') {
      await fight(run, node.encounterId, node.type, rng, log);
    } else if (node.type === 'event') {
      await doEvent(run, node.eventId, rng, log);
    } else if (node.type === 'shop') {
      doShop(run, rng, log);
    } else if (node.type === 'rest') {
      addMaxHp(run, restMaxHpAmount(run));
      log.push({ floor: run.floor, type: 'rest', maxHp: run.maxHp });
    } else if (node.type === 'treasure') {
      const reward = makeTreasureReward(run, rng);
      applyGold(run, reward.gold);
      if (reward.relic) grantRelic(run, reward.relic);
      log.push({ floor: run.floor, type: 'treasure', relic: reward.relic });
    }
    if (run.won || !run.alive) break;
    if (run.pendingNode) completeCurrent(run);
  }
  return {
    seed,
    packId: run.packId,
    won: !!run.won,
    alive: !!run.alive,
    floor: run.floor,
    combatsWon: run.combatsWon,
    maxHp: run.maxHp,
    gold: run.gold,
    deckSize: run.deck.length,
    relics: run.relics.slice(),
    log,
  };
}

export function summarize(results) {
  const n = results.length || 1;
  const wins = results.filter((r) => r.won).length;
  const byPack = {};
  const byEnc = {};
  const deathFloor = {};
  for (const r of results) {
    byPack[r.packId] ||= { n: 0, wins: 0, floors: 0 };
    byPack[r.packId].n += 1;
    byPack[r.packId].wins += r.won ? 1 : 0;
    byPack[r.packId].floors += r.floor;
    if (!r.won) deathFloor[r.floor] = (deathFloor[r.floor] || 0) + 1;
    for (const step of r.log) {
      if (!step.encounterId) continue;
      byEnc[step.encounterId] ||= { n: 0, wins: 0 };
      byEnc[step.encounterId].n += 1;
      byEnc[step.encounterId].wins += step.winner === 'player' ? 1 : 0;
    }
  }
  const rate = (w, t) => (t ? +(100 * w / t).toFixed(1) : 0);
  return {
    runs: results.length,
    winRate: rate(wins, n),
    avgFloor: +(results.reduce((s, r) => s + r.floor, 0) / n).toFixed(2),
    avgCombats: +(results.reduce((s, r) => s + r.combatsWon, 0) / n).toFixed(2),
    packs: Object.fromEntries(Object.entries(byPack).map(([k, v]) => [k, {
      n: v.n, winRate: rate(v.wins, v.n), avgFloor: +(v.floors / v.n).toFixed(2),
    }])),
    encounters: Object.fromEntries(Object.entries(byEnc).map(([k, v]) => [k, {
      n: v.n, winRate: rate(v.wins, v.n),
    }])),
    deathFloor,
  };
}
