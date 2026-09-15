import { shuffle } from '../utils/rng.js';

// 卡牌图鉴。加新卡：写 CARDS，登记 art，再放进配方、卡包或遭遇牌库。
// type: minion | spell
// keywords: taunt | charge | lifesteal
// battlecry: draw | aoe_enemy | damage_enemy_hero | heal_hero | armor | summon
// deathrattle: draw | summon | damage_enemy_hero
// spell.kind: damage | aoe_enemy | heal | draw | buff | debuff | armor | siphon | summon
// spell.target: enemy-any | friendly-any | friendly-minion | enemy-minion | none
export const CARDS = {
  flame_imp: {
    id: 'flame_imp', name: '烈焰小鬼', type: 'minion', cost: 1, attack: 2, health: 1,
    rarity: 'common', tribe: '恶魔',
    desc: '烈焰中降生的小捣蛋，见谁都想咬一口。', art: 'flame_imp', tint: 0xff7a33,
  },
  forest_wolf: {
    id: 'forest_wolf', name: '翡翠妖狼', type: 'minion', cost: 2, attack: 3, health: 2,
    rarity: 'common', tribe: '野兽',
    desc: '月光下的绿影，森林深处的獠牙。', art: 'forest_wolf', tint: 0x4ce08a,
  },
  crystal_guardian: {
    id: 'crystal_guardian', name: '水晶守卫', type: 'minion', cost: 3, attack: 2, health: 5,
    rarity: 'rare', tribe: '元素', keywords: ['taunt'],
    desc: '【嘲讽】敌人必须优先攻击它。', art: 'crystal_guardian', tint: 0x4da6ff,
  },
  shadow_assassin: {
    id: 'shadow_assassin', name: '暗影刺客', type: 'minion', cost: 3, attack: 4, health: 2,
    rarity: 'rare', tribe: '亡灵',
    desc: '从虚空的裂隙中现身，一击致命。', art: 'shadow_assassin', tint: 0xb45cff,
  },
  thunder_samurai: {
    id: 'thunder_samurai', name: '雷霆武士', type: 'minion', cost: 4, attack: 4, health: 3,
    rarity: 'epic', tribe: '武者', keywords: ['charge'],
    desc: '【冲锋】入场后立即可以发动攻击。', art: 'thunder_samurai', tint: 0x6fb6ff,
  },
  frost_elemental: {
    id: 'frost_elemental', name: '冰霜精灵', type: 'minion', cost: 4, attack: 3, health: 4,
    rarity: 'rare', tribe: '元素', battlecry: { type: 'draw', n: 1 },
    desc: '【战吼】抽一张牌。', art: 'frost_elemental', tint: 0x7fd8ff,
  },
  radiant_knight: {
    id: 'radiant_knight', name: '圣光骑士', type: 'minion', cost: 5, attack: 5, health: 5,
    rarity: 'epic', tribe: '人类', keywords: ['taunt'],
    desc: '【嘲讽】圣光庇护之下，坚不可摧。', art: 'radiant_knight', tint: 0xffd166,
  },
  ancient_dragon: {
    id: 'ancient_dragon', name: '远古巨龙', type: 'minion', cost: 7, attack: 8, health: 8,
    rarity: 'legendary', tribe: '巨龙', battlecry: { type: 'aoe_enemy', amount: 2 },
    desc: '【战吼】对所有敌方随从造成 2 点伤害。', art: 'ancient_dragon', tint: 0xff5040,
  },

  lightning_bolt: {
    id: 'lightning_bolt', name: '闪电之矢', type: 'spell', cost: 2,
    rarity: 'rare', spell: { kind: 'damage', amount: 3, target: 'enemy-any', vfx: 'lightning' },
    desc: '对一个敌方角色造成 3 点伤害。', art: 'lightning_bolt', tint: 0x7fd0ff,
  },
  healing_light: {
    id: 'healing_light', name: '治愈圣光', type: 'spell', cost: 2,
    rarity: 'common', spell: { kind: 'heal', amount: 5, target: 'friendly-any', vfx: 'heal' },
    desc: '为一个友方角色恢复 5 点生命值。', art: 'healing_light', tint: 0xffe08a,
  },
  arcane_wisdom: {
    id: 'arcane_wisdom', name: '奥术智慧', type: 'spell', cost: 3,
    rarity: 'rare', spell: { kind: 'draw', n: 2, target: 'none', vfx: 'arcane' },
    desc: '抽两张牌。', art: 'arcane_wisdom', tint: 0xb45cff,
  },
  fireball: {
    id: 'fireball', name: '烈焰火球', type: 'spell', cost: 4,
    rarity: 'epic', spell: { kind: 'damage', amount: 6, target: 'enemy-any', vfx: 'fireball' },
    desc: '对一个敌方角色造成 6 点伤害。', art: 'fireball', tint: 0xff7a33,
  },
  flamestorm: {
    id: 'flamestorm', name: '烈焰风暴', type: 'spell', cost: 6,
    rarity: 'legendary', spell: { kind: 'aoe_enemy', amount: 4, target: 'none', vfx: 'flamestorm' },
    desc: '对所有敌方随从造成 4 点伤害。', art: 'flamestorm', tint: 0xff5a26,
  },

  void_wisp: {
    id: 'void_wisp', name: '虚空萤火', type: 'minion', cost: 1, attack: 1, health: 2,
    rarity: 'common', tribe: '元素',
    desc: '从裂隙里漏出的一点冷光。', art: 'arcane_wisdom', tint: 0x8a6cff,
  },
  ember_whelp: {
    id: 'ember_whelp', name: '余烬幼崽', type: 'minion', cost: 1, attack: 1, health: 1,
    rarity: 'common', tribe: '龙', collectible: false,
    desc: '一声嘶鸣就散成火星。', art: 'flame_imp', tint: 0xff9a44,
  },
  stone_bulwark: {
    id: 'stone_bulwark', name: '石垒卫', type: 'minion', cost: 2, attack: 1, health: 4,
    rarity: 'common', tribe: '元素', keywords: ['taunt'],
    desc: '【嘲讽】把路堵死就完成了任务。', art: 'crystal_guardian', tint: 0x8a8f9a,
  },
  storm_rider: {
    id: 'storm_rider', name: '风暴骑手', type: 'minion', cost: 3, attack: 3, health: 2,
    rarity: 'rare', tribe: '武者', keywords: ['charge'],
    desc: '【冲锋】雷声未落，人已到面前。', art: 'thunder_samurai', tint: 0x7ec8ff,
  },
  blood_acolyte: {
    id: 'blood_acolyte', name: '血色侍僧', type: 'minion', cost: 3, attack: 3, health: 3,
    rarity: 'rare', tribe: '亡灵', battlecry: { type: 'damage_enemy_hero', amount: 2 },
    desc: '【战吼】对敌方英雄造成 2 点伤害。', art: 'shadow_assassin', tint: 0xc43a4a,
  },
  night_blade: {
    id: 'night_blade', name: '夜刃', type: 'minion', cost: 4, attack: 5, health: 3,
    rarity: 'epic', tribe: '亡灵',
    desc: '刀锋比夜色更薄。', art: 'shadow_assassin', tint: 0x6a4ab0,
  },
  rune_golem: {
    id: 'rune_golem', name: '符文巨像', type: 'minion', cost: 6, attack: 6, health: 7,
    rarity: 'epic', tribe: '元素', keywords: ['taunt'],
    desc: '【嘲讽】一步能震落墙上的灰。', art: 'crystal_guardian', tint: 0x6a7cff,
  },

  holy_shock: {
    id: 'holy_shock', name: '圣击', type: 'spell', cost: 1,
    rarity: 'common', spell: { kind: 'damage', amount: 2, target: 'enemy-any', vfx: 'holy' },
    desc: '对一个敌方角色造成 2 点伤害。', art: 'healing_light', tint: 0xffe08a,
  },
  inner_flame: {
    id: 'inner_flame', name: '内火', type: 'spell', cost: 1,
    rarity: 'common', spell: { kind: 'buff', amount: 2, target: 'friendly-minion', vfx: 'arcane' },
    desc: '使一个友方随从获得 +2 攻击。', art: 'fireball', tint: 0xff9a3a,
  },
  soul_pact: {
    id: 'soul_pact', name: '灵魂契约', type: 'spell', cost: 0,
    rarity: 'rare', spell: { kind: 'draw', n: 1, target: 'none', vfx: 'arcane', selfDamage: 2 },
    desc: '抽一张牌，对自己造成 2 点伤害。', art: 'arcane_wisdom', tint: 0xb45cff,
  },
  frost_shield: {
    id: 'frost_shield', name: '霜盾', type: 'spell', cost: 2,
    rarity: 'common', spell: { kind: 'armor', amount: 5, target: 'none', vfx: 'heal' },
    desc: '获得 5 点护甲。', art: 'frost_elemental', tint: 0x7fd8ff,
  },
  shadow_bolt: {
    id: 'shadow_bolt', name: '暗影箭', type: 'spell', cost: 3,
    rarity: 'rare', spell: { kind: 'damage', amount: 4, target: 'enemy-any', vfx: 'shadow' },
    desc: '对一个敌方角色造成 4 点伤害。', art: 'shadow_assassin', tint: 0x8a4cff,
  },
  mind_splinter: {
    id: 'mind_splinter', name: '裂心术', type: 'spell', cost: 2,
    rarity: 'rare', spell: { kind: 'debuff', amount: 2, target: 'enemy-minion', vfx: 'arcane' },
    desc: '使一个敌方随从获得 -2 攻击。', art: 'arcane_wisdom', tint: 0xc86bff,
  },
  burden: {
    id: 'burden', name: '负担', type: 'spell', cost: 2, collectible: false,
    rarity: 'common', spell: { kind: 'draw', n: 1, target: 'none', vfx: 'arcane', selfDamage: 3 },
    desc: '抽一张牌，对自己造成 3 点伤害。契约的利息。', art: 'flamestorm', tint: 0x5a4a60,
  },

  cinder_scout: {
    id: 'cinder_scout', name: '烬火斥候', type: 'minion', cost: 1, attack: 1, health: 1,
    rarity: 'common', tribe: '野兽', keywords: ['charge'],
    desc: '【冲锋】火星未落，它已经咬到脚踝。', art: 'cinder_scout', tint: 0xff8a3a,
  },
  pyre_hound: {
    id: 'pyre_hound', name: '焰冢猎犬', type: 'minion', cost: 2, attack: 3, health: 1,
    rarity: 'common', tribe: '野兽', battlecry: { type: 'damage_enemy_hero', amount: 1 },
    desc: '【战吼】对敌方英雄造成 1 点伤害。', art: 'pyre_hound', tint: 0xff6a28,
  },
  molten_burst: {
    id: 'molten_burst', name: '熔火迸裂', type: 'spell', cost: 2,
    rarity: 'rare', spell: { kind: 'damage', amount: 4, target: 'enemy-minion', vfx: 'fireball' },
    desc: '对一个敌方随从造成 4 点伤害。', art: 'fireball', tint: 0xff7030,
  },
  moss_turtle: {
    id: 'moss_turtle', name: '青苔盾龟', type: 'minion', cost: 1, attack: 1, health: 3,
    rarity: 'common', tribe: '野兽', keywords: ['taunt'],
    desc: '【嘲讽】壳上长满旧神的青苔。', art: 'moss_turtle', tint: 0x6ecf8a,
  },
  ward_priest: {
    id: 'ward_priest', name: '守望牧师', type: 'minion', cost: 2, attack: 1, health: 3,
    rarity: 'common', tribe: '人类', battlecry: { type: 'heal_hero', amount: 4 },
    desc: '【战吼】为你的英雄恢复 4 点生命。', art: 'ward_priest', tint: 0xffe08a,
  },
  sanctuary: {
    id: 'sanctuary', name: '圣所', type: 'spell', cost: 3,
    rarity: 'rare', spell: { kind: 'armor', amount: 4, target: 'none', vfx: 'heal', healHero: 3 },
    desc: '获得 4 点护甲，并为你的英雄恢复 3 点生命。', art: 'healing_light', tint: 0xffd56a,
  },
  rift_sprite: {
    id: 'rift_sprite', name: '裂隙精灵', type: 'minion', cost: 2, attack: 1, health: 2,
    rarity: 'rare', tribe: '元素', battlecry: { type: 'draw', n: 1 },
    desc: '【战吼】抽一张牌。', art: 'arcane_wisdom', tint: 0xb07cff,
  },
  echo_mage: {
    id: 'echo_mage', name: '回声法师', type: 'minion', cost: 3, attack: 2, health: 3,
    rarity: 'rare', tribe: '人类', deathrattle: { type: 'draw', n: 1 },
    desc: '【亡语】抽一张牌。', art: 'echo_mage', tint: 0xc86bff,
  },
  void_siphon: {
    id: 'void_siphon', name: '虚空虹吸', type: 'spell', cost: 2,
    rarity: 'rare', spell: { kind: 'siphon', amount: 3, heal: 2, target: 'none', vfx: 'shadow' },
    desc: '对敌方英雄造成 3 点伤害，为你的英雄恢复 2 点生命。', art: 'void_siphon', tint: 0x8a4cff,
  },
  silver_chaplain: {
    id: 'silver_chaplain', name: '银辉牧师', type: 'minion', cost: 4, attack: 3, health: 4,
    rarity: 'rare', tribe: '人类', keywords: ['lifesteal'],
    desc: '【吸血】造成伤害时，为你的英雄恢复等量生命。', art: 'silver_chaplain', tint: 0xe8f0ff,
  },
  meteor_shard: {
    id: 'meteor_shard', name: '流星碎片', type: 'spell', cost: 5,
    rarity: 'epic', spell: { kind: 'damage', amount: 7, target: 'enemy-any', vfx: 'fireball' },
    desc: '对一个敌方角色造成 7 点伤害。', art: 'meteor_shard', tint: 0xff7040,
  },
  dawn_paladin: {
    id: 'dawn_paladin', name: '黎明圣骑', type: 'minion', cost: 5, attack: 4, health: 5,
    rarity: 'epic', tribe: '人类', keywords: ['taunt'], battlecry: { type: 'armor', amount: 4 },
    desc: '【嘲讽】【战吼】获得 4 点护甲。', art: 'dawn_paladin', tint: 0xffd166,
  },
  twin_shade: {
    id: 'twin_shade', name: '幽影双子', type: 'minion', cost: 3, attack: 2, health: 2,
    rarity: 'rare', tribe: '亡灵', battlecry: { type: 'summon', cardId: 'shade_whelp', n: 1 },
    desc: '【战吼】召唤一个 1/1 的影嗣。', art: 'twin_shade', tint: 0x7a4ab8,
  },
  rune_apprentice: {
    id: 'rune_apprentice', name: '符文学徒', type: 'minion', cost: 1, attack: 1, health: 2,
    rarity: 'common', tribe: '人类',
    desc: '墨未干，咒已成。', art: 'frost_elemental', tint: 0x9aa6ff,
  },
  grove_archer: {
    id: 'grove_archer', name: '林荫弓手', type: 'minion', cost: 2, attack: 2, health: 3,
    rarity: 'common', tribe: '人类',
    desc: '树影里的第二支箭往往更准。', art: 'forest_wolf', tint: 0x5ad08a,
  },
  shade_whelp: {
    id: 'shade_whelp', name: '影嗣', type: 'minion', cost: 1, attack: 1, health: 1,
    rarity: 'common', tribe: '亡灵', collectible: false,
    desc: '孪生影子撕下来的一片。', art: 'shadow_assassin', tint: 0x5a3a80,
  },
};

// 30 张卡组配比（双方共用卡池）
const DECK_RECIPE = [
  ['flame_imp', 3], ['forest_wolf', 3], ['crystal_guardian', 3], ['shadow_assassin', 2],
  ['thunder_samurai', 3], ['frost_elemental', 2], ['radiant_knight', 2], ['ancient_dragon', 2],
  ['lightning_bolt', 2], ['healing_light', 2], ['arcane_wisdom', 2], ['fireball', 2], ['flamestorm', 2],
];

export function buildDeck(rng) {
  const list = [];
  for (const [id, n] of DECK_RECIPE) {
    for (let i = 0; i < n; i++) list.push(CARDS[id]);
  }
  return shuffle(list, rng);
}

export function hasKeyword(def, kw) {
  return !!(def.keywords && def.keywords.includes(kw));
}

export function getCard(id) {
  return CARDS[id] || null;
}

export function collectibleCards() {
  return Object.values(CARDS).filter((c) => c.collectible !== false);
}

export function buildDeckFromIds(ids, rng) {
  const list = (ids || []).map((id) => CARDS[id]).filter(Boolean);
  return shuffle(list, rng);
}

export function randomCollectible(rng, excludeIds = []) {
  const pool = collectibleCards().filter((c) => !excludeIds.includes(c.id));
  return pool[Math.floor(rng() * pool.length)] || collectibleCards()[0];
}

export function rarityWeight(rarity, elite = false) {
  const table = elite
    ? { common: 20, rare: 40, epic: 28, legendary: 12 }
    : { common: 48, rare: 32, epic: 15, legendary: 5 };
  return table[rarity] || 10;
}

export function weightedCollectible(rng, { elite = false, exclude = [] } = {}) {
  const pool = collectibleCards().filter((c) => !exclude.includes(c.id));
  const weights = pool.map((c) => rarityWeight(c.rarity, elite));
  let t = weights.reduce((s, w) => s + w, 0) * rng();
  for (let i = 0; i < pool.length; i++) {
    t -= weights[i];
    if (t <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
