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
    this.intent$ = document.getElementById('intentHud');
    this.str$ = document.getElementById('strHud');

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
    const sync = () => { btn.textContent = sfx.muted ? '音效：关' : '音效：开'; };
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
    this.intent$.classList.toggle('show', combat);
    if (mode === 'map') this.pill$.textContent = '选择下一处落脚';
    if (mode === 'title') this.pill$.textContent = '远征准备中…';
    this.runStrip$.classList.toggle('show', mode !== 'title' && mode !== 'loading');
    if (mode !== 'combat') this.setAimHint('');
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
    if (!intent) {
      this.intent$.textContent = '';
      return;
    }
    this.intent$.textContent = `敌方预兆 · ${intent.title} · ${intent.label}`;
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
