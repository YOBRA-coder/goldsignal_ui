import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import { symbolInfo, tfSeconds } from "../lib/constants";
import { cx, fmtAgo, fmtPrice } from "../lib/format";

// ---- small shared cache so ten previews of the same pair cost one request
const CACHE = new Map();
function fetchWindow(symbol, interval, endTs, bars) {
  const live = endTs == null;
  const key = `${symbol}|${interval}|${live ? "live" : Math.floor(endTs / 3600)}|${bars}`;
  const hit = CACHE.get(key);
  const ttl = live ? 20000 : 10 * 60000;
  if (hit && Date.now() - hit.at < ttl) return hit.p;
  const params = { symbol, interval, limit: Math.max(60, Math.min(600, bars)), structure: false };
  if (!live) params.before = endTs;
  const p = api.get("/market/candles", { params }).then((r) => r.data.candles || []);
  CACHE.set(key, { at: Date.now(), p });
  p.catch(() => CACHE.delete(key));
  if (CACHE.size > 80) CACHE.delete(CACHE.keys().next().value);
  return p;
}

/** Candles around a trade: from a little before it fired to a little after it closed (or to now while it is running). */
function useWindow({ symbol, interval, firedTs, closedTs, live, enabled }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let dead = false;
    const step = tfSeconds(interval);
    const run = async () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const start = firedTs ? firedTs - 45 * step : now - 110 * step;
        const end = closedTs ? closedTs + 18 * step : null;
        const span = ((end ?? now) - start) / step;
        const c = await fetchWindow(symbol, interval, end ? end : null, Math.ceil(span) + 6);
        if (dead) return;
        setRows(c.filter((x) => x.time >= start && (end == null || x.time <= end)));
        setErr(null);
      } catch (e) { if (!dead) setErr("No candles stored for this period"); }
    };
    run();
    const t = live ? setInterval(run, 20000) : null;
    return () => { dead = true; if (t) clearInterval(t); };
  }, [symbol, interval, firedTs, closedTs, live, enabled]);
  return { rows, err };
}

function useWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function useVisible(ref) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!ref.current) return undefined;
    if (!("IntersectionObserver" in window)) { setOn(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [ref]);
  return on;
}

const GREEN = "#12b886", RED = "#ff4d4f", BLUE = "#3b82f6", GOLD = "#d4af37", LINE = "#e5e7eb";

/**
 * Price line with the trade drawn on it: target (green), stop (red), entry (blue), the candle it fired on, and
 * where it ended (stopped out / target hit).  Same look as the previews on the signal cards.
 *   status: open | won | lost | breakeven | expired | cancelled | plan  (plan = not fired yet, just the levels)
 */
export default function PreviewLine({ symbol, interval = "15m", direction, entry, sl, tp, firedTs, closedTs, outcomePrice, status = "open",
  zone, height = 150, legend = true, live, className = "", eager = false }) {
  const wrap = useRef(null);
  const w = useWidth(wrap);
  const visible = useVisible(wrap) || eager;
  const isLive = live ?? (status === "open" || status === "plan");
  const { rows, err } = useWindow({ symbol, interval, firedTs, closedTs: isLive ? null : closedTs, live: isLive, enabled: visible });
  const p = symbolInfo(symbol).precision;
  const buy = direction === "BUY";

  const g = useMemo(() => {
    if (!rows || rows.length < 3 || !w) return null;
    const H = height, padL = 4, padR = 52, padT = 10, padB = 8;
    const t0 = rows[0].time, t1 = rows[rows.length - 1].time + tfSeconds(interval);
    const vals = rows.flatMap((r) => [r.high, r.low]);
    const lv = [entry, sl, tp].filter((v) => v != null);
    let lo = Math.min(...vals, ...lv), hi = Math.max(...vals, ...lv);
    const m = (hi - lo) * 0.06 || 1;
    lo -= m; hi += m;
    const X = (t) => padL + ((t - t0) / (t1 - t0)) * (w - padL - padR);
    const Y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const pts = rows.map((r) => [X(r.time + tfSeconds(interval) / 2), Y(r.close)]);
    // price labels on the right: keep them 11px apart so entry / stop / target never print on top of each other
    const labels = [[tp, GREEN], [sl, RED], [entry, BLUE]].filter(([v]) => v != null).map(([v, c]) => ({ v, c, y: Y(v) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 11) labels[i].y = labels[i - 1].y + 11;
    return { H, X, Y, pts, padR, t0, t1, labels };
  }, [rows, w, height, entry, sl, tp, interval]);

  const endLabel = status === "won" ? "target hit" : status === "lost" ? "stopped out" : status === "breakeven" ? "closed at breakeven" : status === "expired" ? "expired" : null;
  const endColor = status === "won" ? GREEN : status === "lost" ? RED : "#94a3b8";

  return (
    <div ref={wrap} className={cx("w-full", className)}>
      <div className="relative rounded-lg bg-black/25 overflow-hidden" style={{ height }}>
        {!g && <div className="absolute inset-0 flex items-center justify-center text-[11px] text-gray-500">{err || (visible ? "Loading preview…" : "")}</div>}
        {g && (
          <svg width={w} height={g.H} className="block">
            <defs>
              <linearGradient id={`pv-${symbol}-${firedTs}-${status}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={LINE} stopOpacity="0.14" /><stop offset="100%" stopColor={LINE} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* reward / risk bands */}
            {entry != null && tp != null && <rect x={g.X(firedTs ?? g.t0)} y={Math.min(g.Y(entry), g.Y(tp))} width={Math.max(0, w - g.padR - g.X(firedTs ?? g.t0))} height={Math.abs(g.Y(tp) - g.Y(entry))} fill={GREEN} opacity="0.09" />}
            {entry != null && sl != null && <rect x={g.X(firedTs ?? g.t0)} y={Math.min(g.Y(entry), g.Y(sl))} width={Math.max(0, w - g.padR - g.X(firedTs ?? g.t0))} height={Math.abs(g.Y(sl) - g.Y(entry))} fill={RED} opacity="0.09" />}
            {zone && <rect x={0} y={Math.min(g.Y(zone.top), g.Y(zone.bottom))} width={w - g.padR} height={Math.max(2, Math.abs(g.Y(zone.top) - g.Y(zone.bottom)))} fill={GOLD} opacity="0.12" />}
            {[[tp, GREEN, "5 4"], [sl, RED, "5 4"], [entry, BLUE, "2 3"]].map(([v, c, d], i) => v != null && (
              <line key={i} x1={0} x2={w - g.padR} y1={g.Y(v)} y2={g.Y(v)} stroke={c} strokeWidth="1" strokeDasharray={d} opacity="0.9" />
            ))}
            {g.labels.map((l, i) => <text key={i} x={w - g.padR + 4} y={l.y + 3} fontSize="9.5" fill={l.c} fontFamily="ui-monospace,monospace">{fmtPrice(l.v, p)}</text>)}
            <path d={`M${g.pts.map((q) => q.join(",")).join(" L")} L${g.pts[g.pts.length - 1][0]},${g.H} L${g.pts[0][0]},${g.H} Z`} fill={`url(#pv-${symbol}-${firedTs}-${status})`} />
            <polyline points={g.pts.map((q) => q.join(",")).join(" ")} fill="none" stroke={LINE} strokeWidth="1.6" strokeLinejoin="round" />
            {firedTs && (
              <g>
                <line x1={g.X(firedTs)} x2={g.X(firedTs)} y1={0} y2={g.H} stroke={buy ? GREEN : RED} strokeWidth="1" opacity="0.7" />
                <path d={buy ? `M${g.X(firedTs) - 4},${g.H - 3} l4,-7 l4,7 z` : `M${g.X(firedTs) - 4},3 l4,7 l4,-7 z`} fill={buy ? GREEN : RED} />
              </g>
            )}
            {endLabel && closedTs && (outcomePrice ?? (status === "won" ? tp : status === "lost" ? sl : entry)) != null && (
              <circle cx={g.X(closedTs)} cy={g.Y(outcomePrice ?? (status === "won" ? tp : status === "lost" ? sl : entry))} r="4.5" fill={endColor} stroke="#0b0e11" strokeWidth="1.5" />
            )}
            {isLive && (
              <g>
                <circle cx={g.pts[g.pts.length - 1][0]} cy={g.pts[g.pts.length - 1][1]} r="6" fill={GOLD} opacity="0.25"><animate attributeName="r" values="3;9;3" dur="2s" repeatCount="indefinite" /></circle>
                <circle cx={g.pts[g.pts.length - 1][0]} cy={g.pts[g.pts.length - 1][1]} r="3" fill={GOLD} />
              </g>
            )}
          </svg>
        )}
      </div>
      {legend && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><i className="w-3 h-0 border-t-2 border-bull inline-block" />target</span>
          <span className="flex items-center gap-1"><i className="w-3 h-0 border-t-2 border-bear inline-block" />stop</span>
          <span className="flex items-center gap-1"><i className="w-3 h-0 border-t-2 border-dotted border-blue-500 inline-block" />entry</span>
          {firedTs && <span style={{ color: buy ? GREEN : RED }}>{buy ? "▲" : "▼"} fired {fmtAgo(firedTs)}</span>}
          {endLabel && closedTs && <span style={{ color: endColor }}>● {endLabel} {fmtAgo(closedTs)}</span>}
          {isLive && <span className="text-gold">● live price</span>}
          {status === "plan" && <span className="text-amber-400">plan only — not fired yet</span>}
        </div>
      )}
    </div>
  );
}
