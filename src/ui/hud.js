import { resetThinkHud } from '../pseudoai/think.js';
import { imageSrc } from '../utils/assets.js';
import { describeSkill, skillSignature } from './enemySkills.js';
import { TERMS, cardTipInfo, relicTipInfo } from './glossary.js';
import { bindTip, hideTip, isTipSource, showTip, showTipAt } from './tooltip.js';

const PLAYER_NAME = '晨曦法师';
const BANTER_FADE_MS = 420;
const BANTER_MAX = 5;
const TYPE_MS = 22;

function prefersReduce() {
  return globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

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
    this.playerHud$ = document.getElementById('playerHud');
    this.name$ = document.getElementById('runName');
    this.hp$ = document.getElementById('runHp');
    this.armor$ = document.getElementById('runArmor');
    this.gold$ = document.getElementById('runGold');
    this.floor$ = document.getElementById('runFloor');
    this.relics$ = document.getElementById('runRelics');
    this.aim$ = document.getElementById('aimHint');
    this.enemyStage$ = document.getElementById('enemyStage');
    this.enemySkills$ = document.getElementById('enemySkills');
    this.enemySpeech$ = document.getElementById('enemySpeech');
    this.enemyBanterStack$ = document.getElementById('enemyBanterStack');
    this.enemySkillTip$ = document.getElementById('enemySkillTip');
    this.str$ = document.getElementById('strHud');
    this.llmThink$ = document.getElementById('llmThink');
    this._inspectUid = 0;
    this._intent = null;
    this._enemy = { name: '', hp: 0, maxHp: 0, armor: 0, portrait: '' };
    this._combatHero = null;
    this._run = null;
    this._skillSig = '';
    this._banters = [];

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

    if (this.hp$) bindTip(this.hp$, TERMS.hp, { prefer: 'above' });
    if (this.armor$) bindTip(this.armor$, TERMS.armor, { prefer: 'above' });
    if (this.str$) {
      bindTip(this.str$, () => (this.str$.textContent ? TERMS.strength : null), { prefer: 'above' });
    }
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
    if (!combat) {
      this._combatHero = null;
      this._inspectUid = 0;
      hideTip();
      this.setEnemyStatus({ name: '', intent: null });
      this.anchorEnemy(null);
      this.anchorPlayerHud(null);
    }
    this.playerHud$?.classList.toggle('show', mode !== 'title' && mode !== 'loading');
    if (mode !== 'combat') {
      this.setAimHint('');
      resetThinkHud(this);
      this.hideEnemyBanter();
    }
    this.refreshPlayerVitals();
  }

  refreshRun(run) {
    if (!run) return;
    this._run = run;
    if (this.name$) this.name$.textContent = PLAYER_NAME;
    if (this.gold$) this.gold$.textContent = String(run.gold);
    if (this.floor$) this.floor$.textContent = `第 ${run.floor + 1} 层`;
    if (this.relics$) {
      hideTip();
      this.relics$.innerHTML = (run.relics || []).map((id) => {
        const info = relicTipInfo(id);
        return `<span class="miniRelic" data-relic="${id}" tabindex="0">${info?.title || id}</span>`;
      }).join('') || '<span class="muted">无遗物</span>';
      this.relics$.querySelectorAll('[data-relic]').forEach((el) => {
        bindTip(el, () => relicTipInfo(el.dataset.relic), { prefer: 'above' });
      });
    }
    this.refreshPlayerVitals();
  }

  setPlayerCombat(hero) {
    this._combatHero = hero || null;
    this.refreshPlayerVitals();
  }

  refreshPlayerVitals() {
    const src = this._combatHero || this._run;
    if (!src || !this.hp$) return;
    const hp = src.hp;
    const maxHp = src.maxHp;
    const armor = src.armor || 0;
    this.hp$.textContent = `${hp}/${maxHp}`;
    if (this.armor$) {
      this.armor$.textContent = armor ? `甲 ${armor}` : '';
      this.armor$.hidden = !armor;
    }
    this.playerHud$?.classList.toggle('low', hp <= 10 || (maxHp > 0 && hp / maxHp <= 0.3));
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
    if (!this.enemyStage$) return;
    const show = document.body.dataset.mode === 'combat' && !!this._enemy.name;
    this.enemyStage$.classList.toggle('show', show);
    if (!show) {
      this._renderSkill(null);
      return;
    }
    this._renderSkill(this._intent);
  }

  _renderSkill(intent) {
    if (!this.enemySkills$) return;
    const sig = skillSignature(intent);
    if (sig === this._skillSig) return;
    this._skillSig = sig;
    this._hideSkillTip();
    if (!intent) {
      this.enemySkills$.innerHTML = '';
      return;
    }
    const info = describeSkill(intent);
    const src = imageSrc(info.icon, info.icon);
    const val = info.value != null ? `<span class="skillVal">${info.value}</span>` : '';
    this.enemySkills$.innerHTML = `
      <button type="button" class="enemySkill" aria-label="${info.title}：${info.body}">
        <img src="${src}" alt="${info.title}">
        ${val}
      </button>`;
    const btn = this.enemySkills$.querySelector('.enemySkill');
    if (!btn) return;
    bindTip(btn, { title: info.title, body: info.body, extra: info.label }, { prefer: 'left', width: 240 });
  }

  _showSkillTip(info, btn) {
    showTip(btn, { title: info.title, body: info.body, extra: info.label }, { prefer: 'left', width: 240 });
  }

  _hideSkillTip() {
    hideTip();
  }

  inspectCard(inst, ev) {
    if (!inst?.def || !ev) {
      if (this._inspectUid) {
        this._inspectUid = 0;
        if (isTipSource('inspect')) hideTip();
      }
      return;
    }
    if (this._inspectUid === inst.uid && isTipSource('inspect')) return;
    this._inspectUid = inst.uid;
    showTipAt(ev.clientX, ev.clientY, cardTipInfo(inst.def, inst), {
      prefer: 'above', width: 268, source: 'inspect',
    });
  }

  anchorPlayerHud(pos) {
    if (!this.playerHud$) return;
    if (!pos) {
      this.playerHud$.style.maxWidth = '';
      return;
    }
    const limit = Math.max(160, Math.floor(pos.hpX - pos.hpR - 14));
    this.playerHud$.style.maxWidth = `${Math.min(220, limit)}px`;
  }

  anchorEnemy(pos) {
    if (!this.enemyStage$) return;
    if (!pos) {
      this.enemyStage$.classList.remove('anchored');
      return;
    }
    this.enemyStage$.classList.add('anchored');
    if (this.enemySkills$) {
      this.enemySkills$.style.left = `${pos.skillX}px`;
      this.enemySkills$.style.top = `${pos.skillY}px`;
    }
    if (this.enemySpeech$) {
      this.enemySpeech$.style.left = `${pos.speechX}px`;
      this.enemySpeech$.style.top = `${pos.speechY}px`;
    }
  }

  setStrength(ps, es) {
    if (!this.str$) return;
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
    if (!this.enemyBanterStack$ || !text) return;
    if (document.body.dataset.mode !== 'combat') return;
    while (this._banters.length >= BANTER_MAX) this._dropBanter(this._banters[0], true);

    const item = document.createElement('div');
    item.className = 'banterItem';
    const textEl = document.createElement('span');
    textEl.className = 'banterText';
    item.appendChild(textEl);
    this.enemyBanterStack$.appendChild(item);

    const rec = { item, typeId: null, holdId: null };
    if (prefersReduce()) {
      textEl.textContent = text;
    } else {
      let i = 0;
      rec.typeId = setInterval(() => {
        i += 1;
        textEl.textContent = text.slice(0, i);
        if (i >= text.length) {
          clearInterval(rec.typeId);
          rec.typeId = null;
        }
      }, TYPE_MS);
    }

    const hold = Number.isFinite(opts?.holdMs) ? opts.holdMs : 3200;
    rec.holdId = setTimeout(() => this._dropBanter(rec, false), hold);
    this._banters.push(rec);
  }

  _dropBanter(rec, instant) {
    if (!rec || rec._dead) return;
    rec._dead = true;
    if (rec.typeId) {
      clearInterval(rec.typeId);
      rec.typeId = null;
    }
    if (rec.holdId) {
      clearTimeout(rec.holdId);
      rec.holdId = null;
    }
    this._banters = this._banters.filter((x) => x !== rec);
    if (!rec.item) return;
    if (instant || !rec.item.isConnected) {
      rec.item.remove();
      return;
    }
    rec.item.classList.add('out');
    setTimeout(() => rec.item.remove(), BANTER_FADE_MS);
  }

  hideEnemyBanter() {
    for (const rec of this._banters.slice()) this._dropBanter(rec, true);
    this._banters = [];
    if (this.enemyBanterStack$) this.enemyBanterStack$.innerHTML = '';
    this._hideSkillTip();
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
