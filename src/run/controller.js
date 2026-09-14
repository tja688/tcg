import { createRun, grantRelic, snapshotRun } from './state.js';
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
  }

  async boot(autostart = false) {
    this.input.enabled = false;
    this.hud.setMode('title');
    if (!autostart) await this.screens.showTitle();
    await this.beginRun();
  }

  async beginRun() {
    this.rng = mulberry32(this.seed);
    this.run = createRun(this.rng, this.seed);
    this.hud.refreshRun(this.run);
    await this.showMap();
  }

  async showMap() {
    this.input.enabled = false;
    detachPseudoAI();
    this.director.teardownCombat();
    this.game = null;
    this.input.game = null;
    this.hud.setMode('map');
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
    this.hud.refreshRun(this.run);
    this.director.teardownCombat();
    const game = new Game(this.director, this.rng, {
      playerHp: this.run.maxHp,
      playerMaxHp: this.run.maxHp,
      playerDeckIds: this.run.deck.slice(),
      relics: this.run.relics.slice(),
      encounter,
    });
    this.game = game;
    this.director.bindGame(game);
    this.input.game = game;
    this.input.enabled = true;
    const sess = attachPseudoAI({ hud: this.hud, director: this.director, encounter });
    void sess.prepare();
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
    if (reward.relic) grantRelic(this.run, reward.relic);
    this.hud.refreshRun(this.run);
    this.hud.setMode('reward');
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
    const gain = restMaxHpAmount(this.run);
    await this.screens.showRest(this.run, gain, () => {
      addMaxHp(this.run, gain);
    });
    completeCurrent(this.run);
    await this.showMap();
  }

  async openTreasure() {
    this.hud.setMode('treasure');
    const reward = makeTreasureReward(this.run, this.rng);
    await this.screens.showTreasure(reward, this.run, () => {
      applyGold(this.run, reward.gold);
      if (reward.relic) grantRelic(this.run, reward.relic);
      this.hud.refreshRun(this.run);
    });
    completeCurrent(this.run);
    await this.showMap();
  }

  async finishRun(win) {
    this.input.enabled = false;
    this.director.teardownCombat();
    this.hud.setMode('runover');
    await this.screens.depart({ title: win ? '远征完成' : '远征失败', kind: win ? 'win' : 'lose' });
    await this.screens.showRunOver(win, this.run);
    this.seed = ((this.seed * 1103515245) + 12345) >>> 0;
    await this.beginRun();
  }

  abandon() {
    if (this._ending) return;
    this._ending = true;
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
}
