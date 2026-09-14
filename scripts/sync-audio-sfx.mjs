import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(
  'C:/Users/jinji/Documents/GitHub/TJ-NinegridGambit/Assets/Resources/audio/SFX',
);
const DST = path.resolve('public/assets/audio/sfx');

/** 源文件名 → 本仓库 ASCII 文件名。只同步会用到的切片，不搬整库。 */
export const SOURCE_MAP = {
  '卡牌聚焦.wav': 'card_hover.wav',
  '点击1增强.mp3': 'card_select.mp3',
  '卡牌取出包装1增强.mp3': 'card_pickup.mp3',
  '卡牌滑动2增强.mp3': 'card_slide.mp3',
  '卡牌放置1增强.mp3': 'card_place.mp3',
  '放置卡片.wav': 'card_hand.wav',
  '添加卡牌.mp3': 'card_deal.mp3',
  '抽牌声.wav': 'card_draw.wav',
  '洗牌_短版.wav': 'shuffle.wav',
  '洗牌极短切分.wav': 'shuffle_short.wav',
  '翻牌.wav': 'card_flip.wav',
  '卡牌摧毁增强.mp3': 'card_shatter.mp3',
  '撤退增强.FG.mp3': 'card_exit.mp3',
  '卡牌打击1.wav': 'card_strike.wav',
  '复古嗖声.mp3': 'whoosh.mp3',
  '挥舞.mp3': 'swing.mp3',
  '挥动增强.mp3': 'swing_a.mp3',
  '挥动2增强.mp3': 'swing_b.mp3',
  '挥动3增强.mp3': 'swing_c.mp3',
  '用力增强.mp3': 'effort.mp3',
  '斩击.wav': 'slash.wav',
  '07 人类剑攻击.mp3': 'sword.mp3',
  '07 人类剑攻击_1.mp3': 'sword_b.mp3',
  '物品击中.wav': 'hit_flesh.wav',
  '剑受击.wav': 'hit_armor.wav',
  '护甲格挡4增强.mp3': 'armor_block.mp3',
  '518850 米奇13 物品装备增强.mp3': 'armor_gain.mp3',
  '英雄死亡增强.FG.mp3': 'death.mp3',
  '火球增强.mp3': 'fireball.mp3',
  '闪电.mp3': 'lightning.mp3',
  '530356 丹尼尔波德洛维奇 电击.mp3': 'zap.mp3',
  '神圣增强.FG.mp3': 'holy.mp3',
  '准备法术增强.FG.mp3': 'spell_prep.mp3',
  '施法增强.mp3': 'cast.mp3',
  'Break_Explosions2.wav': 'explosion.wav',
  '敌方增益增强.mp3': 'buff.mp3',
  '敌方减益增强.mp3': 'debuff.mp3',
  '激活增强.mp3': 'trigger.mp3',
  '地震增强.mp3': 'rumble.mp3',
  '装备饰品增强.mp3': 'relic.mp3',
  '潜行增强.mp3': 'shadow.mp3',
  '装备利器增强.mp3': 'weapon.mp3',
  '界面聚焦.wav': 'ui_hover.wav',
  '按钮点击.wav': 'ui_click.wav',
  '滴答增强.mp3': 'ui_confirm.mp3',
  '复古单声.wav': 'ui_reject.wav',
  '泡泡音.wav': 'ui_cancel.wav',
  '界面翻页.wav': 'ui_page.wav',
  '打开菜单.wav': 'ui_menu.wav',
  '点击确认轻音.wav': 'ui_soft.wav',
  '失败铃声 00增强.mp3': 'fail_bell.mp3',
  '点击2增强.mp3': 'ui_tick.mp3',
  '幕布关闭增强.mp3': 'transition.mp3',
  '完整流程胜利.mp3': 'victory_run.mp3',
  '游戏失败.mp3': 'defeat.mp3',
  '战斗对局胜利.mp3': 'victory_combat.mp3',
  'boss房胜利2.mp3': 'victory_boss.mp3',
  '打开关卡解锁.wav': 'reward.wav',
  '解锁增强.mp3': 'unlock.mp3',
  '失效增强.mp3': 'abandon.mp3',
  '房间清除增强.FG.mp3': 'room_clear.mp3',
  '阅读卷轴增强.FG.mp3': 'event.mp3',
  '01 箱子打开.mp3': 'chest.mp3',
  '获得翼键增强.mp3': 'rare_get.mp3',
  '治疗.mp3': 'heal.mp3',
  '药水使用增强.FG.mp3': 'potion.mp3',
  '硬币叮当.mp3': 'coin_ding.mp3',
  '掉落硬币.wav': 'coin_drop.wav',
  '购买物品.wav': 'buy.wav',
  '买卖物品增强.FG.mp3': 'sell.mp3',
  '卡牌升级.mp3': 'upgrade.mp3',
  '06 石头脚步声.mp3': 'step_a.mp3',
  '06 石头脚步声_1.mp3': 'step_b.mp3',
  '06 石头脚步声_2.mp3': 'step_c.mp3',
};

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  fs.mkdirSync(DST, { recursive: true });
  fs.mkdirSync(path.resolve('public/assets/audio/bgm'), { recursive: true });
  const keep = path.resolve('public/assets/audio/bgm/.gitkeep');
  if (!fs.existsSync(keep)) fs.writeFileSync(keep, '');

  let ok = 0;
  const missing = [];
  for (const [from, to] of Object.entries(SOURCE_MAP)) {
    const a = path.join(SRC, from);
    if (!fs.existsSync(a)) {
      missing.push(from);
      continue;
    }
    fs.copyFileSync(a, path.join(DST, to));
    ok += 1;
  }
  console.log(`copied ${ok}/${Object.keys(SOURCE_MAP).length} clips → ${DST}`);
  if (missing.length) {
    console.error('missing sources:');
    for (const name of missing) console.error('  -', name);
    process.exit(1);
  }
}
