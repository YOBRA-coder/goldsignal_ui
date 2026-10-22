import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, X } from "lucide-react";
import api from "../api";
import LiveChart from "./LiveChart";
import { ChartTypeSwitch, LayerChips, presetFor } from "./ChartPanel";
import ChartSidePanel from "./ChartSidePanel";
import { Chip, Segmented } from "./ui";
import { useLive } from "../context/LiveContext";
import { SYMBOLS, TIMEFRAMES, symbolInfo } from "../lib/constants";
import { cx, fmtAgo, fmtDateTime, fmtPrice } from "../lib/format";

const RANGES = [{ value: 1, label: "1D" }, { value: 3, label: "3D" }, { value: 7, label: "1W" }, { value: 30, label: "1M" }];
const CAT = { signal: ["SIGNAL", "bull"], setup: ["SETUP", "amber"], watch: ["WATCH", "blue"], aside: ["STAND ASIDE", "gray"] };

/** Analysis of another pair (read-only, nothing is saved). The pair on the dashboard uses the live data instead. */
function usePeek(symbol, tf, enabled) {
  const { prefs } = useLive();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    if (!enabled) { setD(null); return undefined; }
    let dead = false;
    setD(null); setErr(null);
    const entry = ["1m", "5m", "15m", "30m"].includes(tf) ? tf : prefs.entryTF;
    const run = async () => {
      try {
        const { data } = await api.get("/signals/peek", { params: { symbol, entry_interval: entry, min_agreement: prefs.minAgreement,
          sessions_only: prefs.sessionsOnly, rr: prefs.rr, sens: prefs.sens } });
        if (!dead) setD(data);
      } catch (e) { if (!dead) setErr("Could not load the analysis for this pair"); }
    };
    run();
    const t = setInterval(run, 20000);
    return () => { dead = true; clearInterval(t); };
  }, [symbol, enabled, prefs.entryTF, prefs.minAgreement, prefs.sessionsOnly, prefs.rr, prefs.sens, tf === "5m" || tf === "1m" || tf === "30m" ? tf : "15m"]);   // eslint-disable-line react-hooks/exhaustive-deps
  return { d, err };
}

function useSymbolHistory(symbol, enabled) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!enabled) return;
    api.get("/signals/history", { params: { symbol } }).then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [symbol, enabled]);
  return rows;
}

/** Pop-up with the FULL chart (all timeframes, all overlays) for a pair, opened from any signal, alert, board row or log line.
 *  item = { symbol, tf?, plan?, firedTs?, title?, note?, status?, category? } */
export default function ChartModal({ item, onClose }) {
  const { prefs, setPref } = useLive();
  const nav = useNavigate();
  const [symbol, setSymbol] = useState(item.symbol);
  const same = symbol === item.symbol;
  const other = symbol !== prefs.symbol;
  const [tf, setTfRaw] = useState(item.tf || prefs.entryTF || "15m");
  const [layers, setLayers] = useState(() => presetFor(item.tf || prefs.entryTF || "15m"));
  const [focus, setFocus] = useState(() => item.firedTs ? { days: Math.max(1, Math.ceil((Date.now() / 1000 - item.firedTs) / 86400) + 0), nonce: 1 } : null);
  const [note, setNote] = useState("");
  const { d: peekData, err } = usePeek(symbol, tf, other);
  const hist = useSymbolHistory(symbol, other);
  const info = symbolInfo(symbol);
  const p = info.precision;
  const [catLabel, catTone] = CAT[item.category] || [];

  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);

  const setTf = (t) => { setTfRaw(t); setLayers(presetFor(t)); setFocus(null); setNote(""); };
  const plan = useMemo(() => (same && item.plan ? { ...item.plan, multi: true } : null), [same, item.plan]);
  const goDashboard = () => { setPref("symbol", symbol); onClose(); nav("/"); };

  return (
    <div className="fixed inset-0 z-[80] bg-bg flex flex-col pt-[env(safe-area-inset-top)]" role="dialog" aria-label={`${info.short} chart`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <select value={symbol} onChange={(e) => { setSymbol(e.target.value); setFocus(null); }}
            className="bg-panel border border-border rounded-lg px-2 h-9 text-sm font-bold outline-none focus:border-gold">
            {SYMBOLS.map((s) => <option key={s.value} value={s.value}>{s.short}</option>)}
          </select>
          {same && catLabel && <Chip tone={catTone}>{catLabel}</Chip>}
          {same && item.title && <span className="text-xs text-gray-400 truncate hidden sm:inline">{item.title}</span>}
        </div>
        <Segmented size="sm" value={tf} onChange={setTf} options={TIMEFRAMES} />
        <Segmented size="sm" value={focus?.days} onChange={(d) => { setNote(""); setFocus({ days: d, nonce: Date.now() }); }} options={RANGES} />
        {note && <span className="text-[11px] text-amber-400">{note}</span>}
        <div className="hidden lg:block"><LayerChips layers={layers} setLayers={setLayers} tf={tf} /></div>
        <div className="ml-auto flex items-center gap-2">
          <ChartTypeSwitch />
          <button onClick={goDashboard} title="Make this the pair on the dashboard" className="hidden sm:flex h-9 px-3 rounded-lg border border-border bg-panel items-center gap-1.5 text-xs text-gray-300 hover:text-gold"><ExternalLink size={14} /> Open on dashboard</button>
          <button onClick={onClose} aria-label="Close chart" className="w-9 h-9 rounded-lg border border-border bg-panel flex items-center justify-center text-gray-300 hover:text-bear"><X size={18} /></button>
        </div>
        <div className="lg:hidden w-full"><LayerChips layers={layers} setLayers={setLayers} tf={tf} /></div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="flex-1 min-h-[300px] relative">
          <LiveChart tf={tf} layers={layers} heightClass="h-full" limit={800} symbol={symbol} peek={other ? peekData : undefined} plan={plan}
            historyRows={other ? hist : undefined} focus={focus} onFocusDone={({ covered, first }) => setNote(covered ? "" : `Stored history starts ${new Date(first * 1000).toLocaleDateString()}`)} />
          {other && !peekData && !err && <div className="absolute top-2 right-3 text-[11px] text-gray-500">Loading analysis…</div>}
          {err && <div className="absolute top-2 right-3 text-[11px] text-amber-400">{err}</div>}
        </div>
        <aside className="lg:w-[380px] xl:w-[420px] shrink-0 h-[44vh] lg:h-auto flex flex-col min-h-0 border-t lg:border-t-0 lg:border-l border-border text-sm">
          {((same && (item.note || item.plan))) && (
            <div className="shrink-0 max-h-[40%] overflow-y-auto p-3 space-y-2 border-b border-border">
              {item.note && <p className="text-xs text-gray-300 leading-snug">{item.note}</p>}
              {item.plan && (
                <div className="rounded-xl border border-border p-2.5">
                  <div className="text-[10px] uppercase text-gray-500 mb-1">This trade</div>
                  <div className="grid grid-cols-3 text-center tabular-nums">
                    <div><div className="text-[10px] text-gray-500">Entry</div><div className="text-gold font-bold">{fmtPrice(item.plan.entry, p)}</div></div>
                    <div><div className="text-[10px] text-gray-500">Stop</div><div className="text-bear font-bold">{fmtPrice(item.plan.sl, p)}</div></div>
                    <div><div className="text-[10px] text-gray-500">Target</div><div className="text-bull font-bold">{fmtPrice(item.plan.tp, p)}</div></div>
                  </div>
                  {item.firedTs && <div className="text-[11px] text-gray-500 mt-1.5">Fired {fmtDateTime(item.firedTs)} · {fmtAgo(item.firedTs)}</div>}
                </div>
              )}
            </div>
          )}
          <ChartSidePanel symbol={symbol} tf={tf} className="flex-1" />
        </aside>
      </div>
    </div>
  );
}
