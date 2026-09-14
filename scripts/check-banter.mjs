import { Game, mkInstance } from '../src/game/game.js';
import { CARDS } from '../src/game/cards.js';
import { silentFx } from './fxStub.mjs';
import { sanitizeLine } from '../src/pseudoai/llm.js';
import { isUsableLine, takeSpoken, buildSpeechPrompt, buildThinkPrompt, fallbackLine } from '../src/pseudoai/voice.js';
import { personaOf } from '../src/pseudoai/personas.js';
import { peekPlan } from '../src/pseudoai/tactics.js';
import { beginThink, endThink, resetThinkHud, thinkSources } from '../src/pseudoai/think.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

const CLIP = '虚空萤火………已暴露。石垒卫残血，却仍挡在法师身前。晶刺反击';
const oldSlice = CLIP.slice(0, 28).replace(/[，,、；;：:\s]+$/, '');

{
  const line = sanitizeLine(CLIP);
  ok(line.includes('已暴露'), 'sanitize keeps first complete sentence');
  ok(line.includes('石垒卫'), 'sanitize keeps second complete sentence');
  ok(!line.endsWith('晶刺反'), 'sanitize does not mid-cut to 晶刺反');
  ok(line !== oldSlice, 'sanitize is not the old 28-char slice');
  const multiline = sanitizeLine('石垒卫，我先放下。\n别急着换，我还有霜盾。\n水晶守卫，等它出来。');
  ok(multiline.includes('石垒卫'), 'joins first line');
  ok(multiline.includes('霜盾'), 'keeps second line after join');
  ok(!multiline.includes('水晶守卫'), 'still drops a third sentence');
  ok(sanitizeLine('「石垒卫，我先放下。」') === '石垒卫，我先放下。', 'unwraps a fully quoted line');
  ok(sanitizeLine('「霜盾」先叠上。').includes('「霜盾」'), 'keeps inner card quotes');
}

{
  const long = '第一句说完了。第二句也说完了。第三句如果还在就会被丢掉。';
  const spoken = takeSpoken(long);
  ok(spoken.includes('第一句说完了。'), 'keeps first sentence');
  ok(spoken.includes('第二句也说完了。'), 'keeps second sentence');
  ok(!spoken.includes('第三句'), 'drops extra sentence instead of mid-cut');
}

{
  const one = '这是一句没有句号但是很长的完整口语还是不要从中间切断所以整句留下用来给气泡换行显示';
  ok(takeSpoken(one) === one, 'long unpunctuated line is not mid-cut');
  ok(takeSpoken('Nice face，小法师。') === 'Nice face，小法师。', 'keeps mixed english spaces');
}

{
  ok(sanitizeLine('作为AI，我建议你出烈焰风暴') === '', 'rejects strategy talk');
  ok(isUsableLine('嗯…', { type: 'idle' }), 'idle allows 嗯');
  ok(!isUsableLine('嗯…', { type: 'player_play' }), 'non-idle rejects hollow 嗯');
}

{
  const persona = personaOf({
    id: 'crystal_warden', name: '水晶守望者', title: '普通', blurb: '先叠甲，再反打。',
  });
  ok(persona.habit === 'invert', 'warden inverts');
  ok(persona.tic.includes('就这样'), 'warden tic');
  const { system, user } = buildSpeechPrompt(persona, null, { type: 'player_play', card: '虚空萤火', cardType: 'minion' }, {
    hint: '手里有「圣击」能点它',
  });
  ok(!/呢喃/.test(system), 'prompt dropped 呢喃');
  ok(!/不超过\d+个汉字/.test(system), 'prompt has no hard hanzi quota');
  ok(/口语|人话|完整/.test(system), 'prompt asks for spoken chinese');
  ok(user.includes('虚空萤火'), 'user names the played card');
  ok(user.includes('圣击'), 'user can mention a counter');

  const think = buildThinkPrompt(persona, null, { type: 'play', card: '石垒卫', cost: 2 }, {
    now: '打出「石垒卫」2费',
    next: ['出「霜盾」', '「水晶守卫」去打「虚空萤火」'],
  });
  ok(/打算|说话/.test(think.system), 'think prompt asks to talk through the plan');
  ok(think.user.includes('霜盾'), 'think prompt exposes next step');
  ok(!/不超过\d+个汉字/.test(think.system), 'think prompt has no hard hanzi quota');
}

{
  const persona = personaOf({ id: 'rot_whelp', name: '腐化龙嗣' });
  ok(persona.habit === 'giggle' && persona.tic.includes('咯咯'), 'whelp giggles');
  const lord = personaOf({ id: 'abyss_lord', name: '深渊魔王' });
  ok(lord.habit === 'mix_en', 'boss mixes english');
}

{
  const persona = personaOf({ id: 'ashen_pack', name: '灰烬掠夺者' });
  const line = fallbackLine(persona, { type: 'player_play', card: '烈焰小鬼', cardType: 'minion' }, null);
  ok(line.includes('烈焰小鬼'), 'fallback names the played card');
}

{
  const logs = [];
  const hud = { showLlmThink(t) { logs.push(t || ''); } };
  resetThinkHud(hud);
  beginThink('llm', hud);
  ok(thinkSources().active, 'llm source shows overlay');
  ok(logs.some(Boolean), 'overlay painted on first source');
  beginThink('fake', hud);
  ok(thinkSources().llm === 1 && thinkSources().fake === 1, 'both sources counted');
  endThink('llm');
  ok(thinkSources().active, 'still on after first source ends');
  endThink('fake');
  ok(!thinkSources().active, 'off when last source ends');
  ok(logs[logs.length - 1] === '', 'overlay cleared on last end');
  resetThinkHud(hud);
}

{
  const game = new Game(silentFx(), () => 0.1, {
    encounter: {
      id: 'crystal_warden', name: '水晶守望者', hp: 26,
      deck: ['frost_shield'], startBoard: [], startHand: 0,
      phases: [{ cycle: [{ type: 'defend', armor: 1, label: 'x' }], rules: [] }],
    },
    playerDeckIds: ['flame_imp'],
  });
  game.enemy.mana = 6;
  const stone = mkInstance(CARDS.stone_bulwark, 'enemy');
  const frost = mkInstance(CARDS.frost_shield, 'enemy');
  game.enemy.hand.push(stone, frost);
  const wisp = mkInstance(CARDS.void_wisp, 'player');
  wisp.onBoard = true;
  game.player.board.push(wisp);
  const guard = mkInstance(CARDS.crystal_guardian, 'enemy');
  guard.onBoard = true;
  guard.canAttack = true;
  guard.sick = false;
  game.enemy.board.push(guard);

  const plan = peekPlan(game, {
    type: 'play', card: '石垒卫', cost: 2, uid: stone.uid, cardType: 'minion',
  });
  ok(plan.now.includes('石垒卫'), 'plan names current play');
  ok(plan.next.length >= 1, 'plan has a follow-up');
  ok(plan.answers.includes('霜盾'), 'plan sees remaining hand');
}

if (fails.length) {
  console.error('FAIL\n' + fails.join('\n'));
  process.exit(1);
}
console.log('OK', { checks: 'banter voice overlay plan' });
