import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Chart from "./Chart";
import { Spinner } from "./ui";
import { useLive } from "../context/LiveContext";
import { buildMarks } from "../lib/marks";
import { errText } from "../lib/format";
import { symbolInfo, tfSeconds } from "../lib/constants";

// server merges the live 1m tape into every timeframe, so polling fast is cheap (cached server-side)
const pollMs = (tf) => (tf === "1m" ? 6000 : tf === "5m" || tf === "15m" ? 8000 : tf === "30m" || tf === "1h" ? 10000 : 20000);

export function useCandles(symbol, tf, limit = 1000, rev = 0) {
  const [s, setS] = useState({ candles: [], data: null, hasVolume: true, loading: true, error: null, key: "", structure: null });
  useEffect(() => {
    const key = `${symbol}|${tf}`;
    const ctl = new AbortController();      // switching pair / timeframe cancels the request still in flight
    let dead = false;
    // Keep the old candles only while we are re-polling the SAME view; a different view starts empty.
    setS((x) => (x.key === key ? { ...x, loading: false, error: null }
      : { candles: [], data: null, hasVolume: true, loading: true, error: null, key: "", structure: null }));
    let busy = false;
    const run = async () => {
      if (busy) return;                     // never stack polls behind a slow response
      busy = true;
      try {
        const { data } = await api.get("/market/candles", { params: { symbol, interval: tf, limit }, signal: ctl.signal });
        if (dead) return;
        setS({ candles: data.candles, data: data.data, hasVolume: data.has_volume, loading: false, error: null, key, structure: data.structure });
      } catch (e) {
        if (dead || e?.code === "ERR_CANCELED" || e?.name === "CanceledError") return;
        setS((x) => ({ ...x, loading: false, error: errText(e) }));
      } finally { busy = false; }
    };
    run();
    const t = setInterval(run, pollMs(tf));
    return () => { dead = true; ctl.abort(); clearInterval(t); };
  }, [symbol, tf, limit, rev]);
  return s;
}

const ENTRY_SET = ["1m", "5m", "15m", "30m"];

/** Older pages of candles (scroll-back). The live poll only carries the newest `limit` bars; everything the user
 *  scrolls back to is fetched page by page from the stored history and kept until the view (pair / timeframe) changes. */
function useOlder(symbol, tf, rev, firstTime) {
  const [st, setSt] = useState({ key: "", bars: [], more: true, busy: false });
  const key = `${symbol}|${tf}|${rev}`;
  const ref = useRef(st);
  ref.current = st;
  useEffect(() => { setSt({ key, bars: [], more: true, busy: false }); }, [key]);
  const load = useCallback(async () => {
    const cur = ref.current;
    if (cur.key !== key || cur.busy || !cur.more || !firstTime) return;
    const oldest = cur.bars.length ? cur.bars[0].time : firstTime;
    setSt((x) => ({ ...x, busy: true }));
    try {
      const { data } = await api.get("/market/candles", { params: { symbol, interval: tf, limit: 1000, before: oldest, structure: false } });
      setSt((x) => (x.key !== key ? x : { ...x, bars: [...data.candles, ...x.bars], more: !!data.has_more && data.candles.length > 0, busy: false }));
    } catch { setSt((x) => ({ ...x, busy: false })); }
  }, [key, symbol, tf, firstTime]);
  return { older: st.key === key ? st.bars : [], more: st.more, loadOlder: load };
}

/** Past signals + near-misses: the engine replayed over the candles on screen (see /signals/replay). */
function useReplay(symbol, tf, prefs, spanDays, enabled) {
  const [r, setR] = useState({ key: "", data: null });
  const days = Math.min(365, Math.max(14, Math.ceil(spanDays / 7) * 7));
  const key = `${symbol}|${tf}|${prefs.sens}|${prefs.scalp}|${prefs.minAgreement}|${prefs.rr}|${prefs.sessionsOnly}|${days}`;
  useEffect(() => {
    if (!enabled) return undefined;
    let dead = false;
    const run = async () => {
      try {
        const { data } = await api.get("/signals/replay", { params: {
          symbol, entry_interval: tf, style: prefs.scalp ? "both" : "swing", sens: prefs.sens || "normal",
          min_agreement: prefs.minAgreement, sessions_only: prefs.sessionsOnly, rr: prefs.rr, days } });
        if (!dead) setR({ key, data });
      } catch { /* the chart works without it */ }
    };
    run();
    const t = setInterval(run, 90000);
    return () => { dead = true; clearInterval(t); };
  }, [key, enabled]);   // eslint-disable-line react-hooks/exhaustive-deps
  return enabled && r.key === key ? r.data : (enabled ? r.data : null);
}

/** Economic-news events for the span on screen (see /news/calendar): lines + blackout bands + "how far it moved". */
function useNews(symbol, tf, spanDays, enabled) {
  const [r, setR] = useState({ key: "", events: [], win: null });
  const days = Math.min(365, Math.max(3, Math.ceil(spanDays) + 1));
  const impact = ["4h", "1d", "1w"].includes(tf) ? "high" : "medium";
  const key = `${symbol}|${days}|${impact}`;
  useEffect(() => {
    if (!enabled) return undefined;
    let dead = false;
    const run = async () => {
      try {
        const { data } = await api.get("/news/calendar", { params: { symbol, days_back: days, days_ahead: 7, impact, reactions: true } });
        if (!dead) setR({ key, events: data.events || [], win: data.settings && data.settings.filter !== "off" ? data.settings : null });
      } catch { /* the chart works without it */ }
    };
    run();
    const t = setInterval(run, 120000);
    return () => { dead = true; clearInterval(t); };
  }, [key, enabled]);   // eslint-disable-line react-hooks/exhaustive-deps
  return r;
}

/** One chart bound to live data + the shared analysis overlay.
 *  `symbol` / `peek` let the pop-up show ANY pair: peek = {analysis, open_trades} from /signals/peek for that pair.
 *  `plan` draws one extra trade (entry / stop / target) - used when opening a past signal. */
export default function LiveChart({ tf, layers, heightClass, limit = 1000, focus, onFocusDone, symbol, peek, plan, historyRows }) {
  const { prefs, live, history, dataRev } = useLive();
  const sym = symbol || prefs.symbol;
  const own_ = sym === prefs.symbol && !peek;
  const src = own_ ? live : peek;
  const { candles: recent, hasVolume, loading, error, structure, key: loadedKey } = useCandles(sym, tf, limit, dataRev);
  const { older, more, loadOlder } = useOlder(sym, tf, dataRev, recent[0]?.time);
  const candles = useMemo(() => {
    if (!older.length) return recent;
    const first = recent[0]?.time ?? Infinity;
    return [...older.filter((c) => c.time < first), ...recent];
  }, [older, recent]);
  const spanDays = candles.length ? (Date.now() / 1000 - candles[0].time) / 86400 : 14;
  const wantReplay = ENTRY_SET.includes(tf) && prefs.showReplay !== false && layers?.history !== false;
  const replay = useReplay(sym, tf, prefs, spanDays, wantReplay);
  const wantNews = layers?.news !== false && !!layers?.news;
  const newsData = useNews(sym, tf, spanDays, wantNews);
  const hist = historyRows || (own_ ? history : []);
  const here = useMemo(() => (src?.open_trades || []).filter((t) => t.symbol === sym), [src, sym]);
  const marks = useMemo(() => buildMarks(src?.analysis, hist, here, wantReplay ? replay : null), [src, hist, here, replay, wantReplay]);
  // every running trade of this pair is drawn (entry / stop / target), not just the first one
  const analysis = useMemo(() => {
    const a0 = src?.analysis;
    if (!a0) return a0;
    const list = here.map((t) => ({
      ts: t.trigger_ts || Math.floor(new Date(t.created_at).getTime() / 1000), direction: t.direction,
      entry: t.entry_price, sl: t.stop_loss, tp: t.take_profit, current_sl: t.current_sl, be_moved: t.be_moved, live_r: t.live_r }));
    if (plan) list.push(plan);
    return list.length ? { ...a0, trades: list } : a0;
  }, [src, here, plan]);
  const viewKey = `${sym}|${tf}|${dataRev}|${prefs.timeMode}`;
  const dataKey = `${loadedKey}|${dataRev}|${prefs.timeMode}`;
  const info = symbolInfo(sym);
  return (
    <div className="relative h-full">
      <Chart candles={candles} dataKey={dataKey} analysis={analysis} own={structure} tf={tf} layers={layers} marks={marks} precision={info.precision}
        barSeconds={tfSeconds(tf)} viewKey={viewKey} hasVolume={hasVolume} heightClass={heightClass}
        onNeedOlder={more ? loadOlder : undefined} chartType={prefs.chartType || "candles"}
        news={wantNews ? newsData.events : null} newsWin={newsData.win} focus={focus} onFocusDone={onFocusDone} />
      {loading && !candles.length && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-gray-500"><Spinner /> Loading {tf} candles…</div>
      )}
      {error && !candles.length && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-amber-400">{error}</div>
      )}
    </div>
  );
}
