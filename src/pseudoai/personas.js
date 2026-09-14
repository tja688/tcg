const DEFAULT = {
  voice: '冷静、克制，像在低声自语',
  ticks: ['……', '有意思。', '继续。'],
};

export const PERSONAS = {
  ashen_pack: {
    voice: '焦躁、嗜血，短句像火星迸溅，不讲道理只催命',
    ticks: ['烧起来。', '再近点。', '面门空了。'],
  },
  crystal_warden: {
    voice: '沉、慢、像石头在说话，讲究守势与分寸',
    ticks: ['先立住。', '墙还在。', '别急。'],
  },
  venom_adept: {
    voice: '阴柔、带着笑意，喜欢用毒与削弱调侃对手',
    ticks: ['味道对了。', '再蚀一层。', '你会软下来。'],
  },
  drum_brute: {
    voice: '粗声、兴奋，满口战鼓与力气',
    ticks: ['再响一点！', '打得就是爽。', '跟着鼓点。'],
  },
  void_weaver: {
    voice: '文绉绉、疏离，像在织一张看不见的网',
    ticks: ['线收紧了。', '这步在我算中。', '虚空会记着。'],
  },
  storm_vanguard: {
    voice: '干脆、节奏快，像雷声未落刀已出鞘',
    ticks: ['跟得上吗。', '节奏是我的。', '下一刀。'],
  },
  dusk_slayer: {
    voice: '冷、轻、带着处刑者的戏谑',
    ticks: ['夜还长。', '别眨眼。', '颈侧空了。'],
  },
  bastion_saint: {
    voice: '庄重、短促，像誓言，不浪费一个字',
    ticks: ['壁垒不倒。', '圣壁还在。', '站稳。'],
  },
  rot_whelp: {
    voice: '幼龙般的嘶声，贪婪，带着未长成的凶性',
    ticks: ['再热一点。', '血味。', '我想咬。'],
  },
  abyss_lord: {
    voice: '低沉、傲慢，偶尔像深渊在回响，不屑解释',
    ticks: ['跪下。', '深渊睁眼了。', '叫吧。'],
  },
  ambush_shade: {
    voice: '窃窃、短促，像从暗处探出头',
    ticks: ['嘘。', '来晚了。', '影子先到。'],
  },
};

export function personaOf(encounter) {
  const id = encounter?.id || '';
  const p = PERSONAS[id] || DEFAULT;
  return {
    id,
    name: encounter?.name || '未知敌人',
    title: encounter?.title || '',
    blurb: encounter?.blurb || '',
    archetype: encounter?.archetype || 'tempo',
    voice: p.voice,
    ticks: p.ticks,
  };
}
