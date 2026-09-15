import { escapeHtml, getTerm } from './glossary.js';

const bound = new WeakSet();
let tipEl = null;
let currentAnchor = null;
let tipSource = null;

function ensureTip() {
  if (tipEl?.isConnected) return tipEl;
  tipEl = document.getElementById('infoTip');
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'infoTip';
    tipEl.hidden = true;
    (document.getElementById('ui') || document.body).appendChild(tipEl);
  }
  return tipEl;
}

function rectOf(anchor) {
  if (!anchor) return null;
  if (typeof anchor.getBoundingClientRect === 'function') return anchor.getBoundingClientRect();
  const x = anchor.x ?? 0;
  const y = anchor.y ?? 0;
  return { left: x, top: y, right: x, bottom: y, width: 0, height: 0 };
}

function renderInfo(info) {
  if (!info) return '';
  const bits = [];
  if (info.title) bits.push(`<b>${escapeHtml(info.title)}</b>`);
  if (info.body) bits.push(`<p>${escapeHtml(info.body)}</p>`);
  if (info.tags?.length) {
    bits.push(`<ul class="tipTags">${info.tags.map((t) => (
      `<li><em>${escapeHtml(t.title || t.name || '')}</em>${escapeHtml(t.body || '')}</li>`
    )).join('')}</ul>`);
  }
  if (info.extra) bits.push(`<small>${escapeHtml(info.extra)}</small>`);
  return bits.join('');
}

function placeTip(anchor, opts = {}) {
  const tip = ensureTip();
  const r = rectOf(anchor);
  if (!r) return;
  const pad = 10;
  const tw = Math.min(opts.width || 252, window.innerWidth - pad * 2);
  tip.style.width = `${tw}px`;
  const th = Math.max(tip.offsetHeight || 0, 72);
  const spaceAbove = r.top;
  const spaceBelow = window.innerHeight - r.bottom;
  let place = opts.prefer || 'auto';
  if (place === 'auto') {
    place = spaceAbove > th + 16 && spaceAbove >= spaceBelow ? 'above' : 'below';
    if (place === 'below' && spaceBelow < th + 16 && spaceAbove > spaceBelow) place = 'above';
  }
  let top;
  let left;
  if (place === 'left') {
    left = r.left - tw - 10;
    top = r.top;
    if (left < pad) left = Math.min(window.innerWidth - tw - pad, r.right + 10);
  } else if (place === 'above') {
    top = r.top - th - 8;
    left = r.left + r.width / 2 - tw / 2;
  } else {
    top = r.bottom + 8;
    left = r.left + r.width / 2 - tw / 2;
  }
  left = Math.max(pad, Math.min(left, window.innerWidth - tw - pad));
  top = Math.max(pad, Math.min(top, window.innerHeight - th - pad));
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  tip.style.transform = 'none';
}

export function showTip(anchor, info, opts = {}) {
  const tip = ensureTip();
  const html = renderInfo(typeof info === 'function' ? info() : info);
  if (!html || !anchor) {
    hideTip();
    return;
  }
  currentAnchor = anchor;
  tipSource = opts.source ?? anchor;
  tip.innerHTML = html;
  tip.hidden = false;
  placeTip(anchor, opts);
}

export function showTipAt(x, y, info, opts = {}) {
  showTip({ x, y, getBoundingClientRect: () => ({ left: x, top: y, right: x, bottom: y, width: 0, height: 0 }) }, info, opts);
}

export function hideTip(anchor) {
  if (anchor && currentAnchor !== anchor) return;
  currentAnchor = null;
  tipSource = null;
  if (!tipEl) return;
  tipEl.hidden = true;
}

export function isTipSource(src) {
  return tipSource === src;
}

export function bindTip(el, infoOrFn, opts = {}) {
  if (!el || bound.has(el)) return;
  bound.add(el);
  el.classList.add('tippable');
  const show = () => {
    const info = typeof infoOrFn === 'function' ? infoOrFn() : infoOrFn;
    if (!info) return;
    showTip(el, info, opts);
  };
  const hide = () => hideTip(el);
  el.addEventListener('mouseenter', show);
  el.addEventListener('focus', show);
  el.addEventListener('mouseleave', hide);
  el.addEventListener('blur', hide);
}

export function bindTipTerms(root) {
  if (!root) return;
  root.querySelectorAll('[data-tip]').forEach((el) => {
    const term = getTerm(el.dataset.tip);
    if (term) bindTip(el, term);
  });
}

window.addEventListener('resize', () => hideTip());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hideTip();
});
