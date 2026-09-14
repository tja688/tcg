import { EVENT_IDS } from './events.js';
import { pickEncounter } from './encounters.js';
import { shuffle } from '../utils/rng.js';

// 一幕 14 层：走过约 14 个节点（含 Boss），分支在同层锁死
const FLOOR_LAYOUT = [
  ['combat'],
  ['combat', 'event'],
  ['combat', 'combat', 'event'],
  ['shop', 'combat'],
  ['combat', 'event'],
  ['combat', 'elite'],
  ['rest', 'event'],
  ['combat', 'combat'],
  ['treasure', 'shop'],
  ['elite', 'combat'],
  ['rest', 'shop'],
  ['event', 'combat'],
  ['rest'],
  ['boss'],
];

function link(a, b) {
  if (!a.next.includes(b.id)) a.next.push(b.id);
}

function connectFloors(cur, nxt, rng) {
  for (let i = 0; i < nxt.length; i++) link(cur[i % cur.length], nxt[i]);
  for (let i = 0; i < cur.length; i++) {
    if (!cur[i].next.length) link(cur[i], nxt[i % nxt.length]);
    if (nxt.length > 1 && rng() < 0.5) {
      link(cur[i], nxt[Math.floor(rng() * nxt.length)]);
    }
  }
}

export function generateAct1(rng) {
  const eventBag = shuffle(EVENT_IDS.slice(), rng);
  let eventI = 0;
  const usedEnc = new Set();
  const floors = [];

  for (let f = 0; f < FLOOR_LAYOUT.length; f++) {
    const types = FLOOR_LAYOUT[f];
    const nodes = types.map((type, index) => {
      const node = {
        id: `f${f}n${index}`,
        floor: f,
        index,
        type,
        next: [],
        encounterId: null,
        eventId: null,
      };
      if (type === 'combat' || type === 'elite' || type === 'boss') {
        node.encounterId = pickEncounter(type, f, rng, usedEnc);
        usedEnc.add(node.encounterId);
      }
      if (type === 'event') {
        node.eventId = eventBag[eventI % eventBag.length];
        eventI++;
      }
      return node;
    });
    floors.push(nodes);
  }

  for (let f = 0; f < floors.length - 1; f++) connectFloors(floors[f], floors[f + 1], rng);

  const nodes = {};
  for (const row of floors) for (const n of row) nodes[n.id] = n;

  return {
    act: 1,
    title: '第一幕 · 暮光回廊',
    floors: floors.map((row) => row.map((n) => n.id)),
    nodes,
    startIds: floors[0].map((n) => n.id),
    bossId: floors[floors.length - 1][0].id,
  };
}

export function getNode(map, id) {
  return map.nodes[id] || null;
}

export function nodeReachable(run, id) {
  const node = getNode(run.map, id);
  if (!node || run.pendingNode) return false;
  if (run.visited.includes(id) || id === run.currentId) return false;
  if (!run.currentId) return run.map.startIds.includes(id);
  const cur = getNode(run.map, run.currentId);
  return !!(cur && cur.next.includes(id));
}

export function enterNode(run, id) {
  if (!nodeReachable(run, id)) return false;
  const node = getNode(run.map, id);
  if (run.currentId && !run.visited.includes(run.currentId)) run.visited.push(run.currentId);
  run.locked.push(...siblingsToLock(run, node));
  run.currentId = id;
  run.floor = node.floor;
  run.pendingNode = true;
  return true;
}

function siblingsToLock(run, node) {
  const row = run.map.floors[node.floor] || [];
  return row.filter((id) => id !== node.id && !run.visited.includes(id) && id !== run.currentId);
}

export function completeCurrent(run) {
  run.pendingNode = false;
}

export function nodeVisualState(run, id) {
  const node = getNode(run.map, id);
  if (!node) return 'locked';
  if (run.currentId === id) return 'current';
  if (run.visited.includes(id)) return 'visited';
  if (nodeReachable(run, id)) return 'available';
  if (run.locked.includes(id)) return 'skipped';
  return 'locked';
}

export function nextHighlightIds(run) {
  if (!run.currentId) return run.map.startIds.slice();
  if (run.pendingNode) return [];
  return (getNode(run.map, run.currentId)?.next || []).filter((id) => nodeReachable(run, id));
}
