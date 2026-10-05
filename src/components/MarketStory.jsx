import React, { useEffect, useRef, useState } from "react";
import { Compass } from "lucide-react";
import { Card, Chip, Spinner } from "./ui";
import Outlook from "./Outlook";
import { useLive } from "../context/LiveContext";
import { symbolInfo } from "../lib/constants";
import api from "../api";
import { cx, errText, fmtPrice } from "../lib/format";

const TF = { "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1H", "4h": "4H", "1d": "1D", "1w": "1W" };
const tone = (b) => (b === "bullish" ? "bull" : b === "bearish" ? "bear" : "gray");

function useAnalysis() {
  const { prefs } = useLive();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const key = `${prefs.symbol}|${prefs.entryTF}|${prefs.rr}|${prefs.minAgreement}`;
  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
    setData((d) => (d?.__key === key ? d : null));
    setErr("");
    const ctl = new AbortController();
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      setLoading(true);
      try {
        const { data: d } = await api.get("/market/analysis", { params: { symbol: prefs.symbol, entry_interval: prefs.entryTF,
          rr: prefs.rr, min_agreement: prefs.minAgreement }, signal: ctl.signal, timeout: 45000 });
        if (keyRef.current === key) { setData({ ...d, __key: key }); setErr(""); }
      } catch (e) {
        if (!ctl.signal.aborted && e?.code !== "ERR_CANCELED") setErr(errText(e));
      } finally { busy = false; if (!ctl.signal.aborted) setLoading(false); }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { ctl.abort(); clearInterval(t); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, err, loading };
}

function Meter({ score }) {
  const pos = Math.max(0, Math.min(100, (score + 100) / 2));
  return (
    <div className="relative h-2 rounded-full bg-gradient-to-r from-bear/50 via-white/10 to-bull/50 mt-2">
      <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-gold" style={{ left: `calc(${pos}% - 6px)` }} />
    </div>
  );
}

/** Everything happening in this market: consensus, regime, timeframe table, story, levels, flags, plans with times. */
export default function MarketStory() {
  const { prefs } = useLive();
  const { data: d, err, loading } = useAnalysis();
  const p = symbolInfo(prefs.symbol).precision;
  if (!d) {
    return (
      <Card title="Market read" icon={Compass}>
        {err ? <div className="text-sm text-amber-400">{err}</div>
          : <div className="flex items-center gap-2 text-sm text-gray-500 py-3"><Spinner /> Reading the market…</div>}
      </Card>
    );
  }
  const c = d.consensus || {};
  return (
    <div className="space-y-4">
      <Card title="Market read" icon={Compass} right={loading ? <Spinner /> : <Chip tone={tone(c.lean === "BUY" ? "bullish" : c.lean === "SELL" ? "bearish" : "")}>{c.label}</Chip>}>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-black tabular-nums">{fmtPrice(d.price, p)}</div>
            <div className="text-[11px] text-gray-500">{c.votes ? `${c.votes.bull} bullish · ${c.votes.bear} bearish of ${c.votes.of} timeframes` : ""}</div>
          </div>
          <div className="text-right">
            <div className={cx("text-lg font-bold tabular-nums", c.score > 0 ? "text-bull" : c.score < 0 ? "text-bear" : "text-gray-300")}>{c.score > 0 ? "+" : ""}{c.score}</div>
            <div className="text-[10px] text-gray-500 uppercase">consensus</div>
          </div>
        </div>
        <Meter score={c.score || 0} />
        {d.regime && (
          <div className="mt-3 rounded-xl border border-border p-2.5">
            <Chip tone={d.regime.tone || "gray"}>{d.regime.label}</Chip>
            <p className="text-[12px] text-gray-400 mt-1.5 leading-snug">{d.regime.advice}</p>
          </div>
        )}
        <ul className="mt-3 space-y-1.5">
          {(d.story || []).map((s, i) => (
            <li key={i} className={cx("text-[12.5px] leading-snug pl-2.5 border-l-2",
              s.tone === "bull" ? "border-bull" : s.tone === "bear" ? "border-bear" : s.tone === "amber" ? "border-amber-400" : "border-border")}>{s.text}</li>
          ))}
        </ul>
        {(d.flags || []).map((f, i) => <p key={i} className="text-[11px] text-amber-400 mt-2">⚠ {f}</p>)}
      </Card>

      <Card title="Timeframes" pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-[10px] text-gray-500 uppercase"><th className="text-left px-4 py-1">TF</th><th>Bias</th><th>RSI</th><th>ADX</th><th>MACD</th><th>Vol</th><th className="pr-4">Last</th></tr></thead>
            <tbody>
              {(d.timeframes || []).map((t) => (
                <tr key={t.tf} className="border-t border-border/60 text-center">
                  <td className="text-left px-4 py-1.5 font-semibold text-gray-300">{TF[t.tf] || t.tf}</td>
                  <td><Chip tone={tone(t.bias)} className="capitalize">{t.bias}</Chip></td>
                  <td className={t.rsi_zone === "overbought" ? "text-bear" : t.rsi_zone === "oversold" ? "text-bull" : "text-gray-300"}>{t.rsi}</td>
                  <td className="text-gray-300">{t.adx}{t.squeeze ? " ◼" : ""}</td>
                  <td className={t.macd === "bullish" ? "text-bull" : t.macd === "bearish" ? "text-bear" : "text-gray-400"}>{t.macd}</td>
                  <td className="text-gray-400">{t.vol}</td>
                  <td className="pr-4 text-gray-500 whitespace-nowrap">{t.last_event ? `${t.last_event.type} ${t.last_event.dir === "bull" ? "↑" : "↓"} ${t.last_event.bars_ago}b` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Levels around price">
        {["above", "inside", "below"].map((k) => (d.levels?.[k] || []).length > 0 && (
          <div key={k} className="mb-2 last:mb-0">
            <div className="text-[10px] uppercase text-gray-500 mb-0.5">{k === "above" ? "Overhead" : k === "below" ? "Underneath" : "Price is inside"}</div>
            <ul className="space-y-0.5">
              {d.levels[k].map((l, i) => (
                <li key={i} className="flex justify-between text-[12px]">
                  <span className="text-gray-300">{l.label}</span>
                  <span className="tabular-nums text-gray-400">{l.top != null ? `${fmtPrice(l.bottom, p)} – ${fmtPrice(l.top, p)}` : fmtPrice(l.price, p)}
                    {l.dist_atr != null && <span className="text-gray-600"> · {Math.abs(l.dist_atr)} ATR</span>}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>

      <Outlook outlook={{ plans: d.plans, verdict: d.verdict, windows: d.windows, session_open_now: d.session_open_now, next_trade_window: d.next_trade_window, when: d.plans?.[0]?.when }} />
    </div>
  );
}
