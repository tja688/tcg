import { CFG } from '../config.js';
import { generateAct1 } from './map.js';
import { getRelic } from './relics.js';

export const STARTER_DECK = [
  'flame_imp', 'flame_imp',
  'void_wisp',
  'forest_wolf', 'forest_wolf',
  'stone_bulwark',
  'crystal_guardian',
  'holy_shock', 'holy_shock',
  'lightning_bolt',
  'healing_light',
  'frost_shield',
  'thunder_samurai',
  'fireball',
];

export function createRun(rng, seed) {
  return {
    seed,
    hp: CFG.rules.heroHp,
    maxHp: CFG.rules.heroHp,
    gold: CFG.rules.startGold,
    deck: STARTER_DECK.slice(),
    relics: [],
    map: generateAct1(rng),
    currentId: null,
    visited: [],
    locked: [],
    floor: 0,
    combatsWon: 0,
    pendingNode: false,
    alive: true,
    won: false,
    shop: null,
  };
}

export function grantRelic(run, id) {
  if (!id || run.relics.includes(id)) return null;
  run.relics.push(id);
  const def = getRelic(id);
  if (def?.onGain) def.onGain(run);
  return def;
}

export function snapshotRun(run) {
  return {
    seed: run.seed,
    hp: run.hp,
    maxHp: run.maxHp,
    gold: run.gold,
    deck: run.deck.slice(),
    relics: run.relics.slice(),
    currentId: run.currentId,
    floor: run.floor,
    visited: run.visited.length,
    combatsWon: run.combatsWon,
    alive: run.alive,
    won: run.won,
  };
}
