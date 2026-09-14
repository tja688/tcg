import { CFG } from '../config.js';
import { sleep } from '../utils/rng.js';

export async function runAI(game) {
  await sleep(480);

  let guard = 0;
  while (!game.over && guard++ < 28) {
    const playable = game.enemy.hand.filter((c) => game.canPlay(c));
    if (!playable.length) break;
    const pick = choosePlay(game, playable);
    if (!pick) break;
    const ok = await game.playCard(pick.inst, { slot: pick.slot, target: pick.target });
    if (!ok) break;
    if (game.over) return;
    await sleep(420);
  }

  guard = 0;
  while (!game.over && guard++ < 28) {
    const ready = game.enemy.board.filter((m) => m.canAttack && m.attack > 0);
    if (!ready.length) break;
    const attacker = pickAttacker(game, ready);
    const targets = game.validAttackTargets(attacker);
    if (!targets.length) { attacker.canAttack = false; continue; }
    const target = chooseAttackTarget(game, attacker, targets);
    const ok = await game.attack(attacker, target);
    if (!ok) attacker.canAttack = false;
    if (game.over) return;
    await sleep(380);
  }

  if (!game.over) await game.endTurn('enemy');
}

function arch(game) {
  return game.encounter?.archetype || 'tempo';
}

function choosePlay(game, playable) {
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

function scorePlay(game, inst) {
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

function pickAttacker(game, ready) {
  const a = arch(game);
  if (a.includes('aggro') || a === 'boss') {
    return [...ready].sort((x, y) => y.attack - x.attack)[0];
  }
  return ready[0];
}

function chooseAttackTarget(game, attacker, targets) {
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
