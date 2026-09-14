import { createBanter } from './banter.js';
import { describeTarget } from './snapshot.js';
import { llmStatus } from './llm.js';

let current = null;

export function getPseudoAI() {
  return current;
}

export function detachPseudoAI() {
  current?.dispose();
  current = null;
}

export function attachPseudoAI({ hud, director, encounter }) {
  detachPseudoAI();
  const banter = createBanter({ hud, director });
  banter.bind(encounter);

  const session = {
    hud,
    director,
    banter,
    encounter,
    async prepare() {
      return banter.prepare();
    },
    dispose() {
      hud?.showLlmThink?.('');
      banter.dispose();
    },
    async onTurnStart(game) {
      return banter.speak(game, { type: 'turn_start', turnNo: game.turnNo });
    },
    async speakThink(game, intent) {
      return banter.speakThink(game, intent);
    },
    async onActed(game, ev) {
      return banter.speak(game, ev);
    },
    notify(game, ev) {
      if (!game || !ev) return;
      const rich = enrich(game, ev);
      void banter.speak(game, rich);
    },
    debug() {
      return {
        name: banter.persona.name,
        llm: llmStatus(),
      };
    },
  };
  current = session;
  return session;
}

function enrich(game, ev) {
  if (ev.type === 'play' && ev.inst) {
    return {
      ...ev,
      card: ev.inst.def?.name,
      cardType: ev.inst.def?.type,
      targetName: describeTarget(ev.target),
    };
  }
  if (ev.type === 'attack') {
    return {
      ...ev,
      attackerName: ev.attacker?.def?.name,
      targetName: describeTarget(ev.target),
      lethal: !!(ev.target && (
        (ev.target.kind === 'hero' && ev.target.hp <= 0)
        || (ev.target.kind === 'minion' && ev.target.health <= 0)
      )),
    };
  }
  return ev;
}

export function notifyPseudoAI(game, ev) {
  current?.notify(game, ev);
}
