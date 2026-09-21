// Canvas overlay drawn on top of the lightweight-charts candles:
// zones (OB / FVG / supply / demand), BOS/CHoCH, liquidity, trend lines, key levels,
// sessions and the trade plan.  Works for ANY chart timeframe because everything is
// positioned by timestamp + price.
import { COLORS, SESSION_COLORS } from "./constants";

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const LEVEL_COLORS = {
  daily: COLORS.amber, weekly: COLORS.orange, session: COLORS.grey, open: "#64748b", round: "#475569",
};

function label(ctx, text, px, py, color, { align = "left", size = 10, bg = null, bold = false } = {}) {
  ctx.font = `${bold ? "600 " : ""}${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (bg) {
    const w = ctx.measureText(text).width + 8;
    const x0 = align === "right" ? px - w + 4 : align === "center" ? px - w / 2 : px - 4;
    ctx.fillStyle = bg;
    ctx.fillRect(x0, py - size / 2 - 2, w, size + 4);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, px, py);
}

function hline(ctx, y, x1, x2, color, { width = 1, dash = null, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash || []);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

function zoneColors(z) {
  if (z.source === "FVG") return z.type === "demand" ? COLORS.blue : COLORS.amber;
  return z.type === "demand" ? COLORS.bull : COLORS.bear;
}

function drawZone(ctx, env, z, tag, opts = {}) {
  const { x, y, W } = env;
  const y1 = y(z.top), y2 = y(z.bottom);
  if (y1 == null || y2 == null) return;
  const x1 = Math.max(0, x(z.ts) ?? 0);
  const x2 = z.end_ts ? x(z.end_ts) ?? W : W;
  if (x2 <= 0 || x1 >= W) return;
  const col = opts.color || zoneColors(z);
  const fresh = z.state === "fresh";
  ctx.fillStyle = rgba(col, opts.fill ?? (fresh ? 0.14 : 0.08));
  ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  ctx.save();
  ctx.strokeStyle = rgba(col, opts.stroke ?? (fresh ? 0.85 : 0.5));
  ctx.lineWidth = opts.width ?? 1;
  ctx.setLineDash(z.source === "FVG" || !fresh ? [4, 3] : []);
  ctx.strokeRect(x1 + 0.5, y1 + 0.5, x2 - x1 - 1, y2 - y1 - 1);
  ctx.restore();
  if (!env.compact || opts.forceLabel) {
    const kind = z.source === "FVG" ? "FVG" : z.source === "OB" ? "OB" : "zone";
    const side = z.type === "demand" ? "demand" : "supply";
    const txt = opts.text || `${tag} ${side} ${kind}${fresh ? " ✦" : ""}`;
    label(ctx, txt, Math.max(6, x1 + 4), Math.min(y1, y2) + 8, rgba(col, 0.95), { size: 9.5 });
  }
}

function drawEvents(ctx, env, events, tag, n = 5) {
  const { x, y } = env;
  events.slice(-n).forEach((e) => {
    const py = y(e.level);
    const x1 = x(e.level_ts), x2 = x(e.ts);
    if (py == null || x1 == null || x2 == null) return;
    const choch = e.type === "CHoCH";
    const col = choch ? COLORS.amber : e.dir === "bull" ? COLORS.bull : COLORS.bear;
    hline(ctx, py, Math.max(0, x1), x2, col, { width: 1.2, dash: choch ? [5, 3] : null, alpha: 0.9 });
    const mid = (Math.max(0, x1) + x2) / 2;
    label(ctx, `${tag} ${e.type}`, mid, py + (e.dir === "bull" ? -8 : 9), col, { align: "center", size: 9.5, bold: true });
  });
}

function drawSwings(ctx, env, swings, n = 8) {
  const { x, y } = env;
  swings.slice(-n).forEach((s) => {
    if (!s.label) return;
    const px = x(s.ts), py = y(s.price);
    if (px == null || py == null) return;
    const col = s.label === "HH" || s.label === "HL" ? COLORS.bull : COLORS.bear;
    label(ctx, s.label, px, py + (s.type === "high" ? -9 : 10), col, { align: "center", size: 9, bold: true });
  });
}

function drawPools(ctx, env, pools, n = 4) {
  const { x, y, W } = env;
  pools.slice(0, n).forEach((p) => {
    const py = y(p.price);
    if (py == null) return;
    const x1 = Math.max(0, x(p.ts) ?? 0);
    hline(ctx, py, x1, W, COLORS.violet, { width: 1, dash: [2, 3], alpha: 0.85 });
    label(ctx, `${p.type}${p.count > 1 ? " ×" + p.count : ""}`, x1 + 6, py - 7, COLORS.violet, { size: 9.5, bold: true });
  });
}

function drawSweeps(ctx, env, sweeps) {
  const { x, y } = env;
  sweeps.slice(-3).forEach((s) => {
    const px = x(s.ts), py = y(s.wick);
    if (px == null || py == null) return;
    const up = s.dir === "bull"; // sell-side raid then bullish reaction
    ctx.fillStyle = COLORS.violet;
    ctx.beginPath();
    ctx.moveTo(px, py + (up ? 3 : -3));
    ctx.lineTo(px - 4, py + (up ? 10 : -10));
    ctx.lineTo(px + 4, py + (up ? 10 : -10));
    ctx.closePath();
    ctx.fill();
    if (!env.compact) label(ctx, "sweep", px, py + (up ? 19 : -19), COLORS.violet, { align: "center", size: 9 });
  });
}

function drawTrendlines(ctx, env, tls, tag) {
  const { x, y, W, tAtX } = env;
  tls.filter((t) => !t.broken).forEach((t) => {
    const tEnd = t.broken && t.broken_ts ? t.broken_ts : tAtX(W);
    const pEnd = t.p2 + t.slope_per_sec * (tEnd - t.ts2);
    const xa = x(t.ts1), ya = y(t.p1), xb = x(tEnd), yb = y(pEnd);
    if ([xa, ya, xb, yb].some((v) => v == null)) return;
    ctx.save();
    ctx.strokeStyle = "#c084fc";
    ctx.globalAlpha = t.broken ? 0.4 : 0.95;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(t.broken ? [3, 4] : []);
    ctx.beginPath();
    ctx.moveTo(xa, ya);
    ctx.lineTo(xb, yb);
    ctx.stroke();
    ctx.restore();
    if (!env.compact) label(ctx, `${tag} TL${t.type === "up" ? "↗" : "↘"}${t.broken ? " (broken)" : ""}`, x(t.ts2) ?? xa, (y(t.p2) ?? ya) + (t.type === "up" ? 12 : -12), "#c084fc", { size: 9, align: "center" });
  });
}

function drawTF(ctx, env, a, tag, layerOpts = {}) {
  if (!a) return;
  (a.zones || []).forEach((z) => drawZone(ctx, env, z, tag));
  if (layerOpts.fvg) (a.fvgs || []).forEach((z) => drawZone(ctx, env, z, tag));
  if (layerOpts.key && a.key_zones) {
    [a.key_zones.supply_above, a.key_zones.demand_below].forEach((z, i) => {
      if (z) drawZone(ctx, env, z, tag, { width: 2, fill: 0.05, stroke: 1, forceLabel: true,
        text: `${tag} KEY ${i === 0 ? "SUPPLY above ✦" : "DEMAND below ✦"}` });
    });
  }
  drawEvents(ctx, env, a.events || [], tag, layerOpts.events ?? 4);
  if (!env.compact) drawSwings(ctx, env, a.swings || [], layerOpts.swings ?? 8);
  if (layerOpts.pools) drawPools(ctx, env, a.pools || [], layerOpts.pools);
  if (layerOpts.sweeps) drawSweeps(ctx, env, a.sweeps || []);
  if (layerOpts.trend) drawTrendlines(ctx, env, a.trendlines || [], tag);
}

function drawLevels(ctx, env, levels, precision) {
  const { y, W } = env;
  const rows = [];
  levels.forEach((lv) => {
    if (env.compact && lv.kind === "round") return;
    const py = y(lv.price);
    if (py == null || py < -5 || py > env.H + 5) return;
    rows.push({ lv, py });
  });
  rows.sort((a, b) => a.py - b.py);
  let prev = -99;
  rows.forEach(({ lv, py }) => {
    const col = LEVEL_COLORS[lv.kind] || COLORS.grey;
    hline(ctx, py, 0, W, col, { width: 1, dash: lv.kind === "round" ? [1, 5] : [6, 4], alpha: lv.kind === "round" ? 0.5 : 0.75 });
    const ly = Math.max(py - 7, prev + 12);
    prev = ly;
    label(ctx, `${lv.label} ${lv.price.toFixed(precision)}`, W - 6, ly, col, { align: "right", size: 9.5, bg: "rgba(11,14,17,0.75)" });
  });
}

function drawSessions(ctx, env) {
  const { x, H, sessionRuns } = env;
  sessionRuns.forEach((r) => {
    const col = SESSION_COLORS[r.tag];
    if (!col) return;
    const x1 = Math.max(0, x(r.t0) ?? 0), x2 = Math.min(env.W, x(r.t1) ?? env.W);
    if (x2 <= x1) return;
    ctx.fillStyle = rgba(col, r.tag === "asia" ? 0.03 : 0.05);
    ctx.fillRect(x1, 0, x2 - x1, H);
    ctx.fillStyle = rgba(col, 0.85);
    ctx.fillRect(x1, H - 4, x2 - x1, 4);
    if (x2 - x1 > 34) {
      const txt = r.tag === "overlap" ? "LON/NY" : r.tag === "ny" ? "NY" : r.tag === "london" ? "LON" : "ASIA";
      label(ctx, txt, x1 + 4, H - 12, rgba(col, 0.95), { size: 8.5 });
    }
  });
}

function drawTrade(ctx, env, a, precision) {
  const t = a.trade;
  if (!t || !t.entry) return;
  const { x, y, W } = env;
  const x1 = Math.max(0, x(t.ts) ?? 0);
  const ye = y(t.entry), ys = y(t.sl), yt = y(t.tp);
  if ([ye, ys, yt].some((v) => v == null)) return;
  ctx.fillStyle = rgba(COLORS.bull, 0.1);
  ctx.fillRect(x1, Math.min(ye, yt), W - x1, Math.abs(yt - ye));
  ctx.fillStyle = rgba(COLORS.bear, 0.1);
  ctx.fillRect(x1, Math.min(ye, ys), W - x1, Math.abs(ys - ye));
  hline(ctx, ye, x1, W, COLORS.gold, { width: 1.5 });
  hline(ctx, ys, x1, W, COLORS.bear, { width: 1.2, dash: [5, 3] });
  hline(ctx, yt, x1, W, COLORS.bull, { width: 1.2, dash: [5, 3] });
  label(ctx, `${t.direction} ${t.entry.toFixed(precision)}`, W - 6, ye - 7, "#111", { align: "right", size: 10, bold: true, bg: COLORS.gold });
  label(ctx, `SL ${t.sl.toFixed(precision)}`, W - 6, ys + (t.direction === "BUY" ? 8 : -8), COLORS.bear, { align: "right", size: 10, bold: true, bg: "rgba(11,14,17,0.8)" });
  label(ctx, `TP ${t.tp.toFixed(precision)}`, W - 6, yt + (t.direction === "BUY" ? -8 : 8), COLORS.bull, { align: "right", size: 10, bold: true, bg: "rgba(11,14,17,0.8)" });
}

function drawTrigger(ctx, env, a, precision) {
  drawTrade(ctx, env, a, precision);
  const e = a.entry;
  if (e?.mini_bos) {
    const py = env.y(e.mini_bos.level), x1 = env.x(e.mini_bos.level_ts), x2 = env.x(e.mini_bos.ts);
    if (py != null && x1 != null && x2 != null) {
      hline(ctx, py, Math.max(0, x1), x2 + 24, COLORS.cyan, { width: 1.5 });
      label(ctx, "mini BOS", (Math.max(0, x1) + x2) / 2, py - 8, COLORS.cyan, { align: "center", size: 9.5, bold: true });
    }
  }
  if (e?.tap_ts && a.zone_hit) {
    const px = env.x(e.tap_ts), py = env.y((a.zone_hit.top + a.zone_hit.bottom) / 2);
    if (px != null && py != null) {
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.stroke();
      if (!env.compact) label(ctx, "tap", px, py + 17, COLORS.gold, { align: "center", size: 9 });
    }
  }
}

export function drawOverlay(ctx, env) {
  const { W, H, layers, analysis: a, precision, tf } = env;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  if (layers.sessions) drawSessions(ctx, env);
  if (a) {
    if (layers.levels) drawLevels(ctx, env, a.levels || [], precision);
    // Structure of the timeframe being viewed (BOS/CHoCH, swings, OB/FVG, liquidity, trend lines).
    // On 4H / 1H the shared analysis IS that timeframe's structure.
    const own = tf === "4h" ? a["4h"] : tf === "1h" ? a["1h"] : env.own;
    const tag = (tf || "").toUpperCase();
    if (layers.own && own) {
      drawTF(ctx, env, own, tag, tf === "4h"
        ? { key: true, events: 5, swings: 8, pools: 3 }
        : { fvg: true, events: 5, swings: 8, pools: 3, sweeps: true, trend: true });
    }
    if (layers.htf && tf !== "4h") drawTF(ctx, env, a["4h"], "4H", { key: true, events: 4, swings: 6, pools: 3 });
    const setupOn = layers.setup && tf !== "1h";
    if (setupOn) drawTF(ctx, env, a["1h"], "1H", { fvg: true, events: 4, swings: 8, pools: 4, sweeps: true, trend: true });
    if (setupOn || (layers.own && tf === "1h")) {
      if (a.zone_hit) drawZone(ctx, env, a.zone_hit, "1H", { color: COLORS.gold, width: 2, fill: 0.16, stroke: 1, forceLabel: true, text: "1H ZONE HIT" });
      if (a.watch_zone) {
        drawZone(ctx, env, a.watch_zone, "1H", { color: COLORS.gold, fill: 0.05, stroke: 0.9, forceLabel: true,
          text: `WATCH ${a.watch_zone.source} · ${a.watch_zone.distance_atr.toFixed(1)} ATR away` });
      }
    }
    if (layers.trigger) drawTrigger(ctx, env, a, precision);
  }
  ctx.restore();
}
