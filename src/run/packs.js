import { CARDS } from '../game/cards.js';

// 三份初始卡包。core 固定，再从 pool 无放回抽 extraCount 张，保证每局同包也有差别。
export const STARTER_PACKS = {
  ember: {
    id: 'ember',
    name: '余烬先锋',
    tag: '快攻 · 灼烧',
    blurb: '用冲锋和火花抢节奏。打脸比控场更重要。',
    accent: '#ff7a33',
    archetype: 'aggro',
    extraCount: 4,
    preview: ['cinder_scout', 'pyre_hound', 'thunder_samurai', 'fireball'],
    core: [
      'flame_imp', 'flame_imp',
      'cinder_scout',
      'pyre_hound',
      'forest_wolf',
      'holy_shock',
      'molten_burst',
      'lightning_bolt',
      'thunder_samurai',
      'fireball',
    ],
    pool: [
      'flame_imp', 'forest_wolf', 'inner_flame', 'storm_rider',
      'blood_acolyte', 'pyre_hound', 'night_blade', 'meteor_shard',
    ],
  },
  ward: {
    id: 'ward',
    name: '晶壁守望',
    tag: '嘲讽 · 护甲',
    blurb: '把路堵死，把血换厚。敌人先打碎墙，才能碰到你。',
    accent: '#4da6ff',
    archetype: 'tank',
    extraCount: 4,
    preview: ['moss_turtle', 'ward_priest', 'sanctuary', 'dawn_paladin'],
    core: [
      'moss_turtle',
      'stone_bulwark',
      'ward_priest',
      'crystal_guardian',
      'frost_shield',
      'healing_light',
      'sanctuary',
      'silver_chaplain',
      'radiant_knight',
      'dawn_paladin',
    ],
    pool: [
      'moss_turtle', 'void_wisp', 'holy_shock', 'frost_shield',
      'frost_elemental', 'stone_bulwark', 'rune_golem', 'grove_archer',
    ],
  },
  rift: {
    id: 'rift',
    name: '裂隙织法',
    tag: '法术 · 过牌',
    blurb: '用虹吸和回声换资源。场面可以空，手牌不能空。',
    accent: '#b45cff',
    archetype: 'tempo',
    extraCount: 4,
    preview: ['void_siphon', 'echo_mage', 'molten_burst', 'arcane_wisdom'],
    core: [
      'void_wisp',
      'grove_archer',
      'forest_wolf',
      'holy_shock', 'holy_shock',
      'void_siphon',
      'molten_burst',
      'echo_mage',
      'shadow_bolt',
      'arcane_wisdom',
    ],
    pool: [
      'soul_pact', 'rift_sprite', 'cinder_scout', 'lightning_bolt',
      'frost_elemental', 'fireball', 'twin_shade', 'inner_flame',
    ],
  },
};

export const PACK_IDS = Object.keys(STARTER_PACKS);

export function getPack(id) {
  return STARTER_PACKS[id] || STARTER_PACKS.ember;
}

export function packArchetype(id) {
  return getPack(id).archetype;
}

function pickN(list, n, rng) {
  const bag = list.slice();
  const out = [];
  while (out.length < n && bag.length) {
    const i = Math.floor(rng() * bag.length);
    out.push(bag.splice(i, 1)[0]);
  }
  return out;
}

export function buildStarterDeck(packId, rng) {
  const pack = getPack(packId);
  const extras = pickN(pack.pool, pack.extraCount, rng);
  return pack.core.concat(extras).filter((id) => CARDS[id]);
}

export function assertPacks() {
  for (const pack of Object.values(STARTER_PACKS)) {
    if (pack.core.length + pack.extraCount !== 14) {
      throw new Error(`${pack.id} should deal 14 cards`);
    }
    for (const id of [...pack.core, ...pack.pool, ...pack.preview]) {
      if (!CARDS[id]) throw new Error(`${pack.id} unknown card ${id}`);
    }
  }
}
