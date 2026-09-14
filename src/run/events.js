import { CFG } from '../config.js';
import { CARDS, collectibleCards, randomCollectible } from '../game/cards.js';
import { getRelic, randomRelic } from './relics.js';
import { applyGold } from './rewards.js';

function clampHp(run) {
  run.hp = Math.max(0, Math.min(run.maxHp, run.hp));
}

export function addMaxHp(run, n) {
  const gain = Math.max(0, Math.round(n));
  if (!gain) return 0;
  run.maxHp += gain;
  run.hp += gain;
  return gain;
}

export const EVENTS = {
  blood_coin: {
    id: 'blood_coin',
    title: '血色钱币',
    art: 'fireball',
    body: '一座生锈的祭坛上静静躺着两枚钱币。左为赤铜，右为苍银。风里有低语：下注，或者走开。',
    options: [
      {
        id: 'gamble',
        label: '翻转赤铜币',
        hint: '50%：+45 金 / 失去 8 生命',
        apply(run, ctx) {
          if (ctx.rng() < 0.5) {
            applyGold(run, 45);
            return { text: '钱币落地，金光炸开。你捡起 45 金币。', gold: 45 };
          }
          run.hp -= 8; clampHp(run);
          return { text: '钱币咬了你一口。失去 8 点生命。', hp: -8 };
        },
      },
      {
        id: 'safe',
        label: '只取苍银',
        hint: '+15 金',
        apply(run) {
          applyGold(run, 15);
          return { text: '你没有贪婪。衣袋里多了 15 金币。', gold: 15 };
        },
      },
      {
        id: 'leave',
        label: '绕开祭坛',
        hint: '什么也不做',
        apply() { return { text: '低语消失在走廊深处。' }; },
      },
    ],
  },

  spring_price: {
    id: 'spring_price',
    title: '计价之泉',
    art: 'healing_light',
    body: '泉水澄澈，却标着价码。旁边的石碑写着：生命有价，记忆亦可抵押。',
    options: [
      {
        id: 'heal',
        label: '付 25 金沐浴',
        hint: '-25 金，生命上限 +6',
        disabled: (run) => run.gold < 25,
        disabledHint: '金币不足 25',
        apply(run) {
          run.gold -= 25;
          addMaxHp(run, 6);
          return { text: '温水没过肩线。生命上限提高 6 点。', gold: -25, maxHp: 6 };
        },
      },
      {
        id: 'blood',
        label: '以血换金',
        hint: '-10 生命，+40 金',
        apply(run) {
          run.hp -= 10; clampHp(run);
          applyGold(run, 40);
          return { text: '泉水变红。你获得 40 金币。', hp: -10, gold: 40 };
        },
      },
      {
        id: 'leave',
        label: '口干也离开',
        hint: '什么也不做',
        apply() { return { text: '泉声被你甩在身后。' }; },
      },
    ],
  },

  transmute: {
    id: 'transmute',
    title: '蜕变坩埚',
    art: 'arcane_wisdom',
    body: '一位戴铜面具的炼金师向你伸出坩埚：「丢一张牌进来。我不保证它还认得你。」',
    options: [
      {
        id: 'transform',
        label: '投入一张牌',
        hint: '将一张牌变换为随机另一张',
        needPick: 'deck',
        apply(run, ctx) {
          const id = ctx.picked;
          if (!id) return { text: '你收回了手。坩埚咕嘟了一声。' };
          const next = randomCollectible(ctx.rng, [id]);
          const i = run.deck.indexOf(id);
          if (i >= 0) run.deck[i] = next.id;
          const a = CARDS[id]?.name || id;
          return { text: `「${a}」在沸腾中变成了「${next.name}」。`, transform: [id, next.id] };
        },
      },
      {
        id: 'pay',
        label: '付 20 金请他精炼',
        hint: '-20 金，获得一张稀有或以上的牌',
        disabled: (run) => run.gold < 20,
        disabledHint: '金币不足 20',
        apply(run, ctx) {
          run.gold -= 20;
          const pool = collectibleCards().filter((c) => c.rarity === 'rare' || c.rarity === 'epic' || c.rarity === 'legendary');
          const card = pool[Math.floor(ctx.rng() * pool.length)];
          run.deck.push(card.id);
          return { text: `炼金师扔给你「${card.name}」。`, gold: -20, addCard: card.id };
        },
      },
    ],
  },

  relic_altar: {
    id: 'relic_altar',
    title: '遗物祭坛',
    art: 'ancient_dragon',
    body: '黑石台上封着一件旧物。铭文写：取者须以体温为契。',
    options: [
      {
        id: 'take',
        label: '取下遗物',
        hint: '获得一件遗物，失去 7 生命',
        apply(run, ctx) {
          run.hp -= 7; clampHp(run);
          const id = ctx.grantRelic();
          const r = getRelic(id);
          return { text: r ? `你获得「${r.name}」，胸口一阵发冷。` : '祭坛是空的。', hp: -7, relic: id };
        },
      },
      {
        id: 'pray',
        label: '只做祈祷',
        hint: '生命上限 +3',
        apply(run) {
          addMaxHp(run, 3);
          return { text: '旧神没有回答，经脉却宽了一寸。', maxHp: 3 };
        },
      },
    ],
  },

  ambush_toll: {
    id: 'ambush_toll',
    title: '关卡征收',
    art: 'shadow_assassin',
    body: '三名蒙面人拦住去路。「过路费 35 金。否则——我们很乐意试试你的牌。」',
    options: [
      {
        id: 'pay',
        label: '交过路费',
        hint: '-35 金',
        disabled: (run) => run.gold < 35,
        disabledHint: '金币不足 35',
        apply(run) {
          run.gold -= 35;
          return { text: '他们让开了。你少了 35 金币。', gold: -35 };
        },
      },
      {
        id: 'fight',
        label: '拔剑拒绝',
        hint: '打一场遭遇战',
        apply() { return { text: '刀光先于言语落下。', combat: 'ambush_shade' }; },
      },
      {
        id: 'wound',
        label: '用血买路',
        hint: '-12 生命，保留金币',
        apply(run) {
          run.hp -= 12; clampHp(run);
          return { text: '他们收下一小瓶血，放你过去。', hp: -12 };
        },
      },
    ],
  },

  old_shrine: {
    id: 'old_shrine',
    title: '无名神龛',
    art: 'frost_elemental',
    body: '神龛上的名字被刮掉了。你只认出一行小字：路过的人，留下一声问候即可。',
    options: [
      {
        id: 'bow',
        label: '鞠躬致意',
        hint: '+18 金，生命上限 +2',
        apply(run) {
          applyGold(run, 18);
          addMaxHp(run, 2);
          return { text: '神龛里滚出几枚旧币，体魄也沉了一分。', gold: 18, maxHp: 2 };
        },
      },
      {
        id: 'scribble',
        label: '刻下自己的名字',
        hint: '获得一张牌，失去 4 生命',
        apply(run, ctx) {
          run.hp -= 4; clampHp(run);
          const card = randomCollectible(ctx.rng);
          run.deck.push(card.id);
          return { text: `石屑飞溅，「${card.name}」的纹样渗进牌库。`, hp: -4, addCard: card.id };
        },
      },
    ],
  },

  purge_well: {
    id: 'purge_well',
    title: '涤罪古井',
    art: 'crystal_guardian',
    body: '井口飘着纸灰。有人把不想要的牌扔了下去。井底传来一声满足的叹息。',
    options: [
      {
        id: 'remove_hp',
        label: '以血为祭，删一张牌',
        hint: '-6 生命，从牌库删除一张牌',
        needPick: 'deck',
        apply(run, ctx) {
          run.hp -= 6; clampHp(run);
          if (ctx.picked) {
            const i = run.deck.indexOf(ctx.picked);
            if (i >= 0) run.deck.splice(i, 1);
            return { text: `「${CARDS[ctx.picked]?.name}」沉入井底。`, hp: -6, removeCard: ctx.picked };
          }
          return { text: '你没有扔任何东西。井面重新平静。', hp: -6 };
        },
      },
      {
        id: 'remove_gold',
        label: '投 40 金，删一张牌',
        hint: '-40 金，删除一张牌',
        disabled: (run) => run.gold < 40,
        disabledHint: '金币不足 40',
        needPick: 'deck',
        apply(run, ctx) {
          run.gold -= 40;
          if (ctx.picked) {
            const i = run.deck.indexOf(ctx.picked);
            if (i >= 0) run.deck.splice(i, 1);
            return { text: `金币与「${CARDS[ctx.picked]?.name}」一同落下。`, gold: -40, removeCard: ctx.picked };
          }
          return { text: '金币沉了，牌还在。', gold: -40 };
        },
      },
      {
        id: 'leave',
        label: '井边站一会儿就走',
        hint: '生命上限 +2',
        apply(run) {
          addMaxHp(run, 2);
          return { text: '阴凉很好。你觉得肩背更沉稳了。', maxHp: 2 };
        },
      },
    ],
  },

  fate_die: {
    id: 'fate_die',
    title: '命运骰盅',
    art: 'thunder_samurai',
    body: '赌徒只剩一只骰盅。「三或以上你赢。否则它吃生命。」他笑得很干。',
    options: [
      {
        id: 'roll',
        label: '掷骰',
        hint: '1–2：-9 生命；3–6：+30 金',
        apply(run, ctx) {
          const n = 1 + Math.floor(ctx.rng() * 6);
          if (n >= 3) {
            applyGold(run, 30);
            return { text: `骰面是 ${n}。你赢走 30 金币。`, gold: 30 };
          }
          run.hp -= 9; clampHp(run);
          return { text: `骰面是 ${n}。胸口一沉，失去 9 生命。`, hp: -9 };
        },
      },
      {
        id: 'buy',
        label: '买下他的骰盅（50 金）',
        hint: '-50 金，获得一件遗物',
        disabled: (run) => run.gold < 50,
        disabledHint: '金币不足 50',
        apply(run, ctx) {
          run.gold -= 50;
          const id = ctx.grantRelic();
          const r = getRelic(id);
          return { text: r ? `骰盅里掉出「${r.name}」。` : '里面是空的。', gold: -50, relic: id };
        },
      },
      {
        id: 'leave',
        label: '不赌',
        hint: '什么也不做',
        apply() { return { text: '赌徒耸耸肩，继续摇空盅。' }; },
      },
    ],
  },

  wandering_cart: {
    id: 'wandering_cart',
    title: '流浪货郎',
    art: 'forest_wolf',
    body: '板车吱呀作响。货郎只卖两样东西：一张便宜牌，或一口免费的水。',
    options: [
      {
        id: 'cheap',
        label: '买一张便宜牌（20 金）',
        hint: '-20 金，加入一张普通/稀有牌',
        disabled: (run) => run.gold < 20,
        disabledHint: '金币不足 20',
        apply(run, ctx) {
          run.gold -= 20;
          const pool = collectibleCards().filter((c) => c.rarity === 'common' || c.rarity === 'rare');
          const card = pool[Math.floor(ctx.rng() * pool.length)];
          run.deck.push(card.id);
          return { text: `货郎塞给你「${card.name}」，找零是一个眼神。`, gold: -20, addCard: card.id };
        },
      },
      {
        id: 'water',
        label: '只要免费的水',
        hint: '生命上限 +3',
        apply(run) {
          addMaxHp(run, 3);
          return { text: '水有铁锈味，却把经脉冲宽了些。', maxHp: 3 };
        },
      },
    ],
  },

  shadow_pact: {
    id: 'shadow_pact',
    title: '暗影契约',
    art: 'flamestorm',
    body: '羊皮纸自己展开。署名处已经有你的笔迹——只是日期在明天。',
    options: [
      {
        id: 'sign',
        label: '签字',
        hint: '获得一张史诗/传说牌，失去 11 生命',
        apply(run, ctx) {
          run.hp -= 11; clampHp(run);
          const pool = collectibleCards().filter((c) => c.rarity === 'epic' || c.rarity === 'legendary');
          const card = pool[Math.floor(ctx.rng() * pool.length)];
          run.deck.push(card.id);
          return { text: `契约生效。「${card.name}」落入牌库，指尖发麻。`, hp: -11, addCard: card.id };
        },
      },
      {
        id: 'tear',
        label: '撕毁契约',
        hint: '获得 22 金，加入一张「负担」',
        apply(run) {
          applyGold(run, 22);
          run.deck.push('burden');
          return { text: '纸屑变成金币，也变成一张沉重的「负担」。', gold: 22, addCard: 'burden' };
        },
      },
    ],
  },
};

export const EVENT_IDS = Object.keys(EVENTS);

export function getEvent(id) {
  return EVENTS[id] || EVENTS.old_shrine;
}

export function optionDisabled(run, opt) {
  return !!(opt.disabled && opt.disabled(run));
}

export function restMaxHpAmount(run) {
  let n = CFG.rules.restMaxHp;
  if ((run.relics || []).includes('iron_chalice')) n += CFG.rules.restMaxHpChalice;
  return n;
}
