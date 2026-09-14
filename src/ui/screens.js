import { CFG } from '../config.js';
import { CARDS, getCard } from '../game/cards.js';
import { paintCardFace } from '../three/cardVisual.js';
import { getRelic } from '../run/relics.js';
import { getNode, nodeVisualState, nextHighlightIds } from '../run/map.js';
import { optionDisabled } from '../run/events.js';
import { getEncounter } from '../run/encounters.js';

const TYPE_META = {
  combat: { label: '战斗', icon: '⚔' },
  elite: { label: '精英', icon: '☠' },
  event: { label: '事件', icon: '?' },
  shop: { label: '商店', icon: '♦' },
  rest: { label: '篝火', icon: '▲' },
  treasure: { label: '宝藏', icon: '✦' },
  boss: { label: '首领', icon: '♚' },
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
  }

  clear() {
    this.root.classList.remove('active');
    this.root.innerHTML = '';
    this._resolver = null;
  }

  open(html) {
    this.root.classList.add('active');
    this.root.innerHTML = html;
    return this.root;
  }

  showTitle() {
    this.open(`
      <div class="panel dim titlePanel" data-screen="title">
        <div class="titleInner">
          <div class="eyebrow">ARCANE DUEL · ACT I</div>
          <h1>暮光回廊</h1>
          <p class="lead">一幕短征程。分支地图、遭遇、商店与篝火，最终对上深渊魔王。</p>
          <button class="goldBtn" data-testid="start-run" type="button">开启远征</button>
        </div>
      </div>`);
    return new Promise((resolve) => {
      this.root.querySelector('[data-testid="start-run"]').onclick = () => {
        this.sfx.click();
        this.clear();
        resolve();
      };
    });
  }

  showMap(run, { onNode, onDeck }) {
    const map = run.map;
    const W = 1100, H = 520;
    const padX = 70, padY = 56;
    const pos = {};
    map.floors.forEach((row, f) => {
      const x = padX + (f / Math.max(1, map.floors.length - 1)) * (W - padX * 2);
      row.forEach((id, i) => {
        pos[id] = { x, y: padY + ((i + 1) / (row.length + 1)) * (H - padY * 2) };
      });
    });
    const next = new Set(nextHighlightIds(run));
    let lines = '';
    for (const id of Object.keys(map.nodes)) {
      const n = map.nodes[id];
      const a = pos[id];
      for (const nid of n.next) {
        const b = pos[nid];
        const st = nodeVisualState(run, id);
        const faded = st === 'locked' || st === 'skipped' ? '0.18' : '0.55';
        lines += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="rgba(242,208,137,${faded})" stroke-width="2"/>`;
      }
    }
    const nodesHtml = Object.keys(map.nodes).map((id) => {
      const n = map.nodes[id];
      const p = pos[id];
      const st = nodeVisualState(run, id);
      const meta = TYPE_META[n.type];
      const clickable = st === 'available';
      const title = n.encounterId ? getEncounter(n.encounterId).name : meta.label;
      return `<button type="button" class="mapNode ${st} t-${n.type}" data-node-id="${id}"
        style="left:${(p.x / W) * 100}%;top:${(p.y / H) * 100}%"
        aria-disabled="${clickable ? 'false' : 'true'}"
        title="${meta.label} · ${title}">
        <span class="ico">${meta.icon}</span>
        <span class="lab">${meta.label}</span>
        ${next.has(id) ? '<i class="pulse"></i>' : ''}
      </button>`;
    }).join('');

    this.open(`
      <div class="panel dim mapPanel" data-screen="map">
        <div class="sheet mapSheet">
          <div class="mapHead">
            <div>
              <div class="eyebrow">${map.title}</div>
              <h2>选择下一处落脚</h2>
            </div>
            <button class="ghostBtn" type="button" data-act="deck">查看牌库</button>
          </div>
          <div class="mapStage">
            <svg class="mapLines" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${lines}</svg>
            ${nodesHtml}
          </div>
          <p class="mapHint">走过的岔路会锁死。金色脉冲 = 下一跳。</p>
        </div>
      </div>`);

    this.root.querySelector('[data-act="deck"]').onclick = () => { this.sfx.click(); onDeck(); };
    this.root.querySelectorAll('[data-node-id]').forEach((btn) => {
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
    wrap.querySelector('[data-act="close"]').onclick = () => wrap.remove();
    wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
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

  showEvent(ev, run, handlers) {
    this.open(`
      <div class="panel dim eventPanel" data-screen="event">
        <article class="sheet eventSheet">
          <div class="eyebrow">事件</div>
          <h2>${ev.title}</h2>
          <p class="body">${ev.body}</p>
          <div class="optCol"></div>
          <div class="resultBox" hidden></div>
          <button class="goldBtn" type="button" data-act="continue" hidden>继续前进</button>
        </article>
      </div>`);
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
          cont.onclick = () => { this.sfx.click(); this.clear(); resolve(result); };
        };
        col.appendChild(btn);
      });
    });
  }

  showShop(run, shop, handlers) {
    const relic = shop.relic ? getRelic(shop.relic.relicId) : null;
    this.open(`
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
      </div>`);

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
        this.clear();
        resolve();
      };
    });
  }

  showRest(run, healAmt, onRest) {
    this.open(`
      <div class="panel dim restPanel" data-screen="rest">
        <article class="sheet">
          <div class="eyebrow">篝火</div>
          <h2>余烬还醒着</h2>
          <p class="body">你可以在此包扎伤口。生命 ${run.hp}/${run.maxHp}。</p>
          <button class="goldBtn" type="button" data-act="heal">休整 · 回复 ${healAmt}</button>
        </article>
      </div>`);
    return new Promise((resolve) => {
      this.root.querySelector('[data-act="heal"]').onclick = () => {
        this.sfx.chime();
        onRest();
        this.hud.refreshRun?.(run);
        this.hud.toast(`回复了 ${healAmt} 点生命`);
        this.clear();
        resolve();
      };
    });
  }

  showReward(reward, run, handlers) {
    const relic = reward.relic ? getRelic(reward.relic) : null;
    this.open(`
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
      </div>`);
    const row = this.root.querySelector('.rewardRow');
    return new Promise((resolve) => {
      const finish = (cardId) => {
        handlers.take(cardId);
        this.sfx.chime();
        this.clear();
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

  showTreasure(reward, run, onTake) {
    const relic = reward.relic ? getRelic(reward.relic) : null;
    this.open(`
      <div class="panel dim treasurePanel" data-screen="treasure">
        <article class="sheet">
          <div class="eyebrow">宝藏</div>
          <h2>匣锁自己开了</h2>
          <p class="goldRead">+${reward.gold} 金币</p>
          ${relic ? `<p class="body">其中还有 ${relicChip(reward.relic)}</p>` : '<p class="body">只有一袋旧币。</p>'}
          <button class="goldBtn" type="button" data-act="take">收下</button>
        </article>
      </div>`);
    return new Promise((resolve) => {
      this.root.querySelector('[data-act="take"]').onclick = () => {
        this.sfx.chime();
        onTake();
        this.clear();
        resolve();
      };
    });
  }

  showRunOver(win, run) {
    this.open(`
      <div class="panel dim goPanel ${win ? 'win' : 'lose'}" data-screen="runover">
        <article class="sheet">
          <h1>${win ? '远征完成' : '远征失败'}</h1>
          <p class="body">${win
    ? '深渊魔王倒下。暮光回廊暂时安静下来。'
    : '晨曦法师倒在回廊里。牌库散落一地。'}</p>
          <p class="meta">金币 ${run.gold} · 牌库 ${run.deck.length} · 遗物 ${run.relics.length} · 胜场 ${run.combatsWon}</p>
          <button class="goldBtn" type="button" data-testid="new-run">再启远征</button>
        </article>
      </div>`);
    return new Promise((resolve) => {
      this.root.querySelector('[data-testid="new-run"]').onclick = () => {
        this.sfx.click();
        this.clear();
        resolve();
      };
    });
  }
}
