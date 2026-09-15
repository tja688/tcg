// 8+ 种可感知差异的敌人：共用战斗底板，意图表 + 牌库 + 人格不同

export const ENCOUNTERS = {
  ashen_pack: {
    id: 'ashen_pack', name: '灰烬掠夺者', title: '普通',
    portrait: 'flame_imp', tint: 0xff7a33, hp: 18, archetype: 'aggro',
    blurb: '连击加压，总想直取面门。',
    deck: [
      'flame_imp', 'flame_imp', 'flame_imp', 'void_wisp', 'void_wisp',
      'forest_wolf', 'forest_wolf', 'storm_rider', 'storm_rider',
      'shadow_assassin', 'holy_shock', 'holy_shock', 'lightning_bolt',
      'blood_acolyte', 'soul_pact',
    ],
    startBoard: [],
    startHand: 3,
    phases: [{
      cycle: [
        { type: 'attack', amount: 2, label: '掠夺斩 2' },
        { type: 'summon', cardId: 'ember_whelp', label: '唤出余烬幼崽' },
        { type: 'attack', amount: 3, label: '加压斩 3' },
      ],
      rules: [
        { if: { playerHpBelow: 8 }, intent: { type: 'attack', amount: 4, label: '斩杀加压 4' } },
        { if: { eBoardLte: 0 }, intent: { type: 'summon', cardId: 'ember_whelp', label: '补上爪牙' } },
      ],
    }],
  },

  crystal_warden: {
    id: 'crystal_warden', name: '水晶守望者', title: '普通',
    portrait: 'crystal_guardian', tint: 0x4da6ff, hp: 16, archetype: 'tank',
    blurb: '先叠甲，再反打。',
    deck: [
      'stone_bulwark', 'stone_bulwark', 'crystal_guardian', 'crystal_guardian',
      'frost_shield', 'frost_shield', 'healing_light', 'healing_light',
      'forest_wolf', 'radiant_knight', 'inner_flame', 'frost_elemental',
      'void_wisp', 'holy_shock',
    ],
    startBoard: [],
    startHand: 3,
    phases: [{
      cycle: [
        { type: 'defend', armor: 2, label: '晶壁 2' },
        { type: 'defend', armor: 2, label: '再凝 2 甲' },
        { type: 'attack', amount: 2, label: '晶刺反击 2' },
      ],
      rules: [
        { if: { pThreatGte: 8 }, intent: { type: 'defend', armor: 5, label: '全力守御 5' } },
        { if: { hpBelow: 0.35 }, intent: { type: 'defend', armor: 6, label: '残晶护体 6' } },
      ],
    }],
  },

  venom_adept: {
    id: 'venom_adept', name: '毒瘴术士', title: '普通',
    portrait: 'shadow_assassin', tint: 0x7dcf6a, hp: 20, archetype: 'status',
    blurb: '法术与削弱交替，专削你的随从。',
    deck: [
      'lightning_bolt', 'lightning_bolt', 'shadow_bolt', 'shadow_bolt',
      'holy_shock', 'holy_shock', 'flamestorm', 'arcane_wisdom',
      'void_wisp', 'shadow_assassin', 'flame_imp', 'soul_pact',
      'mind_splinter', 'mind_splinter',
    ],
    startBoard: [],
    startHand: 4,
    phases: [{
      cycle: [
        { type: 'debuff', amount: 2, label: '毒雾：敌随从 -2 攻' },
        { type: 'attack', amount: 2, label: '瘴气 2' },
        { type: 'debuff', amount: 1, label: '蚀骨 -1 攻' },
      ],
      rules: [
        { if: { pBoardGte: 3 }, intent: { type: 'special', special: 'aoe', amount: 2, label: '毒爆：全体 2 伤' } },
        { if: { pBoardLte: 0 }, intent: { type: 'attack', amount: 3, label: '直灌毒液 3' } },
      ],
    }],
  },

  drum_brute: {
    id: 'drum_brute', name: '战鼓蛮兵', title: '普通',
    portrait: 'thunder_samurai', tint: 0xffc95e, hp: 16, archetype: 'buff',
    blurb: '自我强化，随从会越打越疼。',
    deck: [
      'forest_wolf', 'forest_wolf', 'flame_imp', 'flame_imp',
      'inner_flame', 'blood_acolyte', 'stone_bulwark',
      'healing_light', 'void_wisp', 'holy_shock',
      'storm_rider', 'forest_wolf', 'flame_imp', 'inner_flame',
    ],
    startBoard: [],
    startHand: 3,
    phases: [{
      cycle: [
        { type: 'buff', amount: 1, label: '战鼓：力量 +1' },
        { type: 'summon', cardId: 'ember_whelp', label: '鼓手入场' },
        { type: 'attack', amount: 2, label: '猛击 2' },
      ],
      rules: [
        { if: { eBoardGte: 4 }, intent: { type: 'buff', amount: 1, label: '全军 +1 力量' } },
      ],
    }],
  },

  void_weaver: {
    id: 'void_weaver', name: '虚空织法者', title: '中层',
    portrait: 'arcane_wisdom', tint: 0xb45cff, hp: 24, archetype: 'control',
    blurb: '清场与过牌，专打拖延。',
    deck: [
      'arcane_wisdom', 'arcane_wisdom', 'flamestorm', 'shadow_bolt',
      'crystal_guardian', 'frost_elemental', 'frost_elemental', 'healing_light',
      'lightning_bolt', 'mind_splinter', 'void_wisp', 'rune_golem',
      'frost_shield', 'holy_shock',
    ],
    startBoard: [],
    startHand: 4,
    phases: [{
      cycle: [
        { type: 'special', special: 'draw', amount: 1, label: '织法：抽 1' },
        { type: 'defend', armor: 4, label: '虚空帷幕 4' },
        { type: 'special', special: 'aoe', amount: 2, label: '裂空：全体 2 伤' },
      ],
      rules: [
        { if: { pBoardGte: 2 }, intent: { type: 'special', special: 'aoe', amount: 2, label: '裂空加强 2' } },
        { if: { hpBelow: 0.35 }, intent: { type: 'defend', armor: 6, label: '闭锁 6 甲' } },
      ],
    }],
  },

  storm_vanguard: {
    id: 'storm_vanguard', name: '雷霆先锋', title: '中层',
    portrait: 'lightning_bolt', tint: 0x6fb6ff, hp: 18, archetype: 'tempo',
    blurb: '冲锋与曲线，节奏极快。',
    deck: [
      'storm_rider', 'flame_imp', 'flame_imp', 'forest_wolf',
      'lightning_bolt', 'holy_shock', 'holy_shock', 'void_wisp',
      'inner_flame', 'forest_wolf', 'void_wisp', 'flame_imp',
      'thunder_samurai', 'healing_light',
    ],
    startBoard: [],
    startHand: 3,
    phases: [{
      cycle: [
        { type: 'attack', amount: 2, label: '先锋突击 2' },
        { type: 'buff', amount: 1, label: '雷纹 +1' },
        { type: 'attack', amount: 2, label: '连斩 2' },
      ],
      rules: [
        { if: { turnGte: 6 }, intent: { type: 'attack', amount: 4, label: '雷霆齐射 4' } },
      ],
    }],
  },

  dusk_slayer: {
    id: 'dusk_slayer', name: '暮刃刺客长', title: '精英',
    portrait: 'shadow_assassin', tint: 0xb45cff, hp: 28, archetype: 'elite_aggro',
    blurb: '精英循环更狠，几乎不给你喘气。',
    deck: [
      'shadow_assassin', 'shadow_assassin', 'night_blade', 'night_blade',
      'storm_rider', 'thunder_samurai', 'fireball', 'shadow_bolt',
      'flame_imp', 'flame_imp', 'holy_shock', 'holy_shock',
      'blood_acolyte', 'soul_pact', 'lightning_bolt',
    ],
    startBoard: ['flame_imp'],
    startHand: 4,
    phases: [{
      cycle: [
        { type: 'attack', amount: 3, label: '暮刃 3' },
        { type: 'attack', amount: 3, label: '连刺 3' },
        { type: 'summon', cardId: 'ember_whelp', label: '影嗣加入' },
        { type: 'attack', amount: 4, label: '处刑 4' },
      ],
      rules: [
        { if: { playerHpBelow: 12 }, intent: { type: 'attack', amount: 6, label: '斩首 6' } },
        { if: { eBoardLte: 1 }, intent: { type: 'summon', cardId: 'ember_whelp', label: '再召影嗣' } },
      ],
    }],
  },

  bastion_saint: {
    id: 'bastion_saint', name: '圣堂壁垒', title: '精英',
    portrait: 'radiant_knight', tint: 0xffd166, hp: 28, archetype: 'elite_tank',
    blurb: '厚甲与嘲讽墙，反击一次就能拆掉你的曲线。',
    deck: [
      'crystal_guardian', 'crystal_guardian', 'radiant_knight', 'radiant_knight',
      'stone_bulwark', 'stone_bulwark', 'frost_shield', 'frost_shield',
      'healing_light', 'healing_light', 'rune_golem', 'inner_flame',
      'holy_shock', 'frost_elemental',
    ],
    startBoard: [],
    startHand: 4,
    phases: [{
      cycle: [
        { type: 'defend', armor: 4, label: '圣壁 4' },
        { type: 'defend', armor: 3, label: '再铸 3' },
        { type: 'attack', amount: 3, label: '盾击 3' },
        { type: 'summon', cardId: 'stone_bulwark', label: '召石卫' },
      ],
      rules: [
        { if: { pThreatGte: 10 }, intent: { type: 'defend', armor: 8, label: '绝对防御 8' } },
        { if: { hpBelow: 0.4 }, intent: { type: 'special', special: 'heal', amount: 6, label: '圣愈 6' } },
      ],
    }],
  },

  rot_whelp: {
    id: 'rot_whelp', name: '腐化龙嗣', title: '精英',
    portrait: 'ancient_dragon', tint: 0x8f3a2e, hp: 22, archetype: 'elite_buff',
    blurb: '战吼与龙息，越拖越危险。',
    deck: [
      'flame_imp', 'flame_imp', 'forest_wolf', 'forest_wolf',
      'fireball', 'blood_acolyte', 'inner_flame', 'healing_light',
      'inner_flame', 'thunder_samurai', 'shadow_bolt', 'rune_golem',
      'storm_rider', 'arcane_wisdom',
    ],
    startBoard: [],
    startHand: 3,
    phases: [{
      cycle: [
        { type: 'buff', amount: 1, label: '龙血 +1' },
        { type: 'special', special: 'aoe', amount: 1, label: '幼息：全体 1' },
        { type: 'attack', amount: 3, label: '撕咬 3' },
      ],
      rules: [
        { if: { turnGte: 6 }, intent: { type: 'special', special: 'aoe', amount: 2, label: '成熟龙息 2' } },
      ],
    }],
  },

  abyss_lord: {
    id: 'abyss_lord', name: '深渊魔王', title: '首领',
    portrait: 'hero_warlock', tint: 0xff5040, hp: 28, archetype: 'boss',
    blurb: '三阶段：召军守势 → 强化清场 → 终焉咆哮。',
    deck: [
      'flame_imp', 'flame_imp', 'forest_wolf', 'void_wisp',
      'holy_shock', 'lightning_bolt', 'shadow_bolt', 'crystal_guardian',
      'frost_shield', 'blood_acolyte', 'storm_rider', 'fireball',
      'arcane_wisdom', 'healing_light', 'night_blade', 'ember_whelp',
    ],
    startBoard: [],
    startHand: 4,
    phases: [
      {
        cycle: [
          { type: 'summon', cardId: 'ember_whelp', label: '深渊幼崽' },
          { type: 'defend', armor: 3, label: '深渊甲 3' },
          { type: 'attack', amount: 2, label: '魔爪 2' },
        ],
        rules: [
          { if: { eBoardLte: 0 }, intent: { type: 'summon', cardId: 'flame_imp', label: '裂隙小鬼' } },
        ],
      },
      {
        atHp: 26,
        banner: '第二形态 · 深渊睁眼',
        cycle: [
          { type: 'buff', amount: 1, label: '魔核 +1 力量' },
          { type: 'special', special: 'aoe', amount: 2, label: '深渊波 2' },
          { type: 'attack', amount: 4, label: '灭世挥击 4' },
        ],
        rules: [
          { if: { pBoardGte: 3 }, intent: { type: 'special', special: 'aoe', amount: 2, label: '深渊波 2' } },
        ],
      },
      {
        atHp: 12,
        banner: '终焉形态 · 魔王咆哮',
        cycle: [
          { type: 'attack', amount: 4, label: '终焉 4' },
          { type: 'special', special: 'aoe', amount: 2, label: '灭世吐息 2' },
          { type: 'attack', amount: 5, label: '咆哮 5' },
        ],
        rules: [
          { if: { playerHpBelow: 10 }, intent: { type: 'attack', amount: 6, label: '处刑咆哮 6' } },
        ],
      },
    ],
  },

  ambush_shade: {
    id: 'ambush_shade', name: '伏击影魔', title: '遭遇',
    portrait: 'shadow_assassin', tint: 0x5a3a80, hp: 16, archetype: 'aggro',
    blurb: '事件里跳出来的短遭遇。',
    deck: [
      'void_wisp', 'void_wisp', 'flame_imp', 'flame_imp',
      'holy_shock', 'shadow_assassin', 'lightning_bolt', 'storm_rider',
      'soul_pact', 'forest_wolf',
    ],
    startBoard: ['void_wisp'],
    startHand: 3,
    phases: [{
      cycle: [
        { type: 'attack', amount: 2, label: '偷袭 2' },
        { type: 'summon', cardId: 'ember_whelp', label: '影嗣' },
        { type: 'attack', amount: 3, label: '补刀 3' },
      ],
    }],
  },
};

const EARLY = ['ashen_pack', 'crystal_warden', 'venom_adept'];
const MID = ['drum_brute', 'void_weaver', 'storm_vanguard'];
const ELITES = ['dusk_slayer', 'bastion_saint', 'rot_whelp'];

export function getEncounter(id) {
  const enc = ENCOUNTERS[id];
  if (!enc) return ENCOUNTERS.ashen_pack;
  return enc;
}

export function pickEncounter(type, floor, rng, used) {
  if (type === 'boss') return 'abyss_lord';
  let pool = EARLY;
  if (type === 'elite') pool = ELITES;
  else if (floor >= 6) pool = MID.concat(EARLY);
  else if (floor >= 5) pool = MID.concat(EARLY);
  const fresh = pool.filter((id) => !used.has(id));
  const bag = fresh.length ? fresh : pool;
  return bag[Math.floor(rng() * bag.length)];
}
