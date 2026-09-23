export class Synth {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  unlock() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
  }

  beep(freq, dur, type = "square", gain = 0.04, slide = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  shoot() {
    this.beep(420, 0.05, "square", 0.03, 180);
  }

  hit() {
    this.beep(180, 0.06, "triangle", 0.035, -80);
  }

  crit() {
    this.beep(920, 0.05, "square", 0.03, 280);
  }

  boom() {
    this.beep(90, 0.22, "sawtooth", 0.05, -50);
  }

  pickup() {
    this.beep(520, 0.1, "square", 0.04, 240);
  }

  overdrive() {
    this.beep(220, 0.28, "sawtooth", 0.05, 400);
  }

  lose() {
    this.beep(160, 0.4, "triangle", 0.05, -120);
  }

  win() {
    this.beep(360, 0.16, "square", 0.04, 200);
    setTimeout(() => this.beep(480, 0.2, "square", 0.04, 160), 90);
  }
}
