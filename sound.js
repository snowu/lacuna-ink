// The current is the score: direction chooses a pitch, force chooses a breath.
// No microphone, samples, files or network. Voices exist only after opting in.
const NOTES = [48, 50, 52, 55, 57, 60, 62, 64];
export function toneForCurrent(vector) {
  if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y)) return { frequency: 220, gain: 0 };
  const magnitude = Math.hypot(vector.x, vector.y);
  const angle = Math.atan2(vector.y, vector.x);
  const index = Math.round((angle + Math.PI) / (2 * Math.PI) * NOTES.length) % NOTES.length;
  return {
    frequency: 440 * 2 ** ((NOTES[index] - 69) / 12),
    gain: Math.min(.04, Math.max(0, (magnitude - .16) / 2.7) * .04),
  };
}

export function connectVoice(context) {
  const master = context.createGain();
  master.gain.value = 0;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass'; filter.frequency.value = 1200; filter.Q.value = .4;
  master.connect(filter); filter.connect(context.destination);
  const partials = [1, 2, 2.003].map((ratio, i) => {
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = 220 * ratio;
    gain.gain.value = [1, .15, .15][i];
    oscillator.connect(gain); gain.connect(master); oscillator.start();
    return { oscillator, ratio };
  });
  return {
    tone({ frequency, gain }, time = context.currentTime) {
      master.gain.setTargetAtTime(gain, time, .08);
      partials.forEach(p => p.oscillator.frequency.setTargetAtTime(frequency * p.ratio, time, .11));
    },
    silence(time = context.currentTime) { master.gain.setTargetAtTime(0, time, .09); },
    stop() { partials.forEach(p => p.oscillator.stop()); master.disconnect(); filter.disconnect(); },
  };
}

export class Listener {
  constructor() { this.context = null; this.voice = null; this.timer = null; this.generation = 0; }
  async start() {
    const generation = ++this.generation;
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) throw new Error('This browser cannot play the currents.');
    const context = new Context();
    try { await context.resume(); }
    catch (error) { await context.close(); throw error; }
    if (generation !== this.generation) { await context.close(); return false; }
    this.context = context; this.voice = connectVoice(context);
    return true;
  }
  sample(vector) {
    if (!this.voice) return;
    this.voice.tone(toneForCurrent(vector));
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.silence(), 350);
  }
  silence() { clearTimeout(this.timer); this.voice?.silence(); }
  stop() {
    this.generation++;
    this.silence();
    const voice = this.voice, context = this.context;
    this.voice = this.context = null;
    if (!voice) return;
    setTimeout(() => { voice.stop(); void context.close().catch(() => {}); }, 350);
  }
}
