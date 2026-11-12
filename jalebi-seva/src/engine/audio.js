// All sound is synthesised with WebAudio so the game ships with no audio
// files and nothing that needs a licence. Dropping public/audio/kirtan.mp3
// into the project replaces the synthesised kirtan with a real recording.

const SA = 277.18; // C#4 – a comfortable "Sa" for a harmonium
const semi = (n) => SA * Math.pow(2, n / 12);

// Raag Bhoopali (Sa Re Ga Pa Dha): five notes, no way to sound wrong.
const N = { S: 0, R: 2, G: 4, P: 7, D: 9, "S'": 12, "R'": 14, "G'": 16, _: null };
const line = (s) => s.trim().split(/\s+/).map((k) => (k === '-' ? 'hold' : N[k]));

const SONGS = {
  // Call-and-response dhun, 32 beats.
  kirtan: {
    bpm: 108,
    voice: 'harmonium',
    drone: true,
    drum: ['dha', 'ge', 'na', 'ti', 'na', 'ka', 'dhi', 'na'],
    cymbal: true,
    melody: line(`
      G G P P   D D P -   G P D S'  D P G -
      S' S' D P G P D -   P G R S   R G S -
    `),
  },
  // Light plucked tune for the kitchen.
  kitchen: {
    bpm: 92,
    voice: 'pluck',
    drone: false,
    drum: null,
    cymbal: false,
    melody: line(`
      S _ G P   D _ P G   R G P D   S' _ D P
      G P D P   G R S _   R G R S   S _ _ _
    `),
  },
  // Same dhun, faster, for the celebration.
  utsav: {
    bpm: 132,
    voice: 'harmonium',
    drone: true,
    drum: ['dha', 'na', 'dha', 'na', 'dha', 'ge', 'dhi', 'na'],
    cymbal: true,
    melody: line(`
      S' S' D P G P D -   P G R S   R G S -
      G G P P   D D P -   G P D S'  D P S' -
    `),
  },
};

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.song = null;
    this.loops = {};
    this.customKirtan = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 1;
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = 0.42;
    this.music.connect(this.master);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Optional real recording for the kirtan step.
    const a = new Audio();
    a.preload = 'auto';
    a.loop = true;
    a.addEventListener('canplaythrough', () => (this.customKirtan = a), { once: true });
    a.addEventListener('error', () => {}, { once: true });
    a.src = 'audio/kirtan.mp3';
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
    if (this.customKirtan) this.customKirtan.muted = m;
  }

  // ---- primitives ----------------------------------------------------------

  tone({ freq, type = 'sine', dur = 0.2, vol = 0.3, attack = 0.005, to = null, when = 0, dest = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest || this.sfx);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  noise({ dur = 0.2, vol = 0.3, type = 'lowpass', freq = 1000, q = 1, to = null, when = 0, attack = 0.005, dest = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.loopStart = Math.random();
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(dest || this.sfx);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
  }

  // ---- sound effects ---------------------------------------------------------

  tap() {
    this.tone({ freq: 620, to: 940, dur: 0.09, vol: 0.25 });
  }
  pop() {
    this.tone({ freq: 380, to: 1250, dur: 0.11, vol: 0.3 });
  }
  pour() {
    this.noise({ dur: 0.7, vol: 0.16, type: 'bandpass', freq: 2200, to: 900, q: 0.8, attack: 0.08 });
  }
  plop() {
    this.tone({ freq: 340, to: 90, dur: 0.2, vol: 0.45 });
    this.noise({ dur: 0.12, vol: 0.12, type: 'lowpass', freq: 1400 });
  }
  whoosh() {
    this.noise({ dur: 0.4, vol: 0.18, type: 'bandpass', freq: 400, to: 2400, q: 1.2, attack: 0.1 });
  }
  sparkle() {
    [1568, 2093, 2637, 3136].forEach((f, i) => this.tone({ freq: f, dur: 0.22, vol: 0.12, when: i * 0.06 }));
  }
  yay() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      this.tone({ freq: f, type: 'triangle', dur: 0.28, vol: 0.28, when: i * 0.09 }),
    );
  }
  bell() {
    const base = 523;
    [1, 2.0, 2.76, 5.4, 8.93].forEach((p, i) =>
      this.tone({ freq: base * p, dur: 2.4 / (1 + i * 0.5), vol: 0.26 / (1 + i), attack: 0.002 }),
    );
  }
  ghanti() {
    [1, 2.41, 3.9].forEach((p, i) => this.tone({ freq: 1480 * p, dur: 0.9 / (1 + i * 0.4), vol: 0.2 / (1 + i) }));
  }
  manjira(when = 0, vol = 0.16) {
    [2637, 3951, 5274].forEach((f, i) => this.tone({ freq: f, dur: 0.7 / (1 + i * 0.6), vol: vol / (1 + i * 0.5), when }));
  }
  jhanjh() {
    this.noise({ dur: 0.9, vol: 0.14, type: 'highpass', freq: 5200 });
    [1180, 1770, 2960].forEach((f) => this.tone({ freq: f, type: 'square', dur: 0.5, vol: 0.03 }));
  }
  drum(kind = 'dha', when = 0, vol = 1) {
    const bass = (v) => this.tone({ freq: 150, to: 62, dur: 0.28, vol: 0.55 * v * vol, when, attack: 0.002 });
    const treb = (v) => {
      this.tone({ freq: 430, to: 340, dur: 0.11, vol: 0.3 * v * vol, when, type: 'triangle', attack: 0.002 });
      this.noise({ dur: 0.04, vol: 0.1 * v * vol, type: 'bandpass', freq: 2400, when });
    };
    if (kind === 'dha') (bass(1), treb(1));
    else if (kind === 'ge') bass(0.7);
    else if (kind === 'na') treb(1);
    else if (kind === 'ti') treb(0.55);
    else if (kind === 'dhi') (bass(0.6), treb(0.8));
    else if (kind === 'ka') this.noise({ dur: 0.05, vol: 0.16 * vol, type: 'bandpass', freq: 900, when });
  }
  shankh() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(205, t0);
    o.frequency.linearRampToValueAtTime(233, t0 + 0.5);
    o.frequency.linearRampToValueAtTime(240, t0 + 2.2);
    f.type = 'lowpass';
    f.frequency.value = 850;
    f.Q.value = 5;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.28, t0 + 0.35);
    g.gain.setValueAtTime(0.28, t0 + 1.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.5);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t0);
    o.stop(t0 + 2.6);
  }
  crunch() {
    for (let i = 0; i < 3; i++) {
      this.noise({ dur: 0.07, vol: 0.2, type: 'bandpass', freq: 1800 + Math.random() * 1600, q: 2, when: i * 0.11 });
    }
    this.tone({ freq: 700, to: 1100, dur: 0.18, vol: 0.14, when: 0.36, type: 'triangle' });
  }

  // ---- continuous sounds -------------------------------------------------------

  _startNoiseLoop(name, { type, freq, q = 0.7, vol }) {
    if (!this.ctx || this.loops[name]) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.4);
    src.connect(f).connect(g).connect(this.sfx);
    src.start();
    // A crackle: wobble the level a little at random.
    const timer = setInterval(() => {
      if (this.ctx.state !== 'running') return;
      g.gain.setTargetAtTime(vol * (0.6 + Math.random() * 0.8), this.ctx.currentTime, 0.04);
    }, 90);
    this.loops[name] = { src, g, timer };
  }

  _stopLoop(name) {
    const l = this.loops[name];
    if (!l) return;
    delete this.loops[name];
    clearInterval(l.timer);
    if (l.g) {
      l.g.gain.cancelScheduledValues(this.ctx.currentTime);
      l.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
    }
    if (l.src) l.src.stop(this.ctx.currentTime + 0.6);
  }

  sizzle(on) {
    if (on) this._startNoiseLoop('sizzle', { type: 'highpass', freq: 3800, vol: 0.085 });
    else this._stopLoop('sizzle');
  }

  bubbling(on) {
    if (!this.ctx) return;
    if (on && !this.loops.bubble) {
      const timer = setInterval(() => {
        if (this.ctx.state !== 'running' || Math.random() < 0.35) return;
        const f = 260 + Math.random() * 380;
        this.tone({ freq: f, to: f * 1.9, dur: 0.07, vol: 0.07 });
      }, 110);
      this.loops.bubble = { timer };
    } else if (!on) {
      this._stopLoop('bubble');
    }
  }

  // ---- music -------------------------------------------------------------------

  playSong(name) {
    this.stopSong();
    if (!this.ctx) return;
    if (name === 'kirtan' && this.customKirtan) {
      this.customKirtan.currentTime = 0;
      this.customKirtan.muted = this.muted;
      this.customKirtan.play().catch(() => {});
      this.song = { custom: true };
      return;
    }
    const def = SONGS[name];
    const beat = 60 / def.bpm;
    const s = { def, beat, i: 0, next: this.ctx.currentTime + 0.12, nodes: [] };
    if (def.drone) s.nodes = this._drone();
    s.timer = setInterval(() => this._schedule(s), 50);
    this.song = s;
  }

  stopSong() {
    const s = this.song;
    if (!s) return;
    this.song = null;
    if (s.custom) {
      this.customKirtan.pause();
      return;
    }
    clearInterval(s.timer);
    for (const n of s.nodes) {
      n.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      n.o.stop(this.ctx.currentTime + 0.8);
    }
  }

  _drone() {
    const out = [];
    for (const [n, v] of [
      [-12, 0.05],
      [-5, 0.035],
      [0, 0.03],
    ]) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = semi(n);
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 1);
      o.connect(g).connect(this.music);
      o.start();
      out.push({ o, g });
    }
    return out;
  }

  _schedule(s) {
    if (this.ctx.state !== 'running') {
      s.next = this.ctx.currentTime + 0.1;
      return;
    }
    const half = s.beat / 2;
    while (s.next < this.ctx.currentTime + 0.25) {
      const when = Math.max(0, s.next - this.ctx.currentTime);
      const { def } = s;
      if (s.i % 2 === 0) {
        const b = (s.i / 2) % def.melody.length;
        const note = def.melody[b];
        if (note !== null && note !== 'hold') {
          // Sustain through any following holds.
          let len = 1;
          while (def.melody[(b + len) % def.melody.length] === 'hold' && len < 4) len++;
          this._voice(def.voice, semi(note), when, s.beat * len);
        }
        if (def.cymbal && (s.i / 2) % 2 === 0) this.manjira(when, 0.05);
      }
      if (def.drum) this.drum(def.drum[s.i % def.drum.length], when, 0.5);
      s.i++;
      s.next += half;
    }
  }

  _voice(kind, freq, when, dur) {
    const t0 = this.ctx.currentTime + when;
    if (kind === 'pluck') {
      this.tone({ freq, type: 'triangle', dur: 0.5, vol: 0.2, when, dest: this.music, attack: 0.004 });
      this.tone({ freq: freq * 2, type: 'sine', dur: 0.25, vol: 0.06, when, dest: this.music });
      return;
    }
    // Harmonium: two slightly detuned reeds through a soft low-pass.
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2100;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.11, t0 + 0.03);
    g.gain.setValueAtTime(0.11, t0 + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.98);
    f.connect(g).connect(this.music);
    for (const det of [-5, 5]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(f);
      o.start(t0);
      o.stop(t0 + dur);
    }
  }
}
