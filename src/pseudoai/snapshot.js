function minionLine(m) {
  return `${m.def?.name || '?'} ${m.attack}/${m.health}${m.taunt ? ' 嘲讽' : ''}${m.canAttack ? ' 可攻' : ''}`;
}

export function boardSnapshot(game) {
  if (!game) return '';
  const p = game.player;
  const e = game.enemy;
  const intent = game.lockedIntent;
  return [
    `回合 ${game.turnNo}，当前行动：${game.turn === 'enemy' ? '你' : '对手'}`,
    `你：${e.hero.hp}/${e.hero.maxHp} 血${e.hero.armor ? ` 甲${e.hero.armor}` : ''}，法力 ${e.mana}/${e.manaMax}，手牌 ${e.hand.length}，牌库 ${e.deck.length}`,
    `对手：${p.hero.hp}/${p.hero.maxHp} 血${p.hero.armor ? ` 甲${p.hero.armor}` : ''}，手牌 ${p.hand.length}`,
    `你的场面：${e.board.length ? e.board.map(minionLine).join('；') : '空'}`,
    `对手场面：${p.board.length ? p.board.map(minionLine).join('；') : '空'}`,
    intent ? `你已显露的预兆：${intent.title} · ${intent.label}` : '',
  ].filter(Boolean).join('\n');
}

export function intentLine(intent) {
  if (!intent) return '你正在权衡下一步。';
  if (intent.type === 'play') {
    const name = intent.card || '一张牌';
    const cost = intent.cost != null ? `（${intent.cost}费）` : '';
    const tgt = intent.targetName ? `，对着${intent.targetName}` : '';
    return `你正准备：打出「${name}」${cost}${tgt}`;
  }
  if (intent.type === 'attack') {
    const from = intent.attackerName || intent.card || '随从';
    const to = intent.targetName || '目标';
    return `你正准备：用「${from}」打${to}`;
  }
  return '你正在权衡下一步。';
}

export function eventLine(ev) {
  if (!ev) return '场面暂时安静。';
  switch (ev.type) {
    case 'think':
      return intentLine(ev);
    case 'turn_start':
      return `轮到你行动了（第 ${ev.turnNo || '?'} 回合）。`;
    case 'play': {
      const name = ev.card || ev.inst?.def?.name || '一张牌';
      const kind = ev.cardType || ev.inst?.def?.type || '牌';
      const tgt = ev.targetName ? `，对着${ev.targetName}` : '';
      return `你打出了${kind === 'spell' ? '法术' : '随从'}「${name}」${tgt}。`;
    }
    case 'attack': {
      const from = ev.attackerName || '随从';
      const to = ev.targetName || '目标';
      return `你的「${from}」扑向了${to}${ev.lethal ? '，这一下像要收割' : ''}。`;
    }
    case 'kill':
      return `「${ev.name || '随从'}」倒下了。`;
    case 'hurt':
      return `你挨了 ${ev.amount || '?'} 点伤害，还剩 ${ev.hp ?? '?'} 血。`;
    case 'phase':
      return `形态变了：${ev.banner || '更深的姿态'}。`;
    case 'over':
      return ev.winner === 'enemy' ? '你赢了。' : '你倒下了。';
    case 'player_play':
      return `对手打出了「${ev.card || '一张牌'}」。`;
    case 'player_attack':
      return `对手的「${ev.attackerName || '随从'}」打向了${ev.targetName || '你'}。`;
    default:
      return ev.note || '局面在变。';
  }
}

export function describeTarget(target) {
  if (!target) return '';
  if (target.kind === 'hero') return target.side === 'player' ? '那个法师' : '你自己';
  return target.def?.name ? `「${target.def.name}」` : '一个随从';
}
