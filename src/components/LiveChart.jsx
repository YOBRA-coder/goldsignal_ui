import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Chart from "./Chart";
import { Spinner } from "./ui";
import { useLive } from "../context/LiveContext";
import { buildMarks } from "../lib/marks";
import { errText } from "../lib/format";
import { symbolInfo, tfSeconds } from "../lib/constants";

// server merges the live 1m tape into every timeframe, so polling fast is cheap (cached server-side)
const pollMs = (tf) => (tf === "1m" ? 6000 : tf === "5m" || tf === "15m" ? 8000 : tf === "30m" || tf === "1h" ? 10000 : 20000);

export function useCandles(symbol, tf, limit = 500, rev = 0) {
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

/** One chart bound to live data + the shared analysis overlay. */
export default function LiveChart({ tf, layers, heightClass, limit = 500 }) {
  const { prefs, live, history, dataRev } = useLive();
  const { candles, hasVolume, loading, error, structure, key: loadedKey } = useCandles(prefs.symbol, tf, limit, dataRev);
  const here = useMemo(() => (live?.open_trades || []).filter((t) => t.symbol === prefs.symbol), [live, prefs.symbol]);
  const marks = useMemo(() => buildMarks(live?.analysis, history, here), [live, history, here]);
  // every running trade of this pair is drawn (entry / stop / target), not just the first one
  const analysis = useMemo(() => {
    if (!live?.analysis) return live?.analysis;
    if (!here.length) return live.analysis;
    return { ...live.analysis, trades: here.map((t) => ({
      ts: t.trigger_ts || Math.floor(new Date(t.created_at).getTime() / 1000), direction: t.direction,
      entry: t.entry_price, sl: t.stop_loss, tp: t.take_profit, current_sl: t.current_sl, be_moved: t.be_moved, live_r: t.live_r })) };
  }, [live, here]);
  const viewKey = `${prefs.symbol}|${tf}|${dataRev}|${prefs.timeMode}`;
  const dataKey = `${loadedKey}|${dataRev}|${prefs.timeMode}`;
  const info = symbolInfo(prefs.symbol);
  return (
    <div className="relative h-full">
      <Chart candles={candles} dataKey={dataKey} analysis={analysis} own={structure} tf={tf} layers={layers} marks={marks} precision={info.precision}
        barSeconds={tfSeconds(tf)} viewKey={viewKey} hasVolume={hasVolume} heightClass={heightClass} />
      {loading && !candles.length && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-gray-500"><Spinner /> Loading {tf} candles…</div>
      )}
      {error && !candles.length && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-amber-400">{error}</div>
      )}
    </div>
  );
}
