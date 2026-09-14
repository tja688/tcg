import { gsap } from 'gsap';
import { CFG } from '../config.js';
import { CARDS, getCard } from '../game/cards.js';
import { paintCardFace } from '../three/cardVisual.js';
import { getRelic } from '../run/relics.js';
import { getNode, nodeVisualState, nextHighlightIds } from '../run/map.js';
import { getEvent, optionDisabled } from '../run/events.js';
import { getEncounter } from '../run/encounters.js';
import { SceneVeil } from './transition.js';
import './screens.css';

const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;

export const TYPE_META = {
  combat: { label: '战斗', icon: svg('M5 3.2 11.2 9.4 9.8 10.8 8 9l-2.2 6.8-2.2-.7L5.6 9 3.4 6.8 5 3.2zm14 0-6.2 6.2 1.4 1.4L16 9l2.2 6.8 2.2-.7L18.4 9l2.2-2.2L19 3.2zM8.8 16.2 12 19.4l6.2-6.2-1.4-1.4-4.8 4.8-1.8-1.8-1.4 1.4z') },
  elite: { label: '精英', icon: svg('M12 2.5 4.8 7v5.6c0 4.4 3 7.4 7.2 8.9 4.2-1.5 7.2-4.5 7.2-8.9V7L12 2.5zm0 2.3 5.4 3.3v4.5c0 3.1-2 5.4-5.4 6.7-3.4-1.3-5.4-3.6-5.4-6.7V8.1L12 4.8zM9.2 10h5.6v1.6H9.2V10zm.8 3.2h4v1.6h-4v-1.6z') },
  event: { label: '事件', icon: svg('M12 2a10 10 0 1 0 .01 20.01A10 10 0 0 0 12 2zm0 3.2c1.7 0 3 1.1 3 2.7 0 1.2-.7 1.9-1.6 2.5-.8.5-1.1.9-1.1 1.6v.4h-1.8v-.5c0-1.3.7-2.1 1.7-2.8.7-.5 1.1-.9 1.1-1.4 0-.6-.5-1-1.3-1s-1.4.4-1.5 1.1H9.1C9.2 6.4 10.4 5.2 12 5.2zM11.1 16.2h1.8v1.8h-1.8v-1.8z') },
  shop: { label: '商店', icon: svg('M12 3.2 3.6 8.4l1.2 1.8L12 6.2l7.2 4 1.2-1.8L12 3.2zM6 11.2V19h3.2v-5.2h5.6V19H18v-7.8l-6-3.4-6 3.4z') },
  rest: { label: '篝火', icon: svg('M12 2.4c2.6 3.2 6.4 6.6 6.4 10.2A6.4 6.4 0 0 1 12 19a6.4 6.4 0 0 1-6.4-6.4C5.6 9 9.4 5.6 12 2.4zm0 6.1c-1.5 1.8-2.8 3.5-2.8 5.1A2.8 2.8 0 0 0 12 16.4a2.8 2.8 0 0 0 2.8-2.8c0-1.6-1.3-3.3-2.8-5.1z') },
  treasure: { label: '宝藏', icon: svg('M12 2.4 14 8h5.8l-4.6 3.5 1.8 5.7L12 14.8 7 17.2l1.8-5.7L4.2 8H10L12 2.4z') },
  boss: { label: '首领', icon: svg('M4 8.2 7.2 6l2.4 2.4L12 5.2l2.4 3.2L16.8 6 20 8.2l-1.4 3.2H5.4L4 8.2zM5.6 13h12.8v6.4H5.6V13z') },
};

function thumb(def, assets, w = 156) {
  const c = document.createElement('canvas');
  c.width = CFG.card.texW;
  c.height = CFG.card.texH;
  paintCardFace(c.getContext('2d'), def, null, assets);
  c.className = 'cardThumb';
  c.style.width = `${w}px`;
  c.alt = def.name;
  return c;
}

function relicChip(id) {
  const r = getRelic(id);
  if (!r) return '';
  return `<span class="relicChip" title="${r.desc}"><b>${r.icon}</b>${r.name}</span>`;
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

function quad(a, b, i) {
  const lift = (i % 2 ? -1 : 1) * 22;
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2 + lift;
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}

export class Screens {
  constructor(root, hud, sfx, assets) {
    this.root = root;
    this.hud = hud;
    this.sfx = sfx;
    this.assets = assets;
    this._resolver = null;
    this.veil = new SceneVeil(document.getElementById('sceneVeil'));
    this._onKey = (e) => {
      if (e.key === 'Escape') this.closeDeck();
    };
    document.addEventListener('keydown', this._onKey);
  }

  clear() {
    this.closeDeck();
    this.root.classList.remove('active');
    this.root.innerHTML = '';
    this._resolver = null;
  }

  open(html) {
    this.closeDeck();
    this.root.classList.add('active');
    this.root.innerHTML = html;
    return this.root;
  }

  async present(html, meta = {}) {
    if (!meta.soft && !this.veil.covered) await this.veil.cover(meta);
    else if (this.veil.covered && meta.title) this.veil.setKind(meta.kind, meta.title);
    this.closeDeck();
    this.root.classList.add('active');
    this.root.innerHTML = html;
    this.playEnter(this.root.querySelector('[data-screen]')?.dataset.screen);
    if (this.veil.covered) await this.veil.reveal();
    return this.root;
  }

  async depart(meta = {}) {
    this.closeDeck();
    if (!this.veil.covered) await this.veil.cover(meta);
    else if (meta.title) this.veil.setKind(meta.kind, meta.title);
    this.clear();
  }

  async unveil() {
    if (this.veil.covered) await this.veil.reveal();
  }

  playEnter(kind) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    const panel = this.root.querySelector('.panel');
    if (!panel) return;
    if (kind === 'map') {
      const nodes = panel.querySelectorAll('.mapNode');
      if (nodes.length) {
        gsap.from(nodes, {
          scale: 0.4, opacity: 0, duration: 0.42, stagger: 0.016,
          ease: 'back.out(1.5)', overwrite: 'auto',
        });
      }
      const paths = panel.querySelectorAll('.mapPath.next, .mapPath.walked');
      if (paths.length) {
        gsap.from(paths, { opacity: 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });
      }
      const head = panel.querySelector('.mapHead');
      if (head) {
        gsap.from(head, { y: -14, opacity: 0, duration: 0.42, ease: 'power3.out', overwrite: 'auto' });
      }
    } else if (kind === 'title') {
      const bits = panel.querySelectorAll('.titleInner > *');
      if (bits.length) {
        gsap.from(bits, {
          y: 20, opacity: 0, duration: 0.62, stagger: 0.07, ease: 'power3.out', overwrite: 'auto',
        });
      }
    } else {
      const sheet = panel.querySelector('.sheet, article, .titleInner');
      if (sheet) {
        gsap.from(sheet, { y: 16, opacity: 0, duration: 0.42, ease: 'power3.out', overwrite: 'auto' });
      }
    }
  }

  closeDeck() {
    this.root.querySelectorAll('[data-screen="deck"]').forEach((el) => el.remove());
    this.root.querySelector('.mapPanel')?.classList.remove('deckOpen');
  }

  async showTitle() {
    await this.present(`
      <div class="panel dim titlePanel" data-screen="title">
        <div class="titleFx" aria-hidden="true">
          <div class="titleDust"></div>
          <div class="titleBeam"></div>
          <div class="sigil"></div>
        </div>
        <div class="titleInner">
          <div class="eyebrow">ARCANE DUEL · ACT I</div>
          <h1>暮光回廊</h1>
          <div class="titleRule"></div>
          <p class="lead">一幕短征程。分支地图、遭遇、商店与篝火，最终对上深渊魔王。</p>
          <button class="goldBtn cta" data-testid="start-run" type="button">开启远征</button>
          <p class="titleHint">拖拽手牌召唤 · 瞄准随从攻击 · 金色符印或空格结束回合</p>
        </div>
      </div>`, { soft: true, kind: 'title' });
    return new Promise((resolve) => {
      this.root.querySelector('[data-testid="start-run"]').onclick = async () => {
        this.sfx.click();
        await this.veil.cover({ title: '暮光回廊', kind: 'map' });
        resolve();
      };
    });
  }

  async showMap(run, { onNode, onDeck }) {
    const map = run.map;
    const W = 1200;
    const H = 580;
    const padX = 72;
    const padY = 48;
    const pos = {};
    map.floors.forEach((row, f) => {
      const x = padX + (f / Math.max(1, map.floors.length - 1)) * (W - padX * 2);
      const n = row.length;
      row.forEach((id, i) => {
        const y = n === 1
          ? H * 0.5
          : padY + (i / (n - 1)) * (H - padY * 2);
        pos[id] = { x, y };
      });
    });
    const next = new Set(nextHighlightIds(run));
    let pathI = 0;
    let lines = '';
    for (const id of Object.keys(map.nodes)) {
      const n = map.nodes[id];
      const a = pos[id];
      for (const nid of n.next) {
        const b = pos[nid];
        const kind = pathKind(run, id, nid);
        lines += `<path class="mapPath ${kind}" d="${quad(a, b, pathI++)}"/>`;
      }
    }
    const nodesHtml = Object.keys(map.nodes).map((id) => {
      const n = map.nodes[id];
      const p = pos[id];
      const st = nodeVisualState(run, id);
      const meta = TYPE_META[n.type];
      const clickable = st === 'available';
      const title = nodeTitle(n, meta);
      return `<div class="mapPin" style="left:${(p.x / W) * 100}%;top:${(p.y / H) * 100}%">
        <button type="button" class="mapNode ${st} t-${n.type}" data-node-id="${id}"
          aria-disabled="${clickable ? 'false' : 'true'}"
          title="${meta.label} · ${title}">
          ${st === 'current' ? '<span class="hereTag">此处</span>' : ''}
          <span class="nodeCore">
            <span class="ico">${meta.icon}</span>
            ${next.has(id) ? '<i class="pulse"></i>' : ''}
          </span>
          <span class="lab">${meta.label}</span>
        </button>
      </div>`;
    }).join('');

    const rail = map.floors.map((_, f) => {
      const cls = f < run.floor ? 'done' : (f === run.floor ? 'here' : '');
      return `<i class="${cls}">${f + 1}</i>`;
    }).join('');

    const legend = Object.entries(TYPE_META).map(([k, m]) =>
      `<span class="lg-${k}"><i></i>${m.label}</span>`).join('');

    await this.present(`
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
            <svg class="mapLines" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
              <defs>
                <filter id="mapGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.4" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              ${lines}
            </svg>
            <div class="mapNodes">${nodesHtml}</div>
            <div class="mapTip" hidden></div>
          </div>
          <div class="mapFoot">
            <div class="mapRail">${rail}</div>
            <div class="mapLegend">${legend}</div>
            <p class="mapHint">走过的岔路会锁死。金色脉冲 = 下一跳。</p>
          </div>
        </div>
      </div>`, { title: '选择前路', kind: 'map' });

    const tip = this.root.querySelector('.mapTip');
    this.root.querySelector('[data-act="deck"]').onclick = () => { this.sfx.click(); onDeck(); };
    this.root.querySelectorAll('[data-node-id]').forEach((btn) => {
      btn.onmouseenter = () => {
        const n = getNode(map, btn.dataset.nodeId);
        const meta = TYPE_META[n.type];
        tip.hidden = false;
        tip.innerHTML = `<b>${meta.label}</b><em>${nodeTitle(n, meta)}</em>`;
        const pin = btn.closest('.mapPin');
        tip.style.left = pin?.style.left || btn.style.left;
        tip.style.top = pin?.style.top || btn.style.top;
      };
      btn.onmouseleave = () => { tip.hidden = true; };
      btn.onclick = () => {
        if (btn.getAttribute('aria-disabled') === 'true') {
          this.hud.toast(btn.classList.contains('visited')
            ? '已经走过这里'
            : (btn.classList.contains('locked') || btn.classList.contains('skipped')
              ? '这条路已经锁死'
              : '还不能前往此处'));
          this.sfx.error();
          btn.classList.add('shake');
          setTimeout(() => btn.classList.remove('shake'), 400);
          return;
        }
        this.sfx.click();
        onNode(btn.dataset.nodeId);
      };
    });
  }

  showDeck(run) {
    if (this.root.querySelector('[data-screen="deck"]')) {
      this.closeDeck();
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'floatLayer';
    wrap.dataset.screen = 'deck';
    wrap.innerHTML = `<div class="sheet">
      <div class="sheetHead"><h3>牌库 · ${run.deck.length} 张</h3><button class="ghostBtn" type="button" data-act="close">关闭</button></div>
      <div class="cardRow"></div>
    </div>`;
    const row = wrap.querySelector('.cardRow');
    run.deck.forEach((id) => {
      const def = getCard(id);
      if (def) row.appendChild(thumb(def, this.assets, 132));
    });
    this.root.appendChild(wrap);
    this.root.querySelector('.mapPanel')?.classList.add('deckOpen');
    wrap.querySelector('[data-act="close"]').onclick = () => this.closeDeck();
    wrap.onclick = (e) => { if (e.target === wrap) this.closeDeck(); };
  }

  pickFromDeck(run, title) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'floatLayer';
      wrap.dataset.screen = 'pick';
      wrap.innerHTML = `<div class="sheet">
        <div class="sheetHead"><h3>${title}</h3><button class="ghostBtn" type="button" data-act="skip">取消</button></div>
        <div class="cardRow pickRow"></div>
      </div>`;
      const row = wrap.querySelector('.pickRow');
      run.deck.forEach((id, i) => {
        const def = getCard(id);
        if (!def) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cardPick';
        btn.dataset.cardId = id;
        btn.dataset.index = String(i);
        btn.appendChild(thumb(def, this.assets, 132));
        btn.onclick = () => { this.sfx.click(); wrap.remove(); resolve(id); };
        row.appendChild(btn);
      });
      wrap.querySelector('[data-act="skip"]').onclick = () => { wrap.remove(); resolve(null); };
      this.root.appendChild(wrap);
    });
  }

  async showEvent(ev, run, handlers) {
    await this.present(`
      <div class="panel dim eventPanel" data-screen="event">
        <article class="sheet eventSheet">
          <div class="eyebrow">事件</div>
          <h2>${ev.title}</h2>
          <p class="body">${ev.body}</p>
          <div class="optCol"></div>
          <div class="resultBox" hidden></div>
          <button class="goldBtn" type="button" data-act="continue" hidden>继续前进</button>
        </article>
      </div>`, { title: ev.title, kind: 'event' });
    const col = this.root.querySelector('.optCol');
    const resultBox = this.root.querySelector('.resultBox');
    const cont = this.root.querySelector('[data-act="continue"]');

    return new Promise((resolve) => {
      ev.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'choiceBtn';
        btn.dataset.opt = opt.id;
        const dead = optionDisabled(run, opt);
        btn.disabled = dead;
        btn.innerHTML = `<b>${opt.label}</b><small>${dead ? (opt.disabledHint || '无法选择') : opt.hint}</small>`;
        btn.onclick = async () => {
          if (btn.disabled) {
            this.hud.toast(opt.disabledHint || '无法选择');
            this.sfx.error();
            btn.classList.add('shake');
            setTimeout(() => btn.classList.remove('shake'), 400);
            return;
          }
          this.sfx.click();
          col.querySelectorAll('button').forEach((b) => { b.disabled = true; });
          const result = await handlers.choose(opt, i);
          resultBox.hidden = false;
          resultBox.textContent = result.text;
          this.hud.refreshRun?.(run);
          if (result.combat) {
            resolve(result);
            return;
          }
          cont.hidden = false;
          cont.onclick = () => { this.sfx.click(); resolve(result); };
        };
        col.appendChild(btn);
      });
    });
  }

  async showShop(run, shop, handlers) {
    const relic = shop.relic ? getRelic(shop.relic.relicId) : null;
    await this.present(`
      <div class="panel dim shopPanel" data-screen="shop">
        <div class="sheet shopSheet">
          <div class="sheetHead">
            <div><div class="eyebrow">商店</div><h2>暮光货栈</h2></div>
            <div class="goldRead" data-gold>${run.gold} 金</div>
          </div>
          <div class="shopGrid">
            <div class="shopCards"></div>
            <aside class="shopSide">
              <div class="shopSlot" data-slot="relic"></div>
              <button class="choiceBtn" type="button" data-act="remove" ${shop.removed ? 'disabled' : ''}>
                <b>删一张牌 · ${shop.removePrice} 金</b>
                <small>${shop.removed ? '已经用过' : '从牌库永久移除'}</small>
              </button>
              <button class="choiceBtn" type="button" data-act="refresh" ${shop.refreshed ? 'disabled' : ''}>
                <b>刷新货架 · ${shop.refreshPrice} 金</b>
                <small>${shop.refreshed ? '本店只能刷新一次' : '换一批卡牌'}</small>
              </button>
              <button class="goldBtn" type="button" data-act="leave">离开商店</button>
            </aside>
          </div>
        </div>
      </div>`, { title: '暮光货栈', kind: 'shop' });

    const paintGold = () => {
      this.root.querySelector('[data-gold]').textContent = `${run.gold} 金`;
      this.hud.refreshRun?.(run);
    };

    const cardsEl = this.root.querySelector('.shopCards');
    const drawCards = () => {
      cardsEl.innerHTML = '';
      shop.cards.forEach((item) => {
        const def = CARDS[item.cardId];
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = `shopCard ${item.sold ? 'sold' : ''}`;
        cell.dataset.shopCard = item.id;
        if (def) cell.appendChild(thumb(def, this.assets, 150));
        const tag = document.createElement('span');
        tag.className = 'priceTag';
        tag.textContent = item.sold ? '已售出' : `${item.price} 金`;
        cell.appendChild(tag);
        cell.disabled = item.sold;
        cell.onclick = () => {
          const r = handlers.buyCard(item);
          if (!r.ok) {
            this.hud.toast(r.reason);
            this.sfx.error();
            cell.classList.add('shake');
            setTimeout(() => cell.classList.remove('shake'), 400);
            return;
          }
          this.sfx.chime();
          item.sold = true;
          cell.classList.add('sold');
          cell.disabled = true;
          tag.textContent = '已售出';
          paintGold();
        };
        cardsEl.appendChild(cell);
      });
    };
    drawCards();

    const relicSlot = this.root.querySelector('[data-slot="relic"]');
    if (relic && shop.relic) {
      relicSlot.innerHTML = `<button type="button" class="choiceBtn relicBuy" data-act="relic" ${shop.relic.sold ? 'disabled' : ''}>
        <b>${relic.icon} ${relic.name} · ${shop.relic.price} 金</b>
        <small>${shop.relic.sold ? '已售出' : relic.desc}</small>
      </button>`;
      relicSlot.querySelector('[data-act="relic"]').onclick = () => {
        const btn = relicSlot.querySelector('button');
        const r = handlers.buyRelic();
        if (!r.ok) {
          this.hud.toast(r.reason);
          this.sfx.error();
          btn.classList.add('shake');
          setTimeout(() => btn.classList.remove('shake'), 400);
          return;
        }
        this.sfx.chime();
        btn.disabled = true;
        btn.querySelector('small').textContent = '已售出';
        paintGold();
      };
    } else {
      relicSlot.innerHTML = '<p class="empty">今日没有遗物</p>';
    }

    this.root.querySelector('[data-act="remove"]').onclick = async () => {
      const btn = this.root.querySelector('[data-act="remove"]');
      if (shop.removed) return;
      if (run.gold < shop.removePrice) {
        this.hud.toast('金币不足，无法删牌');
        this.sfx.error();
        btn.classList.add('shake');
        setTimeout(() => btn.classList.remove('shake'), 400);
        return;
      }
      const id = await this.pickFromDeck(run, '选择要删除的牌');
      const r = handlers.removeCard(id);
      if (!r.ok) {
        if (r.reason) this.hud.toast(r.reason);
        return;
      }
      this.sfx.chime();
      btn.disabled = true;
      btn.querySelector('small').textContent = '已经用过';
      paintGold();
    };

    const leaveBtn = this.root.querySelector('[data-act="leave"]');
    this.root.querySelector('[data-act="refresh"]').onclick = () => {
      const btn = this.root.querySelector('[data-act="refresh"]');
      const r = handlers.refresh();
      if (!r.ok) {
        this.hud.toast(r.reason);
        this.sfx.error();
        btn.classList.add('shake');
        setTimeout(() => btn.classList.remove('shake'), 400);
        return;
      }
      this.sfx.click();
      shop = r.shop;
      drawCards();
      btn.disabled = true;
      btn.querySelector('small').textContent = '本店只能刷新一次';
      paintGold();
    };

    return new Promise((resolve) => {
      leaveBtn.onclick = () => {
        this.sfx.click();
        resolve();
      };
    });
  }

  async showRest(run, healAmt, onRest) {
    await this.present(`
      <div class="panel dim restPanel" data-screen="rest">
        <article class="sheet">
          <div class="eyebrow">篝火</div>
          <h2>余烬还醒着</h2>
          <p class="body">你可以在此包扎伤口。生命 ${run.hp}/${run.maxHp}。</p>
          <button class="goldBtn" type="button" data-act="heal">休整 · 回复 ${healAmt}</button>
        </article>
      </div>`, { title: '余烬篝火', kind: 'rest' });
    return new Promise((resolve) => {
      this.root.querySelector('[data-act="heal"]').onclick = () => {
        this.sfx.chime();
        onRest();
        this.hud.refreshRun?.(run);
        this.hud.toast(`回复了 ${healAmt} 点生命`);
        resolve();
      };
    });
  }

  async showReward(reward, run, handlers) {
    const relic = reward.relic ? getRelic(reward.relic) : null;
    await this.present(`
      <div class="panel dim rewardPanel" data-screen="reward">
        <div class="sheet">
          <div class="eyebrow">战斗奖励</div>
          <h2>拾取战利品</h2>
          <p class="goldRead">+${reward.gold} 金币</p>
          ${relic ? `<p class="body">精英掉落：${relicChip(reward.relic)}</p>` : ''}
          <p class="body">选择一张牌加入牌库，或跳过。</p>
          <div class="cardRow rewardRow"></div>
          <button class="ghostBtn" type="button" data-act="skip">跳过选牌</button>
        </div>
      </div>`, { title: '战利品', kind: 'reward' });
    const row = this.root.querySelector('.rewardRow');
    return new Promise((resolve) => {
      const finish = (cardId) => {
        handlers.take(cardId);
        this.sfx.chime();
        resolve(cardId);
      };
      (reward.cards || []).forEach((id) => {
        const def = getCard(id);
        if (!def) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cardPick';
        btn.dataset.rewardCard = id;
        btn.appendChild(thumb(def, this.assets, 158));
        btn.onclick = () => finish(id);
        row.appendChild(btn);
      });
      this.root.querySelector('[data-act="skip"]').onclick = () => finish(null);
    });
  }

  async showTreasure(reward, run, onTake) {
    const relic = reward.relic ? getRelic(reward.relic) : null;
    await this.present(`
      <div class="panel dim treasurePanel" data-screen="treasure">
        <article class="sheet">
          <div class="eyebrow">宝藏</div>
          <h2>匣锁自己开了</h2>
          <p class="goldRead">+${reward.gold} 金币</p>
          ${relic ? `<p class="body">其中还有 ${relicChip(reward.relic)}</p>` : '<p class="body">只有一袋旧币。</p>'}
          <button class="goldBtn" type="button" data-act="take">收下</button>
        </article>
      </div>`, { title: '匣中遗珍', kind: 'treasure' });
    return new Promise((resolve) => {
      this.root.querySelector('[data-act="take"]').onclick = () => {
        this.sfx.chime();
        onTake();
        resolve();
      };
    });
  }

  async showRunOver(win, run) {
    await this.present(`
      <div class="panel dim goPanel ${win ? 'win' : 'lose'}" data-screen="runover">
        <article class="sheet">
          <h1>${win ? '远征完成' : '远征失败'}</h1>
          <p class="body">${win
    ? '深渊魔王倒下。暮光回廊暂时安静下来。'
    : '晨曦法师倒在回廊里。牌库散落一地。'}</p>
          <p class="meta">金币 ${run.gold} · 牌库 ${run.deck.length} · 遗物 ${run.relics.length} · 胜场 ${run.combatsWon}</p>
          <button class="goldBtn" type="button" data-testid="new-run">再启远征</button>
        </article>
      </div>`, { title: win ? '远征完成' : '远征失败', kind: win ? 'win' : 'lose' });
    return new Promise((resolve) => {
      this.root.querySelector('[data-testid="new-run"]').onclick = async () => {
        this.sfx.click();
        await this.veil.cover({ title: '再启远征', kind: 'map' });
        resolve();
      };
    });
  }
}
