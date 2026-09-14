import { CFG } from '../config.js';
import { weightedCollectible } from '../game/cards.js';
import { randomRelic, shopPrice } from './relics.js';

export function generateShop(run, rng) {
  const cards = [];
  const seen = new Set();
  for (let i = 0; i < 3; i++) {
    const def = weightedCollectible(rng, { exclude: [...seen] });
    seen.add(def.id);
    const base = def.rarity === 'legendary' ? 90
      : def.rarity === 'epic' ? 72
        : def.rarity === 'rare' ? 55
          : 42;
    cards.push({ id: `c${i}`, cardId: def.id, price: shopPrice(base, run.relics), sold: false });
  }
  const relicId = randomRelic(rng, run.relics);
  return {
    cards,
    relic: relicId ? {
      relicId, price: shopPrice(160, run.relics), sold: false,
    } : null,
    removePrice: shopPrice(CFG.rules.shopRemove, run.relics),
    removed: false,
    refreshPrice: shopPrice(CFG.rules.shopRefresh, run.relics),
    refreshed: false,
  };
}

export function canAfford(run, price) {
  return run.gold >= price;
}
