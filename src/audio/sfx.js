// WebAudio 程序化音效：无外置资源，首次交互后激活
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = localStorage.getItem('tcg_muted') === '1';
    this._noiseBuf = null;
    const unlock = () => {
      this.init();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.42;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.2;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('tcg_muted', this.muted ? '1' : '0');
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.42;
  }

  tone({ f = 440, f2 = null, t = 0.15, type = 'sine', g = 0.15, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, now);
    if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), now + t);
    gain.gain.setValueAtTime(g, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + t + 0.05);
  }

  noise({ t = 0.3, g = 0.15, filter = 1200, f2 = null, q = 1, type = 'lowpass', delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
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
    src.connect(bi).connect(gain).connect(this.master);
    src.start(now);
    src.stop(now + t + 0.05);
  }

  // ---- 具体音效 ----
  hover()  { this.tone({ f: 940, f2: 1080, t: 0.05, g: 0.035, type: 'sine' }); }
  pickup() { this.tone({ f: 620, f2: 780, t: 0.09, g: 0.06 }); }
  click()  { this.tone({ f: 540, t: 0.06, g: 0.08, type: 'triangle' }); }
  error()  { this.tone({ f: 210, t: 0.14, g: 0.09, type: 'square' }); }
  draw()   { this.noise({ t: 0.13, g: 0.07, filter: 2600, f2: 900 }); this.tone({ f: 520, f2: 660, t: 0.08, g: 0.035 }); }
  reveal() { this.tone({ f: 480, f2: 760, t: 0.2, g: 0.06 }); }
  place()  { this.tone({ f: 170, f2: 90, t: 0.16, g: 0.14, type: 'triangle' }); this.noise({ t: 0.12, g: 0.1, filter: 700 }); }
  whoosh() { this.noise({ t: 0.22, g: 0.11, filter: 500, f2: 2400, type: 'bandpass', q: 1.4 }); }
  hit()    { this.tone({ f: 130, f2: 55, t: 0.18, g: 0.2, type: 'triangle' }); this.noise({ t: 0.16, g: 0.18, filter: 520 }); }
  boom()   { this.tone({ f: 95, f2: 36, t: 0.5, g: 0.22, type: 'triangle' }); this.noise({ t: 0.5, g: 0.24, filter: 320, f2: 90 }); }
  zap()    { this.noise({ t: 0.28, g: 0.17, filter: 3400, q: 6, type: 'bandpass' }); this.tone({ f: 1500, f2: 180, t: 0.24, g: 0.1, type: 'sawtooth' }); }
  chime()  { [660, 880, 1320].forEach((f, i) => this.tone({ f, t: 0.5, g: 0.055, delay: i * 0.09 })); }
  cast()   { this.tone({ f: 680, f2: 1250, t: 0.28, g: 0.07 }); this.noise({ t: 0.2, g: 0.05, filter: 3000, f2: 5200, type: 'highpass' }); }
  rumble() { this.noise({ t: 0.95, g: 0.2, filter: 170 }); }
  roar()   { this.noise({ t: 0.7, g: 0.24, filter: 260, q: 2 }); this.tone({ f: 75, f2: 42, t: 0.65, g: 0.18, type: 'sawtooth' }); }
  burn()   { this.noise({ t: 0.45, g: 0.13, filter: 1100, f2: 280 }); }
  death()  { this.tone({ f: 300, f2: 110, t: 0.42, g: 0.09, type: 'sawtooth' }); this.noise({ t: 0.36, g: 0.1, filter: 640, f2: 220 }); }
  turn(isPlayer) {
    this.tone({ f: isPlayer ? 392 : 294, t: 0.75, g: 0.13, type: 'sine' });
    this.tone({ f: isPlayer ? 588 : 441, t: 0.55, g: 0.05, type: 'sine', delay: 0.04 });
  }
  victory() { [523, 659, 784, 1046].forEach((f, i) => this.tone({ f, t: 0.55, g: 0.11, delay: i * 0.16 })); }
  defeat()  { this.tone({ f: 330, f2: 150, t: 1.15, g: 0.12, type: 'sawtooth' }); this.tone({ f: 220, f2: 110, t: 1.2, g: 0.08, type: 'sine', delay: 0.1 }); }
}
