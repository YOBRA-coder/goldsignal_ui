import React, { useEffect, useMemo, useRef, useState } from "react";
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
  const genRef = useRef(0);   // bumped on every symbol/tf change so a slow, stale response can never overwrite a newer one
  useEffect(() => {
    let dead = false;
    const myGen = ++genRef.current;
    const key = `${symbol}|${tf}`;
    setS((x) => ({ ...x, loading: x.key !== key, candles: x.key === key ? x.candles : [], structure: x.key === key ? x.structure : null }));
    const run = async () => {
      try {
        const { data } = await api.get("/market/candles", { params: { symbol, interval: tf, limit } });
        if (dead || myGen !== genRef.current) return;   // a newer symbol/tf switch has already happened - drop this response
        setS({ candles: data.candles, data: data.data, hasVolume: data.has_volume, loading: false, error: null, key, structure: data.structure });
      } catch (e) {
        if (dead || myGen !== genRef.current) return;
        setS((x) => ({ ...x, loading: false, error: errText(e) }));
      }
    };
    run();
    const t = setInterval(run, pollMs(tf));
    return () => { dead = true; clearInterval(t); };
  }, [symbol, tf, limit, rev]);
  return s;
}

/** One chart bound to live data + the shared analysis overlay. */
export default function LiveChart({ tf, layers, heightClass, limit = 500 }) {
  const { prefs, live, history, dataRev } = useLive();
  const { candles, hasVolume, loading, error, structure } = useCandles(prefs.symbol, tf, limit, dataRev);
  const marks = useMemo(() => buildMarks(live?.analysis, history), [live, history]);
  const info = symbolInfo(prefs.symbol);
  return (
    <div className="relative h-full">
      <Chart candles={candles} analysis={live?.analysis} own={structure} tf={tf} layers={layers} marks={marks} precision={info.precision}
        barSeconds={tfSeconds(tf)} viewKey={`${prefs.symbol}|${tf}|${dataRev}|${prefs.timeMode}`} hasVolume={hasVolume} heightClass={heightClass} />
      {loading && !candles.length && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-gray-500"><Spinner /> Loading {tf} candles…</div>
      )}
      {error && !candles.length && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-amber-400">{error}</div>
      )}
    </div>
  );
}
