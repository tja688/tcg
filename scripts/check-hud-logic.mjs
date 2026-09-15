import { describeSkill, skillIconKey, skillSignature } from '../src/ui/enemySkills.js';
import { cardKeywordEntries, cardTipInfo, getTerm, linkTerms, TERMS } from '../src/ui/glossary.js';
import { getCard } from '../src/game/cards.js';
import { CFG } from '../src/config.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

{
  const atk = describeSkill({ type: 'attack', value: 4, title: '攻击', label: '斩杀加压 4' });
  ok(atk.body.includes('4'), 'attack body names damage');
  ok(atk.icon === 'skill_attack', 'attack uses attack art');
  ok(atk.value === 4, 'attack keeps value badge');
}

{
  const def = describeSkill({ type: 'defend', value: 5, title: '防御', label: '全力守御 5' });
  ok(def.body.includes('护甲'), 'defend talks about armor');
  ok(def.icon === 'skill_defend', 'defend uses defend art');
}

{
  const sum = describeSkill({ type: 'summon', value: 1, cardId: 'ember_whelp', title: '召唤', label: '唤出余烬幼崽' });
  ok(sum.body.includes('余烬幼崽'), 'summon names the minion');
  ok(sum.body.includes('1/1'), 'summon includes stats');
  ok(sum.value == null, 'summon hides numeric badge');
}

{
  const aoe = describeSkill({ type: 'special', special: 'aoe', value: 2, title: '特殊', label: '毒爆：全体 2 伤' });
  ok(aoe.body.includes('全体') || aoe.body.includes('所有随从'), 'aoe describes board damage');
  ok(skillIconKey('special') === 'skill_special', 'special icon key');
}

ok(skillSignature({ type: 'attack', value: 2, label: 'a' }) !== skillSignature({ type: 'attack', value: 3, label: 'a' }), 'signature changes with value');
ok(skillSignature(null) === '', 'empty signature for no intent');

ok(CFG.layout.manaAnchor.player[0] > 5.5, 'player mana sits near the deck, not the hand');
ok(CFG.layout.manaAnchor.player[0] < CFG.layout.deckPos.player[0], 'player mana is left of the deck');

const icons = ['skill_attack', 'skill_defend', 'skill_buff', 'skill_debuff', 'skill_summon', 'skill_special'];
for (const id of icons) {
  const p = resolve('public/assets/ui', `${id}.png`);
  ok(existsSync(p), `asset exists: ${id}.png`);
}

ok(TERMS.taunt.body.includes('英雄'), 'taunt explains face-block in plain words');
ok(TERMS.charge.body.includes('这个回合'), 'charge says you can attack now');
ok(TERMS.armor.body.includes('先'), 'armor soaks first');
ok(getTerm('pack:过牌')?.body.includes('抽'), 'pack draw tag has a tip');
ok(getTerm('node:elite')?.body.includes('遗物'), 'elite node mentions relic reward');

{
  const guard = getCard('crystal_guardian');
  ok(cardKeywordEntries(guard).some((t) => t.id === 'taunt'), 'guardian exposes taunt');
  ok(cardTipInfo(guard).title === '水晶守卫', 'card tip uses the printed name');
}

{
  const dawn = getCard('dawn_paladin');
  const tags = cardKeywordEntries(dawn).map((t) => t.id);
  ok(tags.includes('taunt') && tags.includes('battlecry'), 'dawn paladin lists both keywords');
}

{
  const echo = getCard('echo_mage');
  ok(cardKeywordEntries(echo).some((t) => t.id === 'deathrattle'), 'echo mage exposes deathrattle');
}

{
  const html = linkTerms('获得一件遗物，加入一张「负担」');
  ok(html.includes('data-tip="relic"'), 'event copy links relic');
  ok(html.includes('data-tip="burden"'), 'event copy links burden');
}

if (fails.length) {
  console.error('FAIL\n' + fails.join('\n'));
  process.exit(1);
}
console.log('OK', { checks: 'hud skill copy mana assets glossary' });
