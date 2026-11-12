// Sons synthétisés avec la Web Audio API (aucun fichier à télécharger).
// « Clac » du pion, carillon des coffrets, mélodie de la grille, ambiance optionnelle.

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = this.read('sound', true);
    this.ambience = false; // désactivée par défaut
    this.ambNodes = null;
  }

  read(k, d) { try { const v = localStorage.getItem(`labyrinthe-${k}`); return v === null ? d : v === '1'; } catch { return d; } }
  write(k, v) { try { localStorage.setItem(`labyrinthe-${k}`, v ? '1' : '0'); } catch { /* rien */ } }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      // légère réverbération de salon
      this.verb = this.ctx.createConvolver();
      this.verb.buffer = this.impulse(2.2);
      const wet = this.ctx.createGain(); wet.gain.value = 0.22;
      this.verb.connect(wet).connect(this.master);
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  impulse(sec) {
    const rate = this.ctx.sampleRate, len = rate * sec;
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  setEnabled(v) {
    this.enabled = v; this.write('sound', v);
    if (this.master) this.master.gain.setTargetAtTime(v ? 0.7 : 0, this.ctx.currentTime, 0.05);
    if (!v && this.ambience) this.setAmbience(false);
  }

  out(dry = 1, wet = 0.5) {
    const g = this.ctx.createGain(); g.gain.value = dry;
    g.connect(this.master);
    if (wet) { const w = this.ctx.createGain(); w.gain.value = wet; g.connect(w).connect(this.verb); }
    return g;
  }

  /** Petit « clac » d'une pièce sur du marbre. */
  clack(strength = 1) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime, ctx = this.ctx;
    const len = 0.05 * ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 8);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600 + Math.random() * 600; bp.Q.value = 2.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.22 * strength, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    src.connect(bp).connect(g).connect(this.out(1, 0.25));
    // corps « tok » de la pièce
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(820, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.05);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.08 * strength, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(og).connect(this.out(1, 0.2));
    src.start(t); o.start(t); o.stop(t + 0.1);
  }

  bell(freq, t, dur = 2.2, vol = 0.12) {
    const ctx = this.ctx;
    // cloche cristalline : partiels inharmoniques
    [[1, 1], [2.76, 0.45], [5.4, 0.25], [8.93, 0.12]].forEach(([r, a]) => {
      if (freq * r > 16000) return;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * r;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * a, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (1 + r * 0.25));
      o.connect(g).connect(this.out(0.8, 0.9));
      o.start(t); o.stop(t + dur);
    });
  }

  chime() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    [1318.5, 1568, 1975.5, 2637].forEach((f, i) => this.bell(f, t + i * 0.09, 2.6, 0.07));
  }

  melody() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + 0.05;
    // petite fanfare douce en ré majeur
    const notes = [[587.3, 0], [740, 0.22], [880, 0.44], [1174.7, 0.7], [1108.7, 1.05], [1174.7, 1.3], [1480, 1.6]];
    notes.forEach(([f, d], i) => this.bell(f, t + d, i === notes.length - 1 ? 4 : 2.4, 0.09));
    [293.7, 440, 587.3].forEach((f) => this.bell(f, t + 1.6, 4.5, 0.05));
  }

  /** « Toc » sourd du couvercle en bois laqué qui arrive en butée. */
  thud() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(this.out(1, 0.3)); o.start(t); o.stop(t + 0.2);
  }

  /** Grondement doux de la grille qui descend dans le sol. */
  rumble(duration = 4) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const len = ctx.sampleRate * duration;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = last * 0.995 + (Math.random() * 2 - 1) * 0.005; d[i] = last * 6; }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.6);
    g.gain.setValueAtTime(0.22, t + duration - 1); g.gain.linearRampToValueAtTime(0, t + duration);
    src.connect(lp).connect(g).connect(this.out(1, 0.4)); src.start(t);
  }

  setAmbience(on) {
    this.ambience = on;
    if (!this.ctx) this.unlock();
    if (!this.ctx) return;
    if (on && this.enabled && !this.ambNodes) {
      const ctx = this.ctx;
      // feu de cheminée : bruit filtré + crépitements
      const len = ctx.sampleRate * 4;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = last * 0.985 + (Math.random() * 2 - 1) * 0.015;
        d[i] = last * 2.4 + (Math.random() < 0.0004 ? (Math.random() * 2 - 1) * 0.9 : 0);
      }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      const g = ctx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 2);
      src.connect(lp).connect(g).connect(this.master);
      src.start();
      // horloge lointaine
      const tick = setInterval(() => {
        if (!this.enabled) return;
        const t = ctx.currentTime;
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 2100 + (Math.floor(t) % 2) * 260;
        const tg = ctx.createGain(); tg.gain.setValueAtTime(0.012, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        o.connect(tg).connect(this.out(0.6, 1)); o.start(t); o.stop(t + 0.06);
      }, 1000);
      this.ambNodes = { src, g, tick };
    } else if (!on && this.ambNodes) {
      const { src, g, tick } = this.ambNodes;
      clearInterval(tick);
      g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
      setTimeout(() => src.stop(), 1500);
      this.ambNodes = null;
    }
  }
}
