import { COLORS } from "./constants";

// Series markers: past signals (with their outcome) + the trigger candle of the current setup.
const BLOCK = { session: "session", confluence: "weak trigger", extension: "stretched", risk: "wide stop", agreement: "agreement", rule: "rule", room: "no room", news: "news", chop: "chop", cost: "spread", amd: "AMD says other way", smc_quality: "weak zone", killzone: "outside kill zone", exhaustion: "climax candle" };

// Past signals + near-misses from the replay endpoint (the engine run over the stored candles).
function replayMarks(replay, out) {
  if (!replay) return;
  const have = (t, dir) => out.some((m) => m.time === t && m.text.startsWith(dir));
  (replay.signals || []).forEach((r) => {
    if (have(r.entry_ts, r.direction)) return;          // the saved signal (real record) wins
    const buy = r.direction === "BUY";
    const res = r.result;
    const color = res === "win" ? COLORS.bull : res === "loss" ? COLORS.bear : res === "breakeven" ? COLORS.grey : COLORS.gold;
    const tail = res === "win" ? ` ✓ +${r.r}R` : res === "loss" ? " ✗ -1R" : res === "breakeven" ? " = 0R" : " ●";
    out.push({ time: r.entry_ts, position: buy ? "belowBar" : "aboveBar", color, shape: buy ? "arrowUp" : "arrowDown",
      text: `${r.style === "scalp" ? "S·" : ""}${r.direction}${tail}` });
  });
  (replay.previews || []).forEach((p) => {
    const buy = p.direction === "BUY";
    if (p.kind === "near_miss") {
      out.push({ time: p.ts, position: buy ? "belowBar" : "aboveBar", color: COLORS.amber, shape: "circle", size: 1,
        text: `${buy ? "buy" : "sell"}? ${BLOCK[p.blocked_by] || p.blocked_by}` });
    } else {
      out.push({ time: p.ts, position: buy ? "belowBar" : "aboveBar", color: COLORS.cyan, shape: "circle", size: 0.5, text: "" });
    }
  });
}

export function buildMarks(analysis, history, openTrades, replay) {
  const out = [];
  (history || []).slice(0, 40).forEach((r) => {
    const ts = r.trigger_ts || Math.floor(new Date(r.created_at).getTime() / 1000);
    const buy = r.direction === "BUY";
    const color = r.status === "won" ? COLORS.bull : r.status === "lost" ? COLORS.bear
      : r.status === "breakeven" ? COLORS.grey : r.status === "open" ? COLORS.gold : COLORS.grey;
    const tail = r.status === "won" ? ` ✓ +${r.result_r ?? ""}R` : r.status === "lost" ? " ✗ -1R" : r.status === "breakeven" ? " = 0R" : r.status === "open" ? " ●" : "";
    out.push({ time: ts, position: buy ? "belowBar" : "aboveBar", color, shape: buy ? "arrowUp" : "arrowDown",
      text: `${buy ? "BUY" : "SELL"}${tail}` });
  });
  (openTrades || []).forEach((r) => {
    const ts = r.trigger_ts || Math.floor(new Date(r.created_at).getTime() / 1000);
    if (out.some((m) => m.time === ts && m.text.startsWith(r.direction))) return;
    const buy = r.direction === "BUY";
    out.push({ time: ts, position: buy ? "belowBar" : "aboveBar", color: COLORS.gold, shape: buy ? "arrowUp" : "arrowDown",
      text: `${r.direction} ●` });
  });
  const p = analysis?.entry?.pattern;
  if (p && !out.some((m) => m.time === p.ts)) {
    const bull = String(p.type).startsWith("bullish");
    out.push({ time: p.ts, position: bull ? "belowBar" : "aboveBar", color: COLORS.cyan,
      shape: "circle", text: p.label });
  }
  replayMarks(replay, out);
  return out.sort((a, b) => a.time - b.time);
}
