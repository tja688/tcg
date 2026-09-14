export const CLIP_BASE = '/assets/audio/sfx/';
export const BGM_BASE = '/assets/audio/bgm/';

export const BGM_FILES = {
  title: 'the_mountain-cinematic-legend-139493.mp3',
  explore: 'ebunny-legend-acoustic-378544.mp3',
  combat: 'the_mountain-war-legend-136947.mp3',
};

export const BGM_KEYS = Object.keys(BGM_FILES);

export function bgmUrl(key) {
  const file = BGM_FILES[key];
  return file ? BGM_BASE + file : '';
}

export function allBgmUrls() {
  return BGM_KEYS.map((k) => bgmUrl(k));
}

export function bgmKeyForFile(filename) {
  return BGM_KEYS.find((k) => BGM_FILES[k] === filename) || '';
}

export const CLIPS = {
  card_hover: 'card_hover.wav',
  card_select: 'card_select.mp3',
  card_pickup: 'card_pickup.mp3',
  card_slide: 'card_slide.mp3',
  card_place: 'card_place.mp3',
  card_hand: 'card_hand.wav',
  card_deal: 'card_deal.mp3',
  card_draw: 'card_draw.wav',
  shuffle: 'shuffle.wav',
  shuffle_short: 'shuffle_short.wav',
  card_flip: 'card_flip.wav',
  card_shatter: 'card_shatter.mp3',
  card_exit: 'card_exit.mp3',
  card_strike: 'card_strike.wav',
  whoosh: 'whoosh.mp3',
  swing: 'swing.mp3',
  swing_a: 'swing_a.mp3',
  swing_b: 'swing_b.mp3',
  swing_c: 'swing_c.mp3',
  effort: 'effort.mp3',
  slash: 'slash.wav',
  sword: 'sword.mp3',
  sword_b: 'sword_b.mp3',
  hit_flesh: 'hit_flesh.wav',
  hit_armor: 'hit_armor.wav',
  armor_block: 'armor_block.mp3',
  armor_gain: 'armor_gain.mp3',
  death: 'death.mp3',
  fireball: 'fireball.mp3',
  lightning: 'lightning.mp3',
  zap: 'zap.mp3',
  holy: 'holy.mp3',
  spell_prep: 'spell_prep.mp3',
  cast: 'cast.mp3',
  explosion: 'explosion.wav',
  buff: 'buff.mp3',
  debuff: 'debuff.mp3',
  trigger: 'trigger.mp3',
  rumble: 'rumble.mp3',
  relic: 'relic.mp3',
  shadow: 'shadow.mp3',
  weapon: 'weapon.mp3',
  ui_hover: 'ui_hover.wav',
  ui_click: 'ui_click.wav',
  ui_confirm: 'ui_confirm.mp3',
  ui_reject: 'ui_reject.wav',
  ui_cancel: 'ui_cancel.wav',
  ui_page: 'ui_page.wav',
  ui_menu: 'ui_menu.wav',
  ui_soft: 'ui_soft.wav',
  fail_bell: 'fail_bell.mp3',
  ui_tick: 'ui_tick.mp3',
  transition: 'transition.mp3',
  victory_run: 'victory_run.mp3',
  defeat: 'defeat.mp3',
  victory_combat: 'victory_combat.mp3',
  victory_boss: 'victory_boss.mp3',
  reward: 'reward.wav',
  unlock: 'unlock.mp3',
  abandon: 'abandon.mp3',
  room_clear: 'room_clear.mp3',
  event: 'event.mp3',
  chest: 'chest.mp3',
  rare_get: 'rare_get.mp3',
  heal: 'heal.mp3',
  potion: 'potion.mp3',
  coin_ding: 'coin_ding.mp3',
  coin_drop: 'coin_drop.wav',
  buy: 'buy.wav',
  sell: 'sell.mp3',
  upgrade: 'upgrade.mp3',
  step_a: 'step_a.mp3',
  step_b: 'step_b.mp3',
  step_c: 'step_c.mp3',
};

export function clipUrl(key) {
  const file = CLIPS[key];
  return file ? CLIP_BASE + file : '';
}
