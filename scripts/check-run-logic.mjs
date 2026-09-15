import { mulberry32 } from '../src/utils/rng.js';
import { createRun, grantRelic, STARTER_DECK } from '../src/run/state.js';
import { PACK_IDS, STARTER_PACKS, assertPacks, buildStarterDeck } from '../src/run/packs.js';
import { enterNode, completeCurrent, nodeReachable, nextHighlightIds, getNode } from '../src/run/map.js';
import { addMaxHp, getEvent, EVENT_IDS, restMaxHpAmount } from '../src/run/events.js';
import { ENCOUNTERS } from '../src/run/encounters.js';
import { CARDS, collectibleCards } from '../src/game/cards.js';
import { makeCombatReward, makeTreasureReward, applyGold } from '../src/run/rewards.js';
import { shopPrice } from '../src/run/relics.js';
import { generateShop, buyShopCard, buyShopRelic, shopRemoveCard, refreshShopCards } from '../src/run/shop.js';
import { resolveArenaEnv } from '../src/three/environments.js';

const rng = mulberry32(20260914);
const run = createRun(rng, 20260914);
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

ok(run.map.floors.length >= 12, 'floors >= 12');
ok(Object.keys(run.map.nodes).length >= 16, 'enough nodes');
ok(EVENT_IDS.length >= 8, 'events >= 8');
ok(Object.keys(ENCOUNTERS).length >= 8, 'encounters >= 8');

const start = run.map.startIds[0];
ok(nodeReachable(run, start), 'start reachable');
ok(enterNode(run, start), 'enter start');
ok(run.pendingNode, 'pending while inside');
ok(!nodeReachable(run, start), 'cannot reenter current');
completeCurrent(run);
const next = nextHighlightIds(run);
ok(next.length >= 1, 'has next after complete');
const sibling = (run.map.floors[getNode(run.map, start).floor] || []).find((id) => id !== start);
if (sibling) ok(!nodeReachable(run, sibling), 'sibling locked');

const nxt = next[0];
ok(enterNode(run, nxt), 'enter next');
completeCurrent(run);

for (const id of EVENT_IDS) {
  const ev = getEvent(id);
  ok(ev.options.length >= 2, `${id} has options`);
  ok(ev.options.every((o) => typeof o.apply === 'function'), `${id} apply`);
}

for (const enc of Object.values(ENCOUNTERS)) {
  ok(enc.phases?.length >= 1, `${enc.id} phases`);
  for (const cid of enc.deck || []) ok(!!CARDS[cid], `${enc.id} deck card ${cid}`);
  for (const cid of enc.startBoard || []) ok(!!CARDS[cid], `${enc.id} board card ${cid}`);
}

ok(collectibleCards().length >= 16, 'collectible pool');
ok(run.deck.every((id) => CARDS[id]), 'starter deck valid');
ok(run.deck.length === 14, 'starter deck is 14 cards');
ok(run.packId === 'ember', 'default pack is ember');
ok(STARTER_DECK.length === 14, 'legacy STARTER_DECK snapshot is 14');
assertPacks();
ok(PACK_IDS.length === 3, 'three starter packs');
for (const id of PACK_IDS) {
  const pack = STARTER_PACKS[id];
  ok(pack.core.length + pack.extraCount === 14, `${id} deals 14`);
  const built = buildStarterDeck(id, mulberry32(7));
  ok(built.length === 14 && built.every((cid) => CARDS[cid]), `${id} build valid`);
}
ok(run.hp === 40 && run.maxHp === 40 && run.gold === 90, 'open 40/40 and 90 gold');
ok(run.map.floors.length === 14, 'act1 is 14 floors');

ok(grantRelic(run, 'vital_heart')?.id === 'vital_heart', 'grant vital_heart');
ok(run.maxHp === 48 && run.hp === 48, 'vital_heart onGain +8/+8');
ok(grantRelic(run, 'vital_heart') === null, 'duplicate relic rejected');

ok(restMaxHpAmount({ maxHp: 40, relics: [] }) === 6, 'rest +6 max hp');
ok(restMaxHpAmount({ maxHp: 48, relics: [] }) === 6, 'rest max hp is flat');
ok(restMaxHpAmount({ maxHp: 40, relics: ['iron_chalice'] }) === 9, 'iron_chalice +3');
{
  const probe = { hp: 22, maxHp: 40 };
  ok(addMaxHp(probe, 6) === 6 && probe.maxHp === 46 && probe.hp === 28, 'addMaxHp raises cap and current');
}
ok(shopPrice(75, []) === 75, 'shop remove base 75');
ok(shopPrice(75, ['merchant_seal']) === 60, 'merchant_seal 20% off');
ok(shopPrice(160, ['merchant_seal']) === 128, 'relic slot 160 * 0.8');

const rCombat = makeCombatReward({ relics: [] }, 'combat', mulberry32(1));
ok(rCombat.gold >= 18 && rCombat.gold <= 24, 'combat gold 18-24');
ok(rCombat.relic === null && rCombat.cards.length === 3, 'combat reward 3 cards no relic');
const rEvent = makeCombatReward({ relics: [] }, 'event', mulberry32(2));
ok(rEvent.gold >= 18 && rEvent.gold <= 24 && rEvent.relic === null, 'event combat uses normal gold table');
const rElite = makeCombatReward({ relics: [] }, 'elite', mulberry32(3));
ok(rElite.gold >= 28 && rElite.gold <= 38, 'elite gold 28-38');
ok(!!rElite.relic, 'elite drops a relic');
const rBoss = makeCombatReward({ relics: [] }, 'boss', mulberry32(4));
ok(rBoss.gold >= 18 && rBoss.gold <= 24, 'boss gold uses combat table not elite');
ok(!!rBoss.relic, 'boss reward object still rolls a relic');
const rCoin = makeCombatReward({ relics: ['ember_coin'] }, 'combat', mulberry32(1));
ok(rCoin.gold === rCombat.gold + 10, 'ember_coin +10 at generation');
const rTreasure = makeTreasureReward({ relics: [] }, mulberry32(5));
ok(rTreasure.gold >= 28 && rTreasure.gold <= 43, 'treasure gold 28-43');

const shopRun = createRun(mulberry32(9), 9);
const shop = generateShop(shopRun, mulberry32(11));
ok(shop.cards.length === 3, 'shop has 3 cards');
ok(shop.removePrice === 75 && shop.refreshPrice === 25, 'shop remove/refresh prices');
shopRun.gold = 200;
const paid = buyShopCard(shopRun, shop.cards[0]);
ok(paid.ok && shop.cards[0].sold, 'buy shop card');
ok(shopRun.gold === 200 - shop.cards[0].price, 'shop gold deducted');
ok(shopRun.deck.includes(shop.cards[0].cardId), 'bought card enters deck');
const sold = buyShopCard(shopRun, shop.cards[0]);
ok(!sold.ok && sold.reason === '已经卖出', 'cannot buy sold card');
const relicBefore = shop.relic?.relicId || null;
const refreshed = refreshShopCards(shopRun, shop, mulberry32(12));
ok(refreshed.ok && shop.refreshed, 'shop refresh once');
ok((shop.relic?.relicId || null) === relicBefore, 'refresh keeps relic slot');
ok(!refreshShopCards(shopRun, shop, mulberry32(13)).ok, 'second refresh blocked');

const relicRun = createRun(mulberry32(21), 21);
relicRun.gold = 500;
const shopR = generateShop(relicRun, mulberry32(22));
if (shopR.relic) {
  const boughtR = buyShopRelic(relicRun, shopR);
  ok(boughtR.ok && shopR.relic.sold, 'buy shop relic');
  ok(relicRun.relics.includes(shopR.relic.relicId), 'bought relic granted with onGain path');
  ok(!buyShopRelic(relicRun, shopR).ok, 'sold relic blocked');
} else {
  ok(buyShopRelic(relicRun, shopR).reason === '没有可买的遗物', 'empty relic slot rejected');
}

const remRun = createRun(mulberry32(31), 31);
remRun.gold = 200;
const shopRem = generateShop(remRun, mulberry32(32));
const firstId = remRun.deck[0];
const deckN = remRun.deck.length;
const removed = shopRemoveCard(remRun, shopRem, firstId);
ok(removed.ok && shopRem.removed, 'shop remove once');
ok(remRun.deck.length === deckN - 1, 'remove drops first matching copy');
ok(!shopRemoveCard(remRun, shopRem, remRun.deck[0]).ok, 'second remove blocked');
ok(shopRemoveCard(remRun, shopRem, 'no_such_card').reason === '已经删除过一张', 'remove lock beats missing id');

applyGold(shopRun, -200);
ok(shopRun.gold === 0, 'applyGold floors at 0');

ok(resolveArenaEnv({ kind: 'title' }) === 'dusk', 'title env is dusk');
ok(resolveArenaEnv({ floor: 0, kind: 'combat' }) === 'dusk', 'early combat dusk');
ok(resolveArenaEnv({ floor: 4, kind: 'combat' }) === 'ashen', 'mid combat ashen');
ok(resolveArenaEnv({ floor: 7, kind: 'combat' }) === 'void', 'deep combat void');
ok(resolveArenaEnv({ floor: 11, kind: 'combat' }) === 'threshold', 'late combat threshold');
ok(resolveArenaEnv({ floor: 5, kind: 'elite' }) === 'void', 'early elite steps up');
ok(resolveArenaEnv({ floor: 13, kind: 'boss' }) === 'abyss', 'boss is abyss');

if (fails.length) {
  console.error('FAIL\n' + fails.join('\n'));
  process.exit(1);
}
console.log('OK', {
  floors: run.map.floors.length,
  nodes: Object.keys(run.map.nodes).length,
  events: EVENT_IDS.length,
  encounters: Object.keys(ENCOUNTERS).length,
  cards: Object.keys(CARDS).length,
});
