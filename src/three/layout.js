import * as THREE from 'three';
import { CFG } from '../config.js';

const L = CFG.layout;

// 玩家手牌扇形
export function handTransforms(n) {
  const out = [];
  const spread = Math.min(1.16, 6.6 / Math.max(n, 1));
  const mid = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const dx = i - mid;
    out.push({
      pos: new THREE.Vector3(
        dx * spread,
        L.handY - Math.abs(dx) * 0.09,
        L.handZ + Math.abs(dx) * 0.06 + i * 0.012,
      ),
      rot: new THREE.Euler(-0.66, -dx * 0.022, -dx * 0.062),
      scale: 0.92,
    });
  }
  return out;
}

// 悬停手牌的抬升姿态
export function handHoverTransform(base) {
  return {
    pos: new THREE.Vector3(base.pos.x, base.pos.y + 1.15, base.pos.z - 0.92),
    rot: new THREE.Euler(-0.36, 0, 0),
    scale: 1.32,
  };
}

// 敌方手牌（卡背小扇形）
export function enemyHandTransforms(n) {
  const out = [];
  const spread = Math.min(0.62, 4.4 / Math.max(n, 1));
  const mid = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const dx = i - mid;
    out.push({
      pos: new THREE.Vector3(dx * spread, L.enemyHandY + Math.abs(dx) * -0.03, L.enemyHandZ - i * 0.012),
      rot: new THREE.Euler(0.5, Math.PI + dx * 0.03, dx * 0.05),
      scale: 0.72,
    });
  }
  return out;
}

// 战场随从一排（站立、微仰）
export function boardTransforms(n, side) {
  const out = [];
  const spacing = Math.min(L.boardSpacing, 13.2 / Math.max(n, 1));
  const mid = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    out.push({
      pos: new THREE.Vector3((i - mid) * spacing, L.minionY, L.rowZ[side]),
      rot: new THREE.Euler(L.minionTilt, 0, 0),
      scale: 1,
    });
  }
  return out;
}

// 拖拽落子时：根据 x 求插入槽位（按 n+1 张卡的布局取最近）
export function slotFromX(x, n) {
  const total = n + 1;
  const spacing = Math.min(L.boardSpacing, 13.2 / total);
  const mid = (total - 1) / 2;
  let best = 0, bestD = Infinity;
  for (let i = 0; i < total; i++) {
    const cx = (i - mid) * spacing;
    const d = Math.abs(x - cx);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// 战场布局但空出 gap 槽位（拖拽预览）
export function boardTransformsWithGap(n, side, gapIndex) {
  const total = n + 1;
  const spacing = Math.min(L.boardSpacing, 13.2 / total);
  const mid = (total - 1) / 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const vi = i >= gapIndex ? i + 1 : i;
    out.push({
      pos: new THREE.Vector3((vi - mid) * spacing, L.minionY, L.rowZ[side]),
      rot: new THREE.Euler(L.minionTilt, 0, 0),
      scale: 1,
    });
  }
  return out;
}
