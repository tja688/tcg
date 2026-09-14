import { CFG } from '../config.js';
import { weightedCollectible } from '../game/cards.js';
import { hasRelic, randomRelic } from './relics.js';

function rollGold(rng, [lo, hi]) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function makeCombatReward(run, kind, rng) {
  const elite = kind === 'elite' || kind === 'boss';
  let gold = kind === 'elite'
    ? rollGold(rng, CFG.rules.eliteGold)
    : rollGold(rng, CFG.rules.combatGold);
  if (hasRelic(run.relics, 'ember_coin')) gold += 10;
  const cards = [];
  const seen = [];
  for (let i = 0; i < 3; i++) {
    const def = weightedCollectible(rng, { elite, exclude: seen });
    seen.push(def.id);
    cards.push(def.id);
  }
  return {
    gold,
    cards,
    relic: elite ? randomRelic(rng, run.relics) : null,
    kind,
  };
}

export function makeTreasureReward(run, rng) {
  return {
    gold: 28 + Math.floor(rng() * 16),
    cards: null,
    relic: randomRelic(rng, run.relics),
    kind: 'treasure',
  };
}

export function applyGold(run, n) {
  run.gold = Math.max(0, run.gold + n);
}

export function addCardToDeck(run, cardId) {
  if (cardId) run.deck.push(cardId);
}

export function removeCardFromDeck(run, cardId) {
  const i = run.deck.indexOf(cardId);
  if (i >= 0) {
    run.deck.splice(i, 1);
    return true;
  }
  return false;
}

export function addRelic(run, relicId) {
  if (!relicId || run.relics.includes(relicId)) return false;
  run.relics.push(relicId);
  return true;
}
