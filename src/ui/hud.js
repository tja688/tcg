import { getRelic } from '../run/relics.js';
import { resetThinkHud } from '../pseudoai/think.js';
import { imageSrc } from '../utils/assets.js';

const INTENT_ICON = {
  attack: '⚔',
  defend: '🛡',
  buff: '▲',
  debuff: '▼',
  summon: '✦',
  special: '✶',
};

export class Hud {
  constructor() {
    this.banner$ = document.getElementById('banner');
    this.toast$ = document.getElementById('toast');
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
    this.aim$ = document.getElementById('aimHint');
    this.enemyHud$ = document.getElementById('enemyHud');
    this.enemyHudPortrait$ = document.getElementById('enemyHudPortrait');
    this.enemyHudName$ = document.getElementById('enemyHudName');
    this.enemyHudHp$ = document.getElementById('enemyHudHp');
    this.enemyHudHpFill$ = document.getElementById('enemyHudHpFill');
    this.enemyHudArmor$ = document.getElementById('enemyHudArmor');
    this.enemyHudIntent$ = document.getElementById('enemyHudIntent');
    this.str$ = document.getElementById('strHud');
    this.llmThink$ = document.getElementById('llmThink');
    this.banter$ = document.getElementById('enemyBanter');
    this.banterWho$ = document.getElementById('enemyBanterWho');
    this.banterText$ = document.getElementById('enemyBanterText');
    this._banterTimer = null;
    this._intent = null;
    this._enemy = { name: '', hp: 0, maxHp: 0, armor: 0, portrait: '' };

    this._toastTimer = null;
    this._bannerTimer = null;
    this.onAbandon = null;
    this.onDeck = null;
    this.onSettings = null;
    this.sfx = null;

    const goBtn = document.getElementById('goBtn');
    if (goBtn) goBtn.addEventListener('click', () => {
      if (this.onAbandon) this.onAbandon();
      else location.href = location.pathname;
    });
  }

  bindSfx(sfx) {
    this.sfx = sfx;
    const deckBtn = document.getElementById('deckBtn');
    if (deckBtn) {
      deckBtn.addEventListener('click', () => {
        if (this.onDeck) this.onDeck();
      });
    }
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        if (this.onSettings) this.onSettings();
      });
    }
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
    if (!combat) this.setEnemyStatus({ name: '', intent: null });
    this.runStrip$.classList.toggle('show', mode !== 'title' && mode !== 'loading');
    if (mode !== 'combat') {
      this.setAimHint('');
      resetThinkHud(this);
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

  setPiles() {}

  setIntent(intent) {
    this.setEnemyStatus({ intent: intent || null });
  }

  setEnemyStatus(partial = {}) {
    if ('intent' in partial) this._intent = partial.intent || null;
    if ('name' in partial) this._enemy.name = partial.name || '';
    if ('hp' in partial) this._enemy.hp = partial.hp;
    if ('maxHp' in partial) this._enemy.maxHp = partial.maxHp;
    if ('armor' in partial) this._enemy.armor = partial.armor || 0;
    if ('portrait' in partial) this._enemy.portrait = partial.portrait || '';
    this.refreshEnemyStatus();
  }

  refreshEnemyStatus() {
    if (!this.enemyHud$) return;
    const { name, hp, maxHp, armor, portrait } = this._enemy;
    const show = document.body.dataset.mode === 'combat' && !!name;
    this.enemyHud$.classList.toggle('show', show);
    if (!show) return;
    if (this.enemyHudName$) this.enemyHudName$.textContent = name;
    if (this.enemyHudPortrait$) {
      const src = imageSrc(portrait);
      if (src && this.enemyHudPortrait$.getAttribute('src') !== src) {
        this.enemyHudPortrait$.src = src;
      }
      this.enemyHudPortrait$.alt = name;
      this.enemyHudPortrait$.hidden = !src;
    }
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    if (this.enemyHudHpFill$) this.enemyHudHpFill$.style.width = `${Math.round(ratio * 100)}%`;
    if (this.enemyHudHp$) this.enemyHudHp$.textContent = `${hp}/${maxHp}`;
    if (this.enemyHudArmor$) {
      this.enemyHudArmor$.textContent = armor ? `甲 ${armor}` : '';
      this.enemyHudArmor$.hidden = !armor;
    }
    this.enemyHud$.classList.toggle('low', hp <= 10 || ratio <= 0.3);
    if (this.enemyHudIntent$) {
      const intent = this._intent;
      const icon = intent ? (INTENT_ICON[intent.type] || '✶') : '';
      const label = intent ? `${icon} ${intent.title} · ${intent.label}` : '';
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

  showEnemyBanter(text, who, _xy, opts) {
    if (!this.banter$ || !text) return;
    if (this.banterWho$) this.banterWho$.textContent = who || this._enemy.name || '';
    if (this.banterText$) this.banterText$.textContent = text;
    this.banter$.style.left = '';
    this.banter$.style.top = '';
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

  setTurnPill() {}

  gameOver(win) {
    this.goTitle$.textContent = win ? '胜 利' : '战 败';
    this.goSub$.textContent = win
      ? '这名敌人已被击溃'
      : '晨曦法师倒下了……但传说仍将继续';
    this.go$.classList.toggle('defeat', !win);
    this.go$.classList.add('show');
  }
}
