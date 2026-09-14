import { CFG } from '../config.js';
import { buildDeck, buildDeckFromIds, hasKeyword, CARDS } from './cards.js';
import { runAI } from './ai.js';
import { computeIntent } from './intent.js';
import { hasRelic } from '../run/relics.js';
import { getEncounter } from '../run/encounters.js';
import { notifyPseudoAI } from '../pseudoai/session.js';

let UID = 1;

function mkHero(side, name, hp, maxHp) {
  return { kind: 'hero', side, name, hp, maxHp, armor: 0 };
}

function mkSide(side, name, hp, maxHp) {
  return {
    side, name,
    hero: mkHero(side, name, hp, maxHp),
    deck: [], hand: [], board: [], discard: [],
    mana: 0, manaMax: 0, strength: 0,
  };
}

export function mkInstance(def, side) {
  return {
    kind: 'minion', uid: UID++, side, def,
    attack: def.attack, health: def.health, maxHealth: def.health,
    canAttack: false, sick: true, onBoard: false,
    taunt: hasKeyword(def, 'taunt'),
  };
}

export class Game {
  constructor(fx, rng, opts = {}) {
    this.fx = fx;
    this.rng = rng;
    this.relics = opts.relics || [];
    this.encounter = opts.encounter || getEncounter('abyss_lord');

    const pHp = opts.playerHp ?? CFG.rules.heroHp;
    const pMax = opts.playerMaxHp ?? CFG.rules.heroHp;
    this.player = mkSide('player', opts.playerName || '晨曦法师', pHp, pMax);
    this.enemy = mkSide('enemy', this.encounter.name, this.encounter.hp, this.encounter.hp);

    this._playerDeckIds = opts.playerDeckIds || null;
    this.turn = 'player';
    this.turnNo = 0;
    this.over = false;
    this.winner = null;
    this.fatigue = { player: 0, enemy: 0 };
    this.phase = 1;
    this.lockedIntent = null;
    this._phaseAnnounced = 1;
  }

  sideOf(name) { return name === 'player' ? this.player : this.enemy; }
  otherName(name) { return name === 'player' ? 'enemy' : 'player'; }
  hasRelic(id) { return hasRelic(this.relics, id); }

  findMinion(uid) {
    return this.player.board.find((m) => m.uid === uid)
        || this.enemy.board.find((m) => m.uid === uid)
        || this.player.hand.find((m) => m.uid === uid)
        || this.enemy.hand.find((m) => m.uid === uid)
        || null;
  }

  async start() {
    this.player.deck = this._playerDeckIds
      ? buildDeckFromIds(this._playerDeckIds, this.rng)
      : buildDeck(this.rng);
    this.enemy.deck = this.encounter.deck
      ? buildDeckFromIds(this.encounter.deck, this.rng)
      : buildDeck(this.rng);

    if (this.hasRelic('crystal_core')) this.player.manaMax = 1;
    if (this.hasRelic('guardian_scale')) this.player.hero.armor = 4;

    this.fx.updateDeck('player');
    this.fx.updateDeck('enemy');
    this.fx.updateArmor?.(this.player.hero);
    this.fx.updateArmor?.(this.enemy.hero);
    await this.fx.intro();

    for (const id of this.encounter.startBoard || []) {
      const def = CARDS[id];
      if (!def) continue;
      const inst = mkInstance(def, 'enemy');
      inst.onBoard = true;
      inst.sick = true;
      inst.canAttack = false;
      this.enemy.board.push(inst);
      await this.fx.spawnMinion(inst, this.enemy.board.length - 1);
    }

    const pDraw = CFG.rules.startHandPlayer + (this.hasRelic('sage_quill') ? 1 : 0);
    const eDraw = this.encounter.startHand ?? CFG.rules.startHandEnemy;
    for (let i = 0; i < pDraw; i++) await this.draw('player');
    for (let i = 0; i < eDraw; i++) await this.draw('enemy');
    await this.startTurn('player');
  }

  async draw(sideName) {
    const s = this.sideOf(sideName);
    if (s.deck.length === 0) {
      this.fatigue[sideName] += 1;
      const n = this.fatigue[sideName];
      await this.fx.drawFail(sideName);
      this.applyDamage(s.hero, n);
      if (this.checkWin()) { await this.fx.gameOver(this.winner); }
      return;
    }
    const def = s.deck.pop();
    this.fx.updateDeck(sideName);
    if (s.hand.length >= CFG.rules.maxHand) {
      s.discard.push(def);
      this.fx.updatePiles?.(sideName);
      await this.fx.burnCard(sideName, def);
      return;
    }
    const inst = mkInstance(def, sideName);
    s.hand.push(inst);
    await this.fx.drawCard(sideName, inst);
    this.fx.updatePiles?.(sideName);
  }

  async startTurn(sideName) {
    if (this.over) return;
    this.turn = sideName;
    if (sideName === 'player') this.turnNo++;
    const s = this.sideOf(sideName);
    s.manaMax = Math.min(CFG.rules.maxMana, s.manaMax + 1);
    s.mana = s.manaMax;
    for (const m of s.board) {
      m.sick = false;
      m.canAttack = m.attack > 0;
    }
    this.fx.updateMana(sideName);
    this.fx.refreshIndicators();
    await this.fx.turnBanner(sideName, this.turnNo);
    await this.draw(sideName);
    if (this.over) return;

    if (sideName === 'player') {
      this.lockedIntent = computeIntent(this);
      await this.fx.showIntent?.(this.lockedIntent);
    }

    this.fx.refreshIndicators();
    if (sideName === 'enemy' && !this.over) {
      await this.resolveIntent(this.lockedIntent);
      if (this.over) return;
      await runAI(this);
    }
  }

  async endTurn(sideName) {
    if (this.over || this.turn !== sideName) return;
    await this.startTurn(this.otherName(sideName));
  }

  playBlockReason(inst) {
    if (this.over) return '对局已结束';
    if (this.turn !== inst.side) return '还没轮到你行动';
    const s = this.sideOf(inst.side);
    if (s.mana < inst.def.cost) return '法力水晶不足！';
    if (inst.def.type === 'minion' && s.board.length >= CFG.rules.maxBoard) return '战场已经满员了！';
    if (this.needsTarget(inst.def) && this.validTargets(inst).length === 0) return '没有合法目标';
    return null;
  }

  canPlay(inst) { return this.playBlockReason(inst) === null; }

  needsTarget(def) {
    const t = def.spell?.target;
    return def.type === 'spell' && t && t !== 'none';
  }

  validTargets(inst) {
    const t = inst.def.spell?.target;
    if (!t || t === 'none') return [];
    const foe = this.sideOf(this.otherName(inst.side));
    const own = this.sideOf(inst.side);
    if (t === 'enemy-any') return [...foe.board, foe.hero];
    if (t === 'friendly-any') return [...own.board, own.hero];
    if (t === 'friendly-minion') return [...own.board];
    if (t === 'enemy-minion') return [...foe.board];
    return [];
  }

  validAttackTargets(minion) {
    const foe = this.sideOf(this.otherName(minion.side));
    const taunts = foe.board.filter((m) => m.taunt);
    if (taunts.length) return taunts;
    return [...foe.board, foe.hero];
  }

  previewAttack(attacker, target) {
    if (!attacker || !target) return null;
    const dmg = Math.max(0, attacker.attack);
    if (target.kind === 'hero') {
      const soak = Math.min(target.armor || 0, dmg);
      return { dmg, soak, hp: Math.max(0, target.hp - (dmg - soak)), lethal: target.hp + (target.armor || 0) <= dmg };
    }
    return { dmg, soak: 0, hp: target.health - dmg, lethal: target.health <= dmg, counter: attacker.health - target.attack };
  }

  async playCard(inst, { slot = null, target = null } = {}) {
    if (!this.canPlay(inst)) return false;
    const def = inst.def;
    if (this.needsTarget(def)) {
      const valid = this.validTargets(inst);
      if (!target || !valid.includes(target)) return false;
    }
    const s = this.sideOf(inst.side);
    const idx = s.hand.indexOf(inst);
    if (idx < 0) return false;

    s.mana -= def.cost;
    this.fx.updateMana(inst.side);
    s.hand.splice(idx, 1);

    if (def.type === 'minion') {
      inst.attack += s.strength;
      if (inst.side === 'player' && this.hasRelic('war_banner')) inst.attack += 1;
      const at = Math.max(0, Math.min(slot ?? s.board.length, s.board.length));
      s.board.splice(at, 0, inst);
      inst.onBoard = true;
      const charge = hasKeyword(def, 'charge');
      inst.sick = !charge;
      inst.canAttack = charge && inst.attack > 0;
      await this.fx.summon(inst, at);
      if (def.battlecry) await this.resolveBattlecry(inst, def.battlecry);
    } else {
      s.discard.push(def);
      this.fx.updatePiles?.(inst.side);
      await this.fx.castSpell(inst, target);
      await this.resolveSpell(inst, def.spell, target);
    }

    await this.checkDeaths();
    await this.checkPhaseChange();
    if (this.checkWin()) { await this.fx.gameOver(this.winner); return true; }
    this.fx.refreshIndicators();
    if (inst.side === 'player' && (def.cost >= 4 || def.rarity === 'legendary')) {
      notifyPseudoAI(this, { type: 'player_play', card: def.name });
    }
    return true;
  }

  async resolveBattlecry(inst, bc) {
    if (bc.type === 'draw') {
      for (let i = 0; i < bc.n; i++) await this.draw(inst.side);
    } else if (bc.type === 'aoe_enemy') {
      const foes = this.sideOf(this.otherName(inst.side)).board.slice();
      if (foes.length) {
        await this.fx.roar(inst);
        for (const m of foes) this.applyDamage(m, bc.amount);
      }
    } else if (bc.type === 'damage_enemy_hero') {
      const foe = this.sideOf(this.otherName(inst.side)).hero;
      await this.fx.projectile?.('fireball', inst.side, foe);
      this.applyDamage(foe, bc.amount);
    }
  }

  spellDamage(amount) {
    return amount + (this.hasRelic('void_lens') ? 1 : 0);
  }

  async resolveSpell(inst, sp, target) {
    switch (sp.kind) {
      case 'damage':
        await this.fx.projectile(sp.vfx, inst.side, target);
        this.applyDamage(target, inst.side === 'player' ? this.spellDamage(sp.amount) : sp.amount);
        break;
      case 'aoe_enemy': {
        const foeName = this.otherName(inst.side);
        const foes = this.sideOf(foeName).board.slice();
        await this.fx.aoeStorm(foeName);
        const amt = inst.side === 'player' ? this.spellDamage(sp.amount) : sp.amount;
        for (const m of foes) this.applyDamage(m, amt);
        break;
      }
      case 'heal':
        await this.fx.healEffect(target);
        this.applyHeal(target, sp.amount);
        break;
      case 'draw':
        await this.fx.arcaneFlourish(inst.side);
        for (let i = 0; i < sp.n; i++) await this.draw(inst.side);
        break;
      case 'buff':
        if (target?.kind === 'minion') {
          target.attack += sp.amount;
          this.fx.updateStats(target);
          await this.fx.buffEffect?.(target);
        }
        break;
      case 'debuff':
        if (target?.kind === 'minion') {
          target.attack = Math.max(0, target.attack - sp.amount);
          this.fx.updateStats(target);
          await this.fx.debuffEffect?.(target);
        }
        break;
      case 'armor': {
        const hero = this.sideOf(inst.side).hero;
        hero.armor += sp.amount;
        this.fx.updateArmor?.(hero);
        await this.fx.armorEffect?.(hero, sp.amount);
        break;
      }
    }
    if (sp.selfDamage) this.applyDamage(this.sideOf(inst.side).hero, sp.selfDamage);
  }

  async attack(attacker, target) {
    if (this.over || this.turn !== attacker.side) return false;
    if (!attacker.onBoard || !attacker.canAttack || attacker.attack <= 0) return false;
    const valid = this.validAttackTargets(attacker);
    if (!valid.includes(target)) return false;

    attacker.canAttack = false;
    await this.fx.attackLunge(attacker, target);
    this.applyDamage(target, attacker.attack);
    if (target.kind === 'hero' && this.hasRelic('thorn_sigil') && target.side === 'player') {
      this.applyDamage(attacker, 1);
    }
    if (target.kind === 'minion' && target.attack > 0) {
      this.applyDamage(attacker, target.attack);
    }
    await this.fx.attackRecover(attacker);

    await this.checkDeaths();
    await this.checkPhaseChange();
    if (this.checkWin()) { await this.fx.gameOver(this.winner); return true; }
    this.fx.refreshIndicators();
    if (attacker.side === 'player' && (target.kind === 'hero' || (target.kind === 'minion' && target.health <= 0))) {
      notifyPseudoAI(this, {
        type: 'player_attack',
        attackerName: attacker.def?.name,
        targetName: target.kind === 'hero' ? '你' : target.def?.name,
      });
    }
    return true;
  }

  applyDamage(entity, n) {
    if (n <= 0 || !entity) return;
    let left = n;
    if (entity.kind === 'hero' && entity.armor > 0) {
      const soak = Math.min(entity.armor, left);
      entity.armor -= soak;
      left -= soak;
      this.fx.updateArmor?.(entity);
      if (soak) this.fx.blockPop?.(entity, soak);
    }
    if (left <= 0) return;
    if (entity.kind === 'hero') {
      entity.hp = Math.max(0, entity.hp - left);
      this.fx.updateHp(entity);
      if (entity.side === 'enemy' && left >= 5) {
        notifyPseudoAI(this, { type: 'hurt', amount: left, hp: entity.hp });
      }
    } else {
      entity.health -= left;
      this.fx.updateStats(entity);
    }
    this.fx.damagePop(entity, left);
  }

  applyHeal(entity, n) {
    if (n <= 0) return;
    let healed = 0;
    if (entity.kind === 'hero') {
      const before = entity.hp;
      entity.hp = Math.min(entity.maxHp, entity.hp + n);
      healed = entity.hp - before;
      this.fx.updateHp(entity);
    } else {
      const before = entity.health;
      entity.health = Math.min(entity.maxHealth, entity.health + n);
      healed = entity.health - before;
      this.fx.updateStats(entity);
    }
    this.fx.healPop(entity, healed);
  }

  applyArmor(hero, n) {
    if (n <= 0) return;
    hero.armor += n;
    this.fx.updateArmor?.(hero);
    this.fx.armorEffect?.(hero, n);
  }

  async resolveIntent(intent) {
    if (!intent || this.over) return;
    await this.fx.intentResolve?.(intent);
    const e = this.enemy;
    const p = this.player;
    switch (intent.type) {
      case 'attack':
        this.applyDamage(p.hero, intent.value);
        await this.fx.heroPowerVfx?.('attack', p.hero);
        break;
      case 'defend':
        this.applyArmor(e.hero, intent.value);
        await this.fx.heroPowerVfx?.('defend', e.hero);
        break;
      case 'buff':
        e.strength += intent.value;
        for (const m of e.board) {
          m.attack += intent.value;
          this.fx.updateStats(m);
        }
        this.fx.updateStrength?.(e);
        await this.fx.heroPowerVfx?.('buff', e.hero);
        break;
      case 'debuff':
        for (const m of p.board) {
          m.attack = Math.max(0, m.attack - intent.value);
          this.fx.updateStats(m);
        }
        await this.fx.heroPowerVfx?.('debuff', p.hero);
        break;
      case 'summon': {
        if (e.board.length >= CFG.rules.maxBoard) break;
        const def = CARDS[intent.cardId] || CARDS.ember_whelp;
        const inst = mkInstance(def, 'enemy');
        inst.onBoard = true;
        inst.sick = true;
        inst.canAttack = false;
        inst.attack += e.strength;
        e.board.push(inst);
        await this.fx.spawnMinion(inst, e.board.length - 1);
        break;
      }
      case 'special':
        if (intent.special === 'aoe') {
          await this.fx.aoeStorm('player');
          for (const m of p.board.slice()) this.applyDamage(m, intent.value);
        } else if (intent.special === 'draw') {
          for (let i = 0; i < (intent.value || 1); i++) await this.draw('enemy');
        } else if (intent.special === 'heal') {
          await this.fx.healEffect(e.hero);
          this.applyHeal(e.hero, intent.value);
        }
        break;
    }
    await this.checkDeaths();
    await this.checkPhaseChange();
    if (this.checkWin()) { await this.fx.gameOver(this.winner); }
    this.fx.refreshIndicators();
  }

  async checkPhaseChange() {
    const phases = this.encounter.phases || [];
    while (this.phase < phases.length) {
      const next = phases[this.phase];
      if (!next || this.enemy.hero.hp > next.atHp) break;
      this.phase += 1;
      this.lockedIntent = computeIntent(this);
      await this.fx.phaseChange?.(next.banner || '形态变化', this.lockedIntent);
      notifyPseudoAI(this, { type: 'phase', banner: next.banner || '形态变化' });
    }
  }

  async checkDeaths() {
    const dead = [
      ...this.player.board.filter((m) => m.health <= 0),
      ...this.enemy.board.filter((m) => m.health <= 0),
    ];
    if (!dead.length) return;
    this.player.board = this.player.board.filter((m) => m.health > 0);
    this.enemy.board = this.enemy.board.filter((m) => m.health > 0);
    for (const m of dead) {
      m.onBoard = false;
      m.dead = true;
      this.sideOf(m.side).discard.push(m.def);
    }
    this.fx.updatePiles?.('player');
    this.fx.updatePiles?.('enemy');
    await this.fx.deaths(dead);
  }

  checkWin() {
    if (this.over) return true;
    if (this.enemy.hero.hp <= 0) { this.over = true; this.winner = 'player'; }
    else if (this.player.hero.hp <= 0) { this.over = true; this.winner = 'enemy'; }
    if (this.over) {
      this.turn = 'none';
      notifyPseudoAI(this, { type: 'over', winner: this.winner });
    }
    return this.over;
  }
}
