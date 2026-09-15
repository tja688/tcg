export const TUTORIAL_STORAGE_KEY = 'tcg_tutorial_done';

export function memoryStorage(init = {}) {
  const map = { ...init };
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: (k) => { delete map[k]; },
  };
}

function store(storage) {
  return storage || globalThis.localStorage;
}

export function isTutorialDone(storage) {
  try {
    return store(storage).getItem(TUTORIAL_STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

export function markTutorialDone(storage) {
  try {
    store(storage).setItem(TUTORIAL_STORAGE_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

export function resetTutorialProgress(storage) {
  try {
    store(storage).removeItem(TUTORIAL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function shouldArmTutorial(storage) {
  return !isTutorialDone(storage);
}
