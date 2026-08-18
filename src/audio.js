export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engine = null;
    this.saucer = null;
    this.noise = null;
  }
  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);
    this.engine = this.makeEngineHum();
    this.saucer = this.makeSaucerHum();
  }
  makeEngineHum() {
    const { ctx, master } = this;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 48;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 160;
    filter.Q.value = 3;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();
    return { osc, filter, gain };
  }
  makeSaucerHum() {
    const { ctx, master } = this;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 150;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 7.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 55;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    lfo.start();
    return { osc, gain };
  }
  noiseBuffer() {
    if (this.noise) return this.noise;
    const len = Math.floor(this.ctx.sampleRate * 1.5);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    return buf;
  }
  setEngine(speed, thrust) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const { osc, filter, gain } = this.engine;
    filter.frequency.setTargetAtTime(140 + speed * 0.85, t, 0.06);
    osc.frequency.setTargetAtTime(40 + speed * 0.07 + thrust * 14, t, 0.06);
    gain.gain.setTargetAtTime(0.03 + thrust * 0.13, t, 0.08);
  }
  setSaucer(on) {
    if (!this.ctx) return;
    this.saucer.gain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.15);
  }
  shoot() {
    this.blip(1240, 340, 0.11, 0.22, 'square', 220);
  }
  laser() {
    this.blip(1900, 140, 0.3, 0.3, 'sawtooth', 40);
  }
  pickup() {
    this.blip(660, 660, 0.09, 0.24, 'square', 0, 0);
    this.blip(880, 880, 0.09, 0.24, 'square', 0, 0.08);
    this.blip(1320, 1760, 0.16, 0.26, 'square', 0, 0.16);
  }
  saucerShot() {
    this.blip(680, 210, 0.18, 0.16, 'sawtooth', 90);
  }
  blip(f0, f1, dur, vol, type, detune, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.detune.value = (Math.random() * 2 - 1) * detune;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.03);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
  breakRock(strength) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 600;
    bp.Q.value = 0.9;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12 + strength * 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.2);
  }
  explode(big) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = big ? 1.7 : 0.75;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(big ? 1400 : 1800, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + dur);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(big ? 0.85 : 0.45, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(lp);
    lp.connect(ng);
    ng.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.1);
    const subs = big ? [46, 69, 92] : [54];
    subs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.4, t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(big ? 0.5 / (i + 1) : 0.35, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    });
  }
  playerDeath() {
    this.explode(true);
    this.blip(320, 40, 0.9, 0.4, 'sawtooth', 10);
  }
}
