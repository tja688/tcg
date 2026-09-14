const BUS_NAMES = ['ui', 'combat', 'sfx', 'bgm'];
const MAX_VOICES = { ui: 6, combat: 12, sfx: 10, bgm: 2 };

export function dbToGain(db) {
  return Math.pow(10, (db || 0) / 20);
}

function loadNum(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw == null || raw === '') return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.buses = {};
    this.buffers = new Map();
    this.loading = new Map();
    this.raw = new Map();
    this.voices = { ui: [], combat: [], sfx: [], bgm: [] };
    this.lastCueAt = new Map();
    this.muted = localStorage.getItem('tcg_muted') === '1';
    this.masterVol = loadNum('tcg_master_vol', 1);
    this.sfxVol = loadNum('tcg_sfx_vol', 0.8);
    this.busVol = {
      ui: this.sfxVol,
      combat: this.sfxVol,
      sfx: this.sfxVol,
      bgm: loadNum('tcg_bgm_vol', 0.5),
    };
    this.debug = localStorage.getItem('tcg_audio_debug') === '1';
    this._noiseBuf = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      for (const name of BUS_NAMES) {
        const g = this.ctx.createGain();
        g.connect(this.master);
        this.buses[name] = g;
      }
      this.applyGains();
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * 1.2));
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  async resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch { /* 浏览器策略 */ }
    }
  }

  applyGains() {
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : 0.42 * this.masterVol;
    for (const name of BUS_NAMES) {
      if (this.buses[name]) this.buses[name].gain.value = this.busVol[name] ?? 1;
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
    localStorage.setItem('tcg_muted', this.muted ? '1' : '0');
    this.applyGains();
  }

  setMasterVolume(v) {
    this.masterVol = Math.max(0, Math.min(1, v));
    localStorage.setItem('tcg_master_vol', String(this.masterVol));
    this.applyGains();
  }

  setBusVolume(bus, v) {
    if (!BUS_NAMES.includes(bus)) return;
    this.busVol[bus] = Math.max(0, Math.min(1, v));
    localStorage.setItem(`tcg_${bus}_vol`, String(this.busVol[bus]));
    if (bus === 'sfx') this.sfxVol = this.busVol.sfx;
    this.applyGains();
  }

  setSfxVolume(v) {
    const n = Math.max(0, Math.min(1, v));
    this.sfxVol = n;
    this.busVol.ui = n;
    this.busVol.combat = n;
    this.busVol.sfx = n;
    localStorage.setItem('tcg_sfx_vol', String(n));
    this.applyGains();
  }

  async fetchRaw(url) {
    if (this.raw.has(url)) return this.raw.get(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`audio ${res.status} ${url}`);
    const buf = await res.arrayBuffer();
    this.raw.set(url, buf);
    return buf;
  }

  async load(url) {
    if (!url) return null;
    if (this.buffers.has(url)) return this.buffers.get(url);
    if (this.loading.has(url)) return this.loading.get(url);
    const job = (async () => {
      const raw = await this.fetchRaw(url);
      this.init();
      if (!this.ctx) return null;
      const copy = raw.slice(0);
      const decoded = await this.ctx.decodeAudioData(copy);
      this.buffers.set(url, decoded);
      return decoded;
    })().catch(() => {
      this.loading.delete(url);
      return null;
    });
    this.loading.set(url, job);
    const buf = await job;
    this.loading.delete(url);
    return buf;
  }

  gate(cueId, interval) {
    if (!interval) return true;
    const now = performance.now() / 1000;
    const last = this.lastCueAt.get(cueId) || 0;
    if (now - last < interval) return false;
    this.lastCueAt.set(cueId, now);
    return true;
  }

  stealOldest(bus) {
    const list = this.voices[bus];
    if (!list || list.length < (MAX_VOICES[bus] || 8)) return;
    const old = list.shift();
    try { old.stop(); } catch { /* already ended */ }
  }

  playBuffer({
    buffer, bus = 'sfx', volume = 1, rate = 1, delay = 0, offset = 0,
  } = {}) {
    if (!this.ctx || this.muted || !buffer) return false;
    const dest = this.buses[bus] || this.buses.sfx;
    if (!dest) return false;
    this.stealOldest(bus);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = Math.max(0.5, Math.min(2, rate));
    const gain = this.ctx.createGain();
    gain.gain.value = Math.max(0, volume);
    src.connect(gain).connect(dest);
    const when = this.ctx.currentTime + Math.max(0, delay);
    const startAt = Math.max(0, Math.min(buffer.duration - 0.01, offset));
    try {
      src.start(when, startAt);
    } catch {
      return false;
    }
    const list = this.voices[bus];
    list.push(src);
    src.onended = () => {
      const i = list.indexOf(src);
      if (i >= 0) list.splice(i, 1);
    };
    return true;
  }

  tone({
    f = 440, f2 = null, t = 0.15, type = 'sine', g = 0.15, delay = 0, bus = 'sfx',
  } = {}) {
    if (!this.ctx || this.muted) return;
    const dest = this.buses[bus] || this.buses.sfx;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, now);
    if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), now + t);
    gain.gain.setValueAtTime(g, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t);
    osc.connect(gain).connect(dest);
    osc.start(now);
    osc.stop(now + t + 0.05);
  }

  noise({
    t = 0.3, g = 0.15, filter = 1200, f2 = null, q = 1, type = 'lowpass', delay = 0, bus = 'sfx',
  } = {}) {
    if (!this.ctx || this.muted || !this._noiseBuf) return;
    const dest = this.buses[bus] || this.buses.sfx;
    const now = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    const bi = this.ctx.createBiquadFilter();
    bi.type = type;
    bi.frequency.setValueAtTime(filter, now);
    if (f2) bi.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), now + t);
    bi.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(g, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t);
    src.connect(bi).connect(gain).connect(dest);
    src.start(now);
    src.stop(now + t + 0.05);
  }
}
