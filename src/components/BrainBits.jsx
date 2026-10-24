import React, { useMemo, useState } from "react";
import { BellRing, Check, ChevronLeft, ChevronRight, Eye, EyeOff, Lock, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { Segmented } from "./ui";
import { useLive } from "../context/LiveContext";
import { DEFAULT_VIEW, VIEW_KEYS, mmss, stateOf, useNow, useView } from "../lib/brain";
import { SESSION_COLORS, SESSION_LABELS } from "../lib/constants";
import { cx, fmtCountdown, fmtPrice, fmtTime } from "../lib/format";

/* ------------------------------------------------------------------ small pieces */
export function PctRing({ value, size = 64, color = "#d4af37", label = "ready", blink = "" }) {
  const r = size / 2 - 5, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={cx("relative shrink-0 rounded-full", blink)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#232a35" strokeWidth="5" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="5" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: "stroke-dashoffset .6s, stroke .3s" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-bold tabular-nums" style={{ fontSize: size * 0.27 }}>{Math.round(v)}%</span>
        {label && <span className="uppercase tracking-wider text-gray-500 mt-0.5" style={{ fontSize: Math.max(7, size * 0.13) }}>{label}</span>}
      </div>
    </div>
  );
}

/** "TRADEABLE NOW" / "ARMED" ... pill; blinks while the side can be traded. */
export function StateBadge({ side, className = "" }) {
  const st = stateOf(side);
  const counter = side?.counter && (side.state === "ready" || side.state === "fire");
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full border whitespace-nowrap",
      st.box, st.text, counter ? "blink-counter" : st.blink, className)}>
      {st.blink && <span className="w-1.5 h-1.5 rounded-full bg-current blink-text" />}
      {counter ? "COUNTER-TREND READY" : st.label}
    </span>
  );
}

/** The seven stages between "idea" and "entry": trend > zone > candle > confirm > session > news > room. */
export function StagePipeline({ stages = [], compact = false }) {
  const now = stages.find((s) => s.state === "now") || stages.find((s) => s.state === "blocked");
  return (
    <div>
      <div className="flex items-start">
        {stages.map((s, i) => {
          const prevDone = i > 0 && stages[i - 1].state === "done";
          const node = {
            done: "border-bull bg-bull/20 text-bull", now: "border-gold bg-gold/20 text-gold node-now",
            blocked: "border-amber-400 bg-amber-400/15 text-amber-400", wait: "border-border text-gray-600",
          }[s.state];
          return (
            <React.Fragment key={s.key}>
              {i > 0 && <div className={cx("h-px w-1 mt-[11px] shrink-0", prevDone ? "bg-bull/60" : "bg-border")} />}
              <div className="flex flex-col items-center flex-1 min-w-0 text-center" title={`${s.label}: ${s.detail}`}>
                <span className={cx("w-[22px] h-[22px] rounded-full border flex items-center justify-center", node)}>
                  {s.state === "done" ? <Check size={12} strokeWidth={3} /> : s.state === "blocked" ? <Lock size={10} /> : s.state === "now" ? <span className="w-1.5 h-1.5 rounded-full bg-current" /> : null}
                </span>
                <span className={cx("mt-1 leading-tight", compact ? "text-[8px]" : "text-[9px]", s.state === "done" ? "text-gray-300" : s.state === "wait" ? "text-gray-600" : "text-gray-200 font-semibold")}>{s.label}</span>
                <span className="text-[8px] tabular-nums text-gray-600">{Math.round(s.score * 100)}%</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {!compact && now && (
        <p className={cx("text-[11px] mt-2 leading-snug rounded-lg px-2.5 py-1.5 border", now.state === "blocked" ? "border-amber-400/30 text-amber-300 bg-amber-400/5" : "border-gold/25 text-gray-300 bg-gold/5")}>
          <b className={now.state === "blocked" ? "text-amber-300" : "text-gold"}>{now.state === "blocked" ? "Blocked" : "Now"} - {now.label}:</b> {now.detail}
        </p>
      )}
    </div>
  );
}

/** Confirmations behind the trigger candle: n of m needed, and which ones are present. */
export function ConfirmMeter({ confirm }) {
  if (!confirm) return null;
  const { have, need, items } = confirm;
  const ok = have >= need;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-gray-400">Confirmations behind the trigger</span>
        <span className={cx("font-bold tabular-nums", ok ? "text-bull" : "text-amber-400")}>{have} / {need} needed</span>
      </div>
      <div className="flex gap-1 mb-1.5">
        {Array.from({ length: Math.max(need, 1) }).map((_, i) => <span key={i} className={cx("h-1.5 flex-1 rounded-full", i < have ? "bg-bull" : "bg-white/10")} />)}
      </div>
      <div className="flex flex-wrap gap-1">
        {items.map((x) => (
          <span key={x.key} title={x.detail} className={cx("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border",
            x.ok ? "border-bull/40 text-bull bg-bull/10" : "border-border text-gray-500")}>
            {x.ok ? <Check size={10} strokeWidth={3} /> : <X size={10} />}{x.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Is the candle being approved as a trigger? forming -> approved / needs more confirmations. */
export function ApprovalBar({ ap, nowMs }) {
  if (!ap) return null;
  const left = ap.candle_open_ts && ap.step ? Math.max(0, ap.candle_open_ts + ap.step - nowMs / 1000) : null;
  const meta = {
    approved: ["Approved", "text-bull border-bull/40 bg-bull/10", "bg-bull"],
    needs_confirm: ["Needs confirmation", "text-amber-300 border-amber-400/40 bg-amber-400/10", "bg-amber-400"],
    forming: ["Approving...", "text-cyan-300 border-cyan-300/40 bg-cyan-300/10", "bg-cyan-300"],
    idle: ["No candle yet", "text-gray-500 border-border", "bg-gray-600"],
  }[ap.state] || [];
  return (
    <div className={cx("rounded-lg border px-2.5 py-1.5 text-[11px]", meta[1])}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{meta[0]}{ap.pattern ? ` - ${ap.pattern}` : ""}</span>
        <span className="tabular-nums">{ap.pct}%{ap.state === "forming" && left != null ? ` · closes in ${mmss(left)}` : ""}</span>
      </div>
      <div className="h-1 rounded-full bg-white/10 mt-1.5 overflow-hidden"><div className={cx("h-full rounded-full transition-all", meta[2])} style={{ width: `${ap.pct}%` }} /></div>
      <div className="text-[10px] opacity-80 mt-1 leading-snug">{ap.detail}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ trade ladder */
/** Stop - entry zone - entry - price - target on one line, with the risk and reward drawn to scale. */
export function TradeLadder({ plan, price, buy, precision }) {
  if (!plan) return null;
  const zone = plan.entry_zone || [plan.entry, plan.entry];
  const pts = [plan.stop, plan.target, plan.entry, zone[0], zone[1], price].filter((v) => v != null);
  const lo = Math.min(...pts), hi = Math.max(...pts), span = Math.max(hi - lo, 1e-9);
  const W = 320, pad = 10;
  const x = (v) => pad + ((v - lo) / span) * (W - pad * 2);
  const col = buy ? "#12b886" : "#ff4d4f";
  const ex = x(plan.entry), sx = x(plan.stop), tx = x(plan.target), px = x(price);
  const risk = Math.abs(plan.entry - plan.stop);
  return (
    <svg viewBox={`0 0 ${W} 58`} className="w-full" role="img" aria-label="Trade ladder: stop, entry zone, price and target">
      <rect x={Math.min(sx, ex)} y="22" width={Math.abs(ex - sx)} height="8" rx="2" fill="#ff4d4f" opacity=".28" />
      <rect x={Math.min(ex, tx)} y="22" width={Math.abs(tx - ex)} height="8" rx="2" fill="#12b886" opacity=".28" />
      <rect x={x(zone[0])} y="17" width={Math.max(3, x(zone[1]) - x(zone[0]))} height="18" rx="3" fill={col} opacity=".35" stroke={col} strokeWidth=".8" />
      <line x1={sx} x2={sx} y1="14" y2="38" stroke="#ff4d4f" strokeWidth="2" />
      <line x1={tx} x2={tx} y1="14" y2="38" stroke="#12b886" strokeWidth="2" />
      <line x1={ex} x2={ex} y1="14" y2="38" stroke="#d4af37" strokeWidth="1.5" strokeDasharray="2 2" />
      <text x={sx} y="10" textAnchor="middle" fontSize="8" fill="#ff4d4f" fontWeight="700">STOP</text>
      <text x={tx} y="10" textAnchor="middle" fontSize="8" fill="#12b886" fontWeight="700">TARGET</text>
      <text x={ex} y="49" textAnchor="middle" fontSize="8" fill="#d4af37">entry</text>
      <text x={(sx + ex) / 2} y="49" textAnchor="middle" fontSize="8" fill="#ff4d4f" opacity=".8">1R</text>
      <text x={(ex + tx) / 2} y="57" textAnchor="middle" fontSize="8" fill="#12b886" opacity=".9">{plan.reward_r}R</text>
      <circle cx={px} cy="26" r="4.5" fill="#fff" stroke="#0b0e11" strokeWidth="1.5" />
      <text x={px} y="8" textAnchor="middle" fontSize="8" fill="#e5e7eb" fontWeight="700" opacity={Math.abs(px - sx) < 28 || Math.abs(px - tx) < 28 ? 0 : 1}>now</text>
      <title>{`price ${fmtPrice(price, precision)} · risk ${fmtPrice(risk, precision)}`}</title>
    </svg>
  );
}

/* ------------------------------------------------------------------ zoom bar */
/** − / + / fit and ◀ ▶ buttons shared by the live preview, the candle being built and the timeline. */
export function ZoomBar({ onIn, onOut, onFit, onBack, onFwd, canIn = true, canOut = true, canBack = false, canFwd = false, label, className = "" }) {
  const b = "w-6 h-6 rounded-md border border-border text-gray-400 hover:text-gold disabled:opacity-30 disabled:hover:text-gray-400 flex items-center justify-center";
  return (
    <div className={cx("flex items-center gap-1", className)} role="group" aria-label="Zoom">
      {onBack && <button type="button" className={b} onClick={onBack} disabled={!canBack} aria-label="Earlier"><ChevronLeft size={13} /></button>}
      {onFwd && <button type="button" className={b} onClick={onFwd} disabled={!canFwd} aria-label="Later"><ChevronRight size={13} /></button>}
      <button type="button" className={b} onClick={onOut} disabled={!canOut} aria-label="Zoom out"><ZoomOut size={13} /></button>
      <button type="button" className={b} onClick={onIn} disabled={!canIn} aria-label="Zoom in"><ZoomIn size={13} /></button>
      {onFit && <button type="button" className={b} onClick={onFit} aria-label="Reset zoom"><Maximize2 size={12} /></button>}
      {label && <span className="text-[10px] text-gray-500 tabular-nums ml-0.5 min-w-[34px]">{label}</span>}
    </div>
  );
}

const IMPACT_COL = { high: "#ff4d4f", medium: "#f59e0b", low: "#6b7280" };
const hhmm = (t) => fmtTime(t, { hour: "2-digit", minute: "2-digit" });
const short = (s, n = 14) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** What the last release did to price, as one sentence + chips (from brain.fundamentals.reaction). */
export function ReactionNote({ r, className = "" }) {
  if (!r) return null;
  const tone = r.dir > 0 ? "border-bull/40 bg-bull/10 text-bull" : r.dir < 0 ? "border-bear/40 bg-bear/10 text-bear" : "border-border bg-white/[0.03] text-gray-300";
  return (
    <div className={cx("rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug", tone, className)}>
      <b>{r.title || r.label}</b> printed {r.mins_ago} min ago{r.actual ? ` (actual ${r.actual}${r.forecast ? ` vs ${r.forecast}` : ""})` : ""}: price {r.move_atr >= 0 ? "+" : ""}{r.move_atr} ATR
      {r.dir > 0 ? " - UP" : r.dir < 0 ? " - DOWN" : " - no clear direction"}
      {r.state === "settling" ? ", still settling (wait for 3 closed candles)" : r.retest ? ", pulled back and holding - post-news retest zone" : r.pullback != null ? `, pullback ${Math.round(r.pullback * 100)}% of the spike` : ""}.
      {r.read ? <span className="text-gray-400"> {r.read}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ mini chart */
const BAR_ZOOMS = [15, 24, 36, 60, 90, 120];

/** The entry-timeframe candles with both sides' zones, the lead plan (entry / stop / target), the candle forming now, the
 *  trigger patterns seen, news releases and what price did after them. Zoom (−/+), pan (◀ ▶) and hover for OHLC.
 *  Everything comes from the brain payload. */
export function MiniChart({ brain, precision = 2, showPatterns = true, height = 220, nowMs }) {
  const all = useMemo(() => {
    const b = (brain.candles || []).map((c) => ({ t: c[0], o: c[1], h: c[2], l: c[3], c: c[4] }));
    if (brain.forming) b.push({ t: brain.forming.open_ts, o: brain.forming.o, h: brain.forming.h, l: brain.forming.l, c: brain.forming.c, forming: true });
    return b;
  }, [brain.candles, brain.forming]);
  const [zi, setZi] = useState(3);
  const [back, setBack] = useState(0);
  const [hov, setHov] = useState(null);
  const total = all.length;
  const count = Math.min(BAR_ZOOMS[zi], total);
  const maxBack = Math.max(0, total - count);
  const off = Math.min(back, maxBack);
  const bars = all.slice(total - count - off, total - off);
  if (bars.length < 5) return null;

  const W = 640, padR = 58, padT = 16, padB = 26, H = height;
  const step = brain.step || (bars[1].t - bars[0].t);
  const lead = brain.sides?.[brain.lead];
  const atr = brain.atr || 0;
  let lo = Math.min(...bars.map((b) => b.l)), hi = Math.max(...bars.map((b) => b.h));
  const rng0 = Math.max(hi - lo, 1e-9);
  const reach = (v) => v != null && v >= lo - 1.2 * rng0 && v <= hi + 1.2 * rng0;
  const zones = ["BUY", "SELL"].map((s) => ({ side: s, z: brain.sides?.[s]?.zone })).filter((q) => q.z && reach(q.z.top) && reach(q.z.bottom));
  const plan = lead?.plan;
  const lines = [];
  if (plan) {
    if (reach(plan.stop)) lines.push({ v: plan.stop, c: "#ff4d4f", t: "SL" });
    if (reach(plan.target)) lines.push({ v: plan.target, c: "#12b886", t: "TP" });
    if (plan.entry != null && reach(plan.entry)) lines.push({ v: plan.entry, c: "#60a5fa", t: "ENTRY" });
  }
  const rx = brain.fundamentals?.reaction;
  const rxVisible = rx && rx.release_ts >= bars[0].t && rx.release_ts <= bars[bars.length - 1].t + step;
  if (rxVisible) [rx.base].forEach((v) => { lo = Math.min(lo, v); hi = Math.max(hi, v); });
  [...zones.flatMap((q) => [q.z.top, q.z.bottom]), ...lines.map((l) => l.v)].forEach((v) => { lo = Math.min(lo, v); hi = Math.max(hi, v); });
  const pad = (hi - lo) * 0.06;
  lo -= pad; hi += pad;
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const n = bars.length, bw = (W - padR) / n, cw = Math.max(2, bw * 0.62);
  const x = (i) => i * bw + bw / 2;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + (hi - lo) * f);
  const last = brain.price;
  const byTs = Object.fromEntries(bars.map((b, i) => [b.t, i]));
  const pats = (brain.recent_patterns || []).filter((p) => byTs[p.ts] != null);
  const fl = brain.forming ? Math.max(0, brain.forming.open_ts + brain.forming.step - (nowMs || Date.now()) / 1000) : null;
  const idxAt = (ts) => { let k = -1; bars.forEach((b, i) => { if (b.t <= ts) k = i; }); return k; };
  const marks = (brain.news_marks || []).filter((m) => m.ts >= bars[0].t && m.ts < bars[n - 1].t + step).map((m) => ({ ...m, i: idxAt(m.ts) })).filter((m) => m.i >= 0);
  const futureNews = (brain.news_marks || []).filter((m) => m.ts >= bars[n - 1].t + step).slice(0, 2);
  const every = Math.max(1, Math.round(n / 6));
  const onMove = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) / r.width * W;
    const k = Math.floor(px / bw);
    setHov(k >= 0 && k < n ? k : null);
  };
  const hb = hov != null ? bars[hov] : bars[n - 1];
  const hp = hb && pats.find((p) => p.ts === hb.t);
  const body = hb ? Math.abs(hb.c - hb.o) : 0, rng = hb ? hb.h - hb.l : 0;
  const zi_ = (d) => setZi((v) => Math.max(0, Math.min(BAR_ZOOMS.length - 1, v + d)));
  const shift = Math.max(1, Math.round(count / 3));
  const facts = [];
  if (plan) {
    if (plan.entry != null) facts.push(["Entry", fmtPrice(plan.entry, precision) + (plan.entry_zone ? ` (zone ${fmtPrice(plan.entry_zone[0], precision)}–${fmtPrice(plan.entry_zone[1], precision)})` : ""), "text-sky-400"]);
    if (plan.stop != null) facts.push(["Stop", fmtPrice(plan.stop, precision) + (plan.risk ? ` · risk ${fmtPrice(plan.risk, precision)}` : ""), "text-bear"]);
    if (plan.target != null) facts.push(["Target", fmtPrice(plan.target, precision) + (plan.reward_r ? ` · ${plan.reward_r}R` : ""), "text-bull"]);
  }
  ["BUY", "SELL"].forEach((s) => {
    const z = brain.sides?.[s]?.zone;
    if (z) facts.push([`${s} zone`, `${fmtPrice(z.bottom, precision)}–${fmtPrice(z.top, precision)}${z.source ? ` · 1H ${z.source}` : ""}${brain.sides[s].distance_atr != null && !brain.sides[s].in_zone ? ` · ${brain.sides[s].distance_atr.toFixed(1)} ATR away` : brain.sides[s].in_zone ? " · price inside" : ""}`, s === "BUY" ? "text-bull" : "text-bear"]);
  });
  if (atr) facts.push(["ATR", `${fmtPrice(atr, precision)} per ${brain.tf} candle`, "text-gray-300"]);
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <div className="text-[10px] text-gray-400 tabular-nums leading-tight">
          <span className="text-gray-500">{hhmm(hb.t)}{hb.forming ? " (forming)" : ""}</span>{" "}
          O {fmtPrice(hb.o, precision)} · H {fmtPrice(hb.h, precision)} · L {fmtPrice(hb.l, precision)} · C <b className={hb.c >= hb.o ? "text-bull" : "text-bear"}>{fmtPrice(hb.c, precision)}</b>
          {atr > 0 && <span className="text-gray-500"> · body {(body / atr).toFixed(1)} ATR · range {(rng / atr).toFixed(1)} ATR</span>}
          {hp && <span className={hp.dir === "BUY" ? " text-bull" : " text-bear"}> · {hp.dir === "BUY" ? "▲" : "▼"} {hp.label}</span>}
        </div>
        <ZoomBar onIn={() => zi_(-1)} onOut={() => zi_(1)} onFit={() => { setZi(3); setBack(0); }} canIn={zi > 0} canOut={zi < BAR_ZOOMS.length - 1 && BAR_ZOOMS[zi] < total}
          onBack={() => setBack(Math.min(maxBack, off + shift))} onFwd={() => setBack(Math.max(0, off - shift))} canBack={off < maxBack} canFwd={off > 0} label={`${n} bars`} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-black/20 border border-border touch-pan-y" role="img" aria-label="Candle chart with zones, plan, patterns and news"
        onMouseMove={onMove} onMouseLeave={() => setHov(null)} onTouchMove={onMove} onTouchEnd={() => setHov(null)}>
        {grid.map((g, i) => (
          <g key={i}>
            <line x1="0" x2={W - padR} y1={y(g)} y2={y(g)} stroke="#232a35" strokeWidth=".6" />
            <text x={W - padR + 4} y={y(g) + 3} fontSize="9" fill="#6b7280">{fmtPrice(g, precision)}</text>
          </g>
        ))}
        {bars.map((b, i) => (i % every === 0 ? <text key={`t${i}`} x={x(i)} y={H - 12} fontSize="8" fill="#6b7280" textAnchor="middle">{hhmm(b.t)}</text> : null))}
        {zones.map((q) => (
          <g key={q.side}>
            <rect x="0" width={W - padR} y={y(q.z.top)} height={Math.max(2, y(q.z.bottom) - y(q.z.top))} fill={q.side === "BUY" ? "#12b886" : "#ff4d4f"} opacity=".14" />
            <text x="4" y={y(q.z.top) + 9} fontSize="8" fill={q.side === "BUY" ? "#12b886" : "#ff4d4f"} fontWeight="700">{q.side} zone{q.z.source ? ` · 1H ${q.z.source}` : ""}</text>
          </g>
        ))}
        {marks.map((m, k) => (
          <g key={`n${k}`}>
            <line x1={x(m.i)} x2={x(m.i)} y1={padT - 4} y2={H - padB} stroke={IMPACT_COL[m.impact] || "#6b7280"} strokeWidth="1" strokeDasharray="1 3" opacity=".9" />
            <text x={Math.min(x(m.i) + 2, W - padR - 40)} y={padT - 5} fontSize="7.5" fill={IMPACT_COL[m.impact] || "#6b7280"} fontWeight="700">{m.currency} {short(m.title, 16)}</text>
            <title>{`${hhmm(m.ts)} ${m.currency} ${m.title} (${m.impact})${m.actual ? ` actual ${m.actual}` : ""}${m.forecast ? ` forecast ${m.forecast}` : ""}`}</title>
          </g>
        ))}
        {rxVisible && (
          <g>
            <line x1="0" x2={W - padR} y1={y(rx.base)} y2={y(rx.base)} stroke="#a78bfa" strokeWidth=".9" strokeDasharray="4 3" opacity=".8" />
            <text x={W - padR - 4} y={y(rx.base) - 3} fontSize="8" fill="#a78bfa" textAnchor="end">pre-news close {fmtPrice(rx.base, precision)}</text>
          </g>
        )}
        {lines.map((l) => (
          <g key={l.t}>
            <line x1="0" x2={W - padR} y1={y(l.v)} y2={y(l.v)} stroke={l.c} strokeWidth="1" strokeDasharray="5 3" opacity=".85" />
            <text x={W - padR - 4} y={y(l.v) - 3} fontSize="8" fill={l.c} textAnchor="end" fontWeight="700">{l.t} {fmtPrice(l.v, precision)}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const up = b.c >= b.o, col = up ? "#12b886" : "#ff4d4f";
          const top = y(Math.max(b.o, b.c)), bot = y(Math.min(b.o, b.c));
          return (
            <g key={b.t} opacity={b.forming ? 0.95 : 1}>
              <line x1={x(i)} x2={x(i)} y1={y(b.h)} y2={y(b.l)} stroke={col} strokeWidth={n <= 30 ? 1.5 : 1} />
              <rect x={x(i) - cw / 2} y={top} width={cw} height={Math.max(1.2, bot - top)} fill={b.forming ? "none" : col} stroke={col} strokeWidth={b.forming ? 1.4 : 0.6} strokeDasharray={b.forming ? "3 2" : undefined} />
            </g>
          );
        })}
        {showPatterns && pats.map((p, k) => {
          const i = byTs[p.ts], b = bars[i], buy = p.dir === "BUY";
          const cy = buy ? y(b.l) + 8 : y(b.h) - 8;
          return (
            <g key={k}>
              <path d={buy ? `M${x(i)} ${cy - 4} l-4 7 h8 z` : `M${x(i)} ${cy + 4} l-4 -7 h8 z`} fill={buy ? "#12b886" : "#ff4d4f"} opacity=".95" />
              {n <= 36 && <text x={x(i)} y={buy ? cy + 13 : cy - 8} fontSize="7" fill={buy ? "#12b886" : "#ff4d4f"} textAnchor="middle">{short(p.label, 12)}</text>}
              <title>{`${p.dir} ${p.label}`}</title>
            </g>
          );
        })}
        {hov != null && <line x1={x(hov)} x2={x(hov)} y1={padT} y2={H - padB} stroke="#e5e7eb" strokeWidth=".6" opacity=".6" />}
        {last != null && (
          <g>
            <line x1="0" x2={W - padR} y1={y(last)} y2={y(last)} stroke="#d4af37" strokeWidth=".8" strokeDasharray="2 3" />
            <rect x={W - padR + 1} y={y(last) - 7} width={padR - 2} height="14" rx="3" fill="#d4af37" />
            <text x={W - padR + 4} y={y(last) + 3} fontSize="9" fontWeight="700" fill="#000">{fmtPrice(last, precision)}</text>
          </g>
        )}
        {brain.forming && off === 0 && fl != null && (
          <text x={x(n - 1)} y={H - 1} fontSize="8" fill="#d4af37" textAnchor="end">candle closes in {mmss(fl)}</text>
        )}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[9px] text-gray-500">
        <span><i className="inline-block w-2.5 h-2 bg-bull/30 border border-bull/50 align-middle" /> BUY zone</span>
        <span><i className="inline-block w-2.5 h-2 bg-bear/30 border border-bear/50 align-middle" /> SELL zone</span>
        <span><i className="inline-block w-3 border-t border-dashed border-sky-400 align-middle" /> entry / SL / TP</span>
        <span><i className="inline-block w-3 border-t border-dotted border-amber-400 align-middle" /> news release</span>
        <span><i className="inline-block w-3 border-t border-dashed border-violet-400 align-middle" /> pre-news close</span>
        <span>▲▼ trigger pattern</span>
        {off > 0 && <span className="text-gold">viewing {off} bars back - ▶ to return</span>}
      </div>
      {futureNews.length > 0 && (
        <div className="text-[10px] text-gray-500 mt-1">Next release: {futureNews.map((m) => `${hhmm(m.ts)} ${m.currency} ${m.title}`).join(" · ")}</div>
      )}
      {rx && <ReactionNote r={rx} className="mt-1.5" />}
      {facts.length > 0 && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 mt-2 text-[11px]">
          {facts.map(([k, v, c]) => (
            <div key={k} className="flex gap-1.5 min-w-0"><dt className="text-gray-500 shrink-0">{k}</dt><dd className={cx("tabular-nums truncate", c)} title={v}>{v}</dd></div>
          ))}
        </dl>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ timeline */
const HOURS = [1, 2, 3, 5, 8, 12, 24, 48];

/** Where the next hours are heading: candle close, sessions, the likely window for each setup, news releases and blackouts,
 *  and what the last release did. Zoom from 1 h to 48 h; the list underneath spells out every item in time order. */
export function Timeline({ outlook, brain }) {
  const now = useNow(1000);
  const [hi_, setHi] = useState(4);                       // index into HOURS (8 h)
  const hours = HOURS[hi_];
  const nowS = Math.floor(now / 1000), end = nowS + hours * 3600;
  const pos = (ts) => Math.max(0, Math.min(100, ((ts - nowS) / (end - nowS)) * 100));
  const inRange = (ts) => ts != null && ts >= nowS - 3600 && ts <= end;
  const wins = outlook?.windows || [];
  const sessions = ["asia", "london", "ny"].map((k) => {
    const opens = wins.filter((w) => w.key === k && w.kind === "open").map((w) => w.ts);
    const closes = wins.filter((w) => w.key === k && w.kind === "close").map((w) => w.ts);
    const o = opens[0], c = closes[0];
    if (c != null && (o == null || c < o)) return { k, from: nowS, to: c };       // open right now
    if (o != null && c != null) return { k, from: o, to: c };
    if (o != null) return { k, from: o, to: end };
    return null;
  }).filter((s) => s && s.to > nowS && s.from < end);
  const plans = (outlook?.plans || []).map((p) => ({ p, e: p.eta, side: brain?.sides?.[p.direction] })).filter((q) => q.e);
  const fund = brain?.fundamentals;
  const events = (fund?.events || []).filter((e) => inRange(e.ts));
  const nx = fund?.next, bo = fund?.blackout, rx = fund?.reaction;
  const nextClose = outlook?.plans?.[0]?.when?.next_candle_close;
  const ticks = [];
  const step = hours <= 1 ? 600 : hours <= 3 ? 1800 : hours <= 8 ? 3600 : hours <= 24 ? 4 * 3600 : 8 * 3600;
  for (let t = Math.ceil(nowS / step) * step; t < end; t += step) ticks.push(t);
  const lane = "relative h-[18px] rounded bg-white/[0.03]";
  const label = "absolute -top-[1px] left-1 text-[8px] uppercase tracking-wider text-gray-600 z-10";

  // every item in time order, for the list under the bars
  const items = [];
  if (nextClose) items.push({ ts: nextClose, k: "Candle", text: `${brain?.tf || ""} candle closes`, tone: "text-gold" });
  sessions.forEach((s) => { if (s.from > nowS) items.push({ ts: s.from, k: "Session", text: `${SESSION_LABELS[s.k]} opens` }); if (s.to < end) items.push({ ts: s.to, k: "Session", text: `${SESSION_LABELS[s.k]} closes` }); });
  plans.forEach(({ p, e, side }) => {
    if (e.in_zone) items.push({ ts: nowS, k: p.direction, text: `${p.direction} setup: price is in the zone now${side ? ` (${side.pct}% ready)` : ""}`, tone: p.direction === "BUY" ? "text-bull" : "text-bear" });
    else if (e.p50_ts) items.push({ ts: e.p50_ts, k: p.direction, text: `${p.direction} zone typically reached (25% by ${hhmm(e.p25_ts)}${e.p75_ts ? `, 75% by ${hhmm(e.p75_ts)}` : ""})${side ? ` · ${side.pct}% ready` : ""}`, tone: p.direction === "BUY" ? "text-bull" : "text-bear" });
  });
  events.forEach((e) => items.push({ ts: e.ts, k: "News", text: `${e.currency} ${e.title} (${e.impact})${e.actual ? ` - actual ${e.actual}` : ""}${e.forecast ? ` · forecast ${e.forecast}` : ""}${e.previous ? ` · prev ${e.previous}` : ""}`, tone: e.impact === "high" ? "text-bear" : "text-amber-400" }));
  [bo, nx].filter(Boolean).forEach((b) => { if (b.start > nowS && inRange(b.start)) items.push({ ts: b.start, k: "Pause", text: `Signals pause: ${b.label}`, tone: "text-bear" }); if (inRange(b.end)) items.push({ ts: b.end, k: "Resume", text: `Signals resume after ${b.label}`, tone: "text-gray-300" }); });
  items.sort((a, b) => a.ts - b.ts);
  const upcoming = items.filter((q) => q.ts >= nowS - 60).slice(0, 10);
  const zIn = () => setHi((v) => Math.max(0, v - 1)), zOut = () => setHi((v) => Math.min(HOURS.length - 1, v + 1));
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">Timeline - next {hours}h</span>
        <ZoomBar onIn={zIn} onOut={zOut} onFit={() => setHi(4)} canIn={hi_ > 0} canOut={hi_ < HOURS.length - 1} label={`${hours}h`} />
      </div>
      <div className="relative space-y-1">
        <div className="relative h-4 text-[9px] text-gray-500 tabular-nums">
          {ticks.map((t) => <span key={t} className="absolute -translate-x-1/2" style={{ left: `${pos(t)}%` }}>{hhmm(t)}</span>)}
        </div>
        <div className={lane}><span className={label}>Candles</span>
          {nextClose && inRange(nextClose) && <span className="absolute inset-y-0 w-0.5 bg-gold/80" style={{ left: `${pos(nextClose)}%` }} title={`next close ${fmtTime(nextClose)}`} />}
          {nextClose && inRange(nextClose) && <span className="absolute top-0.5 text-[9px] text-gold tabular-nums" style={{ left: `calc(${pos(nextClose)}% + 4px)` }}>closes {fmtCountdown(nextClose)}</span>}
        </div>
        <div className={lane}><span className={label}>Sessions</span>
          {sessions.map((s) => (
            <span key={s.k} className="absolute inset-y-[3px] rounded text-[8px] px-1 flex items-center overflow-hidden text-white/90 whitespace-nowrap"
              style={{ left: `${pos(s.from)}%`, width: `${Math.max(1, pos(s.to) - pos(s.from))}%`, background: `${SESSION_COLORS[s.k]}88` }}
              title={`${SESSION_LABELS[s.k]} ${hhmm(s.from)}–${hhmm(s.to)}`}>{SESSION_LABELS[s.k]} {pos(s.to) - pos(s.from) > 14 ? `${hhmm(s.from)}–${hhmm(s.to)}` : ""}</span>
          ))}
        </div>
        <div className={cx(lane, "h-[34px]")}><span className={label}>Setups</span>
          {plans.map(({ p, e, side }, idx) => {
            const buy = p.direction === "BUY";
            const col = buy ? "#12b886" : "#ff4d4f";
            const top = idx * 15 + 9;
            if (e.in_zone) return <span key={p.direction} className="absolute text-[9px] font-bold blink-text" style={{ left: "1%", top, color: col }}>{p.direction}: in the zone now</span>;
            if (!inRange(e.p25_ts) && !inRange(e.p50_ts)) return <span key={p.direction} className="absolute text-[8px] text-gray-600" style={{ right: 4, top }}>{p.direction} later →</span>;
            const a = pos(e.p25_ts), b = e.p75_ts ? pos(e.p75_ts) : 100;
            return (
              <React.Fragment key={p.direction}>
                <span className="absolute h-[10px] rounded" style={{ left: `${a}%`, width: `${Math.max(1.5, b - a)}%`, top, background: `${col}55`, border: `1px solid ${col}` }}
                  title={`${p.direction} zone reached: 25% by ${fmtTime(e.p25_ts)}, 50% by ${fmtTime(e.p50_ts)}${e.p75_ts ? `, 75% by ${fmtTime(e.p75_ts)}` : ""}`} />
                {inRange(e.p50_ts) && <span className="absolute w-1.5 h-[14px] rounded-sm -translate-x-1/2" style={{ left: `${pos(e.p50_ts)}%`, top: top - 2, background: col }} />}
                <span className="absolute text-[8px] font-bold" style={{ left: `calc(${a}% + 3px)`, top: top + 1, color: col }}>{p.direction}{side ? ` ${side.pct}%` : ""} ~{hhmm(e.p50_ts)}</span>
              </React.Fragment>
            );
          })}
        </div>
        <div className={cx(lane, "h-[34px]")}><span className={label}>News</span>
          {[bo, nx].filter((b) => b && b.end > b.start && b.end > nowS - 3600 && b.start < end).map((b, k) => (
            <span key={k} className="absolute top-[10px] h-[16px] rounded bg-bear/25 border border-bear/40" style={{ left: `${pos(b.start)}%`, width: `${Math.max(1, pos(b.end) - pos(b.start))}%` }} title={`signals paused ${hhmm(b.start)}–${hhmm(b.end)}: ${b.label}`} />
          ))}
          {events.map((e, i) => (
            <React.Fragment key={i}>
              <span className={cx("absolute top-0.5 -translate-x-1/2 w-2 h-3.5 rounded-sm", e.impact === "high" ? "bg-bear" : "bg-amber-400", e.ts < nowS && "opacity-50")} style={{ left: `${pos(e.ts)}%` }}
                title={`${fmtTime(e.ts)} ${e.currency} ${e.title} (${e.impact})`} />
              <span className="absolute text-[8px] text-gray-300 whitespace-nowrap" style={{ left: `calc(${pos(e.ts)}% + 6px)`, top: 14 + (i % 2) * 9 }}>{e.currency} {short(e.title, 18)} {e.ts < nowS ? "(out)" : hhmm(e.ts)}</span>
            </React.Fragment>
          ))}
        </div>
        <span className="now-line absolute top-4 bottom-0 w-px bg-white/80 pointer-events-none" style={{ left: "0%" }} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[9px] text-gray-600">
        <span>Setup bars = 25-75 % window for price to reach the zone, tick = typical</span>
        <span><i className="inline-block w-1.5 h-2.5 bg-bear rounded-sm align-middle" /> high-impact <i className="inline-block w-1.5 h-2.5 bg-amber-400 rounded-sm align-middle ml-1" /> medium news <i className="inline-block w-3 h-2 bg-bear/25 border border-bear/40 rounded-sm align-middle ml-1" /> signals paused</span>
      </div>
      {rx && <ReactionNote r={rx} className="mt-1.5" />}
      {upcoming.length > 0 && (
        <ul className="mt-2 border-t border-border/60 pt-1.5 space-y-0.5">
          {upcoming.map((q, i) => (
            <li key={i} className="text-[11px] flex gap-1.5 leading-snug">
              <span className="text-gray-500 tabular-nums shrink-0 w-[92px]">{q.ts - nowS < 60 ? "now" : `${hhmm(q.ts)} · in ${fmtCountdown(q.ts)}`}</span>
              <span className="uppercase text-[9px] tracking-wide text-gray-600 shrink-0 w-12 pt-0.5">{q.k}</span>
              <span className={cx("min-w-0", q.tone || "text-gray-300")}>{q.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ toggles + alert prefs */
/** Show / hide sections of the Outlook and Building-now panels (remembered). */
export function ViewToggles({ className = "" }) {
  const { view, toggle, setAll } = useView();
  const allOn = Object.keys(DEFAULT_VIEW).every((k) => view[k]);
  return (
    <div className={cx("flex flex-wrap items-center gap-1", className)}>
      {VIEW_KEYS.map(([k, label, hint]) => (
        <button key={k} type="button" title={hint} aria-pressed={view[k]} onClick={() => toggle(k)}
          className={cx("inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors",
            view[k] ? "border-gold/50 bg-gold/10 text-gold" : "border-border text-gray-500 hover:text-gray-300")}>
          {view[k] ? <Eye size={10} /> : <EyeOff size={10} />}{label}
        </button>
      ))}
      <button type="button" onClick={() => setAll(!allOn)} title={allOn ? "Hide every section" : "Show every section"}
        className="text-[10px] px-2 py-0.5 rounded-full border border-border text-gray-400 hover:text-gray-100">{allOn ? "Hide all" : "Show all"}</button>
    </div>
  );
}

const ALERT_OPTS = [
  ["alertReady", "Ready (with trend)", "Blink + sound when a with-the-trend setup becomes tradeable"],
  ["alertCounter", "Counter-trend", "Same for the counter-trend side (the engine's own backtests found these lose - your call)"],
  ["alertApproval", "Candle approval", "When a trigger candle starts forming at a zone and when it is approved"],
  ["alertShift", "Quick shifts", "Early signs the picture is changing (decisive candle against 4H+1H, 1H flips, momentum flip, spike)"],
  ["sound", "Sound", "Play a different tone for each kind of alert"],
];

export function AlertPrefs() {
  const { prefs, setPref, enableDesktop } = useLive();
  const [open, setOpen] = useState(false);
  const on = ALERT_OPTS.filter(([k]) => k !== "sound" && prefs[k] !== false).length;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Choose which brain alerts blink and make a sound"
        className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-border bg-panel2 text-gray-300 hover:text-gold">
        <BellRing size={11} /> Alerts {on}/4
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-40 w-64 rounded-xl border border-border bg-bg shadow-2xl p-2">
            {ALERT_OPTS.map(([k, label, hint]) => (
              <button key={k} type="button" onClick={() => setPref(k, prefs[k] === false)} className="w-full flex items-start gap-2 text-left px-2 py-1.5 rounded-lg hover:bg-white/5">
                <span className={cx("mt-0.5 w-8 rounded-full p-0.5 shrink-0 transition-colors", prefs[k] !== false ? "bg-bull" : "bg-gray-700")} style={{ height: 18 }}>
                  <span className={cx("block w-3.5 h-3.5 rounded-full bg-white transition-transform", prefs[k] !== false && "translate-x-3.5")} />
                </span>
                <span><span className="block text-xs text-gray-200">{label}</span><span className="block text-[10px] text-gray-500 leading-snug">{hint}</span></span>
              </button>
            ))}
            {"Notification" in window && !prefs.notify && (
              <button type="button" onClick={enableDesktop} className="w-full mt-1 text-[11px] text-gold border border-gold/30 rounded-lg py-1.5 hover:bg-gold/10">Also notify when this tab is in the background</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Early signs the picture is changing, newest severity first. */
export function ShiftStrip({ shifts = [] }) {
  if (!shifts.length) return null;
  const rank = { hot: 0, warn: 1, info: 2 };
  return (
    <div className="space-y-1">
      {[...shifts].sort((a, b) => rank[a.severity] - rank[b.severity]).map((s) => (
        <div key={s.key} className={cx("flex items-start gap-2 text-[11px] leading-snug rounded-lg border px-2.5 py-1.5",
          s.severity === "hot" ? "border-violet-400/50 bg-violet-400/10 text-violet-200 blink-shift" : s.severity === "warn" ? "border-amber-400/30 bg-amber-400/5 text-amber-200" : "border-border text-gray-400")}>
          <span className="font-bold uppercase text-[9px] tracking-wider mt-0.5 shrink-0">{s.severity === "hot" ? "Quick shift" : s.severity === "warn" ? "Watch" : "Note"}</span>
          <span>{s.direction ? <b>{s.direction}: </b> : null}{s.text}</span>
        </div>
      ))}
    </div>
  );
}

