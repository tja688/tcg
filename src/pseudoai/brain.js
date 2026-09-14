import { getPseudoAI } from './session.js';
import { fakeThink } from './think.js';
import { describeTarget } from './snapshot.js';
import {
  chooseAttackTarget,
  choosePlay,
  makeAttackIntent,
  makePlayIntent,
  pickAttacker,
} from './tactics.js';

const SUCCESS = 'success';
const FAILURE = 'failure';

async function repeatUntilFail(tick, guard = 28) {
  let n = 0;
  while (n++ < guard) {
    const st = await tick();
    if (st !== SUCCESS) return;
  }
}

export async function runAI(game) {
  const hud = game.fx?.hud;
  const session = getPseudoAI();
  let first = true;

  await repeatUntilFail(async () => {
    if (game.over) return FAILURE;
    const playable = game.enemy.hand.filter((c) => game.canPlay(c));
    if (!playable.length) return FAILURE;
    const pick = choosePlay(game, playable);
    if (!pick) return FAILURE;
    await fakeThink(hud, 'play', first, {
      game,
      session,
      intent: makePlayIntent(pick),
    });
    first = false;
    if (game.over) return FAILURE;
    const ok = await game.playCard(pick.inst, { slot: pick.slot, target: pick.target });
    if (!ok) return FAILURE;
    void session?.onActed(game, {
      type: 'play',
      card: pick.inst.def?.name,
      cardType: pick.inst.def?.type,
      targetName: describeTarget(pick.target),
    });
    return game.over ? FAILURE : SUCCESS;
  });

  await repeatUntilFail(async () => {
    if (game.over) return FAILURE;
    const ready = game.enemy.board.filter((m) => m.canAttack && m.attack > 0);
    if (!ready.length) return FAILURE;
    const attacker = pickAttacker(game, ready);
    const targets = game.validAttackTargets(attacker);
    if (!targets.length) { attacker.canAttack = false; return SUCCESS; }
    const target = chooseAttackTarget(game, attacker, targets);
    await fakeThink(hud, 'attack', first, {
      game,
      session,
      intent: makeAttackIntent(attacker, target),
    });
    first = false;
    if (game.over) return FAILURE;
    const ok = await game.attack(attacker, target);
    if (!ok) { attacker.canAttack = false; return SUCCESS; }
    void session?.onActed(game, {
      type: target.kind === 'minion' && target.health <= 0 ? 'kill' : 'attack',
      attackerName: attacker.def?.name,
      targetName: describeTarget(target),
      name: target.def?.name,
      lethal: target.kind === 'hero' && target.hp <= 0,
    });
    return game.over ? FAILURE : SUCCESS;
  });

  if (!game.over) await game.endTurn('enemy');
}
