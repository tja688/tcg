import { gsap } from 'gsap';
import { CFG } from '../config.js';
import { CARDS, getCard } from '../game/cards.js';
import { paintCardFace } from '../three/cardVisual.js';
import { getRelic } from '../run/relics.js';
import { optionDisabled } from '../run/events.js';
import { SceneVeil } from './transition.js';
import { playMapEnter, renderMap } from './mapView.js';
import './screens.css';
import './map.css';

const markIcon = (name) => `<img src="/assets/ui/mark_${name}.png" alt="">`;

export const TYPE_META = {
  combat: { label: '战斗', icon: markIcon('combat') },
  elite: { label: '精英', icon: markIcon('elite') },
  event: { label: '事件', icon: markIcon('event') },
  shop: { label: '商店', icon: markIcon('shop') },
  rest: { label: '篝火', icon: markIcon('rest') },
  treasure: { label: '宝藏', icon: markIcon('treasure') },
  boss: { label: '首领', icon: markIcon('boss') },
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

export class Screens {
  constructor(root, hud, sfx, assets) {
    this.root = root;
    this.hud = hud;
    this.sfx = sfx;
    this.assets = assets;
    this._resolver = null;
    this.veil = new SceneVeil(document.getElementById('sceneVeil'));
    this.settingsRoot = document.getElementById('settingsRoot');
    this._onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (this.settingsRoot?.querySelector('[data-screen="settings"]')) {
        this.closeSettings();
        return;
      }
      this.closeDeck();
    };
    document.addEventListener('keydown', this._onKey);
  }

  clear() {
    this.closeSettings();
    this.closeDeck();
    this.root.classList.remove('active');
    this.root.innerHTML = '';
    this._resolver = null;
  }

  open(html) {
    this.closeSettings();
    this.closeDeck();
    this.root.classList.add('active');
    this.root.innerHTML = html;
    return this.root;
  }

  async present(html, meta = {}) {
    if (!meta.soft && !this.veil.covered) {
      this.sfx.cue('flow.transition');
      await this.veil.cover(meta);
    } else if (this.veil.covered && meta.title) this.veil.setKind(meta.kind, meta.title);
    this.closeSettings();
    this.closeDeck();
    this.root.classList.add('active');
    this.root.innerHTML = html;
    this.playEnter(this.root.querySelector('[data-screen]')?.dataset.screen);
    if (this.veil.covered) await this.veil.reveal();
    return this.root;
  }

  async depart(meta = {}) {
    this.closeSettings();
    this.closeDeck();
    if (!this.veil.covered) {
      this.sfx.cue('flow.transition');
      await this.veil.cover(meta);
    } else if (meta.title) this.veil.setKind(meta.kind, meta.title);
    this.clear();
  }

  async unveil() {
    if (this.veil.covered) await this.veil.reveal();
  }

  playEnter(kind) {
    const enterCue = {
      title: 'flow.map',
      map: 'flow.map',
      shop: 'flow.shop.enter',
      event: 'flow.event',
      rest: 'flow.rest',
      treasure: 'flow.treasure',
      reward: 'flow.reward',
    }[kind];
    if (enterCue) this.sfx.cue(enterCue);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    const panel = this.root.querySelector('.panel');
    if (!panel) return;
    if (kind === 'map') {
      playMapEnter(this.root);
      return;
    }
    if (kind === 'title') {
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
          <div class="titleActions">
            <button class="goldBtn cta" data-testid="start-run" type="button">开启远征</button>
            <button class="ghostBtn" data-testid="open-settings" type="button">设置</button>
          </div>
          <p class="titleHint">拖拽手牌召唤 · 瞄准随从攻击 · 金色符印或空格结束回合</p>
        </div>
      </div>`, { soft: true, kind: 'title' });
    return new Promise((resolve) => {
      this.root.querySelector('[data-testid="start-run"]').onclick = async () => {
        this.sfx.cue('ui.start');
        this.sfx.cue('flow.transition');
        await this.veil.cover({ title: '暮光回廊', kind: 'map' });
        resolve();
      };
      this.root.querySelector('[data-testid="open-settings"]').onclick = () => {
        this.sfx.cue('ui.menu.open');
        this.openSettings();
      };
    });
  }

  toggleSettings() {
    if (this.settingsRoot?.querySelector('[data-screen="settings"]')) {
      this.closeSettings();
      return;
    }
    this.sfx.cue('ui.menu.open');
    this.openSettings();
  }

  openSettings() {
    const root = this.settingsRoot;
    if (!root || root.querySelector('[data-screen="settings"]')) return;
    const bgmPct = Math.round((this.sfx.bgmVolume ?? 0.5) * 100);
    const sfxPct = Math.round((this.sfx.sfxVolume ?? 0.8) * 100);
    const inRun = !['title', 'loading'].includes(document.body.dataset.mode || 'title');
    root.classList.add('open');
    root.innerHTML = `
      <div class="floatLayer" data-screen="settings">
        <article class="sheet settingsSheet">
          <div class="sheetHead">
            <h3>设置</h3>
            <button class="ghostBtn" type="button" data-act="close">关闭</button>
          </div>
          <p class="body">分别调整背景音乐与音效。下次进入游戏仍会记住。</p>
          <label class="volRow">
            <span class="volName">背景音乐</span>
            <input type="range" min="0" max="100" step="1" value="${bgmPct}" data-vol="bgm" aria-label="背景音乐音量">
            <span class="volVal" data-val="bgm">${bgmPct}%</span>
          </label>
          <label class="volRow">
            <span class="volName">音效</span>
            <input type="range" min="0" max="100" step="1" value="${sfxPct}" data-vol="sfx" aria-label="音效音量">
            <span class="volVal" data-val="sfx">${sfxPct}%</span>
          </label>
          <div class="settingsMute">
            <span class="volName">音效开关</span>
            <button class="ghostBtn" type="button" data-act="mute">
              <span class="btnLabel">${this.sfx.muted ? '音效：关' : '音效：开'}</span>
            </button>
          </div>
          ${inRun ? `<div class="settingsActs">
            <button class="ghostBtn" type="button" data-act="deck">查看牌库</button>
            <button class="ghostBtn dangerBtn" type="button" data-act="abandon">放弃对局</button>
          </div>` : ''}
        </article>
      </div>`;
    const bind = (name, setter) => {
      const input = root.querySelector(`[data-vol="${name}"]`);
      const label = root.querySelector(`[data-val="${name}"]`);
      input.addEventListener('input', () => {
        const v = Number(input.value);
        label.textContent = `${v}%`;
        setter(v / 100);
        if (name === 'sfx') this.sfx.cue('ui.toggle');
      });
    };
    bind('bgm', (v) => this.sfx.setBgmVolume(v));
    bind('sfx', (v) => this.sfx.setSfxVolume(v));
    const muteBtn = root.querySelector('[data-act="mute"]');
    const syncMute = () => {
      const label = muteBtn.querySelector('.btnLabel');
      const text = this.sfx.muted ? '音效：关' : '音效：开';
      if (label) label.textContent = text;
      else muteBtn.textContent = text;
    };
    muteBtn.onclick = () => {
      this.sfx.toggleMute();
      syncMute();
    };
    const deckBtn = root.querySelector('[data-act="deck"]');
    if (deckBtn) {
      deckBtn.onclick = () => {
        this.sfx.cue('ui.page');
        this.closeSettings();
        if (this.hud.onDeck) this.hud.onDeck();
      };
    }
    const abandonBtn = root.querySelector('[data-act="abandon"]');
    if (abandonBtn) {
      abandonBtn.onclick = () => {
        this.sfx.cue('ui.cancel');
        this.closeSettings();
        if (this.hud.onAbandon) this.hud.onAbandon();
        else location.href = location.pathname;
      };
    }
    root.querySelector('[data-act="close"]').onclick = () => {
      this.sfx.cue('ui.cancel');
      this.closeSettings();
    };
    root.querySelector('.floatLayer').addEventListener('click', (e) => {
      if (e.target.closest('.settingsSheet')) return;
      this.closeSettings();
    });
  }

  closeSettings() {
    const root = this.settingsRoot;
    if (!root) return;
    root.classList.remove('open');
    root.innerHTML = '';
  }

  async showMap(run, handlers) {
    await renderMap(this, run, handlers);
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
    this.sfx.cue('ui.page');
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
        btn.onclick = () => { this.sfx.cue('card.select'); wrap.remove(); resolve(id); };
        row.appendChild(btn);
      });
      wrap.querySelector('[data-act="skip"]').onclick = () => { this.sfx.cue('ui.cancel'); wrap.remove(); resolve(null); };
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
            this.sfx.cue('ui.reject');
            btn.classList.add('shake');
            setTimeout(() => btn.classList.remove('shake'), 400);
            return;
          }
          this.sfx.cue('ui.confirm');
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
          cont.onclick = () => { this.sfx.cue('ui.confirm'); resolve(result); };
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
            this.sfx.cue(r.reason?.includes('金') ? 'shop.insufficient' : 'ui.reject');
            cell.classList.add('shake');
            setTimeout(() => cell.classList.remove('shake'), 400);
            return;
          }
          this.sfx.cue('shop.buy');
          this.sfx.goldSpend();
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
          this.sfx.cue(r.reason?.includes('金') ? 'shop.insufficient' : 'ui.reject');
          btn.classList.add('shake');
          setTimeout(() => btn.classList.remove('shake'), 400);
          return;
        }
        this.sfx.cue('shop.buy');
        this.sfx.cue('reward.relic');
        this.sfx.goldSpend();
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
        this.sfx.cue('shop.insufficient');
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
      this.sfx.cue('shop.remove');
      this.sfx.goldSpend();
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
        this.sfx.cue(r.reason?.includes('金') ? 'shop.insufficient' : 'ui.reject');
        btn.classList.add('shake');
        setTimeout(() => btn.classList.remove('shake'), 400);
        return;
      }
      this.sfx.cue('shop.refresh');
      this.sfx.goldSpend();
      shop = r.shop;
      drawCards();
      btn.disabled = true;
      btn.querySelector('small').textContent = '本店只能刷新一次';
      paintGold();
    };

    return new Promise((resolve) => {
      leaveBtn.onclick = () => {
        this.sfx.cue('ui.cancel');
        resolve();
      };
    });
  }

  async showRest(run, gainAmt, onRest) {
    await this.present(`
      <div class="panel dim restPanel" data-screen="rest">
        <article class="sheet">
          <div class="eyebrow">篝火</div>
          <h2>余烬还醒着</h2>
          <p class="body">余烬能拓宽经脉。当前生命 ${run.hp}/${run.maxHp}。</p>
          <button class="goldBtn" type="button" data-act="heal">休整 · 生命上限 +${gainAmt}</button>
        </article>
      </div>`, { title: '余烬篝火', kind: 'rest' });
    return new Promise((resolve) => {
      this.root.querySelector('[data-act="heal"]').onclick = () => {
        this.sfx.cue('rest.heal');
        onRest();
        this.hud.refreshRun?.(run);
        this.hud.toast(`生命上限提高了 ${gainAmt} 点`);
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
        this.sfx.cue(cardId ? 'reward.claim' : 'reward.abandon');
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
        this.sfx.cue('ui.confirm');
        onTake();
        resolve();
      };
    });
  }

  async showRunOver(win, run) {
    if (win) this.sfx.cue('flow.victory.run');
    await this.present(`
      <div class="panel dim goPanel ${win ? 'win' : 'lose'}" data-screen="runover">
        <article class="sheet">
          <h1>${win ? '远征完成' : '远征失败'}</h1>
          <p class="body">${win
    ? '深渊魔王倒下。暮光回廊暂时安静下来。'
    : '晨曦法师倒在回廊里。牌库散落一地。'}</p>
          <p class="meta">金币 ${run.gold} · 牌库 ${run.deck.length} · 遗物 ${run.relics.length} · 胜场 ${run.combatsWon}</p>
          <div class="goActions">
            <button class="goldBtn" type="button" data-testid="new-run">再启远征</button>
            <button class="ghostBtn" type="button" data-testid="back-title">返回主菜单</button>
          </div>
        </article>
      </div>`, { title: win ? '远征完成' : '远征失败', kind: win ? 'win' : 'lose' });
    return new Promise((resolve) => {
      let done = false;
      const pick = async (action, cover) => {
        if (done) return;
        done = true;
        this.sfx.cue(action === 'restart' && win ? 'ui.start' : 'ui.confirm');
        this.sfx.cue('flow.transition');
        await this.veil.cover(cover);
        resolve(action);
      };
      this.root.querySelector('[data-testid="new-run"]').onclick = () => pick('restart', {
        title: '再启远征', kind: 'map',
      });
      this.root.querySelector('[data-testid="back-title"]').onclick = () => pick('title', {
        title: '暮光回廊', kind: 'title',
      });
    });
  }
}
