import * as THREE from 'three';

/** 全场特效共享时钟，避免每个材质各自记时。 */
export const vfxClock = {
  uTime: { value: 0 },
};

export function tickVfx(t) {
  vfxClock.uTime.value = t;
}

export function hexColor(hex) {
  return new THREE.Color(hex);
}

export function toColor(value, fallback = 0xffffff) {
  if (value?.isColor) return value.clone();
  return new THREE.Color(value ?? fallback);
}
