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
  if (z.source === "BRK") return z.type === "demand" ? COLORS.cyan : COLORS.violet;
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
  ctx.fillStyle = rgba(col, opts.fill ?? (fresh ? 0.09 : 0.055));
  ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  ctx.save();
  ctx.strokeStyle = rgba(col, opts.stroke ?? (fresh ? 0.85 : 0.5));
  ctx.lineWidth = opts.width ?? 1;
  ctx.setLineDash(z.source === "FVG" || z.source === "BRK" || !fresh ? [4, 3] : []);
  ctx.strokeRect(x1 + 0.5, y1 + 0.5, x2 - x1 - 1, y2 - y1 - 1);
  ctx.restore();
  if (!env.compact || opts.forceLabel) {
    const kind = z.source === "FVG" ? "FVG" : z.source === "BRK" ? "breaker" : z.source === "OB" ? "OB" : "zone";
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
  tls.forEach((t) => {
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
  (a.breakers || []).forEach((z) => drawZone(ctx, env, z, tag));
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

// Premium / discount of the current dealing range (last swing high -> last swing low), the 50% equilibrium line and
// strong / weak highs & lows (the swing that protects the trend is "strong", the one price is expected to take is "weak").
function drawPremiumDiscount(ctx, env, a, tag) {
  if (!a || a.equilibrium == null || !a.last_high || !a.last_low) return;
  const { x, y, W } = env;
  const yh = y(a.last_high.price), yl = y(a.last_low.price), ye = y(a.equilibrium);
  if (yh == null || yl == null || ye == null) return;
  const x1 = Math.max(0, x(Math.min(a.last_high.ts, a.last_low.ts)) ?? 0);
  if (x1 >= W) return;
  ctx.fillStyle = rgba(COLORS.bear, 0.045); ctx.fillRect(x1, Math.min(yh, ye), W - x1, Math.abs(ye - yh));
  ctx.fillStyle = rgba(COLORS.bull, 0.045); ctx.fillRect(x1, Math.min(yl, ye), W - x1, Math.abs(yl - ye));
  hline(ctx, ye, x1, W, COLORS.grey, { width: 1, dash: [8, 5], alpha: 0.7 });
  if (!env.compact) {
    label(ctx, `${tag} EQ 50%`, x1 + 6, ye - 7, COLORS.grey, { size: 9.5, bold: true });
    label(ctx, "PREMIUM", x1 + 6, Math.min(yh, ye) + 9, rgba(COLORS.bear, 0.75), { size: 8.5, bold: true });
    label(ctx, "DISCOUNT", x1 + 6, Math.max(yl, ye) - 9, rgba(COLORS.bull, 0.75), { size: 8.5, bold: true });
  }
  const bullish = a.bias === "bullish", bearish = a.bias === "bearish";
  [[a.last_high, bullish ? "Weak High" : bearish ? "Strong High" : "High"], [a.last_low, bullish ? "Strong Low" : bearish ? "Weak Low" : "Low"]].forEach(([sw, txt]) => {
    const py = y(sw.price), px = x(sw.ts);
    if (py == null || px == null) return;
    const strong = txt.startsWith("Strong");
    const col = strong ? COLORS.gold : COLORS.grey;
    hline(ctx, py, Math.max(0, px), W, col, { width: strong ? 1.6 : 1, dash: strong ? null : [3, 3], alpha: strong ? 0.85 : 0.6 });
    label(ctx, `${tag} ${txt}`, W - 6, py + (sw.type === "high" ? -8 : 9), col, { align: "right", size: 9, bold: strong });
  });
}

// Asia / London session ranges as boxes (high-low of the last run of that session, extended to the right).
function drawSessionRanges(ctx, env, levels) {
  const { x, y, W } = env;
  [["ASI", "Asia range", "#64748b"], ["LON", "London range", "#3b82f6"]].forEach(([k, txt, col]) => {
    const hi = levels.find((l) => l.key === `${k}H`), lo = levels.find((l) => l.key === `${k}L`);
    if (!hi || !lo) return;
    const y1 = y(hi.price), y2 = y(lo.price), x1 = Math.max(0, hi.ts ? x(hi.ts) ?? 0 : 0);
    if (y1 == null || y2 == null || x1 >= W) return;
    ctx.fillStyle = rgba(col, 0.06); ctx.fillRect(x1, y1, W - x1, y2 - y1);
    ctx.save(); ctx.strokeStyle = rgba(col, 0.55); ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.strokeRect(x1 + 0.5, y1 + 0.5, W - x1 - 1, y2 - y1 - 1); ctx.restore();
    label(ctx, txt, x1 + 6, Math.min(y1, y2) + 9, rgba(col, 0.95), { size: 9, bold: true });
  });
}

// Entry-timeframe extras the engine already detects: liquidity sweep before the trigger, volume spike, retest limit entry, breakeven.
function drawEntryExtras(ctx, env, a, precision) {
  const e = a.entry;
  const { x, y, W } = env;
  if (e?.sweep) {
    const px = x(e.sweep.ts), py = y(e.sweep.level);
    if (px != null && py != null) {
      hline(ctx, py, Math.max(0, x(e.sweep.ts - 12 * (env.barSeconds || 900)) ?? 0), px + 30, COLORS.violet, { width: 1, dash: [2, 3], alpha: 0.9 });
      ctx.fillStyle = COLORS.violet; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
      label(ctx, "liq. sweep", px + 6, py + (a.trade?.direction === "SELL" ? -9 : 10), COLORS.violet, { size: 9, bold: true });
    }
  }
  if (e?.idm?.level != null) {
    const px = x(e.idm.sweep_ts ?? e.idm.ts), py = y(e.idm.level);
    if (px != null && py != null) {
      hline(ctx, py, Math.max(0, x(e.idm.ts) ?? 0), px + 30, COLORS.amber, { width: 1, dash: [1, 3], alpha: 0.95 });
      ctx.fillStyle = COLORS.amber; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
      label(ctx, "IDM", px + 6, py + (a.trade?.direction === "SELL" ? -9 : 10), COLORS.amber, { size: 9, bold: true });
    }
  }
  if (e?.volume?.spike) {
    const px = x(e.volume.ts);
    if (px != null) label(ctx, `VOL ×${Number(e.volume.ratio).toFixed(1)}`, px, 14, COLORS.gold, { align: "center", size: 9, bold: true, bg: "rgba(11,14,20,0.75)" });
  }
  if (e?.retest?.price != null) {
    const py = y(e.retest.price);
    if (py != null) {
      hline(ctx, py, 0, W, COLORS.cyan, { width: 1, dash: [6, 4], alpha: 0.8 });
      label(ctx, `retest entry ${e.retest.price.toFixed(precision)} (${e.retest.reward_r}R)`, 8, py - 7, COLORS.cyan, { size: 9.5, bold: true });
    }
  }
  const be = a.trade?.breakeven_price;
  if (be != null) {
    const py = y(be);
    if (py != null) {
      hline(ctx, py, 0, W, COLORS.grey, { width: 1, dash: [1, 4], alpha: 0.8 });
      label(ctx, `move stop to entry here ${be.toFixed(precision)}`, 8, py - 7, COLORS.grey, { size: 9 });
    }
  }
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

function drawOneTrade(ctx, env, t, precision, idx) {
  if (!t || !t.entry) return;
  const { x, y, W } = env;
  const sl = t.current_sl ?? t.sl;
  const x1 = Math.max(0, x(t.ts) ?? 0);
  const ye = y(t.entry), ys = y(sl), yt = y(t.tp);
  if ([ye, ys, yt].some((v) => v == null)) return;
  const buy = t.direction === "BUY";
  ctx.fillStyle = rgba(COLORS.bull, 0.1);
  ctx.fillRect(x1, Math.min(ye, yt), W - x1, Math.abs(yt - ye));
  ctx.fillStyle = rgba(COLORS.bear, t.be_moved ? 0.04 : 0.1);
  ctx.fillRect(x1, Math.min(ye, ys), W - x1, Math.abs(ys - ye));
  hline(ctx, ye, x1, W, COLORS.gold, { width: 1.5 });
  hline(ctx, ys, x1, W, t.be_moved ? COLORS.grey : COLORS.bear, { width: 1.2, dash: [5, 3] });
  hline(ctx, yt, x1, W, COLORS.bull, { width: 1.2, dash: [5, 3] });
  const tag = idx > 0 || t.multi ? ` #${idx + 1}` : "";
  const r = t.live_r != null ? ` ${t.live_r >= 0 ? "+" : ""}${t.live_r}R` : "";
  label(ctx, `${t.direction}${tag} ${t.entry.toFixed(precision)}${r}`, W - 6, ye - 7, "#111", { align: "right", size: 10, bold: true, bg: COLORS.gold });
  label(ctx, `${t.be_moved ? "SL(BE)" : "SL"} ${sl.toFixed(precision)}`, W - 6, ys + (buy ? 8 : -8), t.be_moved ? COLORS.grey : COLORS.bear, { align: "right", size: 10, bold: true, bg: "rgba(11,14,17,0.8)" });
  label(ctx, `TP ${t.tp.toFixed(precision)}`, W - 6, yt + (buy ? -8 : 8), COLORS.bull, { align: "right", size: 10, bold: true, bg: "rgba(11,14,17,0.8)" });
}

function drawTrade(ctx, env, a, precision) {
  const list = a.trades?.length ? a.trades : a.trade ? [a.trade] : [];
  list.forEach((t, i) => drawOneTrade(ctx, env, { ...t, multi: list.length > 1 }, precision, i));
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

// Economic-news events: a vertical line at the release, a shaded blackout band around high-impact ones, a flag with the
// name, and (for releases that already happened) how far price travelled afterwards.
const SHORT = [[/non-?farm|nfp|employment change/i, "NFP"], [/core cpi/i, "Core CPI"], [/\bcpi\b|consumer price/i, "CPI"], [/fomc.*(press|conference)/i, "FOMC presser"],
  [/fomc|federal funds|rate decision|interest rate/i, "RATE"], [/core pce|pce/i, "PCE"], [/unemployment claims/i, "Claims"], [/unemployment rate/i, "Unemp"],
  [/gdp/i, "GDP"], [/retail sales/i, "Retail"], [/\bpmi\b|ism/i, "PMI"], [/powell|speaks|speech/i, "Speech"], [/\bppi\b/i, "PPI"]];
const shortName = (t) => { for (const [re, s] of SHORT) if (re.test(t)) return s; return t.length > 16 ? `${t.slice(0, 15)}…` : t; };

function drawNews(ctx, env) {
  const { x, W, H, news, newsWin } = env;
  if (!news?.length) return;
  const rows = [14, 30, 46];
  let last = [-1e9, -1e9, -1e9];
  news.forEach((e) => {
    if (!e.relevant) return;
    const px = x(e.ts);
    if (px == null || px < -40 || px > W + 40) return;
    const col = e.impact === "high" ? COLORS.bear : COLORS.amber;
    if (e.impact === "high" && newsWin) {
      const a = x(e.ts - newsWin.before * 60), b = x(e.ts + newsWin.after * 60);
      if (a != null && b != null) { ctx.fillStyle = rgba(COLORS.bear, 0.06); ctx.fillRect(a, 0, Math.max(2, b - a), H); }
    }
    ctx.save();
    ctx.strokeStyle = rgba(col, e.impact === "high" ? 0.85 : 0.55);
    ctx.lineWidth = e.impact === "high" ? 1.5 : 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
    ctx.restore();
    const r = e.reaction;
    const text = `${e.impact === "high" ? "●" : "○"} ${e.currency} ${shortName(e.title)}` + (r && r.atr_x ? ` ${r.dir === "up" ? "▲" : "▼"}${r.atr_x}×` : "");
    ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
    const w = ctx.measureText(text).width + 8;
    let row = 0;
    while (row < rows.length - 1 && px < last[row] + 4) row++;
    last[row] = px + w;
    label(ctx, text, px + 4, rows[row], r ? (r.dir === "up" ? COLORS.bull : COLORS.bear) : col, { bg: "rgba(11,14,20,0.82)", bold: true });
  });
}

// AMD (accumulation -> manipulation -> distribution) of the timeframe being viewed.
function drawAMD(ctx, env, amd) {
  if (!amd || !amd.top || amd.phase === "none") return;
  const { x, y, W } = env;
  const y1 = y(amd.top), y2 = y(amd.bottom);
  const x1 = x(amd.start_ts);
  if (y1 == null || y2 == null || x1 == null) return;
  const col = "#a78bfa";
  const x2 = Math.min(W, x(amd.end_ts) ?? W);
  ctx.fillStyle = rgba(col, 0.07);
  ctx.fillRect(Math.max(0, x1), y1, Math.max(2, x2 - Math.max(0, x1)), y2 - y1);
  ctx.save();
  ctx.strokeStyle = rgba(col, 0.7); ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  ctx.strokeRect(Math.max(0, x1), y1, Math.max(2, x2 - Math.max(0, x1)), y2 - y1);
  ctx.setLineDash([6, 4]);
  const ym = y((amd.top + amd.bottom) / 2);
  if (ym != null) { ctx.beginPath(); ctx.moveTo(Math.max(0, x1), ym); ctx.lineTo(W, ym); ctx.globalAlpha = 0.35; ctx.stroke(); }
  ctx.restore();
  label(ctx, "A · range", Math.max(4, x1) + 4, y1 + 9, col, { size: 10, bold: true });
  const sw = amd.sweep;
  if (sw) {
    const sx = x(sw.ts), sy = y(sw.extreme);
    if (sx != null && sy != null) {
      ctx.fillStyle = COLORS.amber; ctx.beginPath();
      const up = sw.side === "high";
      ctx.moveTo(sx, sy + (up ? -2 : 2)); ctx.lineTo(sx - 5, sy + (up ? -10 : 10)); ctx.lineTo(sx + 5, sy + (up ? -10 : 10)); ctx.closePath(); ctx.fill();
      label(ctx, `M · ${sw.side} raided`, sx + 7, sy + (up ? -10 : 10), COLORS.amber, { size: 10, bold: true, bg: "rgba(11,14,20,0.75)" });
    }
  }
  const dsp = amd.disp;
  if (dsp) {
    const dx = x(dsp.ts);
    if (dx != null) label(ctx, `D · ${amd.dir > 0 ? "up" : "down"}`, dx + 4, (y(amd.dir > 0 ? amd.top : amd.bottom) ?? 40) + (amd.dir > 0 ? -14 : 14), amd.dir > 0 ? COLORS.bull : COLORS.bear,
      { size: 10, bold: true, bg: "rgba(11,14,20,0.75)" });
  }
  const txt = { accumulation: "AMD · accumulating", manipulation_pending: "AMD · raid in progress", manipulation: `AMD · trap set → expect ${amd.dir > 0 ? "UP" : "DOWN"}`,
    distribution: `AMD · distribution ${amd.dir > 0 ? "UP" : "DOWN"}` }[amd.phase];
  if (txt) label(ctx, txt, W - 8, env.H - 22, amd.dir > 0 ? COLORS.bull : amd.dir < 0 ? COLORS.bear : col, { align: "right", size: 11, bold: true, bg: "rgba(11,14,20,0.8)" });
}

export function drawOverlay(ctx, env) {
  const { W, H, layers, analysis: a, precision, tf } = env;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  if (layers.sessions) drawSessions(ctx, env);
  if (layers.news) drawNews(ctx, env);
  if (layers.amd && env.own?.amd) drawAMD(ctx, env, env.own.amd);
  if (a) {
    if (layers.sessions) drawSessionRanges(ctx, env, a.levels || []);
    if (layers.levels) drawLevels(ctx, env, a.levels || [], precision);
    // Structure of the timeframe being viewed (BOS/CHoCH, swings, OB/FVG, liquidity, trend lines).
    // On 4H / 1H the shared analysis IS that timeframe's structure.
    const own = tf === "4h" ? a["4h"] : tf === "1h" ? a["1h"] : env.own;
    const tag = (tf || "").toUpperCase();
    if (layers.own && own) {
      drawTF(ctx, env, own, tag, tf === "4h"
        ? { key: true, fvg: true, events: 5, swings: 8, pools: 3, sweeps: true, trend: true }
        : { fvg: true, events: 5, swings: 8, pools: 3, sweeps: true, trend: true });
    }
    if (layers.pd && own) drawPremiumDiscount(ctx, env, own, tag);
    if (layers.htf && tf !== "4h") drawTF(ctx, env, a["4h"], "4H", { key: true, fvg: true, events: 4, swings: 6, pools: 3 });
    const setupOn = layers.setup && tf !== "1h";
    if (setupOn) drawTF(ctx, env, a["1h"], "1H", { fvg: true, events: 4, swings: 8, pools: 4, sweeps: true, trend: true });
    if (setupOn || (layers.own && tf === "1h")) {
      if (a.zone_hit) drawZone(ctx, env, a.zone_hit, "1H", { color: COLORS.gold, width: 2, fill: 0.16, stroke: 1, forceLabel: true, text: "1H ZONE HIT" });
      if (a.watch_zone) {
        drawZone(ctx, env, a.watch_zone, "1H", { color: COLORS.gold, fill: 0.05, stroke: 0.9, forceLabel: true,
          text: `WATCH ${a.watch_zone.source} · ${a.watch_zone.distance_atr.toFixed(1)} ATR away` });
      }
    }
    if (layers.trigger) { drawTrigger(ctx, env, a, precision); drawEntryExtras(ctx, env, a, precision); }
  }
  ctx.restore();
}
