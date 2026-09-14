import { mulberry32 } from '../src/utils/rng.js';
import { createRun } from '../src/run/state.js';
import { enterNode, completeCurrent, nodeReachable, nextHighlightIds, getNode } from '../src/run/map.js';
import { getEvent, EVENT_IDS } from '../src/run/events.js';
import { ENCOUNTERS } from '../src/run/encounters.js';
import { CARDS, collectibleCards } from '../src/game/cards.js';

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
