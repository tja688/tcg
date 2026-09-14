export const RELICS = {
  ember_coin: {
    id: 'ember_coin', name: '余烬钱袋', icon: '金',
    desc: '每场战斗胜利额外获得 10 金币。',
  },
  crystal_core: {
    id: 'crystal_core', name: '晶核', icon: '晶',
    desc: '每场战斗开始时，法力上限 +1。',
  },
  thorn_sigil: {
    id: 'thorn_sigil', name: '荆棘徽记', icon: '刺',
    desc: '英雄受到随从攻击时，反伤 1 点。',
  },
  sage_quill: {
    id: 'sage_quill', name: '贤者羽笔', icon: '笔',
    desc: '每场战斗起手额外抽 1 张牌。',
  },
  iron_chalice: {
    id: 'iron_chalice', name: '铁杯', icon: '杯',
    desc: '篝火额外提高 3 点生命上限。',
  },
  war_banner: {
    id: 'war_banner', name: '战旗', icon: '旗',
    desc: '己方随从入场时获得 +1 攻击。',
  },
  merchant_seal: {
    id: 'merchant_seal', name: '商会火漆', icon: '印',
    desc: '商店所有价格降低 20%。',
  },
  vital_heart: {
    id: 'vital_heart', name: '活心', icon: '心',
    desc: '最大生命 +8，并立即回复 8 点。',
    onGain(run) {
      run.maxHp += 8;
      run.hp = Math.min(run.maxHp, run.hp + 8);
    },
  },
  guardian_scale: {
    id: 'guardian_scale', name: '守护鳞', icon: '鳞',
    desc: '每场战斗开始获得 4 点护甲。',
  },
  void_lens: {
    id: 'void_lens', name: '虚空透镜', icon: '镜',
    desc: '你的伤害法术 +1 点伤害。',
  },
};

export function getRelic(id) {
  return RELICS[id] || null;
}

export function hasRelic(list, id) {
  return (list || []).includes(id);
}

export function shopPrice(base, relics) {
  const n = Math.round(base * (hasRelic(relics, 'merchant_seal') ? 0.8 : 1));
  return Math.max(1, n);
}

export function randomRelic(rng, owned = []) {
  const pool = Object.keys(RELICS).filter((id) => !owned.includes(id));
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}
