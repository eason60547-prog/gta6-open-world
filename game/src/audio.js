// Palmera Bay — synthesized sound, no audio files.
// One job: every sound effect is built with WebAudio oscillators and noise.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.sirenHigh = false;
  }

  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.engineGain) this.engineGain.gain.value = 0;
    if (this.sirenGain) this.sirenGain.gain.value = 0;
    return this.muted;
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  _noise(dur, vol, lowpass) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  }

  click() { this._tone(660, 0.07, 'square', 0.08); }
  pickup() { this._tone(880, 0.09, 'sine', 0.14); this._tone(1320, 0.12, 'sine', 0.1); }
  punch() { this._noise(0.09, 0.25, 900); }
  gunshot() { this._noise(0.16, 0.4, 3200); this._tone(160, 0.1, 'square', 0.12, 60); }
  hurt() { this._tone(220, 0.18, 'sawtooth', 0.14, 110); }
  crash() { this._noise(0.3, 0.35, 700); }
  doorSlam() { this._noise(0.12, 0.2, 500); this._tone(90, 0.1, 'sine', 0.18, 50); }
  wantedUp() { this._tone(440, 0.16, 'square', 0.12); this._tone(330, 0.22, 'square', 0.12); }
  missionStart() { this._tone(523, 0.12, 'sine', 0.14); this._tone(659, 0.12, 'sine', 0.14); }
  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.18, 'sine', 0.16), i * 110);
    });
  }
  busted() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this._tone(f, 0.25, 'triangle', 0.16), i * 160)); }

  // Continuous engine hum: call every frame with speed 0..1, or 0 to stop.
  engine(level) {
    if (this.muted) level = 0;
    const ctx = this.ensure();
    if (!ctx) return;
    if (!this.engineOsc) {
      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineOsc.connect(filter).connect(this.engineGain).connect(ctx.destination);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.value = 55 + level * 130;
    this.engineGain.gain.value = level * 0.05;
  }

  // Police siren: call every frame; active when any police car is near.
  siren(active, dt) {
    if (!active || this.muted) {
      if (this.sirenGain) this.sirenGain.gain.value = 0;
      return;
    }
    const ctx = this.ensure();
    if (!ctx) return;
    if (!this.sirenOsc) {
      this.sirenOsc = ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(ctx.destination);
      this.sirenOsc.start();
    }
    this.sirenTimer += dt;
    if (this.sirenTimer > 0.45) {
      this.sirenTimer = 0;
      this.sirenHigh = !this.sirenHigh;
      this.sirenOsc.frequency.value = this.sirenHigh ? 880 : 660;
    }
    this.sirenGain.gain.value = 0.035;
  }
}
