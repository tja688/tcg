// 全局配置：布局尺寸、规则数值、配色
export const CFG = {
  card: { w: 1.9, h: 2.66, texW: 512, texH: 716, radius: 34 },

  layout: {
    handY: 3.18, handZ: 6.3,
    enemyHandY: 2.35, enemyHandZ: -7.55,
    rowZ: { player: 1.95, enemy: -2.35 },
    minionY: 1.3,          // 站立卡牌中心高度
    minionTilt: -0.3,      // 站立卡牌向后仰角
    boardSpacing: 2.22,
    heroPos: { player: [-5.5, 1.12, 4.7], enemy: [0, 1.12, -5.62] },
    manaAnchor: { player: [3.35, 0.26, 5.8], enemy: [-2.3, 0.26, -4.9] },
    deckPos: { player: [7.35, 0.06, 4.35], enemy: [-7.35, 0.06, -4.35] },
    endTurnPos: [7.5, 0.16, -0.2],
    revealPos: { player: [0, 3.3, 2.6], enemy: [0, 3.15, -0.2] },
    dragPlaneY: 1.15,
    playerRowZone: { zMin: 0.55, zMax: 3.4, xMax: 7.6 },
    spellCastZ: 4.55,
    dropZone: { y: 0.04, z: 1.95, w: 13.6, d: 2.7 },
  },

  rules: {
    maxBoard: 6, maxHand: 10, maxMana: 10,
    heroHp: 40, startHandPlayer: 4, startHandEnemy: 4,
    startGold: 80,
    restHealRatio: 0.3, restHealMin: 12,
    shopRemove: 75, shopRefresh: 25,
    combatGold: [14, 20], eliteGold: [26, 36],
  },

  colors: {
    gold: 0xf2d089,
    playableGlow: 0x53ffb0,
    hoverGlow: 0xffe9a8,
    targetGlow: 0xff5040,
    readyRing: 0x59ffb4,
    exhaustRing: 0x3a3a4a,
    tauntRing: 0xffc95e,
    rarity: {
      common: '#c2c9d6', rare: '#4da6ff', epic: '#c86bff', legendary: '#ffa726',
    },
  },
};
