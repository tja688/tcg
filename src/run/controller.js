import { createRun, grantRelic, snapshotRun } from './state.js';
import { packArchetype } from './packs.js';
import { enterNode, completeCurrent, getNode, nodeReachable } from './map.js';
import { addMaxHp, getEvent, restMaxHpAmount } from './events.js';
import { getEncounter } from './encounters.js';
import { generateShop, buyShopCard, buyShopRelic, shopRemoveCard, refreshShopCards } from './shop.js';
import { makeCombatReward, makeTreasureReward, applyGold, addCardToDeck } from './rewards.js';
import { randomRelic, getRelic } from './relics.js';
import { Game } from '../game/game.js';
import { Screens, TYPE_META } from '../ui/screens.js';
import { mulberry32 } from '../utils/rng.js';
import { attachPseudoAI, detachPseudoAI } from '../pseudoai/index.js';
import { resolveArenaEnv } from '../three/environments.js';

function veilFor(node) {
  const meta = TYPE_META[node.type] || { label: '前进' };
  if (node.encounterId) {
    const enc = getEncounter(node.encounterId);
    return { title: enc?.name || meta.label, kind: node.type };
  }
  if (node.eventId) {
    const ev = getEvent(node.eventId);
    return { title: ev?.title || meta.label, kind: 'event' };
  }
  const titles = { shop: '暮光货栈', rest: '余烬篝火', treasure: '匣中遗珍' };
  return { title: titles[node.type] || meta.label, kind: node.type };
}

export class RunController {
  constructor({ director, input, hud, sfx, assets, seed }) {
    this.director = director;
    this.input = input;
    this.hud = hud;
    this.sfx = sfx;
    this.assets = assets;
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.run = null;
    this.game = null;
    this.screens = new Screens(document.getElementById('overlayRoot'), hud, sfx, assets);
    this.hud.onAbandon = () => this.abandon();
    this.hud.onDeck = () => { if (this.run) this.screens.showDeck(this.run); };
    this.hud.onSettings = () => this.screens.toggleSettings();
  }

  async boot(autostart = false) {
    this.input.enabled = false;
    this.director.world.setEnvironment?.(resolveArenaEnv({ kind: 'title' }));
    this.hud.setMode('title');
    this.sfx.bgm.setScene('title');
    if (autostart) {
      await this.beginRun('ember');
      return;
    }
    await this.screens.showTitle();
    const packId = await this.screens.showPackPick();
    await this.beginRun(packId);
  }

  async beginRun(packId = 'ember') {
    this.rng = mulberry32(this.seed);
    this.run = createRun(this.rng, this.seed, packId);
    this.hud.refreshRun(this.run);
    await this.showMap();
  }

  async showMap() {
    this.input.enabled = false;
    detachPseudoAI();
    this.director.teardownCombat();
    this.game = null;
    this.input.game = null;
    this.director.world.setEnvironment?.(resolveArenaEnv({
      floor: this.run.floor,
      kind: 'map',
    }));
    this.hud.setMode('map');
    this.sfx.bgm.setScene('map');
    this.hud.refreshRun(this.run);
    await this.screens.showMap(this.run, {
      onNode: (id) => this.enter(id),
      onDeck: () => this.screens.showDeck(this.run),
    });
  }

  async enter(id) {
    if (this._navLock) return;
    if (!nodeReachable(this.run, id)) {
      this.hud.toast('这条路还不能走');
      this.sfx.error();
      return;
    }
    this._navLock = true;
    let node;
    try {
      enterNode(this.run, id);
      node = getNode(this.run.map, id);
      this.hud.refreshRun(this.run);
      await this.screens.depart(veilFor(node));
    } finally {
      this._navLock = false;
    }
    switch (node.type) {
      case 'combat':
      case 'elite':
      case 'boss':
        await this.startCombat(node.encounterId, node.type);
        break;
      case 'event':
        await this.openEvent(node.eventId);
        break;
      case 'shop':
        await this.openShop();
        break;
      case 'rest':
        await this.openRest();
        break;
      case 'treasure':
        await this.openTreasure();
        break;
      default:
        completeCurrent(this.run);
        await this.showMap();
    }
  }

  async startCombat(encounterId, kind) {
    const encounter = getEncounter(encounterId);
    this.run.hp = this.run.maxHp;
    this.hud.setMode('combat');
    this.director.world.setEnvironment?.(resolveArenaEnv({
      floor: this.run.floor,
      kind,
    }));
    this.sfx.bgm.setScene(kind === 'boss' ? 'boss' : kind === 'elite' ? 'elite' : 'combat');
    this.hud.refreshRun(this.run);
    this.director.teardownCombat();
    const game = new Game(this.director, this.rng, {
      playerHp: this.run.maxHp,
      playerMaxHp: this.run.maxHp,
      playerDeckIds: this.run.deck.slice(),
      relics: this.run.relics.slice(),
      encounter,
      playerArchetype: packArchetype(this.run.packId),
    });
    this.game = game;
    this.director.bindGame(game);
    this.input.game = game;
    this.input.enabled = true;
    const sess = attachPseudoAI({ hud: this.hud, director: this.director, encounter });
    void sess.prepare();
    this.director.combatKind = kind;
    this.director.onCombatEnd = (winner) => this.afterCombat(winner, kind);
    await this.screens.unveil();
    await this.director.startGame();
  }

  async afterCombat(winner, kind) {
    this.input.enabled = false;
    if (this.game) {
      this.run.hp = winner === 'player' ? this.run.maxHp : this.game.player.hero.hp;
    }
    this.hud.refreshRun(this.run);
    if (winner !== 'player') {
      this.run.alive = false;
      await this.finishRun(false);
      return;
    }
    this.run.combatsWon += 1;
    if (kind === 'boss') {
      this.run.won = true;
      await this.finishRun(true);
      return;
    }
    completeCurrent(this.run);
    const reward = makeCombatReward(this.run, kind, this.rng);
    applyGold(this.run, reward.gold);
    this.sfx.goldGain(reward.gold);
    if (reward.relic) {
      grantRelic(this.run, reward.relic);
      this.sfx.cue('reward.relic');
    }
    this.hud.refreshRun(this.run);
    this.hud.setMode('reward');
    this.sfx.bgm.setScene('reward');
    await this.screens.depart({ title: '战利品', kind: 'reward' });
    await this.screens.showReward(reward, this.run, {
      take: (cardId) => {
        if (cardId) addCardToDeck(this.run, cardId);
        this.hud.refreshRun(this.run);
      },
    });
    await this.showMap();
  }

  async openEvent(eventId) {
    const ev = getEvent(eventId);
    this.hud.setMode('event');
    this.sfx.bgm.setScene('map');
    const ctxBase = {
      rng: this.rng,
      grantRelic: () => {
        const id = randomRelic(this.rng, this.run.relics);
        grantRelic(this.run, id);
        return id;
      },
    };
    const result = await this.screens.showEvent(ev, this.run, {
      choose: async (opt) => {
        let picked = null;
        if (opt.needPick === 'deck') {
          picked = await this.screens.pickFromDeck(this.run, opt.label);
        }
        const out = await opt.apply(this.run, { ...ctxBase, picked });
        this.hud.refreshRun(this.run);
        if (this.run.hp <= 0) {
          this.run.alive = false;
          return { ...out, dead: true };
        }
        return out;
      },
    });
    if (result?.dead) {
      await this.finishRun(false);
      return;
    }
    if (result?.combat) {
      completeCurrent(this.run);
      const enc = getEncounter(result.combat);
      await this.screens.depart({ title: enc?.name || '遭遇', kind: 'combat' });
      await this.startCombat(result.combat, 'event');
      return;
    }
    completeCurrent(this.run);
    await this.showMap();
  }

  async openShop() {
    this.hud.setMode('shop');
    this.sfx.bgm.setScene('shop');
    let shop = generateShop(this.run, this.rng);
    this.run.shop = shop;
    await this.screens.showShop(this.run, shop, {
      buyCard: (item) => buyShopCard(this.run, item),
      buyRelic: () => buyShopRelic(this.run, shop),
      removeCard: (cardId) => shopRemoveCard(this.run, shop, cardId),
      refresh: () => refreshShopCards(this.run, shop, this.rng),
    });
    completeCurrent(this.run);
    await this.showMap();
  }

  async openRest() {
    this.hud.setMode('rest');
    this.sfx.bgm.setScene('rest');
    const gain = restMaxHpAmount(this.run);
    await this.screens.showRest(this.run, gain, () => {
      addMaxHp(this.run, gain);
    });
    completeCurrent(this.run);
    await this.showMap();
  }

  async openTreasure() {
    this.hud.setMode('treasure');
    this.sfx.bgm.setScene('map');
    const reward = makeTreasureReward(this.run, this.rng);
    await this.screens.showTreasure(reward, this.run, () => {
      applyGold(this.run, reward.gold);
      this.sfx.goldGain(reward.gold);
      if (reward.relic) {
        grantRelic(this.run, reward.relic);
        this.sfx.cue('reward.relic');
      }
      this.hud.refreshRun(this.run);
    });
    completeCurrent(this.run);
    await this.showMap();
  }

  async finishRun(win) {
    this.input.enabled = false;
    detachPseudoAI();
    this.director.teardownCombat();
    this.game = null;
    this.input.game = null;
    this.hud.setMode('runover');
    this.sfx.bgm.setScene(win ? 'win' : 'lose');
    await this.screens.depart({ title: win ? '远征完成' : '远征失败', kind: win ? 'win' : 'lose' });
    const next = await this.screens.showRunOver(win, this.run);
    this.seed = ((this.seed * 1103515245) + 12345) >>> 0;
    if (next === 'title') {
      this.run = null;
      this.hud.setMode('title');
      this.director.world.setEnvironment?.(resolveArenaEnv({ kind: 'title' }));
      this.sfx.bgm.setScene('title');
      await this.screens.showTitle();
    }
    const packId = await this.screens.showPackPick();
    await this.beginRun(packId);
  }

  abandon() {
    if (this._ending) return;
    this._ending = true;
    this.sfx.cue('flow.abandon');
    const next = this.run ? this.finishRun(false) : this.beginRun();
    return Promise.resolve(next).finally(() => { this._ending = false; });
  }

  async debugJump(type) {
    const r = this.run;
    if (!r) return null;
    const id = Object.values(r.map.nodes).find((n) => n.type === type)?.id;
    if (!id) return null;
    r.pendingNode = false;
    r.visited = r.visited.filter((x) => x !== id);
    r.locked = r.locked.filter((x) => x !== id);
    r.currentId = null;
    r.map.startIds = [id];
    await this.enter(id);
    return id;
  }

  debug() {
    const run = this.run;
    return {
      run: run ? snapshotRun(run) : null,
      relics: (run?.relics || []).map((id) => getRelic(id)?.name),
      node: run?.currentId,
      pending: run?.pendingNode,
    };
  }

  _parseStat(n) {
    const v = Math.floor(Number(n));
    return Number.isFinite(v) ? v : null;
  }

  setPlayerHp(n) {
    const v = this._parseStat(n);
    if (v === null) return false;
    const hp = Math.max(0, v);
    const game = this.game;
    if (game && !game.over && game.player?.hero) {
      const h = game.player.hero;
      if (hp > h.maxHp) h.maxHp = hp;
      h.hp = hp;
      if (this.director.heroVis?.[h.side]) this.director.updateHp(h);
    }
    if (this.run) {
      if (hp > this.run.maxHp) this.run.maxHp = hp;
      this.run.hp = hp;
      this.hud.refreshRun(this.run);
    }
    return !!(this.run || (game && !game.over));
  }

  setGold(n) {
    const v = this._parseStat(n);
    if (v === null || !this.run) return false;
    this.run.gold = Math.max(0, v);
    this.hud.refreshRun(this.run);
    const goldEl = this.screens?.root?.querySelector('[data-gold]');
    if (goldEl) goldEl.textContent = `${this.run.gold} 金`;
    return true;
  }

  winCombat() {
    const game = this.game;
    if (!game || game.over) return false;
    game.enemy.hero.hp = 0;
    game.checkWin();
    if (this.director.heroVis?.enemy) this.director.updateHp(game.enemy.hero);
    this.director.gameOver('player');
    return true;
  }
}
