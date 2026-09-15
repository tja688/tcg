import { getRelic } from '../run/relics.js';

/** 给新手看的短解释。只写一条人话，不堆规则书。 */
export const TERMS = {
  taunt: { title: '嘲讽', body: '场上有嘲讽时，随从必须先打它，不能直接砍英雄。法术不受这个限制。' },
  charge: { title: '冲锋', body: '上场的这个回合就能攻击，不用等一回合。' },
  lifesteal: { title: '吸血', body: '它造成的伤害，会等量给你回血。' },
  battlecry: { title: '战吼', body: '打出这张随从时，立刻触发一次效果。' },
  deathrattle: { title: '亡语', body: '这只随从死去时，再触发一次效果。' },
  armor: { title: '护甲', body: '伤害先打在护甲上，打光了才扣生命。' },
  strength: { title: '力量', body: '之后上场的随从会加这么多攻击。敌人强化时，已经在场的随从也会立刻变壮。' },
  relic: { title: '遗物', body: '整局都生效的随身道具，战斗之间也不会丢。' },
  sick: { title: '刚上场', body: '这个回合还不能攻击。带冲锋的除外。' },
  burden: { title: '负担', body: '一张碍事的牌：抽 1 张，但自己挨 3 点伤害。' },
  maxhp: { title: '生命上限', body: '上限提高时，当前生命也会一起涨。掉到 0 就输。' },
  hp: { title: '生命', body: '掉到 0 就输掉这场战斗。远征途中生命会带到下一场。' },
  rare: { title: '稀有', body: '比普通牌更强一档。' },
  epic: { title: '史诗', body: '更少见、效果更猛的牌。' },
  legendary: { title: '传说', body: '最稀有的一档，一局里很难再碰到。' },
  fight: { title: '遭遇战', body: '马上打一场战斗，打完再继续赶路。' },
};

export const PACK_TAGS = {
  快攻: { title: '快攻', body: '抢节奏，尽快打脸，不太跟你磨。' },
  灼烧: { title: '灼烧', body: '靠火系伤害和战吼压血。' },
  嘲讽: TERMS.taunt,
  护甲: TERMS.armor,
  法术: { title: '法术', body: '打出后就进坟场，不占场面。' },
  过牌: { title: '过牌', body: '多抽牌，手里资源更足。' },
};

export const NODE_TIPS = {
  combat: { title: '战斗', body: '普通遭遇。赢了拿金币，还能选一张牌进牌库。' },
  elite: { title: '精英', body: '更难的敌人。赢了奖励更好，有时还掉遗物。' },
  event: { title: '事件', body: '随机遭遇。选一项，后果马上生效。' },
  shop: { title: '商店', body: '花钱买牌或遗物，也能删掉不想要的牌。' },
  rest: { title: '篝火', body: '提高生命上限，当前生命也会一起涨。' },
  treasure: { title: '宝藏', body: '打开宝箱，拿走金币和遗物。' },
  boss: { title: '首领', body: '这一层的最终战。赢了就过关。' },
};

const RARITY = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

const LINK_TERMS = [
  ['生命上限', 'maxhp'],
  ['遭遇战', 'fight'],
  ['遗物', 'relic'],
  ['负担', 'burden'],
  ['传说', 'legendary'],
  ['史诗', 'epic'],
  ['稀有', 'rare'],
];

export function getTerm(id) {
  if (!id) return null;
  if (id.startsWith('pack:')) return PACK_TAGS[id.slice(5)] || null;
  if (id.startsWith('node:')) return NODE_TIPS[id.slice(5)] || null;
  if (id.startsWith('relic:')) {
    const r = getRelic(id.slice(6));
    if (!r) return null;
    return { title: `${r.icon} ${r.name}`, body: r.desc, extra: TERMS.relic.body };
  }
  return TERMS[id] || null;
}

export function cardKeywordEntries(def, inst) {
  const tags = [];
  const seen = new Set();
  const push = (id) => {
    if (!id || seen.has(id) || !TERMS[id]) return;
    seen.add(id);
    tags.push({ id, ...TERMS[id] });
  };
  for (const kw of def?.keywords || []) push(kw);
  if (def?.battlecry) push('battlecry');
  if (def?.deathrattle) push('deathrattle');
  if (def?.spell?.kind === 'armor') push('armor');
  if (inst?.sick) push('sick');
  return tags;
}

export function cardTipInfo(def, inst) {
  if (!def) return null;
  const tags = cardKeywordEntries(def, inst);
  const rarity = RARITY[def.rarity] || def.rarity || '';
  const kind = def.type === 'spell' ? '法术' : (def.tribe || '随从');
  const printed = def.type === 'minion' ? `${def.attack}/${def.health}` : '';
  const live = inst && def.type === 'minion' ? `${inst.attack}/${inst.health}` : '';
  const stats = live && live !== printed ? `场上 ${live}（印记 ${printed}）` : printed;
  const extra = [kind, rarity, `${def.cost} 费`, stats].filter(Boolean).join(' · ');
  return {
    title: def.name,
    body: def.desc || '',
    tags,
    extra,
  };
}

export function relicTipInfo(id) {
  const r = getRelic(id);
  if (!r) return null;
  return { title: `${r.icon} ${r.name}`, body: r.desc, extra: TERMS.relic.body };
}

export function nodeTipInfo(type, title, blurb) {
  const tip = NODE_TIPS[type] || { title: title || '节点', body: '' };
  return {
    title: title && title !== tip.title ? `${tip.title} · ${title}` : tip.title,
    body: tip.body,
    extra: blurb && blurb !== tip.body ? blurb : '',
  };
}

export function packTagsHtml(tagLine) {
  return String(tagLine || '').split(/\s*·\s*/).filter(Boolean).map((word, i) => {
    const sep = i ? '<i>·</i>' : '';
    return `${sep}<span class="packTag tipTerm" data-tip="pack:${word}">${word}</span>`;
  }).join('');
}

export function linkTerms(text) {
  let out = escapeHtml(String(text || ''));
  for (const [word, id] of LINK_TERMS) {
    const token = escapeHtml(word);
    out = out.split(token).join(`<span class="tipTerm" data-tip="${id}" tabindex="0">${token}</span>`);
  }
  return out;
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
