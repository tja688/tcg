import { mulberry32 } from '../src/utils/rng.js';
import { Game, mkInstance } from '../src/game/game.js';
import { CARDS } from '../src/game/cards.js';
import { computeIntent } from '../src/game/intent.js';
import { snapshotCombat } from '../src/game/snapshot.js';
import { silentFx } from './fxStub.mjs';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

const PIN_ENC = {
  id: 'pin',
  name: '钉住',
  hp: 30,
  deck: ['flame_imp', 'flame_imp', 'flame_imp', 'flame_imp', 'flame_imp', 'flame_imp'],
  startBoard: ['crystal_guardian'],
  startHand: 0,
  phases: [{
    cycle: [
      { type: 'attack', amount: 4, label: '斩 4' },
      { type: 'summon', cardId: 'ember_whelp', label: '唤崽' },
      { type: 'defend', armor: 5, label: '甲 5' },
    ],
    rules: [],
  }],
};

function makeGame(opts = {}) {
  const rng = opts.rng || mulberry32(20260914);
  return new Game(silentFx(), rng, {
    encounter: PIN_ENC,
    playerHp: opts.playerHp ?? 40,
    playerMaxHp: opts.playerMaxHp ?? 40,
    playerDeckIds: opts.playerDeckIds || [
      'flame_imp', 'flame_imp', 'forest_wolf', 'lightning_bolt',
      'thunder_samurai', 'healing_light', 'fireball', 'crystal_guardian',
    ],
    relics: opts.relics || [],
  });
}

async function startFresh(opts) {
  const game = makeGame(opts);
  await game.start();
  return game;
}

function handOf(game, id) {
  return game.player.hand.find((c) => c.def.id === id);
}

{
  const game = await startFresh();
  ok(game.turn === 'player', 'first turn is player');
  ok(game.turnNo === 1, 'turnNo is 1 after first startTurn');
  ok(game.player.mana === 1 && game.player.manaMax === 1, 'first turn 1 mana');
  ok(game.player.hand.length === 5, 'mulligan 4 plus first-turn draw');
  ok(game.enemy.hand.length === 0, 'enemy startHand 0');
  ok(game.enemy.board.length === 1 && game.enemy.board[0].def.id === 'crystal_guardian', 'startBoard summoned');
  ok(game.enemy.board[0].sick === true && game.enemy.board[0].canAttack === false, 'startBoard no attack');
  ok(game.lockedIntent?.type === 'summon', 'first cycle slot is index 1 (summon), not 0');
  ok(game.lockedIntent?.cardId === 'ember_whelp', 'first intent summons ember_whelp');
  ok(!game.enemy.board[0].def.battlecry, 'guardian has no battlecry to skip');
  const snap = snapshotCombat(game);
  ok(snap.turn === 'player' && snap.turnNo === 1 && snap.player.hand.length === 5, 'snapshotCombat matches start');
  ok(snap.enemy.board[0].name === '水晶守卫' && snap.enemy.board[0].taunt, 'snapshot board taunt');
}

{
  const game = await startFresh({ relics: ['crystal_core', 'guardian_scale', 'sage_quill'] });
  ok(game.player.manaMax === 2 && game.player.mana === 2, 'crystal_core first turn 2 mana');
  ok(game.player.hero.armor === 4, 'guardian_scale armor 4');
  ok(game.player.hand.length === 6, 'sage_quill opening +1 then turn draw');
}

{
  const game = await startFresh();
  const wolf = mkInstance(CARDS.forest_wolf, 'player');
  game.player.hand.push(wolf);
  game.player.mana = 10;
  const played = await game.playCard(wolf);
  ok(played, 'play minion');
  ok(wolf.onBoard && wolf.sick && !wolf.canAttack, 'no charge stays sick');
  ok(wolf.attack === 3, 'wolf attack unchanged');
}

{
  const game = await startFresh({ relics: ['war_banner'] });
  const imp = mkInstance(CARDS.flame_imp, 'player');
  game.player.hand.push(imp);
  game.player.mana = 10;
  await game.playCard(imp);
  ok(imp.attack === 3, 'war_banner +1 on player summon');
}

{
  const game = await startFresh();
  const sam = mkInstance(CARDS.thunder_samurai, 'player');
  game.player.hand.push(sam);
  game.player.mana = 10;
  await game.playCard(sam);
  ok(sam.canAttack && !sam.sick, 'charge can attack');
  const taunts = game.validAttackTargets(sam);
  ok(taunts.length === 1 && taunts[0].def.id === 'crystal_guardian', 'taunt blocks face');
  ok(!taunts.includes(game.enemy.hero), 'hero not attackable through taunt');
}

{
  const game = await startFresh();
  const bolt = mkInstance(CARDS.lightning_bolt, 'player');
  game.player.hand.push(bolt);
  game.player.mana = 10;
  ok(game.needsTarget(bolt.def), 'bolt needs target');
  const targets = game.validTargets(bolt);
  ok(targets.includes(game.enemy.hero), 'spell can hit face through taunt');
  const hp = game.enemy.hero.hp;
  await game.playCard(bolt, { target: game.enemy.hero });
  ok(game.enemy.hero.hp === hp - 3, 'bolt deals 3');
}

{
  const game = await startFresh({ relics: ['void_lens'] });
  const bolt = mkInstance(CARDS.lightning_bolt, 'player');
  game.player.hand.push(bolt);
  game.player.mana = 10;
  const hp = game.enemy.hero.hp;
  await game.playCard(bolt, { target: game.enemy.hero });
  ok(game.enemy.hero.hp === hp - 4, 'void_lens +1 on player damage spell');
}

{
  const game = await startFresh();
  const storm = mkInstance(CARDS.flamestorm, 'player');
  game.player.hand.push(storm);
  game.player.mana = 10;
  await game.playCard(storm);
  ok(game.enemy.board.length === 1 && game.enemy.board[0].health === 1, 'flamestorm 4 leaves 5hp guardian at 1');
}

{
  const game = await startFresh();
  const storm = mkInstance(CARDS.flamestorm, 'player');
  game.player.hand.push(storm);
  game.player.mana = 10;
  game.enemy.board[0].health = 4;
  await game.playCard(storm);
  ok(game.enemy.board.length === 0, 'flamestorm 4 kills 4hp minion');
}

{
  const game = await startFresh();
  const heal = mkInstance(CARDS.healing_light, 'player');
  game.player.hand.push(heal);
  game.player.mana = 10;
  game.player.hero.hp = 30;
  await game.playCard(heal, { target: game.player.hero });
  ok(game.player.hero.hp === 35, 'heal 5');
}

{
  const game = await startFresh({ relics: ['thorn_sigil'] });
  const sam = mkInstance(CARDS.thunder_samurai, 'enemy');
  sam.onBoard = true;
  sam.canAttack = true;
  sam.sick = false;
  game.enemy.board.push(sam);
  game.turn = 'enemy';
  const hp = game.player.hero.hp;
  const atkHp = sam.health;
  await game.attack(sam, game.player.hero);
  ok(game.player.hero.hp === hp - 4, 'samurai hits face for 4');
  ok(sam.health === atkHp - 1 || sam.dead, 'thorn_sigil 1 to attacker');
}

{
  const game = await startFresh();
  game.player.hero.armor = 5;
  game.applyDamage(game.player.hero, 3);
  ok(game.player.hero.armor === 2 && game.player.hero.hp === 40, 'armor soaks first');
  game.applyDamage(game.player.hero, 4);
  ok(game.player.hero.armor === 0 && game.player.hero.hp === 38, 'overflow armor then hp');
}

{
  const game = await startFresh();
  game.player.deck = [];
  const hp = game.player.hero.hp;
  await game.draw('player');
  ok(game.fatigue.player === 1 && game.player.hero.hp === hp - 1, 'first fatigue 1');
  await game.draw('player');
  ok(game.fatigue.player === 2 && game.player.hero.hp === hp - 3, 'second fatigue 2');
}

{
  const game = await startFresh();
  while (game.player.hand.length < 10) {
    game.player.hand.push(mkInstance(CARDS.flame_imp, 'player'));
  }
  game.player.deck = [CARDS.forest_wolf];
  const discard = game.player.discard.length;
  await game.draw('player');
  ok(game.player.hand.length === 10, 'hand cap 10');
  ok(game.player.discard.length === discard + 1, 'burn goes to discard');
}

{
  const game = await startFresh();
  game.player.hero.hp = 0;
  game.enemy.hero.hp = 0;
  ok(game.checkWin() && game.winner === 'player', 'dual lethal player wins');
  ok(game.turn === 'none' && game.over, 'over sets turn none');
  ok(game.checkWin() === true, 'checkWin after over still true');
}

{
  const game = await startFresh();
  const before = game.fx.calls.filter((n) => n === 'gameOver').length;
  game.player.hero.hp = 0;
  await game.announceWin();
  await game.announceWin();
  const after = game.fx.calls.filter((n) => n === 'gameOver').length;
  ok(after === before + 1, 'announceWin fires gameOver once');
}

{
  const game = await startFresh();
  await game.resolveIntent({ type: 'attack', value: 4, label: '斩 4' });
  ok(game.player.hero.hp === 36, 'intent attack ignores taunt');
  await game.resolveIntent({ type: 'defend', value: 5, label: '甲 5' });
  ok(game.enemy.hero.armor === 5, 'intent defend');
  await game.resolveIntent({ type: 'summon', value: 1, cardId: 'ember_whelp', label: '唤崽' });
  ok(game.enemy.board.some((m) => m.def.id === 'ember_whelp'), 'intent summon');
  const whelp = game.enemy.board.find((m) => m.def.id === 'ember_whelp');
  ok(whelp.sick && !whelp.canAttack, 'intent summon no battlecry and sick');
}

{
  const game = await startFresh();
  game.turnNo = 1;
  const a = computeIntent(game);
  ok(a.type === 'summon', 'computeIntent turn 1 uses cycle[1]');
  game.turnNo = 0;
  const b = computeIntent(game);
  ok(b.type === 'attack' && b.value === 4, 'computeIntent turn 0 uses cycle[0]');
  game.turnNo = 3;
  const c = computeIntent(game);
  ok(c.type === 'attack' && c.value === 4, 'computeIntent turn 3 wraps to cycle[0]');
}

{
  const game = await startFresh();
  const cheap = handOf(game, 'flame_imp') || mkInstance(CARDS.flame_imp, 'player');
  if (!game.player.hand.includes(cheap)) game.player.hand.push(cheap);
  game.player.mana = 0;
  ok(game.playBlockReason(cheap) === '法力水晶不足！', 'block mana');
  game.player.mana = 10;
  game.turn = 'enemy';
  ok(game.playBlockReason(cheap) === '还没轮到你行动', 'block wrong turn');
  game.turn = 'player';
  game.over = true;
  ok(game.playBlockReason(cheap) === '对局已结束', 'block over');
}

{
  const game = await startFresh();
  for (let i = 0; i < 6; i++) {
    const m = mkInstance(CARDS.flame_imp, 'player');
    m.onBoard = true;
    game.player.board.push(m);
  }
  const extra = mkInstance(CARDS.forest_wolf, 'player');
  game.player.hand.push(extra);
  game.player.mana = 10;
  ok(game.playBlockReason(extra) === '战场已经满员了！', 'block full board');
}

{
  const game = await startFresh();
  const zero = mkInstance(CARDS.flame_imp, 'player');
  zero.onBoard = true;
  zero.attack = 0;
  zero.canAttack = false;
  game.player.board.push(zero);
  game.player.mana = 10;
  await game.startTurn('player');
  ok(zero.canAttack === false, '0-attack does not wake');
}

{
  const game = await startFresh();
  ok(game.spellDamage(6) === 6, 'spellDamage no lens');
  game.relics = ['void_lens'];
  ok(game.spellDamage(6) === 7, 'spellDamage with lens');
}

{
  const game = await startFresh();
  game.player.hero.hp = 20;
  const priest = mkInstance(CARDS.ward_priest, 'player');
  game.player.hand.push(priest);
  game.player.mana = 10;
  await game.playCard(priest);
  ok(game.player.hero.hp === 24, 'ward_priest battlecry heals 4');
}

{
  const game = await startFresh();
  const pal = mkInstance(CARDS.dawn_paladin, 'player');
  game.player.hand.push(pal);
  game.player.mana = 10;
  await game.playCard(pal);
  ok(game.player.hero.armor === 4 && pal.taunt, 'dawn_paladin armor 4 taunt');
}

{
  const game = await startFresh();
  const twin = mkInstance(CARDS.twin_shade, 'player');
  game.player.hand.push(twin);
  game.player.mana = 10;
  await game.playCard(twin);
  ok(game.player.board.length === 2, 'twin_shade summons shade');
  ok(game.player.board.some((m) => m.def.id === 'shade_whelp'), 'shade_whelp token');
}

{
  const game = await startFresh();
  const echo = mkInstance(CARDS.echo_mage, 'player');
  echo.onBoard = true;
  echo.health = 0;
  game.player.board.push(echo);
  const hand = game.player.hand.length;
  const deckN = game.player.deck.length;
  await game.checkDeaths();
  ok(!game.player.board.includes(echo), 'echo_mage leaves board');
  ok(game.player.hand.length === hand + 1 || deckN === 0, 'echo_mage deathrattle draws');
}

{
  const game = await startFresh();
  const chap = mkInstance(CARDS.silver_chaplain, 'player');
  chap.onBoard = true;
  chap.canAttack = true;
  chap.sick = false;
  game.player.board.push(chap);
  game.player.hero.hp = 20;
  game.turn = 'player';
  const taunt = game.enemy.board[0];
  await game.attack(chap, taunt);
  ok(game.player.hero.hp === 23, 'lifesteal heals equal to attack');
}

{
  const game = await startFresh();
  game.player.hero.hp = 20;
  const siphon = mkInstance(CARDS.void_siphon, 'player');
  game.player.hand.push(siphon);
  game.player.mana = 10;
  const foe = game.enemy.hero.hp;
  await game.playCard(siphon);
  ok(game.enemy.hero.hp === foe - 3, 'siphon deals 3 to enemy hero');
  ok(game.player.hero.hp === 22, 'siphon heals 2');
}

{
  const game = await startFresh();
  game.player.hero.hp = 20;
  const ward = mkInstance(CARDS.sanctuary, 'player');
  game.player.hand.push(ward);
  game.player.mana = 10;
  await game.playCard(ward);
  ok(game.player.hero.armor === 4 && game.player.hero.hp === 23, 'sanctuary 4 armor + heal 3');
}

if (fails.length) {
  console.error('FAIL\n' + fails.join('\n'));
  process.exit(1);
}
console.log('OK', {
  checks: 'combat pin',
  firstIntent: 'summon/ember_whelp at turnNo 1',
});
