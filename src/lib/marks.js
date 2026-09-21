import { COLORS } from "./constants";

// Series markers: past signals (with their outcome) + the trigger candle of the current setup.
export function buildMarks(analysis, history) {
  const out = [];
  (history || []).slice(0, 40).forEach((r) => {
    const ts = r.trigger_ts || Math.floor(new Date(r.created_at).getTime() / 1000);
    const buy = r.direction === "BUY";
    const color = r.status === "won" ? COLORS.bull : r.status === "lost" ? COLORS.bear
      : r.status === "open" ? COLORS.gold : COLORS.grey;
    const tail = r.status === "won" ? ` ✓ +${r.result_r ?? ""}R` : r.status === "lost" ? " ✗ -1R" : r.status === "open" ? " ●" : "";
    out.push({ time: ts, position: buy ? "belowBar" : "aboveBar", color, shape: buy ? "arrowUp" : "arrowDown",
      text: `${buy ? "BUY" : "SELL"}${tail}` });
  });
  const p = analysis?.entry?.pattern;
  if (p && !out.some((m) => m.time === p.ts)) {
    const bull = p.type.startsWith("bullish");
    out.push({ time: p.ts, position: bull ? "belowBar" : "aboveBar", color: COLORS.cyan,
      shape: "circle", text: p.label });
  }
  return out;
}
