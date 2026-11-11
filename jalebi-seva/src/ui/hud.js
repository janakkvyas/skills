import { T, LANGS, LANG_LABEL, getLang } from '../game/i18n.js';

// DOM overlay: progress beads, the spoken-prompt banner, title and end
// screens, and a parents' corner hidden behind a press-and-hold.

const $ = (id) => document.getElementById(id);

const GEAR = `<svg viewBox="0 0 24 24" fill="none" stroke="#3b2a1a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>`;
const SPEAKER = `<svg viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" fill="none"/></svg>`;

function jalebiSvg() {
  let d = '';
  const N = 140;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = t * 2.75 * Math.PI * 2;
    const r = 6 + 34 * t;
    d += `${i ? 'L' : 'M'}${(50 + Math.cos(a) * r).toFixed(1)} ${(50 + Math.sin(a) * r).toFixed(1)}`;
  }
  return `<svg viewBox="0 0 100 100"><path d="${d}" fill="none" stroke="#c96500" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#f9a11b" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#ffd98a" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="6 14" transform="translate(-1.2 -1.6)"/></svg>`;
}

export class Hud {
  constructor(stepCount, handlers) {
    this.h = handlers;
    this.bannerKey = null;
    this.stepCount = stepCount;

    $('gear').innerHTML = GEAR;
    $('say').innerHTML = SPEAKER;
    $('logo').innerHTML = jalebiSvg();
    const beads = $('beads');
    for (let i = 0; i < stepCount; i++) {
      const b = document.createElement('div');
      b.className = 'bead';
      beads.appendChild(b);
    }

    $('say').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.h.onRepeat();
    });

    // Parents' corner: hold the gear for a second so little fingers stay out.
    let timer = null;
    const gear = $('gear');
    const cancel = () => {
      clearTimeout(timer);
      gear.classList.remove('holding');
    };
    gear.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      gear.classList.add('holding');
      timer = setTimeout(() => {
        cancel();
        this._openParents();
      }, 1100);
    });
    gear.addEventListener('pointerup', cancel);
    gear.addEventListener('pointerleave', cancel);
    gear.addEventListener('pointercancel', cancel);

    $('p-close').addEventListener('click', () => $('parents').classList.add('hidden'));
    $('p-skip').addEventListener('click', () => this.h.onSkip());
    $('p-restart').addEventListener('click', () => this.h.onRestart());
    $('p-sound').addEventListener('click', () => {
      this.h.onToggleSound();
      this.refresh();
    });
    $('p-speech').addEventListener('click', () => {
      this.h.onToggleSpeech();
      this.refresh();
    });

    this._langButtons($('langs'));
    this._langButtons($('p-langs'));
    this.refresh();
  }

  _langButtons(host) {
    for (const l of LANGS) {
      const b = document.createElement('button');
      b.className = 'lang';
      b.dataset.lang = l;
      b.textContent = LANG_LABEL[l];
      b.addEventListener('click', () => {
        this.h.onLang(l);
        this.refresh();
      });
      host.appendChild(b);
    }
  }

  _openParents() {
    this.refresh();
    $('parents').classList.remove('hidden');
  }

  /** Re-render every piece of text in the current language. */
  refresh() {
    document.documentElement.lang = getLang();
    $('t-title').textContent = T('title');
    $('t-sub').textContent = T('subtitle');
    $('play').textContent = '▶ ' + T('play');
    $('e-title').textContent = T('jsk');
    $('again').textContent = '↻ ' + T('again');
    $('p-title').textContent = T('parents');
    const s = this.h.getState();
    $('p-sound').textContent = `${T('sound')}: ${s.sound ? '✓' : '✕'}`;
    $('p-speech').textContent = `${T('speech')}: ${s.speech ? '✓' : '✕'}`;
    $('p-skip').textContent = T('skip') + ' ⏭';
    $('p-restart').textContent = T('restart') + ' ↻';
    $('p-close').textContent = T('close');
    document.querySelectorAll('.lang').forEach((b) => b.classList.toggle('on', b.dataset.lang === getLang()));
    if (this.bannerKey) $('banner-text').textContent = T(this.bannerKey);
  }

  setStep(i) {
    [...$('beads').children].forEach((b, n) => {
      b.classList.toggle('done', n < i);
      b.classList.toggle('now', n === i);
    });
  }

  banner(key) {
    this.bannerKey = key;
    $('banner-text').textContent = T(key);
    const el = $('banner');
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  /** 0..1 shows the progress meter; null hides it. */
  meter(p) {
    const m = $('meter');
    if (p === null) {
      m.classList.remove('on');
      return;
    }
    m.classList.add('on');
    $('meter-fill').style.width = `${Math.round(p * 100)}%`;
  }

  /** Fade to cream, run fn while the screen is covered, fade back. */
  async fade(fn) {
    const f = $('fade');
    f.classList.add('on');
    await new Promise((r) => setTimeout(r, 380));
    await fn();
    await new Promise((r) => setTimeout(r, 120));
    f.classList.remove('on');
  }

  showHud(on) {
    $('hud').classList.toggle('on', on);
  }

  showTitle() {
    $('title').classList.remove('hidden');
    return new Promise((resolve) => {
      $('play').addEventListener(
        'click',
        () => {
          $('title').classList.add('hidden');
          resolve();
        },
        { once: true },
      );
    });
  }

  hideTitle() {
    $('title').classList.add('hidden');
  }

  showEnd() {
    $('end').classList.remove('hidden');
    return new Promise((resolve) => $('again').addEventListener('click', resolve, { once: true }));
  }
}
