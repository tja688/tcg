import { getRelic } from '../run/relics.js';

export class Hud {
  constructor() {
    this.banner$ = document.getElementById('banner');
    this.toast$ = document.getElementById('toast');
    this.pill$ = document.getElementById('turnPill');
    this.go$ = document.getElementById('gameover');
    this.goTitle$ = document.getElementById('goTitle');
    this.goSub$ = document.getElementById('goSub');
    this.loading$ = document.getElementById('loading');
    this.loadBar$ = document.getElementById('loadBar');
    this.loadTip$ = document.getElementById('loadTip');
    this.runStrip$ = document.getElementById('runStrip');
    this.hp$ = document.getElementById('runHp');
    this.gold$ = document.getElementById('runGold');
    this.floor$ = document.getElementById('runFloor');
    this.relics$ = document.getElementById('runRelics');
    this.piles$ = document.getElementById('pileHud');
    this.pDeck$ = document.getElementById('pDeck');
    this.pDisc$ = document.getElementById('pDisc');
    this.pHand$ = document.getElementById('pHand');
    this.aim$ = document.getElementById('aimHint');
    this.enemyHud$ = document.getElementById('enemyHud');
    this.enemyHudName$ = document.getElementById('enemyHudName');
    this.enemyHudHp$ = document.getElementById('enemyHudHp');
    this.enemyHudIntent$ = document.getElementById('enemyHudIntent');
    this.str$ = document.getElementById('strHud');
    this.llmThink$ = document.getElementById('llmThink');
    this.banter$ = document.getElementById('enemyBanter');
    this.banterWho$ = document.getElementById('enemyBanterWho');
    this.banterText$ = document.getElementById('enemyBanterText');
    this._banterTimer = null;
    this._intent = null;
    this._enemy = { name: '', hp: 0, maxHp: 0, armor: 0 };

    this._toastTimer = null;
    this._bannerTimer = null;
    this.onAbandon = null;
    this.onDeck = null;

    document.getElementById('restartBtn').addEventListener('click', () => {
      if (this.onAbandon) this.onAbandon();
      else location.href = location.pathname;
    });
    document.getElementById('deckBtn').addEventListener('click', () => {
      if (this.onDeck) this.onDeck();
    });
    const goBtn = document.getElementById('goBtn');
    if (goBtn) goBtn.addEventListener('click', () => {
      if (this.onAbandon) this.onAbandon();
      else location.href = location.pathname;
    });
  }

  bindSfx(sfx) {
    const btn = document.getElementById('muteBtn');
    const sync = () => {
      const text = sfx.muted ? '音效：关' : '音效：开';
      const label = btn.querySelector('.btnLabel');
      if (label) label.textContent = text;
      else btn.textContent = text;
    };
    btn.addEventListener('click', () => { sfx.toggleMute(); sync(); });
    sync();
  }

  loadProgress(p) {
    this.loadBar$.style.width = `${Math.round(p * 100)}%`;
    if (p >= 1) this.loadTip$.textContent = '奥术能量已就绪';
  }

  hideLoading() {
    this.loading$.classList.add('hide');
    setTimeout(() => this.loading$.remove(), 1200);
  }

  setMode(mode) {
    document.body.dataset.mode = mode;
    const combat = mode === 'combat';
    this.piles$.classList.toggle('show', combat);
    if (!combat) this.setEnemyStatus({ name: '', intent: null });
    if (mode === 'map') this.pill$.textContent = '选择下一处落脚';
    if (mode === 'title') this.pill$.textContent = '远征准备中…';
    if (mode === 'shop') this.pill$.textContent = '暮光货栈';
    if (mode === 'event') this.pill$.textContent = '回廊事件';
    if (mode === 'rest') this.pill$.textContent = '余烬篝火';
    if (mode === 'treasure') this.pill$.textContent = '发现宝藏';
    if (mode === 'reward') this.pill$.textContent = '拾取战利品';
    if (mode === 'runover') this.pill$.textContent = '远征结束';
    this.runStrip$.classList.toggle('show', mode !== 'title' && mode !== 'loading');
    if (mode !== 'combat') {
      this.setAimHint('');
      this.showLlmThink('');
      this.hideEnemyBanter();
    }
  }

  refreshRun(run) {
    if (!run) return;
    this.hp$.textContent = `${run.hp}/${run.maxHp}`;
    this.gold$.textContent = String(run.gold);
    this.floor$.textContent = `第 ${run.floor + 1} 层`;
    this.relics$.innerHTML = (run.relics || []).map((id) => {
      const r = getRelic(id);
      return `<span class="miniRelic" data-relic="${id}" title="${r?.desc || ''}">${r?.icon || '?'}${r?.name || id}</span>`;
    }).join('') || '<span class="muted">无遗物</span>';
  }

  setPiles(deck, disc, hand) {
    this.pDeck$.textContent = String(deck);
    this.pDisc$.textContent = String(disc);
    this.pHand$.textContent = String(hand);
  }

  setIntent(intent) {
    this.setEnemyStatus({ intent: intent || null });
  }

  setEnemyStatus(partial = {}) {
    if ('intent' in partial) this._intent = partial.intent || null;
    if ('name' in partial) this._enemy.name = partial.name || '';
    if ('hp' in partial) this._enemy.hp = partial.hp;
    if ('maxHp' in partial) this._enemy.maxHp = partial.maxHp;
    if ('armor' in partial) this._enemy.armor = partial.armor || 0;
    this.refreshEnemyStatus();
  }

  refreshEnemyStatus() {
    if (!this.enemyHud$) return;
    const { name, hp, maxHp, armor } = this._enemy;
    const show = document.body.dataset.mode === 'combat' && !!name;
    this.enemyHud$.classList.toggle('show', show);
    if (!show) return;
    if (this.enemyHudName$) this.enemyHudName$.textContent = name;
    if (this.enemyHudHp$) {
      this.enemyHudHp$.textContent = armor ? `${hp}/${maxHp} · 甲${armor}` : `${hp}/${maxHp}`;
    }
    if (this.enemyHudIntent$) {
      const intent = this._intent;
      const label = intent ? `${intent.title} · ${intent.label}` : '';
      this.enemyHudIntent$.textContent = label;
      this.enemyHudIntent$.hidden = !label;
    }
  }

  setStrength(ps, es) {
    if (!ps && !es) { this.str$.textContent = ''; return; }
    this.str$.textContent = `力量 己 ${ps || 0} / 敌 ${es || 0}`;
  }

  setAimHint(msg) {
    if (!this.aim$) return;
    this.aim$.textContent = msg || '';
    this.aim$.classList.toggle('show', !!msg);
  }

  showLlmThink(text) {
    if (!this.llmThink$) return;
    this.llmThink$.textContent = text || '';
    this.llmThink$.classList.toggle('show', !!text);
  }

  showEnemyBanter(text, who, xy, opts) {
    if (!this.banter$ || !text) return;
    if (this.banterWho$) this.banterWho$.textContent = who || '';
    if (this.banterText$) this.banterText$.textContent = text;
    if (xy && Number.isFinite(xy.x) && Number.isFinite(xy.y)) {
      const x = Math.min(window.innerWidth - 36, Math.max(window.innerWidth * 0.62, xy.x + 96));
      const y = Math.min(window.innerHeight * 0.32, Math.max(86, xy.y - 8));
      this.banter$.style.left = `${x}px`;
      this.banter$.style.top = `${y}px`;
    } else {
      this.banter$.style.left = '72%';
      this.banter$.style.top = '18%';
    }
    this.banter$.classList.add('show');
    clearTimeout(this._banterTimer);
    const hold = Number.isFinite(opts?.holdMs) ? opts.holdMs : 3200;
    this._banterTimer = setTimeout(() => this.hideEnemyBanter(), hold);
  }

  hideEnemyBanter() {
    if (!this.banter$) return;
    this.banter$.classList.remove('show');
  }

  banner(text, side) {
    const el = this.banner$;
    clearTimeout(this._bannerTimer);
    el.classList.remove('show');
    void el.offsetWidth;
    el.textContent = text;
    el.classList.toggle('enemy', side === 'enemy');
    el.classList.add('show');
    this._bannerTimer = setTimeout(() => el.classList.remove('show'), 1400);
  }

  toast(msg) {
    const el = this.toast$;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 1700);
  }

  setTurnPill(turnNo, turn, over) {
    if (over) return;
    if (turn === 'none' || turnNo === 0) {
      this.pill$.textContent = '对决开始';
      this.pill$.classList.remove('enemy');
      return;
    }
    this.pill$.textContent = `第 ${turnNo} 回合 · ${turn === 'player' ? '你的行动' : '对手行动'}`;
    this.pill$.classList.toggle('enemy', turn === 'enemy');
  }

  gameOver(win) {
    this.goTitle$.textContent = win ? '胜 利' : '战 败';
    this.goSub$.textContent = win
      ? '这名敌人已被击溃'
      : '晨曦法师倒下了……但传说仍将继续';
    this.go$.classList.toggle('defeat', !win);
    this.go$.classList.add('show');
    this.pill$.textContent = win ? '你赢得了对决' : '你输掉了对决';
  }
}
