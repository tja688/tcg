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
  card_back: '/assets/card_back.png',
  arena_top: '/assets/arena_top.png',
  backdrop: '/assets/backdrop.png',
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
