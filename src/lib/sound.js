// Tiny WebAudio alert sounds (no asset files). Browsers only allow audio after a user gesture,
// so the context is created lazily on the first click/tap.
let ctx = null;

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch { /* ignore */ }
}

function tone(freq, start, dur, type = "sine", gain = 0.12) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.05);
}

export function playAlert(kind) {
  try {
    unlockAudio();
    if (!ctx) return;
    if (kind === "win") { tone(660, 0, 0.14); tone(880, 0.14, 0.14); tone(1320, 0.28, 0.3); }
    else if (kind === "loss") { tone(330, 0, 0.22, "triangle"); tone(220, 0.22, 0.4, "triangle"); }
    else { tone(880, 0, 0.12); tone(880, 0.2, 0.12); tone(1175, 0.4, 0.25); }
  } catch { /* ignore */ }
}
