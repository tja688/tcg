import { gsap } from 'gsap';
import { getNode, nodeVisualState, nextHighlightIds, scatterNodePositions, MAP_LAYOUT } from '../run/map.js';
import { getEvent } from '../run/events.js';
import { getEncounter } from '../run/encounters.js';
import { mulberry32 } from '../utils/rng.js';
import { TYPE_META } from './screens.js';
import { nodeTipInfo } from './glossary.js';
import { hideTip, showTip } from './tooltip.js';

const MAP_W = MAP_LAYOUT.w;
const MAP_H = MAP_LAYOUT.h;
const PAWN_SRC = '/assets/ui/pawn_player.png';

function reduceMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

function nodeTitle(n, meta) {
  if (n.encounterId) return getEncounter(n.encounterId)?.name || meta.label;
  if (n.eventId) return getEvent(n.eventId)?.title || meta.label;
  return meta.label;
}

function pathKind(run, fromId, toId) {
  const a = nodeVisualState(run, fromId);
  const b = nodeVisualState(run, toId);
  if ((a === 'visited' || a === 'current') && (b === 'visited' || b === 'current')) return 'walked';
  if (b === 'available' && (a === 'current' || a === 'visited' || a === 'available')) return 'next';
  return 'idle';
}

function edgeNoise(key) {
  let h = 2166136261;
  const s = String(key);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function curveOf(a, b, key) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const rnd = edgeNoise(key);
  const sign = rnd < 0.5 ? -1 : 1;
  const mag = Math.min(58, 8 + len * 0.15) * (0.55 + rnd * 0.8);
  const along = 0.38 + rnd * 0.22;
  return {
    a,
    b,
    c: {
      x: a.x + dx * along + nx * mag * sign,
      y: a.y + dy * along + ny * mag * sign,
    },
  };
}

function quadPath(a, b, key) {
  const { c } = curveOf(a, b, key);
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${c.x.toFixed(1)},${c.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}

function bezier2(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function layoutNodes(map) {
  const missing = Object.values(map.nodes).some((n) => n.x == null || n.y == null);
  if (missing) {
    const seed = hashSeed(Object.keys(map.nodes).sort().join(','));
    scatterNodePositions(map, mulberry32(seed));
  }
  const pos = {};
  for (const id of Object.keys(map.nodes)) {
    const n = map.nodes[id];
    pos[id] = { x: n.x, y: n.y };
  }
  return pos;
}

function entrancePos(pos, run) {
  const start = pos[run.map.startIds[0]] || { x: 72, y: MAP_H * 0.5 };
  return { x: Math.max(18, start.x - 6), y: Math.max(40, start.y - 98) };
}

function pawnHome(pos, run) {
  if (run.currentId && pos[run.currentId]) return pos[run.currentId];
  return entrancePos(pos, run);
}

function setPawnAt(el, pt) {
  el.style.left = `${(pt.x / MAP_W) * 100}%`;
  el.style.top = `${(pt.y / MAP_H) * 100}%`;
}

function marchDuration(a, b) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  return gsap.utils.clamp(0.6, 1.1, 0.58 + dist / 360);
}

function controlFor(from, to, stored) {
  if (stored) return stored;
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const lift = dist < 110 ? -52 : 22;
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + lift };
}

export function playMapEnter(root) {
  if (reduceMotion()) return;
  const panel = root.querySelector('[data-screen="map"]');
  if (!panel) return;
  const nodes = panel.querySelectorAll('.mapNode');
  if (nodes.length) {
    gsap.from(nodes, {
      scale: 0.55, opacity: 0, duration: 0.42, stagger: 0.016,
      ease: 'back.out(1.5)', overwrite: 'auto',
    });
  }
  const paths = panel.querySelectorAll('.mapPath.dust.next, .mapPath.dust.walked');
  if (paths.length) {
    gsap.from(paths, { opacity: 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });
  }
  const head = panel.querySelector('.mapHead');
  if (head) {
    gsap.from(head, { y: -14, opacity: 0, duration: 0.42, ease: 'power3.out', overwrite: 'auto' });
  }
  const inner = panel.querySelector('.mapPawnInner');
  if (inner) {
    gsap.from(inner, { y: 16, opacity: 0, duration: 0.48, ease: 'power3.out', overwrite: 'auto' });
  }
}

function buildMapHtml(run, pos, edges) {
  const map = run.map;
  const next = new Set(nextHighlightIds(run));
  let lines = '';
  for (const id of Object.keys(map.nodes)) {
    const n = map.nodes[id];
    const a = pos[id];
    for (const nid of n.next) {
      const b = pos[nid];
      const kind = pathKind(run, id, nid);
      const key = `${id}>${nid}`;
      const curve = curveOf(a, b, key);
      edges[key] = curve;
      const d = quadPath(a, b, key);
      lines += `<path class="mapPath ink ${kind}" d="${d}"/>`;
      lines += `<path class="mapPath dust ${kind}" d="${d}"/>`;
    }
  }

  const nodesHtml = Object.keys(map.nodes).map((id) => {
    const n = map.nodes[id];
    const p = pos[id];
    const st = nodeVisualState(run, id);
    const meta = TYPE_META[n.type];
    const clickable = st === 'available';
    const title = nodeTitle(n, meta);
    return `<div class="mapPin" style="left:${(p.x / MAP_W) * 100}%;top:${(p.y / MAP_H) * 100}%">
      <button type="button" class="mapNode ${st} t-${n.type}" data-node-id="${id}"
        aria-disabled="${clickable ? 'false' : 'true'}"
        aria-label="${meta.label} · ${title}">
        <span class="nodeCore">
          <span class="ico">${meta.icon}</span>
          ${next.has(id) ? '<i class="pulse"></i>' : ''}
        </span>
        <span class="lab">${meta.label}</span>
      </button>
    </div>`;
  }).join('');

  const home = pawnHome(pos, run);

  return `
    <div class="panel dim mapPanel" data-screen="map">
      <div class="mapFx" aria-hidden="true"></div>
      <div class="mapChrome">
        <div class="mapHead">
          <div>
            <div class="eyebrow">${map.title}</div>
            <h2>选择下一处落脚</h2>
          </div>
          <div class="mapHeadActs">
            <button class="ghostBtn" type="button" data-act="deck">查看牌库</button>
          </div>
        </div>
        <div class="mapStage">
          <div class="mapStageBg"></div>
          <svg class="mapLines" viewBox="0 0 ${MAP_W} ${MAP_H}" preserveAspectRatio="none">
            <defs>
              <filter id="mapInk" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="1.1" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="mapGoldDust" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.4" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            ${lines}
          </svg>
          <div class="mapNodes">${nodesHtml}
            <div class="mapPawn" style="left:${(home.x / MAP_W) * 100}%;top:${(home.y / MAP_H) * 100}%">
              <div class="mapPawnInner">
                <img src="${PAWN_SRC}" alt="">
              </div>
            </div>
          </div>
          <div class="mapTip" hidden></div>
        </div>
      </div>
    </div>`;
}

function lockMarch(screens, panel, on) {
  screens._navLock = on;
  panel.classList.toggle('is-marching', on);
  panel.querySelectorAll('[data-node-id]').forEach((btn) => {
    if (on) btn.setAttribute('aria-disabled', 'true');
  });
}

function marchPawn(pawn, from, ctrl, to, onDone, sfx) {
  const proxy = { t: 0 };
  const dur = marchDuration(from, to);
  let done = false;
  let lastStep = -1;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(safety);
    gsap.killTweensOf(proxy);
    gsap.ticker.lagSmoothing(500, 33);
    setPawnAt(pawn, to);
    onDone();
  };
  pawn.classList.toggle('face-left', to.x < from.x);
  gsap.killTweensOf(proxy);
  gsap.killTweensOf(pawn);
  gsap.ticker.lagSmoothing(0);
  const safety = setTimeout(finish, Math.round(dur * 1000) + 280);
  gsap.to(proxy, {
    t: 1,
    duration: dur,
    ease: 'power1.inOut',
    overwrite: true,
    onUpdate() {
      setPawnAt(pawn, bezier2(from, ctrl, to, proxy.t));
      const step = Math.floor(proxy.t / 0.18);
      if (step !== lastStep) {
        lastStep = step;
        sfx?.cue('avatar.walk.step');
      }
    },
    onComplete: finish,
  });
}

function bindMap(screens, run, pos, edges, { onNode, onDeck }) {
  const tip = screens.root.querySelector('.mapTip');
  const panel = screens.root.querySelector('.mapPanel');
  const pawn = screens.root.querySelector('.mapPawn');
  screens.root.querySelector('[data-act="deck"]').onclick = () => { onDeck(); };

  screens.root.querySelectorAll('[data-node-id]').forEach((btn) => {
    btn.onmouseenter = () => {
      const n = getNode(run.map, btn.dataset.nodeId);
      const meta = TYPE_META[n.type];
      const title = nodeTitle(n, meta);
      const enc = n.encounterId ? getEncounter(n.encounterId) : null;
      const ev = n.eventId ? getEvent(n.eventId) : null;
      showTip(btn, nodeTipInfo(n.type, title, enc?.blurb || ev?.title || ''), { prefer: 'above', width: 240 });
      if (tip) {
        tip.hidden = true;
      }
    };
    btn.onmouseleave = () => {
      hideTip(btn);
      if (tip) tip.hidden = true;
    };
    btn.onclick = () => {
      if (screens._navLock || panel.classList.contains('is-marching')) return;
      if (btn.getAttribute('aria-disabled') === 'true') {
        screens.hud.toast(btn.classList.contains('visited')
          ? '已经走过这里'
          : (btn.classList.contains('locked') || btn.classList.contains('skipped')
            ? '这条路已经锁死'
            : '还不能前往此处'));
        screens.sfx.error();
        btn.classList.add('shake');
        setTimeout(() => btn.classList.remove('shake'), 400);
        return;
      }
      const id = btn.dataset.nodeId;
      screens.sfx.click();
      if (reduceMotion()) {
        onNode(id);
        return;
      }
      const dest = pos[id];
      const fromId = run.currentId;
      const edge = fromId ? edges[`${fromId}>${id}`] : null;
      const from = fromId && pos[fromId] ? pos[fromId] : pawnHome(pos, run);
      const ctrl = controlFor(from, dest, edge?.c);
      lockMarch(screens, panel, true);
      hideTip();
      if (tip) tip.hidden = true;
      marchPawn(pawn, from, ctrl, dest, () => {
        if (!pawn.isConnected) return;
        onNode(id);
      }, screens.sfx);
    };
  });
}

export async function renderMap(screens, run, handlers) {
  screens._navLock = false;
  const pos = layoutNodes(run.map);
  const edges = {};
  await screens.present(buildMapHtml(run, pos, edges), { title: '选择前路', kind: 'map' });
  bindMap(screens, run, pos, edges, handlers);
}
