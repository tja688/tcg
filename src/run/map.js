import { EVENT_IDS } from './events.js';
import { pickEncounter } from './encounters.js';
import { shuffle } from '../utils/rng.js';

export const MAP_LAYOUT = { w: 1200, h: 580 };

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

  const map = {
    act: 1,
    title: '第一幕 · 暮光回廊',
    floors: floors.map((row) => row.map((n) => n.id)),
    nodes,
    startIds: floors[0].map((n) => n.id),
    bossId: floors[floors.length - 1][0].id,
  };
  scatterNodePositions(map, rng);
  return map;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permutations(rest)) out.push([arr[i], ...p]);
  }
  return out;
}

function segmentsCross(a, b, c, d) {
  const side = (p, q, r) => (r.y - p.y) * (q.x - p.x) > (q.y - p.y) * (r.x - p.x);
  return side(a, c, d) !== side(b, c, d) && side(a, b, c) !== side(a, b, d);
}

function placeRowYs(n, spineY, yMin, yMax, rng, kind) {
  if (n === 1) {
    const amp = kind === 'boss' ? 42 : kind === 'start' ? 78 : 138;
    return [clamp(spineY + (rng() - 0.5) * amp, yMin, yMax)];
  }

  const minSep = n === 3 ? 102 : 118;
  const ys = [];
  const mode = rng();

  if (n === 2 && mode < 0.4) {
    const side = rng() < 0.5 ? 0.3 : 0.7;
    const mid = yMin + (yMax - yMin) * side;
    const a = mid + (rng() - 0.5) * 46;
    const b = a + (rng() < 0.5 ? -1 : 1) * (minSep + rng() * 56);
    ys.push(a, b);
  } else if (n === 3 && mode < 0.38) {
    const cluster = yMin + 48 + rng() * (yMax - yMin - 96);
    ys.push(cluster, cluster + (rng() < 0.5 ? -1 : 1) * (minSep + rng() * 28));
    ys.push(cluster > (yMin + yMax) * 0.5
      ? yMin + 24 + rng() * 88
      : yMax - 24 - rng() * 88);
  } else {
    for (let i = 0; i < n; i++) {
      const spread = n === 3 ? 230 : 200;
      ys.push(spineY + (rng() - 0.5) * spread);
    }
  }

  for (let iter = 0; iter < 10; iter++) {
    for (let i = 0; i < ys.length; i++) {
      ys[i] = clamp(ys[i], yMin, yMax);
      for (let j = 0; j < ys.length; j++) {
        if (i === j) continue;
        const d = ys[i] - ys[j];
        if (Math.abs(d) < minSep) {
          ys[i] += (d >= 0 ? 1 : -1) * (minSep - Math.abs(d)) * 0.62;
        }
      }
    }
  }
  return ys.map((y) => clamp(y + (rng() - 0.5) * 18, yMin, yMax));
}

function uncrossFloor(prev, cur, pos) {
  const ids = cur.map((n) => n.id);
  if (ids.length < 2) return;
  const slots = ids.map((id) => ({ ...pos[id] }));
  let best = null;
  let bestCost = Infinity;
  for (const perm of permutations(ids)) {
    const trial = {};
    for (let i = 0; i < perm.length; i++) trial[perm[i]] = slots[i];
    let cost = 0;
    const edges = [];
    for (const n of prev) {
      for (const nid of n.next) {
        if (!trial[nid]) continue;
        cost += Math.abs(pos[n.id].y - trial[nid].y);
        edges.push([n.id, nid]);
      }
    }
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const [a, b] = edges[i];
        const [c, d] = edges[j];
        if (a === c || a === d || b === c || b === d) continue;
        if (segmentsCross(pos[a], trial[b] || pos[b], pos[c], trial[d] || pos[d])) cost += 240;
      }
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = trial;
    }
  }
  if (best) Object.assign(pos, best);
}

function minSep(a, b) {
  const gap = Math.abs(a.floor - b.floor);
  if (gap === 0) return 128;
  if (gap === 1) return 84;
  return 68;
}

function relaxPositions(map, pos, floorXs) {
  const nodes = Object.values(map.nodes);
  const { w: W, h: H } = MAP_LAYOUT;
  for (let iter = 0; iter < 36; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const na = nodes[i];
        const nb = nodes[j];
        const a = pos[na.id];
        const b = pos[nb.id];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d < 1) { dx = 1; dy = 0; d = 1; }
        const need = minSep(na, nb);
        if (d >= need) continue;
        const push = (need - d) * (na.floor === nb.floor ? 0.62 : 0.4);
        const ux = dx / d;
        const uy = dy / d;
        a.x -= ux * push * 0.5;
        a.y -= uy * push * 0.5;
        b.x += ux * push * 0.5;
        b.y += uy * push * 0.5;
      }
    }
    for (const n of nodes) {
      for (const nid of n.next) {
        const a = pos[n.id];
        const b = pos[nid];
        const dy = b.y - a.y;
        if (Math.abs(dy) > 230) {
          a.y += dy * 0.03;
          b.y -= dy * 0.03;
        }
      }
    }
    for (const n of nodes) {
      const p = pos[n.id];
      const band = (n.type === 'boss' || n.floor === 0) ? 18 : 40;
      p.x = clamp(p.x, floorXs[n.floor] - band, floorXs[n.floor] + band);
      p.x = clamp(p.x, 58, W - 58);
      p.y = clamp(p.y, 66, H - 86);
    }
  }
}

function staggerRowX(row, pos, rng) {
  if (row.length < 2) return;
  const sorted = row.slice().sort((a, b) => pos[a.id].y - pos[b.id].y);
  for (let i = 0; i < sorted.length; i++) {
    pos[sorted[i].id].x += (i % 2 ? 1 : -1) * (16 + rng() * 18);
  }
}

function separateSiblings(rows, pos) {
  const { w: W, h: H } = MAP_LAYOUT;
  for (const row of rows) {
    if (row.length < 2) continue;
    for (let iter = 0; iter < 14; iter++) {
      for (let i = 0; i < row.length; i++) {
        for (let j = i + 1; j < row.length; j++) {
          const a = pos[row[i].id];
          const b = pos[row[j].id];
          const d = Math.hypot(b.x - a.x, b.y - a.y);
          if (d >= 128) continue;
          const push = (128 - Math.max(d, 1)) * 0.7;
          if (Math.abs(b.y - a.y) < 96) {
            const dir = b.y >= a.y ? 1 : -1;
            a.y -= dir * push * 0.55;
            b.y += dir * push * 0.55;
          }
          if (Math.abs(b.x - a.x) < 22) {
            const dir = b.x >= a.x ? 1 : -1;
            a.x -= dir * 14;
            b.x += dir * 14;
          } else if (Math.abs(b.x - a.x) < 78) {
            const dir = b.x >= a.x ? 1 : -1;
            a.x -= dir * push * 0.4;
            b.x += dir * push * 0.4;
          }
          a.x = clamp(a.x, 58, W - 58);
          b.x = clamp(b.x, 58, W - 58);
          a.y = clamp(a.y, 66, H - 86);
          b.y = clamp(b.y, 66, H - 86);
        }
      }
    }
  }
}

// 层带内随机漫步 + 同层打散 + 短边无交叉松弛，避免整列对齐。
export function scatterNodePositions(map, rng) {
  const { w: W, h: H } = MAP_LAYOUT;
  const rows = map.floors.map((row) => row.map((id) => map.nodes[id]));
  const nF = rows.length;
  const gaps = [];
  for (let i = 0; i < nF - 1; i++) gaps.push(0.52 + rng() * 0.95);
  const gapSum = gaps.reduce((a, b) => a + b, 0);
  const padL = 80;
  const padR = 92;
  const span = W - padL - padR;
  const floorXs = [padL];
  for (let i = 0; i < gaps.length; i++) {
    floorXs.push(floorXs[i] + (gaps[i] / gapSum) * span);
  }

  let spineY = H * (0.3 + rng() * 0.4);
  const yMin = 68;
  const yMax = H - 88;
  const pos = {};

  for (let f = 0; f < nF; f++) {
    const row = rows[f];
    const kind = f === 0 ? 'start' : (f === nF - 1 ? 'boss' : 'mid');
    const wander = kind === 'boss' ? 0.07 * H : 0.2 * H;
    spineY += (rng() - 0.5) * wander * 2;
    spineY = spineY * 0.8 + H * 0.5 * 0.2;
    spineY = clamp(spineY, yMin + 36, yMax - 36);
    const ys = placeRowYs(row.length, spineY, yMin, yMax, rng, kind);
    const t = nF <= 1 ? 0 : f / (nF - 1);
    const xAmp = kind === 'mid' ? 20 + Math.sin(t * Math.PI) * 24 : 12;
    for (let i = 0; i < row.length; i++) {
      pos[row[i].id] = {
        x: clamp(floorXs[f] + (rng() - 0.5) * 2 * xAmp, 58, W - 58),
        y: ys[i],
      };
    }
    staggerRowX(row, pos, rng);
  }

  for (let f = 1; f < nF; f++) uncrossFloor(rows[f - 1], rows[f], pos);
  relaxPositions(map, pos, floorXs);
  separateSiblings(rows, pos);

  for (const id of Object.keys(pos)) {
    const p = pos[id];
    map.nodes[id].x = Math.round(p.x * 10) / 10;
    map.nodes[id].y = Math.round(p.y * 10) / 10;
  }
  return pos;
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
