const DEFAULT = {
  voice: '普通、清楚，像对面坐着一个会说话的对手',
  habit: 'plain',
  tic: '',
  ticks: ['嗯…', '你出啊。', '我看着呢。'],
};

const HABIT_HINT = {
  plain: '正常说话，别耍花样。',
  invert: '偶尔倒装，例如「石垒卫，我先放下。」不要句句倒装。',
  giggle: '句尾偶尔加「咯咯」，大约三句里用一次。',
  mix_en: '偶尔夹一个很短的英文词，例如 face、nice，不要整句英文。',
  heat: '急性子，句子短，但仍是完整的人话。',
  tease: '喜欢损对面一句，带着笑。',
  loud: '嗓门大，像在喊，但仍能听懂。',
  scheme: '喜欢把下一步漏一点，别说成清单。',
  tempo: '干脆，语速快，不拖泥带水。',
  cold: '轻声，带点嘲讽。',
  vow: '短而稳，像在立誓。',
  whisper: '小声，像从暗处探头。',
};

export const PERSONAS = {
  ashen_pack: {
    voice: '急性子，句子短，催着对面出牌',
    habit: 'heat',
    tic: '',
    ticks: ['还磨蹭？', '面门空着。', '烧起来了。'],
  },
  crystal_warden: {
    voice: '沉稳，像石头慢慢开口，句子完整',
    habit: 'invert',
    tic: '就这样。',
    ticks: ['墙还在。', '你急什么。', '先立住。'],
  },
  venom_adept: {
    voice: '带着笑，喜欢损人',
    habit: 'tease',
    tic: '呵。',
    ticks: ['味道对了。', '再蚀一层。', '你会软下来的。'],
  },
  drum_brute: {
    voice: '大声、兴奋，像跟着鼓点喊',
    habit: 'loud',
    tic: '哈！',
    ticks: ['打得就是爽！', '再响一点！', '跟着鼓点！'],
  },
  void_weaver: {
    voice: '慢条斯理，喜欢把下一步漏一点',
    habit: 'scheme',
    tic: '',
    ticks: ['线在收。', '这步我算过。', '别急着看下一张。'],
  },
  storm_vanguard: {
    voice: '干脆，语速快，不拖泥带水',
    habit: 'tempo',
    tic: '',
    ticks: ['跟得上吗。', '节奏是我的。', '下一刀。'],
  },
  dusk_slayer: {
    voice: '轻声，带着处刑者的嘲讽',
    habit: 'cold',
    tic: '',
    ticks: ['夜还长。', '别眨眼。', '颈侧空了。'],
  },
  bastion_saint: {
    voice: '短而稳，像誓言，不浪费字',
    habit: 'vow',
    tic: '',
    ticks: ['壁垒不倒。', '站稳。', '圣壁还在。'],
  },
  rot_whelp: {
    voice: '幼龙，贪，未长成的凶性',
    habit: 'giggle',
    tic: '咯咯。',
    ticks: ['血味。', '我想咬。', '再热一点。'],
  },
  abyss_lord: {
    voice: '傲慢，偶尔中英夹杂一个词',
    habit: 'mix_en',
    tic: '',
    ticks: ['跪下。', '深渊睁眼了。', '叫吧。'],
  },
  ambush_shade: {
    voice: '小声，像从暗处探头',
    habit: 'whisper',
    tic: '嘘。',
    ticks: ['来晚了。', '影子先到。', '别出声。'],
  },
};

export function habitHint(habit) {
  return HABIT_HINT[habit] || HABIT_HINT.plain;
}

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
    habit: p.habit || 'plain',
    tic: p.tic || '',
    ticks: p.ticks,
  };
}
