import React, { useEffect, useRef, useState } from "react";
import { DatabaseZap } from "lucide-react";
import api from "../api";
import { Card, Segmented, SymbolSelect } from "./ui";
import { useLive } from "../context/LiveContext";
import { errText } from "../lib/format";

const TFS = ["1m", "5m", "15m", "30m", "1h"];
const day = (ts) => new Date(ts * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

/** Load years of candles from an MT5 export into the app's store (Yahoo only serves ~60 days of 5m/15m/30m). */
export default function HistoryCard() {
  const { prefs, refresh } = useLive();
  const [symbol, setSymbol] = useState(prefs.symbol);
  const [tf, setTf] = useState("15m");
  const [tz, setTz] = useState(3);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [stored, setStored] = useState([]);
  const fileRef = useRef(null);
  const load = () => api.get("/market/store", { params: { symbol } }).then(({ data }) => setStored(data.series || [])).catch(() => setStored([]));
  useEffect(() => { load(); }, [symbol]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setMsg(null);
    try {
      const buf = await f.arrayBuffer();
      const u8 = new Uint8Array(buf);
      const text = (u8[0] === 0xff && u8[1] === 0xfe) ? new TextDecoder("utf-16le").decode(buf) : new TextDecoder("utf-8").decode(buf);
      const { data } = await api.post("/market/import", text, { params: { symbol, interval: tf, tz_offset: tz },
        headers: { "Content-Type": "text/plain" }, maxBodyLength: Infinity, maxContentLength: Infinity, timeout: 180000 });
      setMsg({ ok: true, text: `Imported ${data.rows_stored.toLocaleString()} candles (${day(data.file_from)} → ${day(data.file_to)}). ${symbol} ${tf} now holds ${data.store_rows.toLocaleString()} candles back to ${day(data.store_from)}.` });
      load(); refresh?.();
    } catch (err) { setMsg({ ok: false, text: errText(err) }); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <Card title="Candle history" icon={DatabaseZap}>
      <div className="space-y-3 text-xs text-gray-400">
        <p className="leading-snug">Yahoo only serves about 60 days of 5m / 15m / 30m candles. Import a CSV exported from MetaTrader 5 to load months or years; the chart range buttons, past-signal replay and backtests then use it. Imported candles are kept and never overwritten by the live feed.</p>
        <div className="grid grid-cols-2 gap-2 items-end">
          <label className="col-span-2">Pair
            <SymbolSelect value={symbol} onChange={setSymbol} className="mt-1 w-full bg-panel2 border border-border rounded-lg px-2 py-2 text-sm text-gray-200" />
          </label>
          <div className="col-span-2"><div className="mb-1">Timeframe of the file</div><Segmented size="sm" value={tf} onChange={setTf} options={TFS} /></div>
          <label>Broker time (hours from UTC)
            <input type="number" step="0.5" min="-14" max="14" value={tz} onChange={(e) => setTz(+e.target.value)} className="mt-1 w-full bg-panel2 border border-border rounded-lg px-2 py-2 text-sm text-gray-200" />
          </label>
          <label className={"text-center text-sm font-medium rounded-lg border px-3 py-2 cursor-pointer " + (busy ? "border-border text-gray-500" : "border-gold/50 text-gold hover:bg-gold/10")}>
            {busy ? "Importing…" : "Choose CSV file"}
            <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" disabled={busy} onChange={onFile} className="hidden" />
          </label>
        </div>
        {msg && <div className={msg.ok ? "text-bull" : "text-bear break-words"}>{msg.text}</div>}
        {stored.length > 0 && (
          <div>
            <div className="text-[11px] uppercase text-gray-500 mb-1">Stored for {symbol}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 tabular-nums">
              {stored.map((s) => <div key={s.interval} className="flex justify-between"><span className="text-gray-300">{s.interval}</span><span>{s.days} days · {s.rows.toLocaleString()}</span></div>)}
            </div>
          </div>
        )}
        <details className="leading-snug">
          <summary className="cursor-pointer text-gray-300">How to export from MT5</summary>
          <ol className="list-decimal ml-4 mt-1 space-y-0.5">
            <li>MT5 → Tools → History Center (F2), pick the symbol and timeframe (M5, M15…). Let it download (scroll back / press Download).</li>
            <li>Select that timeframe → Export → save the .csv. Use the matching timeframe and the broker's time zone here (the chart header shows "MT5 server GMT+3").</li>
            <li>Import it above. Do the same for each pair / timeframe you want deep history on. Export a few months at a time if the file is very large (80 MB limit).</li>
          </ol>
          <p className="mt-1">The pair must be the same instrument as Yahoo's (EUR/USD → EURUSD=X). For gold, MT5 spot XAUUSD sits a little below Yahoo's futures price, so keep gold on one source per timeframe.</p>
        </details>
      </div>
    </Card>
  );
}
