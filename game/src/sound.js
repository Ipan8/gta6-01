// Procedural WebAudio: engine hum, police siren, gunshots, UI blips and a
// low synth pad for ambience. Everything is synthesized — no audio assets.
// All calls are safe when audio is unavailable (headless screenshots).
export function createSound() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let musicNodes = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      return null;
    }
    return ctx;
  }

  /** Call from a user gesture (start button): unlocks audio + starts ambience. */
  function unlock() {
    const c = ensure();
    if (!c) return;
    try {
      if (c.state === 'suspended') void c.resume();
      startMusic();
    } catch { /* audio stays off */ }
  }

  function startMusic() {
    if (musicNodes || !ctx) return;
    try {
      const gain = ctx.createGain();
      gain.gain.value = 0.035;
      gain.connect(ctx.destination);
      const freqs = [110, 164.8, 220];
      const oscs = freqs.map((f) => {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.connect(gain);
        o.start();
        return o;
      });
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.015;
      lfo.connect(lfoGain);
      lfoGain.connect(gain);
      lfo.start();
      musicNodes = { oscs, gain, lfo };
    } catch { /* ignore */ }
  }

  function engine(speed01) {
    if (!ctx || !engineOsc) return;
    try {
      engineOsc.frequency.value = 55 + speed01 * 130;
      engineGain.gain.value = 0.03 + speed01 * 0.05;
    } catch { /* ignore */ }
  }

  function setEngineOn(on) {
    const c = ensure();
    if (!c) return;
    try {
      if (on && !engineOsc) {
        engineOsc = c.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 60;
        engineGain = c.createGain();
        engineGain.gain.value = 0.03;
        engineOsc.connect(engineGain);
        engineGain.connect(c.destination);
        engineOsc.start();
      } else if (!on && engineOsc) {
        engineOsc.stop();
        engineOsc = null;
        engineGain = null;
      }
    } catch { /* ignore */ }
  }

  function siren(on) {
    const c = ensure();
    if (!c) return;
    try {
      if (on && !sirenOsc) {
        sirenOsc = c.createOscillator();
        sirenOsc.type = 'square';
        sirenOsc.frequency.value = 720;
        sirenGain = c.createGain();
        sirenGain.gain.value = 0.018;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(c.destination);
        sirenOsc.start();
        sirenTimer = 0;
      } else if (!on && sirenOsc) {
        sirenOsc.stop();
        sirenOsc = null;
        sirenGain = null;
      }
    } catch { /* ignore */ }
  }

  function sirenTick(dt) {
    if (!sirenOsc || !ctx) return;
    sirenTimer += dt;
    if (sirenTimer > 0.45) {
      sirenTimer = 0;
      sirenHigh = !sirenHigh;
      try { sirenOsc.frequency.value = sirenHigh ? 950 : 720; } catch { /* ignore */ }
    }
  }

  function noiseBurst(duration, volume, filterFreq) {
    const c = ensure();
    if (!c) return;
    try {
      const len = Math.floor(c.sampleRate * duration);
      const buffer = c.createBuffer(1, len, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buffer;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = c.createGain();
      gain.gain.value = volume;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);
      src.start();
    } catch { /* ignore */ }
  }

  function blip(freq, duration, volume) {
    const c = ensure();
    if (!c) return;
    try {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const gain = c.createGain();
      gain.gain.value = volume;
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      o.connect(gain);
      gain.connect(c.destination);
      o.start();
      o.stop(c.currentTime + duration);
    } catch { /* ignore */ }
  }

  return {
    unlock, engine, setEngineOn, siren, sirenTick,
    gunshot() { noiseBurst(0.14, 0.5, 1800); },
    enemyShot() { noiseBurst(0.1, 0.22, 1200); },
    pickup() { blip(880, 0.12, 0.2); setTimeout(() => blip(1318, 0.15, 0.2), 90); },
    uiClick() { blip(660, 0.07, 0.15); },
  };
}
