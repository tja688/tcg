import { AudioEngine, dbToGain } from './engine.js';
import { Bgm } from './bgm.js';
import { CUES, allClipKeys, pickVariant } from './cues.js';
import { clipUrl } from './clips.js';

const UI_HOVER_SEL = 'button, .cardPick, .shopCard, .choiceBtn, [data-node-id], .goldBtn, .ghostBtn, .iconBtn';

function jitter(amount) {
  if (!amount) return 1;
  return 1 + (Math.random() * 2 - 1) * amount;
}

export class Sfx {
  constructor() {
    this.engine = new AudioEngine();
    this.bgm = new Bgm(this.engine);
    this._chromeBound = false;
    const unlock = () => {
      this.engine.init();
      this.bgm.prefetch();
      void this.engine.resume();
      void this.bgm.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  get muted() { return this.engine.muted; }

  init() { this.engine.init(); }

  setBgmVolume(v) { this.engine.setBusVolume('bgm', v); }

  setSfxVolume(v) { this.engine.setSfxVolume(v); }

  get bgmVolume() { return this.engine.busVol.bgm; }

  get sfxVolume() { return this.engine.sfxVol; }

  async preload(onProgress = () => {}) {
    this.engine.init();
    this.bgm.prefetch();
    const keys = allClipKeys();
    let done = 0;
    const queue = keys.map((k) => clipUrl(k)).filter(Boolean);
    const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
      while (queue.length) {
        const url = queue.shift();
        await this.engine.load(url);
        done += 1;
        onProgress(done / keys.length);
      }
    });
    await Promise.all(workers);
  }

  toggleMute() {
    if (!this.engine.muted) {
      this.cue('ui.toggle');
      this.engine.setMuted(true);
    } else {
      this.engine.setMuted(false);
      this.cue('ui.toggle');
    }
    return this.engine.muted;
  }

  setMuted(muted) { this.engine.setMuted(muted); }

  installChrome(root = document) {
    if (this._chromeBound) return;
    this._chromeBound = true;
    root.addEventListener('pointerover', (e) => {
      const el = e.target.closest?.(UI_HOVER_SEL);
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      if (el.id === 'app' || el.closest?.('#app')) return;
      if (e.relatedTarget && el.contains(e.relatedTarget)) return;
      const cardish = el.classList.contains('cardPick') || el.classList.contains('shopCard');
      this.cue(cardish ? 'card.hand.hover' : el.hasAttribute('data-node-id') ? 'ui.soft' : 'ui.hover');
    });
  }

  cue(id, opts = {}) {
    const def = CUES[id];
    if (!def) {
      if (this.engine.debug) console.warn('[sfx] unbound', id);
      return false;
    }
    if (!this.engine.gate(id, def.interval)) return false;
    const variant = pickVariant(def);
    const clip = variant.clip || def.clip;
    const volDb = (def.vol || 0) + (variant.trim || 0) + (opts.vol || 0);
    const rate = (opts.rate || 1) * jitter(opts.pitch ?? def.pitch);
    const delay = opts.delay ?? 0;
    const bus = opts.bus || def.bus || 'sfx';
    if (this.engine.debug) console.debug('[sfx]', id, clip, volDb.toFixed(1) + 'dB');

    const url = clipUrl(clip);
    const play = (buffer) => {
      if (buffer) {
        return this.engine.playBuffer({
          buffer, bus, volume: dbToGain(volDb), rate, delay, offset: variant.startOffsetSeconds || 0,
        });
      }
      this.synth(def.synth || 'click', { delay, bus });
      return false;
    };

    const go = async () => {
      this.engine.init();
      await this.engine.resume();
      const cached = url ? this.engine.buffers.get(url) : null;
      if (cached) return play(cached);
      if (!url) {
        this.synth(def.synth || 'click', { delay, bus });
        return false;
      }
      const buf = await this.engine.load(url);
      return play(buf);
    };
    void go();
    return true;
  }

  goldGain(amount = 10) {
    const n = Math.max(1, Math.min(5, 1 + Math.floor(Math.abs(amount) / 22)));
    for (let i = 0; i < n; i++) this.cue('economy.gold_gain', { delay: i * 0.06 });
  }

  goldSpend() { this.cue('economy.gold_spend'); }

  synth(name, { delay = 0, bus = 'sfx' } = {}) {
    const e = this.engine;
    const t = (o) => e.tone({ ...o, delay: (o.delay || 0) + delay, bus });
    const n = (o) => e.noise({ ...o, delay: (o.delay || 0) + delay, bus });
    switch (name) {
      case 'hover': t({ f: 940, f2: 1080, t: 0.05, g: 0.035 }); break;
      case 'pickup': t({ f: 620, f2: 780, t: 0.09, g: 0.06 }); break;
      case 'click': t({ f: 540, t: 0.06, g: 0.08, type: 'triangle' }); break;
      case 'error': t({ f: 210, t: 0.14, g: 0.09, type: 'square' }); break;
      case 'draw': n({ t: 0.13, g: 0.07, filter: 2600, f2: 900 }); t({ f: 520, f2: 660, t: 0.08, g: 0.035 }); break;
      case 'reveal': t({ f: 480, f2: 760, t: 0.2, g: 0.06 }); break;
      case 'place': t({ f: 170, f2: 90, t: 0.16, g: 0.14, type: 'triangle' }); n({ t: 0.12, g: 0.1, filter: 700 }); break;
      case 'whoosh': n({ t: 0.22, g: 0.11, filter: 500, f2: 2400, type: 'bandpass', q: 1.4 }); break;
      case 'hit': t({ f: 130, f2: 55, t: 0.18, g: 0.2, type: 'triangle' }); n({ t: 0.16, g: 0.18, filter: 520 }); break;
      case 'boom': t({ f: 95, f2: 36, t: 0.5, g: 0.22, type: 'triangle' }); n({ t: 0.5, g: 0.24, filter: 320, f2: 90 }); break;
      case 'zap': n({ t: 0.28, g: 0.17, filter: 3400, q: 6, type: 'bandpass' }); t({ f: 1500, f2: 180, t: 0.24, g: 0.1, type: 'sawtooth' }); break;
      case 'chime': [660, 880, 1320].forEach((f, i) => t({ f, t: 0.5, g: 0.055, delay: i * 0.09 })); break;
      case 'cast': t({ f: 680, f2: 1250, t: 0.28, g: 0.07 }); n({ t: 0.2, g: 0.05, filter: 3000, f2: 5200, type: 'highpass' }); break;
      case 'rumble': n({ t: 0.95, g: 0.2, filter: 170 }); break;
      case 'roar': n({ t: 0.7, g: 0.24, filter: 260, q: 2 }); t({ f: 75, f2: 42, t: 0.65, g: 0.18, type: 'sawtooth' }); break;
      case 'burn': n({ t: 0.45, g: 0.13, filter: 1100, f2: 280 }); break;
      case 'death': t({ f: 300, f2: 110, t: 0.42, g: 0.09, type: 'sawtooth' }); n({ t: 0.36, g: 0.1, filter: 640, f2: 220 }); break;
      case 'turnP': t({ f: 392, t: 0.75, g: 0.13 }); t({ f: 588, t: 0.55, g: 0.05, delay: 0.04 }); break;
      case 'turnE': t({ f: 294, t: 0.75, g: 0.13 }); t({ f: 441, t: 0.55, g: 0.05, delay: 0.04 }); break;
      case 'victory': [523, 659, 784, 1046].forEach((f, i) => t({ f, t: 0.55, g: 0.11, delay: i * 0.16 })); break;
      case 'defeat': t({ f: 330, f2: 150, t: 1.15, g: 0.12, type: 'sawtooth' }); t({ f: 220, f2: 110, t: 1.2, g: 0.08, delay: 0.1 }); break;
      default: t({ f: 480, t: 0.08, g: 0.06, type: 'triangle' });
    }
  }

  hover(kind = 'card') {
    if (kind === 'ui') this.cue('ui.hover');
    else if (kind === 'board' || kind === 'target') this.cue('card.ground.hover');
    else this.cue('card.hand.hover');
  }
  pickup(kind = 'card') {
    this.cue(kind === 'attack' ? 'battle.attack.charge' : 'card.drag.pickup');
  }
  click() { this.cue('ui.press'); }
  error() { this.cue('ui.reject'); }
  draw() { this.cue('card.lifecycle.draw'); }
  reveal() { this.cue('card.lifecycle.flip'); }
  place() { this.cue('card.lifecycle.into_field'); }
  whoosh() { this.cue('battle.attack.prepare'); }
  hit() { this.cue('battle.attack.hit'); }
  boom() { this.cue('sfx.spell.explode'); }
  zap() { this.cue('sfx.spell.lightning'); }
  chime() { this.cue('sfx.effect.buff'); }
  cast() { this.cue('sfx.spell.cast'); }
  rumble() { this.cue('sfx.effect.rumble'); }
  roar() { this.cue('sfx.effect.roar'); this.cue('battle.attack.charge'); }
  burn() { this.cue('card.lifecycle.shatter'); }
  death() { this.cue('battle.combat.death'); }
  turn(isPlayer) { this.cue(isPlayer ? 'flow.turn.player' : 'flow.turn.enemy'); }
  victory() { this.cue('flow.victory.combat'); }
  defeat() { this.cue('flow.defeat'); }
}
