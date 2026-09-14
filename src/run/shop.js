import { CFG } from '../config.js';
import { weightedCollectible } from '../game/cards.js';
import { randomRelic, shopPrice } from './relics.js';
import { addCardToDeck, removeCardFromDeck } from './rewards.js';
import { grantRelic } from './state.js';

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

export function buyShopCard(run, item) {
  if (!item || item.sold) return { ok: false, reason: '已经卖出' };
  if (!canAfford(run, item.price)) return { ok: false, reason: '金币不足' };
  run.gold -= item.price;
  addCardToDeck(run, item.cardId);
  item.sold = true;
  return { ok: true };
}

export function buyShopRelic(run, shop) {
  if (!shop.relic || shop.relic.sold) return { ok: false, reason: '没有可买的遗物' };
  if (!canAfford(run, shop.relic.price)) return { ok: false, reason: '金币不足' };
  run.gold -= shop.relic.price;
  grantRelic(run, shop.relic.relicId);
  shop.relic.sold = true;
  return { ok: true };
}

export function shopRemoveCard(run, shop, cardId) {
  if (shop.removed) return { ok: false, reason: '已经删除过一张' };
  if (!cardId) return { ok: false, reason: '' };
  if (!canAfford(run, shop.removePrice)) return { ok: false, reason: '金币不足' };
  if (!removeCardFromDeck(run, cardId)) return { ok: false, reason: '牌库里没有这张牌' };
  run.gold -= shop.removePrice;
  shop.removed = true;
  return { ok: true };
}

export function refreshShopCards(run, shop, rng) {
  if (shop.refreshed) return { ok: false, reason: '只能刷新一次' };
  if (!canAfford(run, shop.refreshPrice)) return { ok: false, reason: '金币不足' };
  run.gold -= shop.refreshPrice;
  const next = generateShop(run, rng);
  shop.cards = next.cards;
  shop.refreshed = true;
  return { ok: true, shop };
}
