import './cheat.css';

function isToggleKey(e) {
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  if (e.key === '、') return true;
  if (e.code === 'Backslash') return true;
  return false;
}

function modeLabel() {
  const mode = document.body.dataset.mode || 'title';
  const labels = {
    title: '标题',
    loading: '载入',
    map: '地图',
    combat: '战斗',
    shop: '商店',
    event: '事件',
    rest: '篝火',
    treasure: '宝藏',
    reward: '战利品',
    runover: '结算',
  };
  return labels[mode] || mode;
}

export class CheatPanel {
  constructor(run) {
    this.run = run;
    this.open = false;
    this._syncTimer = null;
    this.root = document.createElement('div');
    this.root.id = 'cheatRoot';
    this.root.innerHTML = `
      <aside class="cheatPanel" hidden>
        <header class="cheatHead">
          <div>
            <p class="cheatEyebrow">测试用</p>
            <h3>作弊面板</h3>
          </div>
          <button class="cheatClose" type="button" data-act="close" aria-label="关闭">×</button>
        </header>
        <p class="cheatStatus" data-status>未开启</p>
        <form class="cheatRow" data-act="hp">
          <label for="cheatHp">生命</label>
          <input id="cheatHp" name="hp" type="number" min="0" step="1" inputmode="numeric">
          <button type="submit">改</button>
        </form>
        <form class="cheatRow" data-act="gold">
          <label for="cheatGold">金币</label>
          <input id="cheatGold" name="gold" type="number" min="0" step="1" inputmode="numeric">
          <button type="submit">改</button>
        </form>
        <button class="cheatWin" type="button" data-act="win">直接获胜</button>
        <p class="cheatHint">按「、」开关 · 战斗中改当前英雄生命</p>
      </aside>
    `;
    document.body.appendChild(this.root);
    this.panel = this.root.querySelector('.cheatPanel');
    this.status$ = this.root.querySelector('[data-status]');
    this.hp$ = this.root.querySelector('#cheatHp');
    this.gold$ = this.root.querySelector('#cheatGold');
    this.win$ = this.root.querySelector('[data-act="win"]');
    this.bind();
  }

  bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat || !isToggleKey(e)) return;
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    }, true);

    this.panel.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    this.root.querySelector('[data-act="close"]').onclick = () => this.hide();

    this.root.querySelector('[data-act="hp"]').onsubmit = (e) => {
      e.preventDefault();
      this.applyHp();
    };
    this.root.querySelector('[data-act="gold"]').onsubmit = (e) => {
      e.preventDefault();
      this.applyGold();
    };
    this.win$.onclick = () => this.winNow();
  }

  toggle() {
    if (this.open) this.hide();
    else this.show();
  }

  show() {
    this.open = true;
    this.root.classList.add('open');
    this.panel.hidden = false;
    this.sync();
    clearInterval(this._syncTimer);
    this._syncTimer = setInterval(() => this.sync(true), 400);
    this.hp$.focus();
    this.hp$.select();
  }

  hide() {
    this.open = false;
    this.root.classList.remove('open');
    this.panel.hidden = true;
    clearInterval(this._syncTimer);
    this._syncTimer = null;
    if (this.panel.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  }

  currentHp() {
    const game = this.run.game;
    if (game && !game.over) return game.player.hero.hp;
    return this.run.run?.hp ?? '';
  }

  currentGold() {
    return this.run.run?.gold ?? '';
  }

  sync(quiet = false) {
    const hp = this.currentHp();
    const gold = this.currentGold();
    const inCombat = !!(this.run.game && !this.run.game.over);
    const hasRun = !!this.run.run;
    const editing = document.activeElement === this.hp$ || document.activeElement === this.gold$;
    if (!quiet || !editing) {
      this.hp$.value = hp === '' ? '' : String(hp);
      this.gold$.value = gold === '' ? '' : String(gold);
    }
    this.win$.disabled = !inCombat;
    if (!hasRun) this.status$.textContent = '还没有远征';
    else if (inCombat) {
      const hero = this.run.game.player.hero;
      this.status$.textContent = `${modeLabel()} · 生命 ${hero.hp}/${hero.maxHp} · 金币 ${gold}`;
    } else {
      const r = this.run.run;
      this.status$.textContent = `${modeLabel()} · 生命 ${r.hp}/${r.maxHp} · 金币 ${r.gold}`;
    }
  }

  applyHp() {
    const ok = this.run.setPlayerHp(this.hp$.value);
    if (!ok) {
      this.run.hud.toast(this.run.run ? '生命数值无效' : '还没有开始远征');
      return;
    }
    this.run.hud.toast(`生命已改为 ${this.currentHp()}`);
    this.sync();
  }

  applyGold() {
    const ok = this.run.setGold(this.gold$.value);
    if (!ok) {
      this.run.hud.toast(this.run.run ? '金币数值无效' : '还没有开始远征');
      return;
    }
    this.run.hud.toast(`金币已改为 ${this.currentGold()}`);
    this.sync();
  }

  winNow() {
    const ok = this.run.winCombat();
    if (!ok) {
      this.run.hud.toast('当前没有进行中的对局');
      this.sync();
      return;
    }
    this.run.hud.toast('已判定本局胜利');
    this.sync();
  }
}
