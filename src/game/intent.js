const TYPE_LABEL = {
  attack: '攻击',
  defend: '防御',
  buff: '强化',
  debuff: '削弱',
  summon: '召唤',
  special: '特殊',
};

function match(cond, ctx) {
  if (!cond) return true;
  if (cond.hpBelow != null && ctx.eHp >= cond.hpBelow) return false;
  if (cond.hpAbove != null && ctx.eHp <= cond.hpAbove) return false;
  if (cond.playerHpBelow != null && ctx.pHp >= cond.playerHpBelow) return false;
  if (cond.playerArmorGte != null && ctx.pArmor < cond.playerArmorGte) return false;
  if (cond.eBoardGte != null && ctx.eBoard < cond.eBoardGte) return false;
  if (cond.eBoardLte != null && ctx.eBoard > cond.eBoardLte) return false;
  if (cond.pBoardGte != null && ctx.pBoard < cond.pBoardGte) return false;
  if (cond.pBoardLte != null && ctx.pBoard > cond.pBoardLte) return false;
  if (cond.pThreatGte != null && ctx.pThreat < cond.pThreatGte) return false;
  if (cond.turnGte != null && ctx.turn < cond.turnGte) return false;
  if (cond.turnLte != null && ctx.turn > cond.turnLte) return false;
  if (cond.phase != null && ctx.phase !== cond.phase) return false;
  return true;
}

function fill(raw, ctx, game) {
  const src = typeof raw === 'string' ? { type: raw } : { ...raw };
  const type = src.type;
  let value = src.value;
  if (value == null) {
    if (type === 'attack') value = src.amount ?? (4 + game.phase);
    else if (type === 'defend') value = src.armor ?? (5 + game.phase * 2);
    else if (type === 'buff') value = src.amount ?? 1;
    else if (type === 'debuff') value = src.amount ?? 1;
    else if (type === 'summon') value = 1;
    else if (type === 'special') value = src.amount ?? 2;
  }
  const label = src.label || (
    type === 'attack' ? `攻击 ${value}`
      : type === 'defend' ? `获得 ${value} 护甲`
        : type === 'buff' ? `力量 +${value}`
          : type === 'debuff' ? `敌方随从 -${value} 攻`
            : type === 'summon' ? '召唤援军'
              : src.title || '未知预兆'
  );
  return {
    type,
    value,
    label,
    title: TYPE_LABEL[type] || '未知',
    cardId: src.cardId || null,
    special: src.special || null,
  };
}

export function computeIntent(game) {
  const enc = game.encounter;
  const phases = enc.phases || [{ cycle: ['attack'] }];
  const phase = phases[Math.max(0, game.phase - 1)] || phases[0];
  const ctx = {
    turn: game.turnNo,
    phase: game.phase,
    eHp: game.enemy.hero.hp / Math.max(1, game.enemy.hero.maxHp),
    pHp: game.player.hero.hp,
    pArmor: game.player.hero.armor || 0,
    eArmor: game.enemy.hero.armor || 0,
    pBoard: game.player.board.length,
    eBoard: game.enemy.board.length,
    pThreat: game.player.board.reduce((s, m) => s + m.attack, 0),
  };
  for (const rule of phase.rules || []) {
    if (match(rule.if, ctx)) return fill(rule.intent, ctx, game);
  }
  const cycle = phase.cycle || ['attack'];
  const raw = cycle[(Math.max(0, game.turnNo)) % cycle.length];
  return fill(raw, ctx, game);
}
