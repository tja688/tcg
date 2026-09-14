// 8+ 种可感知差异的敌人：共用战斗底板，意图表 + 牌库 + 人格不同

export const ENCOUNTERS = {
  ashen_pack: {
    id: 'ashen_pack', name: '灰烬掠夺者', title: '普通',
    portrait: 'flame_imp', tint: 0xff7a33, hp: 22, archetype: 'aggro',
    blurb: '连击加压，总想直取面门。',
    deck: [
      'flame_imp', 'flame_imp', 'flame_imp', 'void_wisp', 'void_wisp',
      'forest_wolf', 'forest_wolf', 'storm_rider', 'storm_rider',
      'shadow_assassin', 'holy_shock', 'holy_shock', 'lightning_bolt',
      'blood_acolyte', 'soul_pact',
    ],
    startBoard: ['flame_imp'],
    startHand: 3,
    phases: [{
      cycle: [
        { type: 'attack', amount: 4, label: '掠夺斩 4' },
        { type: 'summon', cardId: 'ember_whelp', label: '唤出余烬幼崽' },
        { type: 'attack', amount: 5, label: '加压斩 5' },
      ],
      rules: [
        { if: { playerHpBelow: 10 }, intent: { type: 'attack', amount: 6, label: '斩杀加压 6' } },
        { if: { eBoardLte: 0 }, intent: { type: 'summon', cardId: 'ember_whelp', label: '补上爪牙' } },
      ],
    }],
  },

  crystal_warden: {
    id: 'crystal_warden', name: '水晶守望者', title: '普通',
    portrait: 'crystal_guardian', tint: 0x4da6ff, hp: 26, archetype: 'tank',
    blurb: '先叠甲，再反打。',
    deck: [
      'stone_bulwark', 'stone_bulwark', 'crystal_guardian', 'crystal_guardian',
      'frost_shield', 'frost_shield', 'healing_light', 'healing_light',
      'forest_wolf', 'radiant_knight', 'inner_flame', 'frost_elemental',
      'void_wisp', 'holy_shock',
    ],
    startBoard: ['stone_bulwark'],
    startHand: 3,
    phases: [{
      cycle: [
        { type: 'defend', armor: 6, label: '晶壁 6' },
        { type: 'defend', armor: 5, label: '再凝 5 甲' },
        { type: 'attack', amount: 5, label: '晶刺反击 5' },
      ],
      rules: [
        { if: { pThreatGte: 8 }, intent: { type: 'defend', armor: 8, label: '全力守御 8' } },
        { if: { hpBelow: 0.35 }, intent: { type: 'defend', armor: 10, label: '残晶护体 10' } },
      ],
    }],
  },

  venom_adept: {
    id: 'venom_adept', name: '毒瘴术士', title: '普通',
    portrait: 'shadow_assassin', tint: 0x7dcf6a, hp: 24, archetype: 'status',
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
        { type: 'attack', amount: 3, label: '瘴气 3' },
        { type: 'debuff', amount: 1, label: '蚀骨 -1 攻' },
      ],
      rules: [
        { if: { pBoardGte: 3 }, intent: { type: 'special', special: 'aoe', amount: 2, label: '毒爆：全体 2 伤' } },
        { if: { pBoardLte: 0 }, intent: { type: 'attack', amount: 4, label: '直灌毒液 4' } },
      ],
    }],
  },

  drum_brute: {
    id: 'drum_brute', name: '战鼓蛮兵', title: '普通',
    portrait: 'thunder_samurai', tint: 0xffc95e, hp: 28, archetype: 'buff',
    blurb: '自我强化，随从会越打越疼。',
    deck: [
      'forest_wolf', 'forest_wolf', 'thunder_samurai', 'thunder_samurai',
      'inner_flame', 'inner_flame', 'blood_acolyte', 'night_blade',
      'radiant_knight', 'flame_imp', 'flame_imp', 'storm_rider',
      'healing_light', 'shadow_assassin',
    ],
    startBoard: ['forest_wolf'],
    startHand: 3,
    phases: [{
      cycle: [
        { type: 'buff', amount: 1, label: '战鼓：力量 +1' },
        { type: 'summon', cardId: 'ember_whelp', label: '鼓手入场' },
        { type: 'attack', amount: 4, label: '猛击 4' },
      ],
      rules: [
        { if: { eBoardGte: 3 }, intent: { type: 'buff', amount: 2, label: '全军 +2 力量' } },
        { if: { hpBelow: 0.4 }, intent: { type: 'buff', amount: 2, label: '狂化 +2' } },
      ],
    }],
  },

  void_weaver: {
    id: 'void_weaver', name: '虚空织法者', title: '中层',
    portrait: 'arcane_wisdom', tint: 0xb45cff, hp: 30, archetype: 'control',
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
        { type: 'defend', armor: 5, label: '虚空帷幕 5' },
        { type: 'special', special: 'aoe', amount: 2, label: '裂空：全体 2 伤' },
      ],
      rules: [
        { if: { pBoardGte: 2 }, intent: { type: 'special', special: 'aoe', amount: 3, label: '裂空加强 3' } },
        { if: { hpBelow: 0.35 }, intent: { type: 'defend', armor: 8, label: '闭锁 8 甲' } },
      ],
    }],
  },

  storm_vanguard: {
    id: 'storm_vanguard', name: '雷霆先锋', title: '中层',
    portrait: 'lightning_bolt', tint: 0x6fb6ff, hp: 27, archetype: 'tempo',
    blurb: '冲锋与曲线，节奏极快。',
    deck: [
      'storm_rider', 'storm_rider', 'thunder_samurai', 'thunder_samurai',
      'lightning_bolt', 'lightning_bolt', 'holy_shock', 'forest_wolf',
      'night_blade', 'flame_imp', 'void_wisp', 'inner_flame',
      'shadow_assassin', 'fireball',
    ],
    startBoard: ['storm_rider'],
    startHand: 3,
    phases: [{
      cycle: [
        { type: 'attack', amount: 5, label: '先锋突击 5' },
        { type: 'buff', amount: 1, label: '雷纹 +1' },
        { type: 'attack', amount: 4, label: '连斩 4' },
      ],
      rules: [
        { if: { turnGte: 5 }, intent: { type: 'attack', amount: 7, label: '雷霆齐射 7' } },
      ],
    }],
  },

  dusk_slayer: {
    id: 'dusk_slayer', name: '暮刃刺客长', title: '精英',
    portrait: 'shadow_assassin', tint: 0xb45cff, hp: 38, archetype: 'elite_aggro',
    blurb: '精英循环更狠，几乎不给你喘气。',
    deck: [
      'shadow_assassin', 'shadow_assassin', 'night_blade', 'night_blade',
      'storm_rider', 'thunder_samurai', 'fireball', 'shadow_bolt',
      'flame_imp', 'flame_imp', 'holy_shock', 'holy_shock',
      'blood_acolyte', 'soul_pact', 'lightning_bolt',
    ],
    startBoard: ['shadow_assassin'],
    startHand: 4,
    phases: [{
      cycle: [
        { type: 'attack', amount: 7, label: '暮刃 7' },
        { type: 'attack', amount: 5, label: '连刺 5' },
        { type: 'summon', cardId: 'shadow_assassin', label: '影嗣加入' },
        { type: 'attack', amount: 8, label: '处刑 8' },
      ],
      rules: [
        { if: { playerHpBelow: 16 }, intent: { type: 'attack', amount: 9, label: '斩首 9' } },
        { if: { eBoardLte: 1 }, intent: { type: 'summon', cardId: 'night_blade', label: '再召暮刃' } },
      ],
    }],
  },

  bastion_saint: {
    id: 'bastion_saint', name: '圣堂壁垒', title: '精英',
    portrait: 'radiant_knight', tint: 0xffd166, hp: 42, archetype: 'elite_tank',
    blurb: '厚甲与嘲讽墙，反击一次就能拆掉你的曲线。',
    deck: [
      'crystal_guardian', 'crystal_guardian', 'radiant_knight', 'radiant_knight',
      'stone_bulwark', 'stone_bulwark', 'frost_shield', 'frost_shield',
      'healing_light', 'healing_light', 'rune_golem', 'inner_flame',
      'holy_shock', 'frost_elemental',
    ],
    startBoard: ['crystal_guardian'],
    startHand: 4,
    phases: [{
      cycle: [
        { type: 'defend', armor: 8, label: '圣壁 8' },
        { type: 'defend', armor: 6, label: '再铸 6' },
        { type: 'attack', amount: 6, label: '盾击 6' },
        { type: 'summon', cardId: 'stone_bulwark', label: '召石卫' },
      ],
      rules: [
        { if: { pThreatGte: 10 }, intent: { type: 'defend', armor: 12, label: '绝对防御 12' } },
        { if: { hpBelow: 0.4 }, intent: { type: 'special', special: 'heal', amount: 8, label: '圣愈 8' } },
      ],
    }],
  },

  rot_whelp: {
    id: 'rot_whelp', name: '腐化龙嗣', title: '精英',
    portrait: 'ancient_dragon', tint: 0x8f3a2e, hp: 40, archetype: 'elite_buff',
    blurb: '战吼与龙息，越拖越危险。',
    deck: [
      'ancient_dragon', 'flame_imp', 'flame_imp', 'flamestorm',
      'fireball', 'blood_acolyte', 'night_blade', 'forest_wolf',
      'inner_flame', 'thunder_samurai', 'shadow_bolt', 'rune_golem',
      'storm_rider', 'arcane_wisdom',
    ],
    startBoard: ['flame_imp', 'flame_imp'],
    startHand: 3,
    phases: [{
      cycle: [
        { type: 'buff', amount: 2, label: '龙血 +2' },
        { type: 'special', special: 'aoe', amount: 2, label: '幼息：全体 2' },
        { type: 'attack', amount: 6, label: '撕咬 6' },
      ],
      rules: [
        { if: { turnGte: 6 }, intent: { type: 'special', special: 'aoe', amount: 3, label: '成熟龙息 3' } },
      ],
    }],
  },

  abyss_lord: {
    id: 'abyss_lord', name: '深渊魔王', title: '首领',
    portrait: 'hero_warlock', tint: 0xff5040, hp: 54, archetype: 'boss',
    blurb: '三阶段：召军守势 → 强化清场 → 终焉咆哮。',
    deck: [
      'ancient_dragon', 'flamestorm', 'fireball', 'fireball',
      'shadow_assassin', 'radiant_knight', 'rune_golem', 'thunder_samurai',
      'arcane_wisdom', 'shadow_bolt', 'flame_imp', 'flame_imp',
      'crystal_guardian', 'night_blade', 'blood_acolyte', 'frost_elemental',
    ],
    startBoard: ['crystal_guardian'],
    startHand: 4,
    phases: [
      {
        cycle: [
          { type: 'summon', cardId: 'ember_whelp', label: '深渊幼崽' },
          { type: 'defend', armor: 6, label: '深渊甲 6' },
          { type: 'attack', amount: 5, label: '魔爪 5' },
        ],
        rules: [
          { if: { eBoardLte: 0 }, intent: { type: 'summon', cardId: 'flame_imp', label: '裂隙小鬼' } },
        ],
      },
      {
        atHp: 32,
        banner: '第二形态 · 深渊睁眼',
        cycle: [
          { type: 'buff', amount: 2, label: '魔核 +2 力量' },
          { type: 'special', special: 'aoe', amount: 2, label: '深渊波 2' },
          { type: 'attack', amount: 7, label: '灭世挥击 7' },
        ],
        rules: [
          { if: { pBoardGte: 3 }, intent: { type: 'special', special: 'aoe', amount: 3, label: '深渊波 3' } },
        ],
      },
      {
        atHp: 16,
        banner: '终焉形态 · 魔王咆哮',
        cycle: [
          { type: 'attack', amount: 8, label: '终焉 8' },
          { type: 'special', special: 'aoe', amount: 3, label: '灭世吐息 3' },
          { type: 'attack', amount: 10, label: '咆哮 10' },
        ],
        rules: [
          { if: { playerHpBelow: 14 }, intent: { type: 'attack', amount: 12, label: '处刑咆哮 12' } },
        ],
      },
    ],
  },

  ambush_shade: {
    id: 'ambush_shade', name: '伏击影魔', title: '遭遇',
    portrait: 'shadow_assassin', tint: 0x5a3a80, hp: 20, archetype: 'aggro',
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
        { type: 'attack', amount: 3, label: '偷袭 3' },
        { type: 'summon', cardId: 'ember_whelp', label: '影嗣' },
        { type: 'attack', amount: 4, label: '补刀 4' },
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
  else if (floor >= 3) pool = EARLY.concat(MID.slice(0, 1));
  const fresh = pool.filter((id) => !used.has(id));
  const bag = fresh.length ? fresh : pool;
  return bag[Math.floor(rng() * bag.length)];
}
