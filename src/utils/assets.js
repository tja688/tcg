import * as THREE from 'three';
import {
  makeGlowTexture, makeRingTexture, makeNoiseTexture, makeCardGlowTexture,
  makeShieldTexture, makeStreakTexture, makeSparkTexture, makeSlashTexture,
} from './canvasTex.js';

const IMAGE_LIST = {
  flame_imp: '/assets/art_flame_imp.png',
  forest_wolf: '/assets/art_forest_wolf.png',
  crystal_guardian: '/assets/art_crystal_guardian.png',
  shadow_assassin: '/assets/art_shadow_assassin.png',
  thunder_samurai: '/assets/art_thunder_samurai.png',
  frost_elemental: '/assets/art_frost_elemental.png',
  radiant_knight: '/assets/art_radiant_knight.png',
  ancient_dragon: '/assets/art_ancient_dragon.png',
  fireball: '/assets/art_fireball.png',
  lightning_bolt: '/assets/art_lightning_bolt.png',
  healing_light: '/assets/art_healing_light.png',
  arcane_wisdom: '/assets/art_arcane_wisdom.png',
  flamestorm: '/assets/art_flamestorm.png',
  cinder_scout: '/assets/art_cinder_scout.png',
  pyre_hound: '/assets/art_pyre_hound.png',
  moss_turtle: '/assets/art_moss_turtle.png',
  ward_priest: '/assets/art_ward_priest.png',
  echo_mage: '/assets/art_echo_mage.png',
  void_siphon: '/assets/art_void_siphon.png',
  silver_chaplain: '/assets/art_silver_chaplain.png',
  meteor_shard: '/assets/art_meteor_shard.png',
  dawn_paladin: '/assets/art_dawn_paladin.png',
  twin_shade: '/assets/art_twin_shade.png',
  card_back: '/assets/card_back.png',
  arena_top: '/assets/arena_top.png',
  backdrop: '/assets/backdrop.png',
  backdrop_dusk: '/assets/backdrop_dusk.png',
  backdrop_ashen: '/assets/backdrop_ashen.png',
  backdrop_void: '/assets/backdrop_void.png',
  backdrop_threshold: '/assets/backdrop_threshold.png',
  backdrop_abyss: '/assets/backdrop_abyss.png',
  hero_mage: '/assets/hero_mage.png',
  hero_warlock: '/assets/hero_warlock.png',
  map_act1: '/assets/ui/map_act1.png',
  mark_combat: '/assets/ui/mark_combat.png',
  mark_elite: '/assets/ui/mark_elite.png',
  mark_event: '/assets/ui/mark_event.png',
  mark_shop: '/assets/ui/mark_shop.png',
  mark_rest: '/assets/ui/mark_rest.png',
  mark_treasure: '/assets/ui/mark_treasure.png',
  mark_boss: '/assets/ui/mark_boss.png',
  pawn_player: '/assets/ui/pawn_player.png',
  skill_attack: '/assets/ui/skill_attack.png',
  skill_defend: '/assets/ui/skill_defend.png',
  skill_buff: '/assets/ui/skill_buff.png',
  skill_debuff: '/assets/ui/skill_debuff.png',
  skill_summon: '/assets/ui/skill_summon.png',
  skill_special: '/assets/ui/skill_special.png',
};

export function imageSrc(key, fallback = 'hero_warlock') {
  return IMAGE_LIST[key] || IMAGE_LIST[fallback] || '';
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // 缺图时走程序化回退
    img.src = url;
  });
}

export async function loadAssets(onProgress = () => {}) {
  const keys = Object.keys(IMAGE_LIST);
  const images = {};
  let done = 0;
  await Promise.all(keys.map(async (k) => {
    images[k] = await loadImage(IMAGE_LIST[k]);
    done++;
    onProgress(done / keys.length);
  }));

  const texOf = (key) => {
    const img = images[key];
    if (!img) return null;
    const t = new THREE.Texture(img);
    t.needsUpdate = true;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };

  return {
    images,
    tex: {
      cardBack: texOf('card_back'),
      arena: texOf('arena_top'),
      backdrop: texOf('backdrop'),
      backdrop_dusk: texOf('backdrop_dusk'),
      backdrop_ashen: texOf('backdrop_ashen'),
      backdrop_void: texOf('backdrop_void'),
      backdrop_threshold: texOf('backdrop_threshold'),
      backdrop_abyss: texOf('backdrop_abyss'),
    },
    glowTex: makeGlowTexture(),
    ringTex: makeRingTexture(),
    noiseTex: makeNoiseTexture(),
    cardGlowTex: makeCardGlowTexture(),
    shieldTex: makeShieldTexture(),
    streakTex: makeStreakTexture(),
    sparkTex: makeSparkTexture(),
    slashTex: makeSlashTexture(),
  };
}
