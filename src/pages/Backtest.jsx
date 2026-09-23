import React, { useEffect, useState } from "react";
import { FlaskConical, Play } from "lucide-react";
import api from "../api";
import { Card, Chip, Empty, Segmented, Spinner, Stat, Toggle } from "../components/ui";
import { useLive } from "../context/LiveContext";
import { ENTRY_TFS, SYMBOLS, symbolInfo } from "../lib/constants";
import { cx, errText, fmtDateTime, fmtPrice } from "../lib/format";

const BUCKET = { ny: "New York", overlap: "London/NY overlap", london: "London", asia: "Asia", BUY: "Buy trades", SELL: "Sell trades" };

function Equity({ curve }) {
  if (!curve || curve.length < 2) return <Empty>Not enough trades for an equity curve.</Empty>;
  const W = 600, H = 180, pad = 8;
  const min = Math.min(0, ...curve), max = Math.max(0, ...curve);
  const sx = (i) => pad + (i / (curve.length - 1)) * (W - 2 * pad);
  const sy = (v) => H - pad - ((v - min) / (max - min || 1)) * (H - 2 * pad);
  const pts = curve.map((v, i) => `${sx(i)},${sy(v)}`).join(" ");
  const up = curve[curve.length - 1] >= 0;
  const col = up ? "#12b886" : "#ff4d4f";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
      <line x1="0" x2={W} y1={sy(0)} y2={sy(0)} stroke="#2a3140" strokeDasharray="4 4" />
      <polygon points={`${sx(0)},${sy(0)} ${pts} ${sx(curve.length - 1)},${sy(0)}`} fill={col} opacity="0.12" />
      <polyline points={pts} fill="none" stroke={col} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Result({ r }) {
  const s = r.stats || {};
  const p = symbolInfo(r.symbol).precision;
  const closed = r.trades.filter((t) => t.result === "win" || t.result === "loss");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <Stat label="Trades" value={r.total_trades} sub={`${r.wins}W / ${r.losses}L`} />
        <Stat label="Win rate" value={`${r.win_rate}%`} tone={r.win_rate >= 40 ? "bull" : "amber"} sub={`break-even at ${(100 / (1 + (r.params?.rr || 2))).toFixed(0)}%`} />
        <Stat label="Min agreement used" value={`${r.min_agreement_effective ?? r.stats?.params?.min_agreement}%`} sub={r.min_agreement_effective !== r.stats?.params?.min_agreement ? `adjusted from ${r.stats?.params?.min_agreement}% for 1:${r.stats?.params?.risk_reward}` : "as requested"} />
        <Stat label="Net R" value={`${r.net_r > 0 ? "+" : ""}${r.net_r}R`} tone={r.net_r >= 0 ? "bull" : "bear"} />
        <Stat label="Avg R / trade" value={r.avg_r} tone={r.avg_r >= 0 ? "bull" : "bear"} />
        <Stat label="Profit factor" value={s.profit_factor ?? "—"} />
        <Stat label="Max drawdown" value={`${s.max_drawdown_r ?? 0}R`} tone="bear" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title="Equity curve (R)" className="xl:col-span-2"><Equity curve={r.equity_curve} /></Card>
        <Card title="By session / direction">
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] uppercase text-gray-500 text-left"><th className="py-1">Bucket</th><th>Trades</th><th>Win %</th><th className="text-right">Net R</th></tr></thead>
            <tbody>
              {[...Object.entries(s.by_session || {}), ...Object.entries(s.by_direction || {})].map(([k, v]) => (
                <tr key={k} className="border-t border-border/60"><td className="py-1.5">{BUCKET[k] || k}</td><td>{v.trades}</td><td>{v.trades ? Math.round((100 * v.wins) / v.trades) : 0}%</td>
                  <td className={cx("text-right tabular-nums", v.net_r >= 0 ? "text-bull" : "text-bear")}>{v.net_r}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <Card title={`Trades (${closed.length})`} pad={false}>
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-sm hidden md:table">
            <thead className="sticky top-0 bg-panel"><tr className="text-[11px] uppercase text-gray-500 text-left">
              <th className="px-4 py-2">Time</th><th>Side</th><th>Entry</th><th>SL</th><th>TP</th><th>Agree</th><th>Session</th><th>Zone / candle</th><th className="pr-4 text-right">Result</th></tr></thead>
            <tbody>
              {closed.map((t, i) => (
                <tr key={i} className="border-t border-border/60 tabular-nums">
                  <td className="px-4 py-2 text-gray-400">{fmtDateTime(t.entry_ts)}</td>
                  <td className={t.direction === "BUY" ? "text-bull font-semibold" : "text-bear font-semibold"}>{t.direction}</td>
                  <td>{fmtPrice(t.entry, p)}</td><td className="text-bear">{fmtPrice(t.sl, p)}</td><td className="text-bull">{fmtPrice(t.tp, p)}</td>
                  <td>{Math.round(t.agreement)}%</td><td className="text-gray-400">{BUCKET[t.session] || t.session}</td>
                  <td className="text-gray-500 text-xs">{t.zone} · {(t.pattern || "").replace("_", " ")}</td>
                  <td className={cx("pr-4 text-right font-semibold", t.result === "win" ? "text-bull" : "text-bear")}>{t.result === "win" ? `+${t.r}R` : `${t.r}R`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="md:hidden divide-y divide-border/60">
            {closed.map((t, i) => (
              <li key={i} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div>
                  <div><span className={t.direction === "BUY" ? "text-bull font-bold" : "text-bear font-bold"}>{t.direction}</span> <span className="text-gray-400 text-xs">@ {fmtPrice(t.entry, p)}</span></div>
                  <div className="text-[11px] text-gray-500">{fmtDateTime(t.entry_ts)} · {Math.round(t.agreement)}% · {BUCKET[t.session] || t.session}</div>
                </div>
                <Chip tone={t.result === "win" ? "bull" : "bear"}>{t.result === "win" ? `+${t.r}R` : `${t.r}R`}</Chip>
              </li>
            ))}
          </ul>
          {!closed.length && <Empty>No closed trades with these settings.</Empty>}
        </div>
      </Card>
      <p className="text-xs text-gray-500">
        Walk-forward on {r.stats?.bars ?? "?"} candles ({fmtDateTime(r.stats?.from_ts)} → {fmtDateTime(r.stats?.to_ts)}). Higher-timeframe context ({r.stats?.htf_source || "1H/4H"}) is used only after each bar closes, entries are at the trigger candle's close,
        and a candle touching both SL and TP counts as a loss. Spread, slippage and commission are <b>not</b> modelled; key daily/weekly levels are not used in the backtest.
        Past results do not guarantee future performance.
      </p>
    </div>
  );
}

export default function Backtest() {
  const { prefs } = useLive();
  const [f, setF] = useState({ symbol: prefs.symbol, entry_interval: prefs.entryTF, risk_reward: prefs.rr, min_agreement: prefs.minAgreement, sessions_only: prefs.sessionsOnly });
  const [res, setRes] = useState(null);
  const [runs, setRuns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const withParams = (r) => ({ ...r, params: { rr: r.stats?.params?.risk_reward } });
  useEffect(() => {
    api.get("/backtest/history").then(({ data }) => { setRuns(data); if (data[0]) setRes(withParams(data[0])); }).catch(() => {});
  }, []);

  async function run() {
    setBusy(true); setErr(null);
    try {
      const { data } = await api.post("/backtest/run", { ...f, period: "59d" });
      setRes(withParams(data));
      setRuns((x) => [data, ...x]);
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Card title="Backtest the strategy" icon={FlaskConical}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 items-end">
          <label className="block text-xs text-gray-500">Symbol
            <select value={f.symbol} onChange={(e) => setF({ ...f, symbol: e.target.value })} className="mt-1 w-full h-10 bg-panel2 border border-border rounded-lg px-2 text-sm text-gray-100">
              {SYMBOLS.map((s) => <option key={s.value} value={s.value}>{s.short} · {s.label}</option>)}
            </select>
          </label>
          <div className="text-xs text-gray-500">Entry timeframe
            <Segmented className="mt-1" options={ENTRY_TFS} value={f.entry_interval} onChange={(v) => setF({ ...f, entry_interval: v })} />
          </div>
          <label className="block text-xs text-gray-500">Risk : reward — 1 : {f.risk_reward}
            <input type="range" min="1" max="5" step="0.5" value={f.risk_reward} onChange={(e) => setF({ ...f, risk_reward: +e.target.value })} className="mt-3 w-full" />
          </label>
          <label className="block text-xs text-gray-500">Min agreement — {f.min_agreement}%
            <input type="range" min="40" max="95" step="5" value={f.min_agreement} onChange={(e) => setF({ ...f, min_agreement: +e.target.value })} className="mt-3 w-full" />
          </label>
          <button onClick={run} disabled={busy} className="h-10 rounded-xl bg-gold text-black font-bold flex items-center justify-center gap-2 disabled:opacity-60">
            {busy ? <Spinner className="!border-black/30 !border-t-black" /> : <Play size={16} />} {busy ? "Running…" : "Run backtest"}
          </button>
        </div>
        <div className="max-w-sm mt-1"><Toggle on={f.sessions_only} onChange={(v) => setF({ ...f, sessions_only: v })} label="London / New York only" /></div>
        <p className="text-xs text-gray-500">Uses the last ~59 days of {f.entry_interval} candles (the most Yahoo provides for intraday data). Takes a few seconds.</p>
        {err && <div className="text-sm text-bear mt-2 break-words">{err}</div>}
      </Card>

      {runs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {runs.slice(0, 8).map((r) => (
            <button key={r.id} onClick={() => setRes(withParams(r))}
              className={cx("shrink-0 text-xs px-3 py-1.5 rounded-lg border", res?.id === r.id ? "border-gold/60 text-gold bg-gold/10" : "border-border text-gray-400")}>
              {r.symbol} {r.entry_interval} · {r.total_trades}t · {r.net_r > 0 ? "+" : ""}{r.net_r}R
            </button>
          ))}
        </div>
      )}
      {res ? <Result r={res} /> : !busy && <Card><Empty>Run a backtest to see win rate, drawdown and every simulated trade.</Empty></Card>}
    </div>
  );
}
