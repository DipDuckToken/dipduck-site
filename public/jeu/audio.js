// Dip Duck — musique et sons fabriqués par le navigateur (Web Audio), aucun fichier externe.
// Musiques originales : village, nuit, forêt, intérieur, donjon. Ambiances et bruitages.
(() => {
  "use strict";
  let ac = null, out, music, sfx, amb, verb, muted = false;
  const MUSIC_VOL = 1.6;
  // volumes réglables (0 à 1), retenus dans le navigateur
  const VOL = { general: .8, musique: .7, effets: .9, ambiance: .7 };
  try { Object.assign(VOL, JSON.parse(localStorage.getItem("dipduck-volumes") || "{}")); } catch { /* */ }
  const outLevel = () => (muted ? 0 : 1.06 * VOL.general);
  const musicLevel = () => MUSIC_VOL * VOL.musique;
  try { muted = localStorage.getItem("dipduck-son") === "off"; } catch { /* */ }
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const m = (s) => { const r = /^([A-G])(b|#)?(-?\d)$/.exec(s); return 12 * (+r[3] + 1) + NOTE[r[1]] + (r[2] === "b" ? -1 : r[2] === "#" ? 1 : 0); };
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  let noiseBuf = null;

  function init() {
    if (ac) { if (ac.state === "suspended") ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    setup(new AC());
    setInterval(tick, 25);
  }
  function setup(ctx) {
    ac = ctx;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    out = ac.createGain(); out.gain.value = outLevel(); comp.connect(out);
    const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 55;
    const lim = ac.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .12; out.connect(hp); hp.connect(lim); lim.connect(ac.destination);
    // réverbération douce (réponse impulsionnelle fabriquée)
    verb = ac.createConvolver(); const len = ac.sampleRate * 2.4, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 2.6); }
    verb.buffer = ir; const vg = ac.createGain(); vg.gain.value = .32; verb.connect(vg); vg.connect(comp);
    music = bus(musicLevel(), comp); sfx = bus(1.6 * VOL.effets, comp); amb = bus(1.2 * VOL.ambiance, comp);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const nd = noiseBuf.getChannelData(0); for (let k = 0; k < nd.length; k++) nd[k] = Math.random() * 2 - 1;
  }
  // Enregistre une musique dans un fichier WAV (pour l'écouter hors du jeu)
  async function render(name, secs = 30) {
    const saved = [ac, out, music, sfx, amb, verb, noiseBuf, muted];
    const off = new OfflineAudioContext(2, Math.ceil(44100 * secs), 44100);
    setup(off); muted = false; out.gain.value = .85; music.gain.value = MUSIC_VOL; sfx.gain.value = 1.5; amb.gain.value = .9;
    const T = TRACKS[name], spb = 60 / T.bpm / 2;
    for (let st = 0, t = .05; t < secs - 1; st++, t += spb) { T.play(st, t, spb); if (T.amb) T.amb(t); }
    [ac, out, music, sfx, amb, verb, noiseBuf, muted] = saved;
    const buf = await off.startRendering();
    const L = buf.getChannelData(0), R = buf.getChannelData(1); let sum = 0, peak = 0;
    for (let k = 0; k < L.length; k++) { sum += L[k] * L[k]; peak = Math.max(peak, Math.abs(L[k])); }
    const n = L.length, data = new DataView(new ArrayBuffer(44 + n * 4));
    const w = (o, str) => { for (let k = 0; k < str.length; k++) data.setUint8(o + k, str.charCodeAt(k)); };
    w(0, "RIFF"); data.setUint32(4, 36 + n * 4, true); w(8, "WAVE"); w(12, "fmt "); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
    data.setUint32(24, 44100, true); data.setUint32(28, 44100 * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true); w(36, "data"); data.setUint32(40, n * 4, true);
    for (let k = 0; k < n; k++) { data.setInt16(44 + k * 4, Math.max(-1, Math.min(1, L[k])) * 32767, true); data.setInt16(46 + k * 4, Math.max(-1, Math.min(1, R[k])) * 32767, true); }
    return { url: URL.createObjectURL(new Blob([data], { type: "audio/wav" })), rms: Math.sqrt(sum / n), peak };
  }
  function bus(v, to) { const g = ac.createGain(); g.gain.value = v; g.connect(to); return g; }
  // une voix : oscillateurs → filtre → enveloppe → bus (+ réverbération)
  function voice(t, { type = "sine", f, dur = .4, a = .01, r = .3, vol = .2, to = music, wet = .3, cut = 0, detune = 0, glide = 0, vib = 0, partials = null }) {
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.setValueAtTime(vol, t + Math.max(a, dur - r)); g.gain.exponentialRampToValueAtTime(.0001, t + dur + r);
    let node = g;
    if (cut) { const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = cut; lp.connect(g); node = lp; }
    for (const [mul, pv] of partials || [[1, 1]]) {
      const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f * mul, t); if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, glide * mul), t + dur); o.detune.value = detune;
      if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.2; lg.gain.value = vib; l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(t + dur + r + .05); }
      let src = o; if (pv !== 1) { const pg = ac.createGain(); pg.gain.value = pv; o.connect(pg); src = pg; }
      src.connect(node); o.start(t); o.stop(t + dur + r + .05);
    }
    g.connect(to); if (wet) { const w = ac.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); }
  }
  function noise(t, { dur = .1, vol = .2, type = "bandpass", f = 1000, q = 1, f2 = 0, to = sfx, wet = .1, a = .003 }) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(to); if (wet) { const w = ac.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); }
    s.start(t, Math.random()); s.stop(t + dur + .05);
  }
  // instruments
  const I = {
    pad: (t, n, d, v = .05, cut = 1100) => voice(t, { type: "sawtooth", f: hz(n), dur: d, a: .5, r: .9, vol: v, cut, detune: 7, wet: .5, partials: [[1, 1], [1.003, .8]] }),
    bass: (t, n, d, v = .16) => voice(t, { type: "triangle", f: hz(n), dur: d, a: .01, r: .15, vol: v * .55, cut: 600, wet: .05 }),
    pluck: (t, n, v = .07) => voice(t, { type: "triangle", f: hz(n), dur: .05, a: .004, r: .45, vol: v, cut: 2600, wet: .25 }),
    bell: (t, n, v = .07) => voice(t, { type: "sine", f: hz(n), dur: .03, a: .003, r: 1.4, vol: v, wet: .45, partials: [[1, 1], [2.76, .25], [5.4, .08]] }),
    box: (t, n, v = .08) => voice(t, { type: "sine", f: hz(n), dur: .02, a: .002, r: .9, vol: v, wet: .35, partials: [[1, 1], [4, .18], [8.1, .05]] }),
    flute: (t, n, d, v = .07) => { voice(t, { type: "sine", f: hz(n), dur: d, a: .07, r: .22, vol: v, vib: 9, wet: .45, partials: [[1, 1], [2, .12], [3, .05]] }); noise(t, { dur: d * .6, vol: v * .12, f: hz(n) * 2, q: 3, to: music, wet: .2, a: .05 }); },
    lead: (t, n, d, v = .06) => voice(t, { type: "square", f: hz(n), dur: d, a: .01, r: .12, vol: v * .55, cut: 2400, vib: 6, wet: .3 }),
    hat: (t, v = .025) => noise(t, { dur: .045, vol: v, type: "highpass", f: 7000, to: music, wet: 0 }),
    kick: (t, v = .12) => voice(t, { type: "sine", f: 120, glide: 60, dur: .12, a: .002, r: .04, vol: v * .6, wet: 0 }),
    boom: (t, v = .15) => voice(t, { type: "sine", f: 70, glide: 35, dur: .9, a: .01, r: .6, vol: v, wet: .6 }),
  };

  // ─── Partitions (1 jeton = une croche ; « - » prolonge ; « . » silence) ───
  const parse = (str) => str.trim().split(/\s+/);
  function melody(tokens, step, t, spb, play) {
    const k = step % tokens.length, tok = tokens[k]; if (tok === "-" || tok === ".") return;
    let len = 1; while (tokens[(k + len) % tokens.length] === "-" && len < 16) len++;
    play(t, m(tok), len * spb);
  }
  const chordAt = (ch, step) => ch[Math.floor(step / 8) % ch.length].map(m);
  const TRACKS = {
    // Le Val de l'Étang, le jour : pastoral, joyeux (fa majeur)
    village: {
      bpm: 92,
      chords: [["F3", "A3", "C4"], ["C3", "E3", "G3"], ["D3", "F3", "A3"], ["Bb2", "D3", "F3"], ["F3", "A3", "C4"], ["C3", "E3", "G3"], ["Bb2", "D3", "F3"], ["C3", "E3", "G3"]],
      mel: parse(`A4 - C5 - A4 G4 F4 -   G4 - E4 - G4 A4 G4 -   F4 - A4 - D5 - C5 -   Bb4 A4 G4 - F4 - . .
                  A4 - C5 - F5 - E5 D5   C5 - G4 - E4 - G4 -   D5 C5 Bb4 A4 G4 - A4 Bb4   A4 - G4 - F4 - - .`),
      play(s, t, spb) {
        const ch = chordAt(this.chords, s), b = s % 8, loop = Math.floor(s / 64) % 4;
        if (b === 0) I.pad(t, ch[0] + 12, 8 * spb, .035);
        if (b === 0 || b === 4) I.bass(t, ch[0] - 12, 3 * spb);
        if (b === 2 || b === 6) ch.forEach((n, k) => I.pluck(t + k * .018, n + 12, .05));
        if (s % 2) I.hat(t); if (b === 0) I.kick(t, .07);
        if (loop !== 2) melody(this.mel, s, t, spb, (tt, n, d) => (loop === 3 ? I.flute(tt, n + 12, d, .05) : I.lead(tt, n, d, .07)));
        else if (b % 2 === 0) I.box(t, ch[(b / 2) % 3] + 24, .04);
      },
      amb(t) { if (Math.random() < .035) bird(t, .6); },
    },
    // La nuit : la même mélodie, tout doux, grillons
    nuit: {
      bpm: 64,
      chords: [["F3", "A3", "C4"], ["D3", "F3", "A3"], ["Bb2", "D3", "F3"], ["C3", "E3", "G3"]],
      scale: ["F4", "G4", "A4", "C5", "D5", "F5"],
      play(s, t, spb) {
        const ch = chordAt(this.chords, s), b = s % 8;
        if (b === 0) { I.pad(t, ch[0], 8 * spb, .04, 700); I.bass(t, ch[0] - 12, 6 * spb, .08); }
        if (b % 2 === 0 && Math.random() < .35) I.bell(t, m(this.scale[Math.floor(Math.random() * this.scale.length)]), .05);
      },
      amb(t) { if (Math.random() < .55) cricket(t); if (Math.random() < .01) owl(t); },
    },
    // La Forêt Profonde : mystérieuse (ré dorien), harpe et flûte
    foret: {
      bpm: 72,
      chords: [["D3", "F3", "A3"], ["C3", "E3", "G3"], ["G2", "B2", "D3"], ["D3", "F3", "A3"], ["D3", "F3", "A3"], ["F3", "A3", "C4"], ["C3", "E3", "G3"], ["A2", "C3", "E3"]],
      mel: parse(`D5 - - - A4 - C5 -   D5 - E5 - C5 - - -   B4 - D5 - G5 - F5 E5   D5 - - - - - . .
                  F5 - E5 - D5 - A4 -   C5 - E5 - G5 - E5 -   D5 - B4 - G4 - A4 B4   A4 - - - D5 - - .`),
      play(s, t, spb) {
        const ch = chordAt(this.chords, s), b = s % 8, loop = Math.floor(s / 64) % 3;
        if (b === 0) { I.pad(t, ch[0], 8 * spb, .035, 800); I.bass(t, ch[0] - 12, 6 * spb, .11); }
        const arp = [0, 1, 2, 1, 0, 1, 2, 1][b]; I.pluck(t, ch[arp] + 12 + (b >= 4 ? 12 : 0), .045);
        if (loop !== 1) melody(this.mel, s, t, spb, (tt, n, d) => I.flute(tt, n, d, .065));
      },
      amb(t) { if (Math.random() < .09) bird(t, 1); if (Math.random() < .04) noise(t, { dur: 1.4, vol: .03, type: "lowpass", f: 500, to: amb, wet: .2, a: .5 }); },
    },
    // Intérieur : boîte à musique douillette (si bémol majeur)
    interieur: {
      bpm: 84,
      chords: [["Bb2", "D3", "F3"], ["G2", "Bb2", "D3"], ["Eb3", "G3", "Bb3"], ["F2", "A2", "C3"]],
      mel: parse(`D5 F5 Bb5 F5 D5 F5 Bb4 -   D5 G5 Bb5 G5 D5 - . .   Eb5 G5 Bb5 G5 Eb5 G5 C5 -   C5 F5 A5 F5 C5 - . .
                  F5 - D5 - Bb4 - D5 -   G5 - F5 - D5 - . .   Eb5 - G5 - F5 - Eb5 D5   C5 - - - Bb4 - . .`),
      play(s, t, spb) {
        const ch = chordAt(this.chords, s), b = s % 8;
        if (b === 0) { I.bass(t, ch[0], 3 * spb, .1); I.pad(t, ch[1] + 12, 8 * spb, .02, 900); }
        if (b === 4) I.bass(t, ch[2] - 12, 3 * spb, .07);
        melody(this.mel, s, t, spb, (tt, n) => I.box(tt, n, .075));
      },
      amb(t) { if (Math.random() < .5) noise(t + Math.random() * .1, { dur: .02 + Math.random() * .03, vol: .05 + Math.random() * .05, type: "highpass", f: 2500, to: amb, wet: 0 }); },
    },
    // Les Monts du Vent : aérien et vaste (mi mineur), flûte, clochettes, rafales
    monts: {
      bpm: 78,
      chords: [["E3", "G3", "B3"], ["C3", "E3", "G3"], ["G2", "B2", "D3"], ["D3", "F#3", "A3"], ["E3", "G3", "B3"], ["C3", "E3", "G3"], ["G2", "B2", "D3"], ["D3", "F#3", "A3"]],
      mel: parse(`E5 - G5 - B5 - A5 G5   E5 - - - D5 - E5 -   D5 - B4 - D5 - G5 -   F#5 - - - - - . .
                  B5 - A5 - G5 - E5 -   G5 - E5 - C5 - E5 -   D5 - G5 - B5 - A5 G5   F#5 - E5 - - - . .`),
      play(s, t, spb) {
        const ch = chordAt(this.chords, s), b = s % 8, loop = Math.floor(s / 64) % 3;
        if (b === 0) { I.pad(t, ch[0] + 12, 8 * spb, .04, 1400); I.bass(t, ch[0] - 12, 7 * spb, .1); }
        if (b === 0 || b === 3 || b === 6) I.bell(t, ch[(b / 3) % 3] + 24, .03);
        if (loop !== 1) melody(this.mel, s, t, spb, (tt, n, d) => I.flute(tt, n, d, .065));
        else if (b % 2 === 0) I.pluck(t, ch[(b / 2) % 3] + 12, .05);
      },
      amb(t) { if (Math.random() < .06) noise(t, { dur: 2.2, vol: .07, type: "bandpass", f: 400, f2: 1400, q: .8, to: amb, wet: .3, a: .8 }); if (Math.random() < .006) voice(t, { type: "sine", f: 2400, glide: 1500, dur: .5, a: .05, r: .2, vol: .025, to: amb, wet: .6 }); },
    },
    // La Côte aux Phares : chanson de marins (sol majeur), accordéon, vagues, mouettes
    cote: {
      bpm: 104,
      chords: [["G3", "B3", "D4"], ["C3", "E3", "G3"], ["D3", "F#3", "A3"], ["G3", "B3", "D4"], ["E3", "G3", "B3"], ["C3", "E3", "G3"], ["D3", "F#3", "A3"], ["G3", "B3", "D4"]],
      mel: parse(`D5 - B4 - G4 - B4 D5   E5 - C5 - E5 - G5 -   F#5 - E5 - D5 - C5 -   B4 - - - G4 - . .
                  B4 - D5 - G5 - F#5 E5   E5 - D5 - C5 - E5 -   D5 - A4 - B4 - C5 -   B4 - A4 - G4 - . .`),
      play(s, t, spb) {
        const ch = chordAt(this.chords, s), b = s % 8;
        if (b === 0 || b === 4) I.bass(t, ch[0] - 12, 2 * spb, .13);
        if (b === 2 || b === 6) ch.forEach((n) => voice(t, { type: "square", f: hz(n), dur: spb * .8, a: .01, r: .08, vol: .018, cut: 1800, wet: .2 }));
        if (b === 0) I.pad(t, ch[0] + 12, 8 * spb, .025, 1200);
        if (b % 4 === 0) I.kick(t, .06);
        melody(this.mel, s, t, spb, (tt, n, d) => voice(tt, { type: "square", f: hz(n), dur: d, a: .02, r: .12, vol: .045, cut: 2200, vib: 14, wet: .3, partials: [[1, 1], [1.004, .6]] }));
      },
      amb(t) { if (Math.random() < .05) noise(t, { dur: 2.6, vol: .09, type: "lowpass", f: 700, f2: 300, to: amb, wet: .3, a: 1 }); if (Math.random() < .02) { const f = 1400 + Math.random() * 400; for (let k = 0; k < 2; k++) voice(t + k * .22, { type: "sawtooth", f, glide: f * .7, dur: .14, a: .01, r: .06, vol: .02, cut: 2600, to: amb, wet: .4 }); } },
    },
    // Combat de boss : rapide et intense (ré mineur), basse obstinée, tambours
    boss: {
      bpm: 138,
      chords: [["D3", "F3", "A3"], ["D3", "F3", "A3"], ["Bb2", "D3", "F3"], ["C3", "E3", "G3"]],
      mel: parse(`D5 - F5 - A5 - G5 F5   E5 - C5 - D5 - - .   F5 - E5 D5 C5 - A4 -   Bb4 - C5 - D5 - - .
                  A5 - G5 F5 E5 - F5 G5   A5 - - - D6 - C6 -   Bb5 - A5 G5 F5 - E5 -   D5 - - - - - . .`),
      play(s, t, spb) {
        const ch = chordAt(this.chords, s), b = s % 8;
        I.bass(t, ch[0] - 12 + (b % 2 ? 12 : 0), spb * .9, .14);
        if (b % 4 === 0) I.kick(t, .16); if (b % 4 === 2) noise(t, { dur: .12, vol: .07, f: 1800, q: .8, to: music, wet: .1 }); I.hat(t, .02);
        if (b === 0) I.pad(t, ch[1] + 12, 8 * spb, .03, 1600);
        melody(this.mel, s, t, spb, (tt, n, d) => I.lead(tt, n, d, .08));
      },
    },
    // Donjons : sombre et clairsemé (la mineur), cloches et gouttes
    donjon: {
      bpm: 58,
      scale: ["A4", "C5", "D5", "E5", "G5", "A5", "E4"],
      play(s, t, spb) {
        if (s % 16 === 0) { I.pad(t, m("A1"), 16 * spb, .05, 380); I.pad(t, m("E2"), 16 * spb, .035, 380); }
        if (s % 32 === 12) I.boom(t, .1);
        if (s % 2 === 0 && Math.random() < .3) I.bell(t, m(this.scale[Math.floor(Math.random() * this.scale.length)]), .045);
      },
      amb(t) { if (Math.random() < .08) drip(t); if (Math.random() < .03) noise(t, { dur: 2, vol: .04, type: "lowpass", f: 300, to: amb, wet: .3, a: .8 }); },
    },
  };
  // ambiances
  function bird(t, v) { const f = 2200 + Math.random() * 1800; for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) voice(t + k * .09, { type: "sine", f, glide: f * (1.2 + Math.random() * .4), dur: .06, a: .005, r: .03, vol: .03 * v, to: amb, wet: .3 }); }
  function cricket(t) { for (let k = 0; k < 3; k++) voice(t + k * .035, { type: "sine", f: 4400, dur: .015, a: .002, r: .01, vol: .012, to: amb, wet: .1 }); }
  function owl(t) { voice(t, { type: "sine", f: 420, glide: 380, dur: .35, a: .05, r: .2, vol: .05, to: amb, wet: .5 }); voice(t + .5, { type: "sine", f: 400, glide: 350, dur: .5, a: .05, r: .3, vol: .05, to: amb, wet: .5 }); }
  function drip(t) { const f = 900 + Math.random() * 900; voice(t, { type: "sine", f, glide: f * .5, dur: .07, a: .002, r: .05, vol: .06, to: amb, wet: .8 }); }

  // ─── Lecture en continu, fondu entre les musiques ───
  let cur = null, want = null, step = 0, nextT = 0, fading = false;
  function tick() {
    if (!ac || ac.state !== "running") return;
    const T = TRACKS[cur]; if (!T) return;
    const spb = 60 / T.bpm / 2;
    while (nextT < ac.currentTime + .15) { T.play(step, nextT, spb); if (T.amb) T.amb(nextT); step++; nextT += spb; }
  }
  function setTrack(name) {
    if (!ac || name === want) return; want = name;
    if (!cur) { cur = name; step = 0; nextT = ac.currentTime + .05; return; }
    if (fading) return; fading = true;
    music.gain.setTargetAtTime(0, ac.currentTime, .25);
    setTimeout(() => { cur = want; step = 0; nextT = ac.currentTime + .05; music.gain.setTargetAtTime(musicLevel(), ac.currentTime, .4); fading = false; }, 800);
  }

  // ─── Bruitages ───
  const FX = {
    quack: (t) => { for (const [d, f] of [[0, 620], [.13, 560]]) { voice(t + d, { type: "sawtooth", f, glide: f * .62, dur: .1, a: .005, r: .05, vol: .09, to: sfx, cut: 1500, wet: .1 }); noise(t + d, { dur: .1, vol: .05, f: 1100, q: 4, wet: .05 }); } },
    calm: (t) => { ["C6", "E6", "G6", "C7"].forEach((n, k) => I.bell(t + k * .06, m(n), .07)); noise(t, { dur: .5, vol: .04, type: "highpass", f: 6000, f2: 9000, wet: .4 }); },
    hurt: (t) => { voice(t, { type: "square", f: 320, glide: 110, dur: .22, a: .005, r: .08, vol: .07, to: sfx, cut: 1800, wet: .1 }); noise(t, { dur: .15, vol: .08, f: 800, q: .7 }); },
    hit: (t) => { noise(t, { dur: .12, vol: .12, f: 1500, q: .8 }); voice(t, { type: "square", f: 200, glide: 90, dur: .12, a: .003, r: .05, vol: .06, to: sfx, cut: 1200 }); },
    piece: (t) => { I.bell(t, m("B5"), .07); I.bell(t + .07, m("E6"), .08); },
    plume: (t) => { ["G5", "B5", "D6", "G6", "B6"].forEach((n, k) => voice(t + k * .035, { type: "sine", f: hz(m(n)), dur: .04, a: .003, r: .35, vol: .045, to: sfx, wet: .5 })); },
    cle: (t) => { for (let k = 0; k < 5; k++) voice(t + k * .05, { type: "triangle", f: 1800 + k * 220, dur: .03, a: .002, r: .12, vol: .04, to: sfx, wet: .3 }); },
    chest: (t) => { noise(t, { dur: .25, vol: .08, type: "lowpass", f: 400 }); ["C5", "E5", "G5", "C6"].forEach((n, k) => voice(t + .15 + k * .09, { type: "triangle", f: hz(m(n)), dur: .12, a: .005, r: .25, vol: .08, to: sfx, wet: .35 })); ["C5", "E5", "G5"].forEach((n) => voice(t + .55, { type: "triangle", f: hz(m(n)), dur: .5, a: .01, r: .6, vol: .05, to: sfx, wet: .5 })); },
    fanfare: (t) => { ["G4", "C5", "E5", "G5", "E5", "G5"].forEach((n, k) => voice(t + k * .11, { type: "square", f: hz(m(n)), dur: k === 5 ? .5 : .1, a: .005, r: .2, vol: .045, to: sfx, cut: 2600, wet: .35 })); },
    door: (t) => { voice(t, { type: "sine", f: 130, glide: 60, dur: .18, a: .003, r: .1, vol: .14, to: sfx, wet: .2 }); noise(t, { dur: .08, vol: .06, f: 600, q: 1 }); noise(t + .25, { dur: .35, vol: .025, type: "lowpass", f: 1200, f2: 400 }); },
    whoosh: (t) => noise(t, { dur: .7, vol: .08, f: 300, f2: 2500, q: 1.5, wet: .3, a: .2 }),
    unlock: (t) => { voice(t, { type: "square", f: 900, dur: .02, a: .001, r: .04, vol: .05, to: sfx }); voice(t + .12, { type: "square", f: 700, dur: .03, a: .001, r: .05, vol: .06, to: sfx }); FX.door(t + .3); },
    gate: (t) => { for (let k = 0; k < 8; k++) voice(t + k * .06, { type: "square", f: 300 + (k % 2) * 60, dur: .03, a: .001, r: .04, vol: .03, to: sfx, cut: 1600 }); I.boom(t + .5, .12); },
    push: (t) => noise(t, { dur: .3, vol: .07, type: "lowpass", f: 600, f2: 300, wet: .1, a: .05 }),
    grapple: (t) => { noise(t, { dur: .25, vol: .07, f: 800, f2: 3000, q: 2 }); voice(t + .2, { type: "triangle", f: 1400, dur: .02, a: .001, r: .1, vol: .06, to: sfx }); noise(t + .25, { dur: .4, vol: .05, f: 2000, f2: 600, q: 2 }); },
    miss: (t) => noise(t, { dur: .3, vol: .05, f: 900, f2: 2400, q: 2 }),
    blip: (t) => voice(t, { type: "square", f: 880, dur: .025, a: .002, r: .03, vol: .025, to: sfx, cut: 3000, wet: 0 }),
    pas: (t) => noise(t, { dur: .05, vol: .018, type: "lowpass", f: 900 + Math.random() * 300, wet: 0 }),
    pasDur: (t) => noise(t, { dur: .04, vol: .025, f: 2000 + Math.random() * 600, q: 1.2, wet: .05 }),
    pasEau: (t) => noise(t, { dur: .12, vol: .03, f: 1200, f2: 600, q: 1, wet: .1 }),
    chime: (t) => { ["E6", "B5", "G6"].forEach((n, k) => I.bell(t + k * .08, m(n), .05)); },
    papier: (t) => noise(t, { dur: .25, vol: .05, type: "highpass", f: 2500, f2: 5000, wet: .05, a: .05 }),
    coeur: (t) => { ["C5", "G5", "C6", "E6"].forEach((n, k) => I.bell(t + k * .1, m(n), .07)); },
  };
  function play(name) { if (!ac || ac.state !== "running" || muted || !FX[name]) return; FX[name](ac.currentTime + .01); }
  function toggle() { muted = !muted; try { localStorage.setItem("dipduck-son", muted ? "off" : "on"); } catch { /* */ } if (out) out.gain.setTargetAtTime(outLevel(), ac.currentTime, .1); return !muted; }

  // le son ne peut démarrer qu'après un geste du joueur
  for (const ev of ["keydown", "pointerdown"]) addEventListener(ev, init, { passive: true });
  function setVolume(kind, v) {
    VOL[kind] = Math.max(0, Math.min(1, v));
    try { localStorage.setItem("dipduck-volumes", JSON.stringify(VOL)); } catch { /* */ }
    if (!ac) return;
    const t = ac.currentTime;
    out.gain.setTargetAtTime(outLevel(), t, .05);
    if (!fading) music.gain.setTargetAtTime(musicLevel(), t, .05);
    sfx.gain.setTargetAtTime(1.6 * VOL.effets, t, .05); amb.gain.setTargetAtTime(1.2 * VOL.ambiance, t, .05);
  }
  window.AUDIO = { setVolume, volumes: () => ({ ...VOL }), init, setTrack, sfx: play, toggle, render, tracks: () => Object.keys(TRACKS), get on() { return !muted; } };
})();
