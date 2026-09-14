import { gsap } from 'gsap';

function prefersReduced() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

function ensureVeil() {
  let el = document.getElementById('sceneVeil');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'sceneVeil';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="veilWash"></div>
    <div class="veilSweep"></div>
    <div class="veilLine"></div>
    <p class="veilLabel"></p>`;
  document.body.appendChild(el);
  return el;
}

/** 全屏墨金过场：盖住画面 → 换页 → 揭开。 */
export class SceneVeil {
  constructor(el) {
    this.el = el || ensureVeil();
    this.wash = this.el.querySelector('.veilWash');
    this.sweep = this.el.querySelector('.veilSweep');
    this.line = this.el.querySelector('.veilLine');
    this.label = this.el.querySelector('.veilLabel');
    this.covered = false;
    this._tl = null;
    this._done = null;
    gsap.set(this.el, { autoAlpha: 0 });
  }

  dur(n) {
    return prefersReduced() ? 0.01 : n;
  }

  setKind(kind, title) {
    this.el.dataset.kind = kind || 'default';
    if (this.label) this.label.textContent = title || '';
  }

  kill() {
    this._tl?.kill();
    this._tl = null;
    if (this._done) {
      const done = this._done;
      this._done = null;
      done();
    }
  }

  async cover({ title = '', kind = 'default' } = {}) {
    this.kill();
    this.setKind(kind, title);
    this.el.classList.add('show');
    this.covered = true;
    gsap.set(this.el, { autoAlpha: 1 });
    gsap.set(this.wash, { opacity: 0 });
    gsap.set(this.sweep, { xPercent: -112, opacity: 1 });
    gsap.set(this.line, { scaleX: 0, opacity: 1 });
    gsap.set(this.label, { y: 18, opacity: 0 });
    await new Promise((resolve) => {
      this._done = resolve;
      this._tl = gsap.timeline({
        defaults: { ease: 'power3.inOut' },
        onComplete: () => {
          this._done = null;
          resolve();
        },
      });
      this._tl
        .to(this.sweep, { xPercent: 0, duration: this.dur(0.44) }, 0)
        .to(this.wash, { opacity: 1, duration: this.dur(0.3) }, 0.1)
        .to(this.line, { scaleX: 1, duration: this.dur(0.34) }, 0.16)
        .to(this.label, { y: 0, opacity: 1, duration: this.dur(0.26), ease: 'power2.out' }, 0.2);
    });
  }

  async reveal() {
    if (!this.covered && !this.el.classList.contains('show')) return;
    this.kill();
    await new Promise((resolve) => {
      this._done = resolve;
      this._tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        onComplete: () => {
          this.el.classList.remove('show');
          this.covered = false;
          gsap.set(this.el, { autoAlpha: 0 });
          this._done = null;
          resolve();
        },
      });
      this._tl
        .to(this.label, { y: -12, opacity: 0, duration: this.dur(0.18) }, 0)
        .to(this.line, { scaleX: 0, opacity: 0, duration: this.dur(0.2) }, 0)
        .to(this.sweep, { xPercent: 112, duration: this.dur(0.4) }, 0.05)
        .to(this.wash, { opacity: 0, duration: this.dur(0.3) }, 0.08);
    });
  }
}
