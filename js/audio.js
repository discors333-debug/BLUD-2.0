// Tiny synthesized sound effects with the Web Audio API (no audio files).
(function (SS) {
  "use strict";

  const A = { enabled: true, ctx: null, wind: null };

  A.init = function () {
    if (!A.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { A.ctx = new AC(); } catch (e) { A.ctx = null; return; }
    }
    if (A.ctx.state === "suspended") A.ctx.resume().catch(() => {});
  };

  function tone(freq, dur, opts) {
    if (!A.enabled || !A.ctx) return;
    const o = opts || {};
    const c = A.ctx, t0 = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), gain = c.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(o.vol || 0.12, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  A.sfx = {
    click: () => tone(660, 0.06, { type: "triangle", vol: 0.08 }),
    eat: () => { tone(300, 0.07, { type: "square", vol: 0.05 }); tone(220, 0.07, { type: "square", vol: 0.05, delay: 0.08 }); },
    drink: () => tone(520, 0.18, { to: 900, vol: 0.08 }),
    dew: () => { tone(880, 0.12, { vol: 0.1 }); tone(1320, 0.18, { vol: 0.08, delay: 0.1 }); tone(1760, 0.25, { vol: 0.06, delay: 0.2 }); },
    burrow: () => tone(260, 0.15, { to: 140, type: "triangle", vol: 0.1 }),
    hawk: () => { tone(1800, 0.35, { to: 1100, type: "sawtooth", vol: 0.04 }); tone(1700, 0.3, { to: 1000, type: "sawtooth", vol: 0.03, delay: 0.4 }); },
    dive: () => tone(1400, 0.6, { to: 400, type: "sawtooth", vol: 0.04 }),
    hurt: () => tone(180, 0.3, { to: 60, type: "square", vol: 0.12 }),
    dodge: () => { tone(500, 0.08, { type: "triangle" }); tone(750, 0.12, { type: "triangle", delay: 0.08 }); },
    beat: () => { tone(70, 0.12, { vol: 0.2 }); tone(60, 0.12, { vol: 0.15, delay: 0.16 }); },
    day: () => [523, 659, 784].forEach((f, i) => tone(f, 0.4, { type: "triangle", vol: 0.07, delay: i * 0.12 })),
    evolve: () => [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, { type: "triangle", vol: 0.06, delay: i * 0.07 })),
    over: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.45, { type: "triangle", vol: 0.08, delay: i * 0.2 }))
  };

  // Looping filtered noise for sandstorm wind.
  A.setWind = function (on) {
    if (!A.ctx) return;
    if (on && !A.wind && A.enabled) {
      const c = A.ctx, len = c.sampleRate * 2;
      const buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const filter = c.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.value = 500; filter.Q.value = 0.7;
      const gain = c.createGain(); gain.gain.setValueAtTime(0.0001, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, c.currentTime + 1.5);
      src.connect(filter).connect(gain).connect(c.destination);
      src.start();
      A.wind = { src, gain };
    } else if (!on && A.wind) {
      const w = A.wind, c = A.ctx; A.wind = null;
      w.gain.gain.setValueAtTime(w.gain.gain.value, c.currentTime);
      w.gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1);
      w.src.stop(c.currentTime + 1.1);
    }
  };

  A.setEnabled = function (on) {
    A.enabled = on;
    if (!on) A.setWind(false);
  };

  SS.audio = A;
})(window.SS);
