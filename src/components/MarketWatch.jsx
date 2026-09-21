import React, { useEffect, useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import api from "../api";
import { Card, Chip, Spinner } from "./ui";
import MtfTable from "./MtfTable";
import { useLive } from "../context/LiveContext";
import { SYMBOLS, symbolInfo } from "../lib/constants";
import { cx, errText, fmtPrice } from "../lib/format";

export function useOverview(symbol, everyMs = 90000) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let dead = false;
    setD((x) => (x?.symbol === symbol ? x : null));
    setLoading(true);
    const run = async () => {
      try {
        const { data } = await api.get("/market/overview", { params: { symbol } });
        if (!dead) { setD(data); setErr(null); }
      } catch (e) { if (!dead) setErr(errText(e)); }
      finally { if (!dead) setLoading(false); }
    };
    run();
    const t = setInterval(run, everyMs);
    return () => { dead = true; clearInterval(t); };
  }, [symbol, everyMs]);
  return { d, err, loading };
}

const FullWrap = ({ children }) => <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">{children}</div>;

function RangeBar({ low, high, last, p }) {
  const pct = high > low ? ((last - low) / (high - low)) * 100 : 50;
  return (
    <div>
      <div className="relative h-1.5 rounded-full bg-panel2 mt-2">
        <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-gold border-2 border-bg" style={{ left: `calc(${pct}% - 5px)` }} />
      </div>
      <div className="flex justify-between text-[11px] text-gray-500 mt-1 tabular-nums"><span>{fmtPrice(low, p)}</span><span>Day range</span><span>{fmtPrice(high, p)}</span></div>
    </div>
  );
}

export function LevelsList({ levels, price, p }) {
  const rows = [...(levels || [])].sort((a, b) => b.price - a.price);
  const col = { daily: "text-amber-400", weekly: "text-orange-400", session: "text-slate-400", open: "text-slate-500", round: "text-slate-600" };
  return (
    <ul className="text-sm divide-y divide-border/50">
      {rows.map((l, i) => {
        const above = l.price > price;
        const showPrice = rows[i - 1] && rows[i - 1].price > price && !above;
        return (
          <React.Fragment key={l.key}>
            {showPrice && (
              <li className="flex items-center justify-between py-1.5 bg-gold/10 -mx-2 px-2 rounded">
                <span className="text-gold text-xs font-bold">PRICE</span><span className="text-gold font-bold tabular-nums">{fmtPrice(price, p)}</span>
              </li>
            )}
            <li className="flex items-center justify-between py-1.5">
              <span className={cx("font-medium", col[l.kind])}>{l.label}</span>
              <span className="flex items-center gap-3 tabular-nums">
                <span className="text-[11px] text-gray-500">{above ? "+" : ""}{(l.price - price).toFixed(p)}</span>
                <span className="w-24 text-right">{fmtPrice(l.price, p)}</span>
              </span>
            </li>
          </React.Fragment>
        );
      })}
    </ul>
  );
}

export default function MarketWatch({ full = false }) {
  const { prefs, setPref, quote } = useLive();
  const { d, err, loading } = useOverview(prefs.symbol);
  const info = symbolInfo(prefs.symbol);
  const p = info.precision;
  const q = quote?.symbol === prefs.symbol ? { ...(d?.quote || {}), ...quote } : d?.quote;   // live tape wins
  const up = q?.change >= 0;

  const Wrap = full ? FullWrap : React.Fragment;
  return (
    <Wrap>
      <Card title="Market watch" icon={Eye}
        right={loading ? <Spinner className="!w-4 !h-4" /> : <Chip tone="gray">{info.short}</Chip>}>
        {!q?.last ? <div className="text-sm text-amber-400 py-4">{err || "Loading market data…"}</div> : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-3xl font-black tabular-nums">{fmtPrice(q.last, p)}</div>
                <div className={cx("text-sm font-semibold tabular-nums", up ? "text-bull" : "text-bear")}>
                  {up ? "▲" : "▼"} {fmtPrice(Math.abs(q.change), p)} ({up ? "+" : ""}{q.change_pct.toFixed(2)}%)
                </div>
              </div>
              <div className="text-right text-xs text-gray-500 space-y-0.5">
                <div>Prev close <b className="text-gray-300 tabular-nums">{fmtPrice(q.prev_close, p)}</b></div>
                {d && <div>ATR 1H <b className="text-gray-300 tabular-nums">{fmtPrice(d.atr_1h, p)}</b></div>}
                {d?.atr_daily && <div>ATR 1D <b className="text-gray-300 tabular-nums">{fmtPrice(d.atr_daily, p)}</b></div>}
              </div>
            </div>
            <RangeBar low={q.day_low} high={q.day_high} last={q.last} p={p} />
            {(quote?.data || d?.data) && (() => { const dd = quote?.data || d.data; return (
              <div className="flex flex-wrap gap-1.5 mt-3">
                <Chip tone={dd.demo ? "amber" : "bull"}>{dd.demo ? "DEMO data" : `Live · ${dd.source}`}</Chip>
                <Chip tone={dd.market_open ? "bull" : "bear"}>{dd.market_open ? "Market open" : "Market closed"}</Chip>
                {dd.lag_sec != null && <Chip tone={dd.stale ? "amber" : "gray"}>Feed lag {dd.lag_sec < 90 ? `${dd.lag_sec}s` : `${Math.round(dd.lag_sec / 60)}m`}</Chip>}
              </div>); })()}
          </>
        )}
      </Card>

      {d && q?.last && (
        <Card title="Key levels · daily / weekly / sessions" icon={RefreshCw}>
          <LevelsList levels={d.levels} price={q.last} p={p} />
        </Card>
      )}
      {full && <div className="lg:col-span-2"><MtfTable mtf={d?.mtf} alignment={d?.alignment} /></div>}
      {!full && <MtfTable mtf={d?.mtf} alignment={d?.alignment} />}
    </Wrap>
  );
}

export function Watchlist() {
  const { prefs, setPref } = useLive();
  const [q, setQ] = useState([]);
  useEffect(() => {
    let dead = false;
    const run = async () => {
      try {
        const { data } = await api.get("/market/watchlist", { params: { symbols: SYMBOLS.map((s) => s.value).join(",") } });
        if (!dead) setQ(data.quotes);
      } catch { /* ignore */ }
    };
    run();
    const t = setInterval(run, 60000);
    return () => { dead = true; clearInterval(t); };
  }, []);
  return (
    <Card title="Watchlist" icon={Eye}>
      <ul className="divide-y divide-border/60">
        {SYMBOLS.map((s) => {
          const r = q.find((x) => x.symbol === s.value);
          const up = r?.change >= 0;
          return (
            <li key={s.value}>
              <button onClick={() => setPref("symbol", s.value)}
                className={cx("w-full flex items-center justify-between py-2.5 text-left rounded", prefs.symbol === s.value && "text-gold")}>
                <span><span className="text-sm font-semibold">{s.short}</span><span className="block text-[11px] text-gray-500">{s.label}</span></span>
                {r?.ok ? (
                  <span className="text-right tabular-nums">
                    <span className="block text-sm">{fmtPrice(r.last, s.precision)}</span>
                    <span className={cx("text-xs", up ? "text-bull" : "text-bear")}>{up ? "+" : ""}{r.change_pct.toFixed(2)}%</span>
                  </span>
                ) : <span className="text-xs text-gray-600">{r ? "n/a" : "…"}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
