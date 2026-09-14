/**
 * 背景音乐状态机。
 * 三首曲目各占一个 Audio 槽，任何时刻最多一首在听；切歌只认最新目标，
 * 当前交叉淡化结束后再跟，避免旧的异步 play 把两首甚至三首叠在一起。
 */
import { BGM_FILES, bgmKeyForFile, bgmUrl } from './clips.js';

const FADE_SEC = 0.8;
const FADE_SEC_REDUCED = 0.12;

const SCENE_TRACK = {
  title: 'title',
  map: 'explore',
  shop: 'explore',
  rest: 'explore',
  event: 'explore',
  treasure: 'explore',
  reward: 'explore',
  win: 'explore',
  lose: 'explore',
  combat: 'combat',
  elite: 'combat',
  boss: 'combat',
};

function fadeSec() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    ? FADE_SEC_REDUCED
    : FADE_SEC;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function trackForScene(scene) {
  return SCENE_TRACK[scene] || 'explore';
}

export class Bgm {
  constructor(engine) {
    this.engine = engine;
    this.scene = 'title';
    this.pending = '';
    this.currentUrl = '';
    this._src = null;
    this._gain = null;
    this._slots = {};
    this._ready = false;
    this._wantKey = '';
    this._activeKey = '';
    this._fadingTo = '';
    this._job = null;
    this._dirty = false;
    this._unlocking = false;
    this._unlocked = false;
    this._fadeSecOverride = null;
  }

  setScene(scene) {
    this.scene = scene || 'title';
    const key = trackForScene(this.scene);
    this.pending = BGM_FILES[key] || '';
    this._wantKey = key;
    this._kick();
    return this.pending;
  }

  setTrack(filename) {
    this.pending = filename || '';
    this._wantKey = filename ? bgmKeyForFile(filename) : '';
    this._kick();
  }

  async play() {
    if (!this._wantKey) {
      const key = trackForScene(this.scene);
      this._wantKey = key;
      this.pending = BGM_FILES[key] || '';
    }
    await this.engine.resume();
    this._kick();
    if (this._job) await this._job;
    return !!this._activeKey && !this._slot(this._activeKey)?.el.paused;
  }

  async fadeTo(volume, seconds = 0.6) {
    const slot = this._slot(this._activeKey);
    if (!slot || !this.engine.ctx) return;
    const now = this.engine.ctx.currentTime;
    const g = slot.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(Math.max(0, volume), now + Math.max(0.05, seconds));
    this._gain = slot.gain;
  }

  async stop(seconds = 0.4) {
    this._wantKey = '';
    this.pending = '';
    this._fadeSecOverride = seconds;
    this._kick();
    if (this._job) await this._job;
    this._fadeSecOverride = null;
  }

  ensurePlaying() {
    if (this._wantKey) this._kick();
  }

  prefetch() {
    this._ensureGraph();
    for (const slot of Object.values(this._slots)) {
      try { slot.el.load(); } catch { /* 预载失败就等首次播放 */ }
    }
  }

  async unlock() {
    this._ensureGraph();
    this._unlocking = true;
    const pending = [];
    try {
      for (const slot of Object.values(this._slots)) {
        if (!slot.el.paused) continue;
        slot.el.muted = true;
        pending.push(Promise.resolve(slot.el.play()).catch(() => {}));
      }
      await this.engine.resume();
      await Promise.race([Promise.all(pending), sleep(400)]);
      for (const slot of Object.values(this._slots)) {
        if (slot.key === this._wantKey || slot.key === this._activeKey || slot.key === this._fadingTo) {
          slot.el.muted = false;
          continue;
        }
        this._silence(slot, true);
        slot.el.muted = false;
      }
    } finally {
      this._unlocking = false;
    }
    this._unlocked = true;
    this.ensurePlaying();
  }

  get ready() {
    return !!this._wantKey;
  }

  get snapshot() {
    return {
      scene: this.scene,
      want: this._wantKey,
      active: this._activeKey,
      fadingTo: this._fadingTo,
      playing: Object.values(this._slots)
        .filter((s) => !s.el.paused)
        .map((s) => s.key),
    };
  }

  _slot(key) {
    return key ? this._slots[key] : null;
  }

  _fadeDuration() {
    return this._fadeSecOverride ?? fadeSec();
  }

  _ensureGraph() {
    if (this._ready) return true;
    this.engine.init();
    const ctx = this.engine.ctx;
    const dest = this.engine.buses.bgm;
    if (!ctx || !dest) return false;
    for (const key of Object.keys(BGM_FILES)) {
      const el = new Audio(bgmUrl(key));
      el.loop = true;
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      el.playsInline = true;
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', '');
      el.volume = 1;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const src = ctx.createMediaElementSource(el);
      src.connect(gain).connect(dest);
      const slot = { key, el, gain, src };
      el.addEventListener('play', () => this._onSlotPlay(slot));
      this._slots[key] = slot;
    }
    this._ready = true;
    return true;
  }

  _onSlotPlay(slot) {
    if (this._unlocking) return;
    const allowed = slot.key === this._wantKey
      || slot.key === this._activeKey
      || slot.key === this._fadingTo;
    if (!allowed) this._silence(slot);
  }

  _silence(slot, reset = false) {
    if (!slot) return;
    try { slot.el.pause(); } catch { /* already paused */ }
    const ctx = this.engine.ctx;
    if (ctx && slot.gain) {
      const now = ctx.currentTime;
      slot.gain.gain.cancelScheduledValues(now);
      slot.gain.gain.setValueAtTime(0, now);
    } else if (slot.gain) {
      slot.gain.gain.value = 0;
    }
    if (reset) {
      try { slot.el.currentTime = 0; } catch { /* ignore */ }
    }
  }

  _enforceExclusive(keepKey, alsoKeep = '') {
    for (const slot of Object.values(this._slots)) {
      if (slot.key === keepKey || slot.key === alsoKeep) continue;
      if (!slot.el.paused || slot.gain.gain.value > 0.001) this._silence(slot);
    }
  }

  _kick() {
    this._dirty = true;
    if (this._job) return;
    this._job = this._run().finally(() => {
      this._job = null;
      if (this._dirty) this._kick();
    });
  }

  async _run() {
    do {
      this._dirty = false;
      if (!this._ensureGraph()) return;
      await this.engine.resume();
      const want = this._wantKey;
      if (!want) {
        await this._fadeAllOut();
        this._activeKey = '';
        this._fadingTo = '';
        this.currentUrl = '';
        this._src = null;
        this._gain = null;
        this._enforceExclusive('');
        continue;
      }
      const live = this._slot(want);
      if (this._activeKey === want && live && !live.el.paused) {
        this._enforceExclusive(want);
        this.currentUrl = bgmUrl(want);
        this._src = live.el;
        this._gain = live.gain;
        continue;
      }
      await this._crossfade(want);
    } while (this._dirty);
  }

  async _fadeAllOut() {
    const dur = this._fadeDuration();
    const ctx = this.engine.ctx;
    const live = Object.values(this._slots).filter((s) => !s.el.paused || s.gain.gain.value > 0.001);
    if (!live.length) return;
    if (ctx) {
      const now = ctx.currentTime;
      for (const slot of live) {
        slot.gain.gain.cancelScheduledValues(now);
        slot.gain.gain.setValueAtTime(slot.gain.gain.value, now);
        slot.gain.gain.linearRampToValueAtTime(0, now + dur);
      }
    }
    await sleep(dur * 1000);
    for (const slot of Object.values(this._slots)) this._silence(slot);
  }

  async _crossfade(wantKey) {
    const incoming = this._slot(wantKey);
    if (!incoming) return;

    const outgoingKey = this._activeKey && this._activeKey !== wantKey ? this._activeKey : '';
    this._enforceExclusive(wantKey, outgoingKey);
    this._fadingTo = wantKey;

    incoming.el.muted = false;
    if (wantKey === 'combat') {
      try { incoming.el.currentTime = 0; } catch { /* ignore */ }
    }
    incoming.el.play().catch(() => {});
    const t0 = performance.now();
    while (incoming.el.paused && performance.now() - t0 < 1600) {
      await sleep(50);
    }
    if (incoming.el.paused) {
      this._fadingTo = '';
      return;
    }

    if (this._wantKey !== wantKey) {
      this._fadingTo = '';
      return;
    }

    const ctx = this.engine.ctx;
    const dur = this._fadeDuration();
    const outgoing = this._slot(outgoingKey);
    if (ctx) {
      const now = ctx.currentTime;
      incoming.gain.gain.cancelScheduledValues(now);
      incoming.gain.gain.setValueAtTime(incoming.gain.gain.value, now);
      incoming.gain.gain.linearRampToValueAtTime(1, now + dur);
      if (outgoing) {
        outgoing.gain.gain.cancelScheduledValues(now);
        outgoing.gain.gain.setValueAtTime(outgoing.gain.gain.value, now);
        outgoing.gain.gain.linearRampToValueAtTime(0, now + dur);
      }
    } else {
      incoming.gain.gain.value = 1;
      if (outgoing) outgoing.gain.gain.value = 0;
    }

    await sleep(dur * 1000);

    if (outgoing) this._silence(outgoing);
    this._activeKey = wantKey;
    this._fadingTo = '';
    this.currentUrl = bgmUrl(wantKey);
    this._src = incoming.el;
    this._gain = incoming.gain;
    this._enforceExclusive(wantKey);
  }
}
