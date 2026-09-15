import { CFG } from '../config.js';
import { generateAct1 } from './map.js';
import { getRelic } from './relics.js';
import { buildStarterDeck, getPack, STARTER_PACKS } from './packs.js';

export { STARTER_PACKS };

/** 余烬先锋的一份定稿 14 张，给旧测试和对照用。实际开局走 buildStarterDeck。 */
export const STARTER_DECK = STARTER_PACKS.ember.core.concat(
  STARTER_PACKS.ember.pool.slice(0, STARTER_PACKS.ember.extraCount),
);

export function createRun(rng, seed, packId = 'ember') {
  const pack = getPack(packId);
  return {
    seed,
    packId: pack.id,
    hp: CFG.rules.heroHp,
    maxHp: CFG.rules.heroHp,
    gold: CFG.rules.startGold,
    deck: buildStarterDeck(pack.id, rng),
    relics: [],
    map: generateAct1(rng),
    currentId: null,
    visited: [],
    locked: [],
    floor: 0,
    combatsWon: 0,
    pendingNode: false,
    alive: true,
    won: false,
    shop: null,
  };
}

export function grantRelic(run, id) {
  if (!id || run.relics.includes(id)) return null;
  run.relics.push(id);
  const def = getRelic(id);
  if (def?.onGain) def.onGain(run);
  return def;
}

export function snapshotRun(run) {
  return {
    seed: run.seed,
    packId: run.packId || null,
    hp: run.hp,
    maxHp: run.maxHp,
    gold: run.gold,
    deck: run.deck.slice(),
    relics: run.relics.slice(),
    currentId: run.currentId,
    floor: run.floor,
    visited: run.visited.length,
    combatsWon: run.combatsWon,
    alive: run.alive,
    won: run.won,
  };
}
