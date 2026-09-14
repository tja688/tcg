import { CFG } from '../config.js';
import { describeTarget } from './snapshot.js';

function arch(game) {
  return game.encounter?.archetype || 'tempo';
}

export function makePlayIntent(pick) {
  const d = pick.inst?.def;
  const t = pick.target;
  const amount = d?.spell?.amount || 0;
  return {
    type: 'play',
    uid: pick.inst?.uid,
    card: d?.name || '',
    cost: d?.cost,
    cardType: d?.type || '',
    spellKind: d?.spell?.kind || d?.battlecry?.type || '',
    targetName: describeTarget(t),
    targetTaunt: !!(t && t.taunt),
    lethal: !!(t && t.kind === 'hero' && (t.hp + (t.armor || 0)) <= amount),
    kill: !!(t && t.kind === 'minion' && t.health <= amount),
    aoe: d?.spell?.kind === 'aoe_enemy' || d?.battlecry?.type === 'aoe_enemy',
  };
}

export function makeAttackIntent(attacker, target) {
  const dmg = attacker.attack || 0;
  return {
    type: 'attack',
    uid: attacker?.uid,
    card: attacker.def?.name || '',
    attackerName: attacker.def?.name || '',
    cardType: 'attack',
    targetName: describeTarget(target),
    targetTaunt: !!target?.taunt,
    lethal: !!(target?.kind === 'hero' && (target.hp + (target.armor || 0)) <= dmg),
    kill: !!(target?.kind === 'minion' && target.health <= dmg),
  };
}

export function choosePlay(game, playable) {
  let best = null;
  let bestScore = 0.5;
  for (const inst of playable) {
    const scored = scorePlay(game, inst);
    if (scored && scored.score > bestScore) {
      bestScore = scored.score;
      best = scored;
    }
  }
  return best;
}

export function scorePlay(game, inst) {
  const d = inst.def;
  const a = arch(game);
  const pBoard = game.player.board;
  const e = game.enemy;
  const pHero = game.player.hero;
  const eHero = e.hero;

  if (d.type === 'minion') {
    if (e.board.length >= CFG.rules.maxBoard) return null;
    let score = d.cost * 1.6 + d.attack + d.health * 0.8;
    if (d.keywords?.includes('taunt')) score += (a.includes('tank') ? 7 : 3);
    if (d.keywords?.includes('charge')) score += (a.includes('aggro') || a === 'tempo' ? d.attack * 2.2 : d.attack);
    if (d.battlecry?.type === 'aoe_enemy' && pBoard.length >= 2) score += 8;
    if (d.battlecry?.type === 'damage_enemy_hero') score += a.includes('aggro') ? 6 : 3;
    if (a === 'control' && d.cost >= 5) score += 3;
    if (a === 'buff' && e.strength > 0) score += e.strength * 2;
    if (eHero.hp < 12 && d.cost >= 5) score -= 2;
    return { inst, slot: e.board.length, target: null, score };
  }

  const sp = d.spell;
  if (!sp) return null;

  if (sp.kind === 'damage') {
    const valid = game.validTargets(inst);
    if (!valid.length) return null;
    let target = null;
    let score = 0;
    if (pHero.hp + (pHero.armor || 0) <= sp.amount && valid.includes(pHero)) {
      return { inst, target: pHero, score: 200 };
    }
    const killable = pBoard.filter((m) => valid.includes(m) && m.health <= sp.amount)
      .sort((x, y) => (y.attack + y.health) - (x.attack + x.health));
    if (killable[0]) {
      target = killable[0];
      score = 10 + target.attack * 1.4 + (target.taunt ? 4 : 0);
    } else {
      const big = pBoard.filter((m) => valid.includes(m)).sort((x, y) => y.attack - x.attack)[0];
      if (big && (a === 'control' || a === 'status' || big.attack >= 4)) {
        target = big;
        score = 5 + big.attack;
      } else if (valid.includes(pHero) && (a.includes('aggro') || a === 'boss' || pHero.hp <= 16)) {
        target = pHero;
        score = a.includes('aggro') ? 8 : 4;
      }
    }
    if (!target) return null;
    if (a === 'status') score += 2;
    return { inst, target, score };
  }

  if (sp.kind === 'aoe_enemy') {
    const value = pBoard.reduce((s, m) => s + Math.min(m.health, sp.amount) + (m.health <= sp.amount ? m.attack : 0), 0);
    if (pBoard.length >= 2 && value >= 5) return { inst, target: null, score: 7 + value + (a === 'control' ? 4 : 0) };
    if (pBoard.length >= 3) return { inst, target: null, score: 6 };
    return null;
  }

  if (sp.kind === 'heal') {
    const valid = game.validTargets(inst);
    if (eHero.hp <= eHero.maxHp - 5 && valid.includes(eHero)) {
      return { inst, target: eHero, score: (a.includes('tank') ? 9 : 5) + (eHero.hp < 12 ? 5 : 0) };
    }
    const hurt = e.board.filter((m) => valid.includes(m) && m.health <= m.maxHealth - 3)
      .sort((x, y) => (y.attack) - (x.attack))[0];
    if (hurt) return { inst, target: hurt, score: 4 + (hurt.taunt ? 3 : 0) };
    return null;
  }

  if (sp.kind === 'draw') {
    const pain = sp.selfDamage || 0;
    if (e.hand.length <= 4) return { inst, target: null, score: 4.5 - pain * 0.4 };
    if (e.hand.length <= 6 && a === 'control') return { inst, target: null, score: 3 };
    return null;
  }

  if (sp.kind === 'buff') {
    const valid = game.validTargets(inst);
    const best = valid.filter((m) => m.kind === 'minion').sort((x, y) => y.attack - x.attack)[0];
    if (!best) return null;
    return { inst, target: best, score: 4 + best.attack * 0.5 + (a === 'buff' ? 4 : 0) };
  }

  if (sp.kind === 'debuff') {
    const valid = game.validTargets(inst);
    const best = valid.filter((m) => m.kind === 'minion').sort((x, y) => y.attack - x.attack)[0];
    if (!best || best.attack <= 1) return null;
    return { inst, target: best, score: 5 + best.attack + (a === 'status' ? 4 : 0) };
  }

  if (sp.kind === 'armor') {
    return { inst, target: null, score: (a.includes('tank') ? 8 : 3) + (eHero.hp < 14 ? 4 : 0) };
  }

  return null;
}

export function pickAttacker(game, ready) {
  const a = arch(game);
  if (a.includes('aggro') || a === 'boss') {
    return [...ready].sort((x, y) => y.attack - x.attack)[0];
  }
  return ready[0];
}

export function chooseAttackTarget(game, attacker, targets) {
  const a = arch(game);
  const minions = targets.filter((t) => t.kind === 'minion');
  const hero = targets.find((t) => t.kind === 'hero');
  const pHero = game.player.hero;

  if (hero && pHero.hp + (pHero.armor || 0) <= attacker.attack) return hero;

  const canKill = minions.filter((t) => t.health <= attacker.attack);
  const killSafe = canKill.filter((t) => t.attack < attacker.health);
  if (killSafe.length) {
    return killSafe.sort((x, y) => (y.attack + (y.taunt ? 4 : 0)) - (x.attack + (x.taunt ? 4 : 0)))[0];
  }

  if (!hero) {
    if (canKill.length) return canKill[0];
    return minions.sort((x, y) => x.attack - y.attack)[0];
  }

  if (a.includes('tank') || a === 'control') {
    const worthy = canKill.filter((t) => t.attack >= 3);
    if (worthy.length) return worthy[0];
    if (minions.length && pHero.hp > 18) {
      const threat = minions.sort((x, y) => y.attack - x.attack)[0];
      if (threat.attack >= 4) return threat;
    }
  }

  if (a.includes('aggro') || a === 'boss' || a === 'tempo') {
    const worthy = canKill.filter((t) => t.attack >= 5 || t.taunt);
    if (worthy.length) return worthy[0];
    return hero;
  }

  const worthy = canKill.filter((t) => t.attack >= 4 || (t.attack + t.health) >= (attacker.attack + attacker.health) + 2);
  if (worthy.length) return worthy[0];
  return hero;
}

function describeIntent(intent) {
  if (!intent) return '';
  if (intent.type === 'play') {
    const cost = intent.cost != null ? `${intent.cost}费` : '';
    const tgt = intent.targetName ? `，对着${intent.targetName}` : '';
    return `打出「${intent.card || '一张牌'}」${cost}${tgt}`;
  }
  if (intent.type === 'attack') {
    return `用「${intent.attackerName || intent.card || '随从'}」打${intent.targetName || '目标'}`;
  }
  return '';
}

/** 把当前已定的一手，以及脑里接下来可能的出牌/攻击，收成给台词用的短计划。不改局面。 */
export function peekPlan(game, current = null) {
  const now = describeIntent(current);
  const next = [];
  if (!game) return { now, next, answers: [] };

  let mana = game.enemy.mana;
  let boardLen = game.enemy.board.length;
  if (current?.type === 'play') {
    mana -= current.cost || 0;
    if (current.cardType === 'minion') boardLen += 1;
  }

  let best = null;
  for (const inst of game.enemy.hand) {
    if (current?.uid != null && inst.uid === current.uid) continue;
    if ((inst.def?.cost || 0) > mana) continue;
    if (inst.def?.type === 'minion' && boardLen >= CFG.rules.maxBoard) continue;
    const scored = scorePlay(game, inst);
    if (scored && (!best || scored.score > best.score)) best = scored;
  }
  if (best) {
    const t = describeTarget(best.target);
    next.push(t ? `出「${best.inst.def.name}」对着${t}` : `出「${best.inst.def.name}」`);
  }

  const ready = game.enemy.board.filter((m) => m.canAttack && m.attack > 0);
  if (ready.length) {
    const attacker = pickAttacker(game, ready);
    const targets = game.validAttackTargets(attacker);
    if (targets.length) {
      const target = chooseAttackTarget(game, attacker, targets);
      next.push(`「${attacker.def.name}」去打${describeTarget(target)}`);
    }
  }

  const answers = game.enemy.hand
    .filter((c) => current?.uid == null || c.uid !== current.uid)
    .map((c) => c.def?.name)
    .filter(Boolean);

  return { now, next, answers };
}

export function formatPlan(plan) {
  if (!plan) return '';
  const bits = [];
  if (plan.now) bits.push(`你这一手：${plan.now}`);
  if (plan.next?.length) bits.push(`你大概还会：${plan.next.join('；')}`);
  return bits.join('\n');
}

export function counterHint(game, ev) {
  const hand = game?.enemy?.hand || [];
  if (!hand.length) return '';
  const dmg = hand.find((c) => c.def?.spell?.kind === 'damage');
  const taunt = hand.find((c) => c.def?.keywords?.includes('taunt'));
  const aoe = hand.find((c) => c.def?.spell?.kind === 'aoe_enemy' || c.def?.battlecry?.type === 'aoe_enemy');
  if (ev?.type === 'player_play' && ev.cardType === 'minion') {
    if (dmg) return `手里有「${dmg.def.name}」能点它`;
    if (aoe) return `手里有「${aoe.def.name}」能扫场`;
    if (taunt) return `手里还有「${taunt.def.name}」可以挡`;
  }
  if (ev?.type === 'player_attack' && taunt) return `手里有「${taunt.def.name}」能堵路`;
  if (ev?.type === 'idle' && dmg) return `手里捏着「${dmg.def.name}」`;
  return '';
}
