export const TUTORIAL_PHASES = ['goal', 'hp', 'mana', 'hand', 'skill', 'play', 'attack', 'end'];

export const STATIC_STEPS = {
  goal: {
    id: 'goal',
    title: '胜负',
    body: '打掉对面英雄的生命就赢。你归零则败。',
    wait: 'continue',
    focus: ['phero', 'ehero'],
    dock: 'left',
  },
  hp: {
    id: 'hp',
    title: '生命',
    body: '头像旁的血球是生命。左下角面板也会同步。',
    wait: 'continue',
    focus: ['php', 'ehp', 'hudhp'],
    dock: 'left',
  },
  mana: {
    id: 'mana',
    title: '能量',
    body: '右下角蓝水晶是法力。每回合上限 +1，并回满。',
    wait: 'continue',
    focus: ['mana'],
    dock: 'left',
  },
  hand: {
    id: 'hand',
    title: '手牌',
    body: '底部是你的手牌。左上角是费用，发绿光的现在打得出。',
    wait: 'continue',
    focus: ['hand'],
    dock: 'top',
  },
  skill: {
    id: 'skill',
    title: '敌方技能',
    body: '敌人头像旁的圆标，是他下回合要做的事。悬停可看详情。',
    wait: 'continue',
    focus: ['skill'],
    dock: 'left',
  },
  end: {
    id: 'end',
    title: '结束回合',
    body: '点右侧金色符印，或按空格。对手会先结算预兆。',
    wait: 'endturn',
    focus: ['endturn'],
    dock: 'left',
  },
};

export function firstPlayable(game) {
  const hand = game?.player?.hand;
  if (!hand?.length || !game.canPlay) return [];
  return hand.filter((inst) => game.canPlay(inst));
}

export function readyAttackers(game) {
  return (game?.player?.board || []).filter((m) => m.canAttack && m.attack > 0);
}

function playKind(inst, game) {
  if (inst.def.type === 'minion') return 'minion';
  if (game.needsTarget?.(inst.def)) return 'target';
  return 'spell';
}

export function playCoach(playable, game) {
  if (!playable.length) {
    return {
      id: 'play-skip',
      title: '费用',
      body: '费用不够就打不出。下回合能量会更多。',
      wait: 'continue',
      focus: ['hand', 'mana'],
      dock: 'top',
    };
  }
  const kinds = new Set(playable.map((inst) => playKind(inst, game)));
  const uids = playable.map((inst) => inst.uid);
  if (kinds.size === 1 && kinds.has('minion')) {
    return {
      id: 'play',
      title: '出牌',
      body: '按住发光手牌，拖到己方战场松开，即可召唤。',
      wait: 'play',
      focus: ['hand', 'lane'],
      dock: 'top',
      uids,
    };
  }
  if (kinds.size === 1 && kinds.has('target')) {
    return {
      id: 'play',
      title: '出牌',
      body: '点发光法术，再拖向对面头像或发光目标。',
      wait: 'play',
      focus: ['hand', 'ehero'],
      dock: 'top',
      uids,
    };
  }
  if (kinds.size === 1 && kinds.has('spell')) {
    return {
      id: 'play',
      title: '出牌',
      body: '把发光法术拖向战场中央，松开施放。',
      wait: 'play',
      focus: ['hand', 'lane'],
      dock: 'top',
      uids,
    };
  }
  return {
    id: 'play',
    title: '出牌',
    body: '拖发光手牌：随从放己方战场，法术拖向中央或指向目标。',
    wait: 'play',
    focus: ['hand', 'lane'],
    dock: 'top',
    uids,
  };
}

export function attackCoach(game) {
  const ready = readyAttackers(game);
  if (ready.length) {
    const taunt = (game.enemy?.board || []).some((m) => m.taunt);
    return {
      id: 'attack',
      title: '交战',
      body: taunt
        ? '有嘲讽时必须先打嘲讽。拖随从指向目标，松开攻击。'
        : '拖己方随从指向敌人头像，松开即可攻击。',
      wait: 'attack',
      focus: ['pminion', 'ehero'],
      dock: 'left',
      uids: ready.map((m) => m.uid),
    };
  }
  const hasBoard = (game.player?.board || []).length > 0;
  const sick = (game.player?.board || []).some((m) => m.sick);
  return {
    id: sick ? 'sick' : 'attack-later',
    title: '交战',
    body: sick
      ? '随从入场当回合不能打，除非带「冲锋」。'
      : '场上的随从可以拖向敌人交战。有嘲讽要先打嘲讽。',
    wait: 'continue',
    focus: hasBoard ? ['pminion', 'ehero'] : ['lane', 'ehero'],
    dock: 'left',
  };
}

export function stepForPhase(phase, game) {
  if (phase === 'play') return playCoach(firstPlayable(game), game);
  if (phase === 'attack') return attackCoach(game);
  return STATIC_STEPS[phase] || null;
}

export function gateForStep(step) {
  if (!step) return null;
  if (step.wait === 'play') {
    return { play: true, uids: step.uids || null, hint: '先打出高亮的手牌' };
  }
  if (step.wait === 'attack') {
    return { attack: true, uids: step.uids || null, hint: '先拖随从去攻击' };
  }
  if (step.wait === 'endturn') {
    return { endTurn: true, hint: '先结束回合，或点继续' };
  }
  return null;
}

export function nextPhase(phase) {
  const i = TUTORIAL_PHASES.indexOf(phase);
  if (i < 0 || i >= TUTORIAL_PHASES.length - 1) return null;
  return TUTORIAL_PHASES[i + 1];
}
