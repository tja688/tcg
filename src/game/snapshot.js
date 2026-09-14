export function snapshotSide(s) {
  return {
    hp: s.hero.hp,
    armor: s.hero.armor,
    mana: s.mana,
    manaMax: s.manaMax,
    deck: s.deck.length,
    discard: s.discard.length,
    strength: s.strength,
    hand: s.hand.map((c) => ({ uid: c.uid, name: c.def.name, cost: c.def.cost })),
    board: s.board.map((c) => ({
      uid: c.uid, name: c.def.name, atk: c.attack, hp: c.health, canAttack: c.canAttack, taunt: c.taunt,
    })),
  };
}

export function snapshotCombat(game) {
  if (!game) return { turn: 'none', over: true, winner: null, intent: null, player: null, enemy: null };
  return {
    turn: game.turn,
    turnNo: game.turnNo,
    over: game.over,
    winner: game.winner,
    intent: game.lockedIntent,
    player: snapshotSide(game.player),
    enemy: snapshotSide(game.enemy),
  };
}
