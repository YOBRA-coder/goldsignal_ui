import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api";
import { SYMBOLS, symbolInfo } from "./constants";
import { errText, fmtPrice } from "./format";

export const CATS = {
  signal: { label: "SIGNAL", tone: "bull", dot: "bg-bull", order: 0, ready: "Ready — signal fired" },
  setup: { label: "SETUP", tone: "amber", dot: "bg-amber-400", order: 1, ready: "Almost — waiting for the trigger" },
  watch: { label: "WATCH", tone: "blue", dot: "bg-blue-500", order: 2, ready: "Not yet — waiting for price to reach a zone" },
  aside: { label: "STAND ASIDE", tone: "gray", dot: "bg-gray-500", order: 3, ready: "No trade here right now" },
  none: { label: "NOT SCANNED", tone: "gray", dot: "bg-gray-700", order: 4, ready: "Not scanned yet" },
};

const dirOf = (s) => (s?.trade_type?.endsWith("BUY") ? "BUY" : s?.trade_type?.endsWith("SELL") ? "SELL" : null);

/** One plain-English line saying what a pair is doing (used by the board, the bell and the log). */
export function describe(row, entryTF = "15m") {
  const s = row.snapshot || {};
  const z = s.zone;
  const tf = entryTF.toUpperCase();
  const d = dirOf(s) || row.direction;
  if (row.category === "signal") return row.headline;
  if (row.category === "setup") {
    if (row.status === "waiting_trigger" && z) return `Price is at the ${String(z.tf || "1h").toUpperCase()} ${z.source || "zone"} — waiting for a ${tf} confirmation candle${d ? ` (${d === "BUY" ? "bullish" : "bearish"})` : ""}.`;
    return row.headline || "Setup is there but not complete (a gate is failing — open the chart / checklist).";
  }
  if (row.category === "watch") {
    if (z && z.top != null) {
      const p = symbolInfo(row.symbol).precision;
      return `Expect a ${d || "trade"} if price pulls back into the ${String(z.tf || "1h").toUpperCase()} ${z.source || "zone"} ${fmtPrice(z.bottom, p)}–${fmtPrice(z.top, p)}${z.distance_atr != null ? ` (${Number(z.distance_atr).toFixed(1)} ATR away)` : ""}, then a ${tf} trigger.`;
    }
    return row.headline;
  }
  return row.headline || "Nothing to do on this pair right now.";
}

export function stageOf(row) {
  const s = row.snapshot || {};
  if (row.category === "signal") return 4;
  return Math.max(0, Math.min(4, s.stage ?? 0));
}

const ALL = SYMBOLS.map((s) => s.value);
const STALE_SEC = 6 * 60;

/** Latest state of every pair + keeps them fresh: pairs never scanned (or older than a few minutes) are evaluated a few at a time
 *  while the page is open; the server keeps scanning in the background afterwards. */
export function useBoard(prefs, { symbols = ALL, auto = true, pollMs = 15000 } = {}) {
  const [data, setData] = useState({ rows: [], now: 0 });
  const [err, setErr] = useState(null);
  const [scanning, setScanning] = useState(null);     // {done, total} while a manual / automatic pass runs
  const busy = useRef(false);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const key = symbols.join(",");

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get("/signals/board", { params: { symbols: key, entry_interval: prefsRef.current.entryTF } });
      setData(d); setErr(null);
      return d;
    } catch (e) { setErr(errText(e)); return null; }
  }, [key]);

  const scan = useCallback(async (list) => {
    if (busy.current || !list.length) return;
    busy.current = true;
    const p = prefsRef.current;
    try {
      for (let i = 0; i < list.length; i += 3) {
        setScanning({ done: i, total: list.length });
        await api.post("/signals/board/scan", { symbols: list.slice(i, i + 3), entry_interval: p.entryTF, min_agreement: p.minAgreement,
          sessions_only: p.sessionsOnly, rr: p.rr, scalp: p.scalp, sens: p.sens }, { timeout: 120000 }).catch(() => {});
        await load();
      }
    } finally { busy.current = false; setScanning(null); }
  }, [load]);

  const scanAll = useCallback(() => scan(symbols), [scan, symbols]);

  useEffect(() => {
    let dead = false;
    load().then((d) => {
      if (dead || !auto || !d) return;
      const need = d.rows.filter((r) => !r.scanned || d.now - r.ts > STALE_SEC).map((r) => r.symbol);
      scan(need.slice(0, 12));
    });
    const t = setInterval(async () => {
      const d = await load();
      if (!d || !auto || busy.current) return;
      const need = d.rows.filter((r) => !r.scanned || d.now - r.ts > STALE_SEC).map((r) => r.symbol);
      if (need.length) scan(need.slice(0, 6));
    }, pollMs);
    return () => { dead = true; clearInterval(t); };
  }, [load, scan, auto, pollMs, prefs.entryTF]);   // eslint-disable-line react-hooks/exhaustive-deps

  return { rows: data.rows, now: data.now, err, scanning, scanAll, reload: load };
}

/** Engine activity (every time a pair changed state), newest first. */
export function useActivity(everyMs = 20000, symbol) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let dead = false;
    const run = () => api.get("/signals/activity", { params: { limit: 80, symbol } }).then((r) => { if (!dead) setRows(r.data); }).catch(() => {});
    run();
    const t = setInterval(run, everyMs);
    return () => { dead = true; clearInterval(t); };
  }, [everyMs, symbol]);
  return rows;
}
