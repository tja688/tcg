/** 语义 cue 表。音量用 dB，interval 防连打，variants 做轻微去重复。 */
export const CUES = {
  'ui.hover':           { clip: 'ui_hover', vol: -10, interval: 0.12, bus: 'ui', pitch: 0.02, synth: 'hover' },
  'ui.press':           { clip: 'ui_click', vol: -5, interval: 0.04, bus: 'ui', synth: 'click' },
  'ui.confirm':         { clip: 'ui_confirm', vol: -2, interval: 0.05, bus: 'ui', synth: 'click' },
  'ui.cancel':          { clip: 'ui_cancel', vol: -6, interval: 0.08, bus: 'ui', synth: 'click' },
  'ui.reject':          { clip: 'ui_reject', vol: -6, interval: 0.15, bus: 'ui', synth: 'error' },
  'ui.toggle':          { clip: 'ui_tick', vol: -6, interval: 0.05, bus: 'ui', synth: 'click' },
  'ui.menu.open':       { clip: 'ui_menu', vol: -5, interval: 0.12, bus: 'ui', synth: 'click' },
  'ui.page':            { clip: 'ui_page', vol: -5, interval: 0.08, bus: 'ui', synth: 'draw' },
  'ui.start':           { clip: 'unlock', vol: -3, interval: 0.2, bus: 'ui', synth: 'chime' },
  'ui.soft':            { clip: 'ui_soft', vol: -8, interval: 0.06, bus: 'ui', synth: 'click' },

  'card.hand.hover':    { clip: 'card_hover', vol: -9, interval: 0.12, bus: 'ui', pitch: 0.03, synth: 'hover' },
  'card.ground.hover':  { clip: 'card_hover', vol: -11, interval: 0.14, bus: 'ui', pitch: 0.04, synth: 'hover' },
  'card.select':        { clip: 'card_select', vol: -5, interval: 0.05, bus: 'ui', synth: 'click' },
  'card.drag.pickup':   { clip: 'card_pickup', vol: -4, interval: 0.04, bus: 'ui', pitch: 0.04, synth: 'pickup' },
  'card.drag.drop':     { clip: 'card_slide', vol: -10, interval: 0.04, bus: 'ui', synth: 'draw' },
  'card.drag.return':   { clip: 'card_hand', vol: -7, interval: 0.08, bus: 'ui', synth: 'place' },
  'card.drag.valid':    { clip: 'card_place', vol: -3, interval: 0.05, bus: 'combat', synth: 'place' },
  'card.lifecycle.deal': { clip: 'card_deal', vol: -5, interval: 0.05, bus: 'sfx', pitch: 0.04, synth: 'draw' },
  'card.lifecycle.draw': { clip: 'card_draw', vol: -5, interval: 0.05, bus: 'sfx', pitch: 0.05, synth: 'draw' },
  'card.lifecycle.shuffle': { clip: 'shuffle', vol: -3, interval: 0.2, bus: 'sfx', synth: 'draw' },
  'card.lifecycle.into_hand': { clip: 'card_hand', vol: -6, interval: 0.05, bus: 'sfx', synth: 'place' },
  'card.lifecycle.into_field': { clip: 'card_place', vol: -3, interval: 0.05, bus: 'combat', synth: 'place' },
  'card.lifecycle.flip': { clip: 'card_flip', vol: -4, interval: 0.04, bus: 'sfx', pitch: 0.03, synth: 'reveal' },
  'card.lifecycle.move': { clip: 'card_slide', vol: -7, interval: 0.06, bus: 'sfx', synth: 'draw' },
  'card.lifecycle.shatter': { clip: 'card_shatter', vol: -2, interval: 0.08, bus: 'combat', synth: 'burn' },
  'card.lifecycle.exit': { clip: 'card_exit', vol: -6, interval: 0.08, bus: 'sfx', synth: 'death' },

  'battle.attack.prepare': {
    vol: -5, interval: 0.08, bus: 'combat', pitch: 0.07, synth: 'whoosh',
    variants: [
      { clip: 'swing', w: 1 },
      { clip: 'swing_a', w: 1 },
      { clip: 'swing_b', w: 1 },
      { clip: 'swing_c', w: 1 },
      { clip: 'whoosh', w: 1 },
    ],
  },
  'battle.attack.charge': { clip: 'effort', vol: -8, interval: 0.05, bus: 'combat', synth: 'pickup' },
  'battle.attack.hit': {
    vol: -3, interval: 0.05, bus: 'combat', pitch: 0.06, synth: 'hit',
    variants: [
      { clip: 'card_strike', w: 2 },
      { clip: 'slash', w: 2 },
      { clip: 'sword', w: 1 },
      { clip: 'sword_b', w: 1 },
    ],
  },
  'battle.combat.block': { clip: 'armor_block', vol: -3, interval: 0.05, bus: 'combat', synth: 'hit' },
  'battle.combat.armor_absorb': { clip: 'hit_armor', vol: -4, interval: 0.05, bus: 'combat', pitch: 0.04, synth: 'hit' },
  'battle.combat.hp_damage': { clip: 'hit_flesh', vol: -4, interval: 0.04, bus: 'combat', pitch: 0.05, synth: 'hit' },
  'battle.combat.heal': { clip: 'heal', vol: -3, interval: 0.08, bus: 'combat', synth: 'chime' },
  'battle.combat.armor_gain': { clip: 'armor_gain', vol: -5, interval: 0.1, bus: 'combat', synth: 'chime' },
  'battle.combat.death': { clip: 'death', vol: -2, interval: 0.1, bus: 'combat', synth: 'death' },

  'sfx.spell.cast': { clip: 'cast', vol: -3, interval: 0.06, bus: 'combat', synth: 'cast' },
  'sfx.spell.prep': { clip: 'spell_prep', vol: -3, interval: 0.08, bus: 'combat', synth: 'cast' },
  'sfx.spell.fire': { clip: 'fireball', vol: -2, interval: 0.08, bus: 'combat', pitch: 0.04, synth: 'boom' },
  'sfx.spell.lightning': { clip: 'lightning', vol: -2, interval: 0.08, bus: 'combat', synth: 'zap' },
  'sfx.spell.holy': { clip: 'holy', vol: -2, interval: 0.08, bus: 'combat', synth: 'zap' },
  'sfx.spell.shadow': { clip: 'shadow', vol: -3, interval: 0.08, bus: 'combat', synth: 'cast' },
  'sfx.spell.arcane': { clip: 'trigger', vol: -3, interval: 0.08, bus: 'combat', synth: 'cast' },
  'sfx.spell.explode': { clip: 'explosion', vol: -2, interval: 0.12, bus: 'combat', synth: 'boom' },
  'sfx.effect.buff': { clip: 'buff', vol: -3, interval: 0.08, bus: 'combat', synth: 'chime' },
  'sfx.effect.debuff': { clip: 'debuff', vol: -3, interval: 0.08, bus: 'combat', synth: 'cast' },
  'sfx.effect.trigger': { clip: 'trigger', vol: -3, interval: 0.08, bus: 'combat', synth: 'cast' },
  'sfx.effect.rumble': { clip: 'rumble', vol: -3, interval: 0.2, bus: 'combat', synth: 'rumble' },
  'sfx.effect.roar': { clip: 'rumble', vol: -1, interval: 0.2, bus: 'combat', synth: 'roar' },
  'sfx.effect.whoosh': { clip: 'whoosh', vol: -6, interval: 0.06, bus: 'combat', pitch: 0.08, synth: 'whoosh' },
  'sfx.relic.trigger': { clip: 'relic', vol: -4, interval: 0.1, bus: 'sfx', synth: 'chime' },

  'flow.transition': { clip: 'transition', vol: -4, interval: 0.18, bus: 'sfx', synth: 'whoosh' },
  'flow.map': { clip: 'ui_menu', vol: -6, interval: 0.2, bus: 'sfx', synth: 'click' },
  'flow.shop.enter': { clip: 'ui_menu', vol: -4, interval: 0.15, bus: 'sfx', synth: 'click' },
  'flow.event': { clip: 'event', vol: -3, interval: 0.15, bus: 'sfx', synth: 'reveal' },
  'flow.rest': { clip: 'potion', vol: -4, interval: 0.15, bus: 'sfx', synth: 'chime' },
  'flow.treasure': { clip: 'chest', vol: -3, interval: 0.15, bus: 'sfx', synth: 'chime' },
  'flow.reward': { clip: 'reward', vol: -3, interval: 0.15, bus: 'sfx', synth: 'chime' },
  'flow.combat.start': { clip: 'shuffle_short', vol: -4, interval: 0.3, bus: 'sfx', synth: 'draw' },
  'flow.combat.elite': { clip: 'weapon', vol: -3, interval: 0.3, bus: 'combat', synth: 'rumble' },
  'flow.combat.boss': { clip: 'rumble', vol: -1, interval: 0.3, bus: 'combat', synth: 'roar' },
  'flow.turn.player': { clip: 'ui_confirm', vol: -4, interval: 0.4, bus: 'sfx', synth: 'turnP' },
  'flow.turn.enemy': { clip: 'ui_soft', vol: -6, interval: 0.4, bus: 'sfx', synth: 'turnE' },
  'flow.victory.combat': { clip: 'victory_combat', vol: -2, interval: 0.4, bus: 'sfx', synth: 'victory' },
  'flow.victory.boss': { clip: 'victory_boss', vol: -2, interval: 0.4, bus: 'sfx', synth: 'victory' },
  'flow.victory.run': { clip: 'victory_run', vol: -1, interval: 0.4, bus: 'sfx', synth: 'victory' },
  'flow.defeat': { clip: 'defeat', vol: -2, interval: 0.4, bus: 'sfx', synth: 'defeat' },
  'flow.abandon': { clip: 'abandon', vol: -4, interval: 0.2, bus: 'sfx', synth: 'defeat' },
  'flow.intent': { clip: 'rumble', vol: -6, interval: 0.25, bus: 'combat', synth: 'rumble' },
  'flow.room.clear': { clip: 'room_clear', vol: -3, interval: 0.3, bus: 'sfx', synth: 'chime' },

  'avatar.walk.step': {
    vol: -8, interval: 0.16, bus: 'ui', pitch: 0.08, synth: 'click',
    variants: [
      { clip: 'step_a', w: 1 },
      { clip: 'step_b', w: 1 },
      { clip: 'step_c', w: 1 },
    ],
  },

  'shop.buy': { clip: 'buy', vol: -2, interval: 0.08, bus: 'sfx', synth: 'chime' },
  'shop.refresh': { clip: 'ui_page', vol: -4, interval: 0.08, bus: 'ui', synth: 'draw' },
  'shop.remove': { clip: 'sell', vol: -3, interval: 0.08, bus: 'sfx', synth: 'chime' },
  'shop.insufficient': { clip: 'fail_bell', vol: -10, interval: 0.2, bus: 'ui', synth: 'error' },
  'reward.claim': { clip: 'card_deal', vol: -3, interval: 0.1, bus: 'sfx', synth: 'chime' },
  'reward.abandon': { clip: 'abandon', vol: -5, interval: 0.08, bus: 'sfx', synth: 'error' },
  'reward.relic': { clip: 'rare_get', vol: -2, interval: 0.12, bus: 'sfx', synth: 'chime' },
  'rest.heal': { clip: 'heal', vol: -3, interval: 0.1, bus: 'sfx', synth: 'chime' },
  'economy.gold_gain': {
    vol: -3, interval: 0.04, bus: 'sfx', pitch: 0.07, synth: 'chime',
    variants: [
      { clip: 'coin_ding', w: 2 },
      { clip: 'coin_ding', w: 1, trim: -1 },
    ],
  },
  'economy.gold_spend': { clip: 'coin_drop', vol: -5, interval: 0.05, bus: 'sfx', synth: 'click' },
};

export function allClipKeys() {
  const keys = new Set();
  for (const cue of Object.values(CUES)) {
    if (cue.clip) keys.add(cue.clip);
    for (const v of cue.variants || []) {
      if (v.clip) keys.add(v.clip);
    }
  }
  return [...keys];
}

export function pickVariant(cue, rng = Math.random) {
  const list = cue.variants;
  if (!list?.length) return { clip: cue.clip, trim: 0 };
  let total = 0;
  for (const v of list) total += v.w || 1;
  let t = rng() * total;
  for (const v of list) {
    t -= v.w || 1;
    if (t <= 0) return v;
  }
  return list[list.length - 1];
}
