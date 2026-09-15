import { getCard } from '../game/cards.js';

export const SKILL_ICONS = {
  attack: 'skill_attack',
  defend: 'skill_defend',
  buff: 'skill_buff',
  debuff: 'skill_debuff',
  summon: 'skill_summon',
  special: 'skill_special',
};

const TYPE_TITLE = {
  attack: '攻击',
  defend: '防御',
  buff: '强化',
  debuff: '削弱',
  summon: '召唤',
  special: '特殊',
};

export function skillIconKey(type) {
  return SKILL_ICONS[type] || SKILL_ICONS.special;
}

export function skillSignature(intent) {
  if (!intent) return '';
  return [
    intent.type || '',
    intent.label || '',
    intent.value ?? '',
    intent.special || '',
    intent.cardId || '',
  ].join('|');
}

export function describeSkill(intent) {
  if (!intent) {
    return { title: '', label: '', body: '', icon: SKILL_ICONS.special, value: null, type: '' };
  }
  const type = intent.type;
  const value = intent.value;
  const title = intent.title || TYPE_TITLE[type] || '未知';
  const label = intent.label || '';
  let body = label || '未知预兆。';
  switch (type) {
    case 'attack':
      body = `下回合对你的英雄造成 ${value} 点伤害。`;
      break;
    case 'defend':
      body = `为自己获得 ${value} 点护甲。`;
      break;
    case 'buff':
      body = `自身力量 +${value}，场上随从攻击力各 +${value}。`;
      break;
    case 'debuff':
      body = `你场上所有随从的攻击力 -${value}。`;
      break;
    case 'summon': {
      const card = getCard(intent.cardId);
      const name = card?.name || '援军';
      const stats = card ? `${card.attack}/${card.health}` : '';
      body = `召唤「${name}」${stats ? `（${stats}）` : ''}到战场。`;
      break;
    }
    case 'special':
      if (intent.special === 'aoe') body = `对你场上所有随从造成 ${value} 点伤害。`;
      else if (intent.special === 'draw') body = `敌人抽 ${value} 张牌。`;
      else if (intent.special === 'heal') body = `敌人恢复 ${value} 点生命。`;
      break;
    default:
      break;
  }
  const showVal = type !== 'summon' && value != null;
  return {
    title,
    label,
    body,
    icon: skillIconKey(type),
    value: showVal ? value : null,
    type,
  };
}
