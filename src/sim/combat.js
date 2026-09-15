import { Game } from '../game/game.js';
import { runSide } from '../pseudoai/brain.js';
import { packArchetype } from '../run/packs.js';
import { silentFx } from '../../scripts/fxStub.mjs';

export async function playCombat(run, encounter, rng) {
  const game = new Game(silentFx(), rng, {
    playerHp: run.maxHp,
    playerMaxHp: run.maxHp,
    playerDeckIds: run.deck.slice(),
    relics: run.relics.slice(),
    encounter,
    playerArchetype: packArchetype(run.packId),
    fastAI: true,
  });
  await game.start();
  let guard = 0;
  while (!game.over && guard++ < 48) {
    if (game.turn !== 'player') break;
    await runSide(game, 'player');
  }
  return {
    winner: game.over ? game.winner : 'enemy',
    turns: game.turnNo,
    stall: !game.over,
    playerHp: game.player.hero.hp,
    enemyHp: game.enemy.hero.hp,
    encounterId: encounter.id,
  };
}
