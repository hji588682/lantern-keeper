// Lantern Keeper — sound, synthesized live with WebAudio (no audio files).
// The context is created lazily on the first user gesture (browsers refuse
// audio before one). Every effect is oscillators and envelopes; M mutes.

export function createAudio() {
  let context = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;

  /** Create the context and start the ambient pad. Safe to call repeatedly. */
  function unlock() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    context = new AudioCtor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(context.destination);
    startAmbientPad();
  }

  /** A very quiet two-note pad under everything, like distant night water. */
  function startAmbientPad() {
    const padGain = context.createGain();
    padGain.gain.value = 0.018;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    for (const freq of [110, 164.81, 220]) {
      const osc = context.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(filter);
      osc.start();
    }
    filter.connect(padGain);
    padGain.connect(master);
  }

  /** One enveloped tone; slideTo glides the pitch, delay offsets the start. */
  function tone(freq, { type = 'sine', duration = 0.15, volume = 0.2, slideTo = null, delay = 0 } = {}) {
    if (!context) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  /** A short filtered noise burst, for the hurt thud's crunch. */
  function noiseBurst({ duration = 0.18, volume = 0.25, delay = 0 } = {}) {
    if (!context) return;
    if (!noiseBuffer) {
      noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    const start = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
    source.stop(start + duration + 0.05);
  }

  return {
    unlock,
    /** Firefly caught: a soft chime that climbs as the combo streak grows. */
    pickup(streak) {
      const base = 620 + Math.min(streak, 12) * 36;
      tone(base, { type: 'sine', duration: 0.12, volume: 0.22 });
      tone(base * 1.5, { type: 'sine', duration: 0.16, volume: 0.16, delay: 0.045 });
    },
    /** Sunstone caught: a bright three-note sparkle. */
    sunstone() {
      tone(880, { type: 'triangle', duration: 0.14, volume: 0.22 });
      tone(1174.66, { type: 'triangle', duration: 0.16, volume: 0.2, delay: 0.06 });
      tone(1567.98, { type: 'triangle', duration: 0.24, volume: 0.2, delay: 0.12 });
    },
    /** Shadow block hit: a low thud with a crunch on top. */
    hurt() {
      tone(130, { type: 'sine', duration: 0.28, volume: 0.5, slideTo: 42 });
      noiseBurst({ duration: 0.16, volume: 0.2 });
    },
    /** Level up: a quick rising arpeggio. */
    levelUp() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => tone(freq, { type: 'triangle', duration: 0.16, volume: 0.18, delay: i * 0.07 }));
    },
    /** Victory: the lighthouse lit — a warm five-note jingle. */
    win() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      notes.forEach((freq, i) => tone(freq, { type: 'triangle', duration: 0.3, volume: 0.2, delay: i * 0.11 }));
      tone(261.63, { type: 'sine', duration: 0.9, volume: 0.12, delay: 0.1 });
    },
    /** Defeat: four descending notes as the light goes out. */
    lose() {
      const notes = [392, 329.63, 261.63, 196];
      notes.forEach((freq, i) => tone(freq, { type: 'triangle', duration: 0.34, volume: 0.2, delay: i * 0.16 }));
    },
    /** Flip the mute; returns the new muted state. */
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.9;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
