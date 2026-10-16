import React, { useEffect, useState } from "react";
import { FlaskConical, GitCompare, Play } from "lucide-react";
import EngineCard from "../components/EngineCard";
import api from "../api";
import { Card, Chip, Empty, Segmented, Spinner, Stat, SymbolSelect, Toggle } from "../components/ui";
import { useLive } from "../context/LiveContext";
import { ENTRY_TFS, symbolInfo } from "../lib/constants";
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

function Why({ d }) {
  if (!d || !d.losers && d.losers !== 0) return null;
  const rows = [["AMD", d.by_amd], ["Agreement", d.by_agreement], ["Pattern", d.by_pattern], ["Zone", d.by_zone], ["Grade", d.by_grade]];
  return (
    <Card title="Why trades lose — and where">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Average win" value={`+${d.avg_win_r}R`} tone="bull" />
        <Stat label="Average loss" value={`${d.avg_loss_r}R`} tone="bear" sub="stop + spread" />
        <Stat label="Win rate needed" value={d.breakeven_win_rate != null ? `${d.breakeven_win_rate}%` : "—"} sub="to break even at these averages" />
        <Stat label="Losers once in profit" value={`${d.losers_reached_half_r}/${d.losers}`} sub={`reached +0.5R first · ${d.losers_reached_1r} reached +1R`} tone={d.losers && d.losers_reached_half_r / d.losers > 0.4 ? "amber" : undefined} />
      </div>
      {(d.hints || []).map((h, i) => <p key={i} className="text-xs text-amber-300 mt-2">• {h}</p>)}
      {(d.weak_spots || []).length > 0 && (
        <div className="mt-3 text-xs">
          <div className="text-[11px] uppercase text-gray-500 mb-1">Buckets that lose money (8+ trades)</div>
          {d.weak_spots.map((w, i) => <div key={i} className="text-gray-300">{w.group} <b>{String(w.key).replace(/_/g, " ")}</b>: {w.trades} trades, {w.win_rate}% won, <span className="text-bear">{w.net_r}R</span></div>)}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 mt-3">
        {rows.map(([name, b]) => b && Object.keys(b).length > 0 && (
          <table key={name} className="w-full text-xs mb-2">
            <thead><tr className="text-[10px] uppercase text-gray-500 text-left"><th className="py-1">{name}</th><th>Trades</th><th>Win %</th><th className="text-right">Net R</th></tr></thead>
            <tbody>{Object.entries(b).map(([k, v]) => (
              <tr key={k} className="border-t border-border/60"><td className="py-1">{String(k).replace(/_/g, " ")}</td><td>{v.trades}</td><td>{v.win_rate}%</td>
                <td className={cx("text-right tabular-nums", v.net_r >= 0 ? "text-bull" : "text-bear")}>{v.net_r}</td></tr>))}</tbody>
          </table>
        ))}
      </div>
    </Card>
  );
}

function Compare({ c, onUse }) {
  const best = c.recommended;
  return (
    <Card title={`Which setting loses least? · ${c.symbol} ${c.entry_interval} ${c.style} · ${c.days} days`} icon={GitCompare}>
      <p className={cx("text-sm mb-3", best ? "text-gold" : "text-amber-300")}>{c.verdict}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead><tr className="text-[11px] uppercase text-gray-500 text-left">
            <th className="py-1">Setting</th><th>Trades</th><th>Win %</th><th>Avg win / loss</th><th>Net R</th><th>Profit factor</th><th>Max DD</th><th title="the last 30% of the period, judged separately">Last 30% net R</th><th /></tr></thead>
          <tbody>
            {c.rows.map((r) => (
              <tr key={r.key} className={cx("border-t border-border/60 tabular-nums", r.key === best && "bg-gold/5")}>
                <td className="py-2 pr-2">{r.label}{r.key === best && <Chip tone="gold" className="ml-2">best</Chip>}</td>
                <td>{r.trades}</td><td>{r.win_rate}%</td>
                <td className="text-gray-400">{r.avg_win_r != null ? `+${r.avg_win_r}` : "—"} / {r.avg_loss_r ?? "—"}</td>
                <td className={r.net_r >= 0 ? "text-bull" : "text-bear"}>{r.net_r > 0 ? "+" : ""}{r.net_r}R</td>
                <td>{r.profit_factor ?? "—"}</td><td className="text-bear">{r.max_drawdown_r}R</td>
                <td className={r.oos_net_r >= 0 ? "text-bull" : "text-bear"}>{r.oos_trades ? `${r.oos_net_r > 0 ? "+" : ""}${r.oos_net_r}R (${r.oos_trades})` : "—"}</td>
                <td className="text-right"><button onClick={() => onUse(r)} className="text-xs px-2.5 py-1 rounded-lg border border-border hover:border-gold/50 text-gray-300">Use live</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500 mt-2">Same candles, spread and news windows in every row - only the engine strictness changes. A setting that wins overall but loses in the last 30% is probably luck. Fewer than ~30 trades is not enough to trust either way.</p>
    </Card>
  );
}

function Result({ r }) {
  const s = r.stats || {};
  const p = symbolInfo(r.symbol).precision;
  const closed = r.trades.filter((t) => t.result === "win" || t.result === "loss" || t.result === "breakeven");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <Stat label="Trades" value={r.total_trades} sub={`${r.wins}W / ${r.losses}L${s.breakevens ? ` / ${s.breakevens} BE` : ""}`} />
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
      <Why d={s.diagnostics} />
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
        Walk-forward on {r.stats?.bars ?? "?"} candles ({fmtDateTime(r.stats?.from_ts)} → {fmtDateTime(r.stats?.to_ts)}, {s.days ?? "?"} days, {s.trades_per_day ?? "?"} trades/day). Higher-timeframe context ({r.stats?.htf_source || "1H/4H"}) is used only after each bar closes.
        Same engine, daily/weekly levels and trade rules as the live scanner. Fills: {s.fill === "close" ? "at the signal candle's close, no costs" : `next candle's open, spread ${s.spread ?? 0} per trade (${s.total_cost_r ?? 0}R total cost)`}.
        A candle touching both SL and TP counts as a loss. {s.skipped ? `Skipped: ${s.skipped.missed_fill} missed fills, ${s.skipped.overlap} overlapping setups, ${s.skipped.cooldown ?? 0} re-entries right after a stop-out.` : ""} News blackout: {s.news_level || "off"} ({s.news_windows ?? 0} windows; the calendar only knows releases the app has seen or can schedule - NFP, FOMC, claims - so older CPI days are not blocked).
         Commission is not modelled.
        Past results do not guarantee future performance.
      </p>
    </div>
  );
}

export default function Backtest() {
  const { prefs, setPref } = useLive();
  const [f, setF] = useState({ symbol: prefs.symbol, entry_interval: prefs.entryTF, risk_reward: prefs.rr, min_agreement: prefs.minAgreement, sessions_only: prefs.sessionsOnly, style: prefs.scalp ? "scalp" : "swing", sens: prefs.sens || "normal", realistic_fill: true, period: "59d", news: "app" });
  const [res, setRes] = useState(null);
  const [runs, setRuns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [cmp, setCmp] = useState(null);
  const [cbusy, setCbusy] = useState(false);
  const [applied, setApplied] = useState(0);

  const withParams = (r) => ({ ...r, params: { rr: r.stats?.params?.risk_reward } });
  useEffect(() => {
    api.get("/backtest/history").then(({ data }) => { setRuns(data); if (data[0]) setRes(withParams(data[0])); }).catch(() => {});
  }, []);

  async function run() {
    setBusy(true); setErr(null);
    try {
      const { data } = await api.post("/backtest/run", { ...f, news: f.news === "app" ? null : f.news });
      setRes(withParams(data));
      setRuns((x) => [data, ...x]);
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }

  async function compare() {
    setCbusy(true); setErr(null); setCmp(null);
    try { const { data } = await api.post("/backtest/compare", { ...f, news: f.news === "app" ? null : f.news }); setCmp(data); }
    catch (e) { setErr(errText(e)); } finally { setCbusy(false); }
  }
  async function useRow(r) {
    await api.put("/engine/settings", { amd: r.engine.amd_mode, quality: r.engine.quality, daily_stop: r.engine.daily_stop });
    if (r.engine.rr) setPref("rr", r.engine.rr);
    if (r.engine.rr) setF((x) => ({ ...x, risk_reward: r.engine.rr, breakeven_at_r: r.engine.be ?? x.breakeven_at_r }));
    setApplied((n) => n + 1);
  }

  return (
    <div className="space-y-4">
      <Card title="Backtest the strategy" icon={FlaskConical}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 items-end">
          <label className="block text-xs text-gray-500">Symbol
            <SymbolSelect value={f.symbol} onChange={(v) => setF({ ...f, symbol: v })} className="mt-1 w-full h-10 bg-panel2 border border-border rounded-lg px-2 text-sm text-gray-100" />
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
          <button onClick={compare} disabled={cbusy || busy} title="Same data, six engine settings side by side"
            className="h-10 rounded-xl border border-gold/50 text-gold font-semibold flex items-center justify-center gap-2 disabled:opacity-60 xl:col-start-5">
            {cbusy ? <Spinner /> : <GitCompare size={16} />} {cbusy ? "Comparing… (6 runs)" : "Compare settings"}
          </button>
        </div>
        <div className="max-w-sm mt-1"><Toggle on={f.style === "scalp"} onChange={(v) => setF({ ...f, style: v ? "scalp" : "swing" })} label="Scalp mode (1H-led, short-term)" hint="Off = swing: 4H and 1H must agree" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <div className="text-xs text-gray-500">Entry sensitivity
            <Segmented className="mt-1" options={[{ value: "strict", label: "Strict" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }]} value={f.sens} onChange={(v) => setF({ ...f, sens: v })} />
          </div>
          <div className="text-xs text-gray-500">History to test
            <Segmented className="mt-1" options={[{ value: "30d", label: "30d" }, { value: "59d", label: "59d" }, { value: "120d", label: "120d" }, { value: "250d", label: "250d" }]} value={f.period} onChange={(v) => setF({ ...f, period: v })} />
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-3">News blackout (CPI / NFP / FOMC …)
          <Segmented className="mt-1" options={[{ value: "app", label: "App setting" }, { value: "off", label: "Off" }, { value: "high", label: "High" }, { value: "all", label: "High+med" }]} value={f.news} onChange={(v) => setF({ ...f, news: v })} />
        </div>
        <div className="max-w-sm mt-2"><Toggle on={f.realistic_fill} onChange={(v) => setF({ ...f, realistic_fill: v })} label="Realistic fills + spread" hint="Enter on the NEXT candle's open and pay the spread (about 1 basis point of price). Off = enter at the signal candle's close, no costs." /></div>
        <div className="max-w-sm mt-1"><Toggle on={f.sessions_only} onChange={(v) => setF({ ...f, sessions_only: v })} label="London / New York only" /></div>
        <p className="text-xs text-gray-500">Yahoo only serves ~59 days of {f.entry_interval} candles at a time; anything longer comes from the candles this app has stored while running (it keeps growing). If the stored history is shorter than you asked for, the test uses what exists.</p>
        {err && <div className="text-sm text-bear mt-2 break-words">{err}</div>}
      </Card>

      {cmp && <Compare c={cmp} onUse={useRow} />}
      <div className="max-w-xl"><EngineCard reloadKey={applied} /></div>

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
