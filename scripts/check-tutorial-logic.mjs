import {
  TUTORIAL_STORAGE_KEY,
  isTutorialDone,
  markTutorialDone,
  memoryStorage,
  resetTutorialProgress,
  shouldArmTutorial,
} from '../src/ui/tutorialStore.js';
import {
  STATIC_STEPS,
  TUTORIAL_PHASES,
  attackCoach,
  firstPlayable,
  gateForStep,
  nextPhase,
  playCoach,
  readyAttackers,
  stepForPhase,
} from '../src/ui/tutorialFlow.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

{
  const mem = memoryStorage();
  ok(shouldArmTutorial(mem) === true, 'empty storage arms tutorial');
  ok(isTutorialDone(mem) === false, 'empty storage is not done');
  markTutorialDone(mem);
  ok(mem.getItem(TUTORIAL_STORAGE_KEY) === '1', 'done flag is 1');
  ok(shouldArmTutorial(mem) === false, 'done storage does not arm');
  resetTutorialProgress(mem);
  ok(shouldArmTutorial(mem) === true, 'reset re-arms for next run');
}

{
  ok(TUTORIAL_PHASES.join('>') === 'goal>hp>mana>hand>skill>play>attack>end', 'phase order');
  ok(nextPhase('goal') === 'hp', 'goal goes to hp');
  ok(nextPhase('end') === null, 'end is last');
  ok(STATIC_STEPS.skill.body.includes('悬停'), 'skill step mentions hover');
  ok(STATIC_STEPS.mana.body.includes('法力'), 'mana step names mana');
  for (const step of Object.values(STATIC_STEPS)) {
    ok(step.body.length <= 36, `${step.id} copy stays short`);
  }
}

function mockGame({ hand = [], board = [], eboard = [] } = {}) {
  return {
    player: { hand, board },
    enemy: { board: eboard },
    canPlay: (inst) => inst.playable !== false,
    needsTarget: (def) => !!def.spell?.target && def.spell.target !== 'none',
  };
}

{
  const minion = { uid: 1, playable: true, def: { type: 'minion', name: '烈焰小鬼' } };
  const bolt = {
    uid: 2, playable: true,
    def: { type: 'spell', name: '圣击', spell: { target: 'enemy-any' } },
  };
  const free = {
    uid: 3, playable: true,
    def: { type: 'spell', name: '奥术智慧', spell: { target: 'none' } },
  };
  const costly = { uid: 4, playable: false, def: { type: 'minion', name: '远古巨龙' } };

  ok(firstPlayable(mockGame({ hand: [costly] })).length === 0, 'unplayable hand is empty');
  const skip = playCoach([], mockGame());
  ok(skip.wait === 'continue' && skip.id === 'play-skip', 'no playable card skips play');

  const m = playCoach([minion], mockGame({ hand: [minion] }));
  ok(m.wait === 'play' && m.body.includes('战场'), 'minion play asks for board drop');
  ok(gateForStep(m).play === true, 'play step gates to cards');

  const t = playCoach([bolt], mockGame({ hand: [bolt] }));
  ok(t.body.includes('目标') || t.body.includes('头像'), 'targeted spell mentions aim');
  ok(t.focus.includes('ehero'), 'targeted spell highlights enemy');

  const s = playCoach([free], mockGame({ hand: [free] }));
  ok(s.body.includes('中央'), 'free spell asks for center cast');

  const mix = playCoach([minion, bolt], mockGame({ hand: [minion, bolt] }));
  ok(mix.wait === 'play' && mix.uids.includes(1) && mix.uids.includes(2), 'mixed playables all allowed');
}

{
  const ready = { uid: 9, canAttack: true, attack: 2, sick: false };
  const rest = { uid: 8, canAttack: false, attack: 1, sick: true };
  const taunt = { uid: 7, taunt: true };

  ok(readyAttackers(mockGame({ board: [rest] })).length === 0, 'sick minion is not ready');
  const hit = attackCoach(mockGame({ board: [ready] }));
  ok(hit.wait === 'attack' && hit.body.includes('拖'), 'ready attacker asks for drag');
  ok(gateForStep(hit).attack === true, 'attack step gates combat');

  const wall = attackCoach(mockGame({ board: [ready], eboard: [taunt] }));
  ok(wall.body.includes('嘲讽'), 'taunt is called out');

  const wait = attackCoach(mockGame({ board: [rest] }));
  ok(wait.wait === 'continue' && wait.id === 'sick', 'summoning sickness is explained');

  const later = attackCoach(mockGame());
  ok(later.wait === 'continue' && later.body.includes('嘲讽'), 'empty board still teaches combat');
}

{
  const play = stepForPhase('play', mockGame({
    hand: [{ uid: 1, playable: true, def: { type: 'minion' } }],
  }));
  ok(play.id === 'play', 'play phase builds live coach');
  const end = stepForPhase('end');
  ok(end.wait === 'endturn' && gateForStep(end).endTurn === true, 'end step waits for end turn');
  ok(gateForStep(STATIC_STEPS.goal) === null, 'info steps have no input gate');
}

if (fails.length) {
  console.error('FAIL\n' + fails.join('\n'));
  process.exit(1);
}
console.log('OK', { checks: 'tutorial store flow gates' });
