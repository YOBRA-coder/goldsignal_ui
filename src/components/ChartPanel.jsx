import React, { useEffect, useState } from "react";
import { Expand, Layers, LayoutGrid, Maximize, Minimize, Square, X } from "lucide-react";
import LiveChart from "./LiveChart";
import LivePrice from "./LivePrice";
import { Chip, Segmented } from "./ui";
import { useLive } from "../context/LiveContext";
import { TIMEFRAMES, SESSION_LABELS, SESSION_COLORS, symbolInfo } from "../lib/constants";
import { biasColor, cx } from "../lib/format";

const LAYER_DEFS = [
  { key: "own", label: "This TF", hint: "Structure of the timeframe you are viewing: BOS/CHoCH, swings, OB/FVG, liquidity, trend lines" },
  { key: "htf", label: "4H map", hint: "4H direction, fresh supply/demand, BOS/CHoCH" },
  { key: "setup", label: "1H setup", hint: "1H OB/FVG, liquidity, trend lines, structure" },
  { key: "trigger", label: "Trigger", hint: "Entry candle, mini BOS, entry/SL/TP" },
  { key: "levels", label: "Levels", hint: "PDH/PDL/PWH/PWL, opens, sessions, round numbers" },
  { key: "sessions", label: "Sessions", hint: "London / New York / Asia bands" },
];
export const DEFAULT_LAYERS = { own: true, htf: true, setup: true, trigger: true, levels: true, sessions: true };

/** Sensible overlays per timeframe so candles stay readable (you can still toggle anything). */
export function presetFor(tf) {
  const off = { own: false, htf: false, setup: false, trigger: false, levels: false, sessions: false };
  if (["1d", "1w"].includes(tf)) return { ...off, own: true, levels: true };
  if (tf === "4h") return { ...off, own: true, levels: true, trigger: true };
  if (tf === "1h") return { ...off, own: true, htf: true, levels: true, trigger: true, sessions: true };
  return { ...off, own: true, setup: true, trigger: true, levels: true, sessions: true };   // 1m-30m
}

function LayerChips({ layers, setLayers, tf }) {
  // on 4H the "4H map" IS the own-TF layer, on 1H the "1H setup" is - don't offer duplicates
  const defs = LAYER_DEFS.filter((l) => !(l.key === "htf" && tf === "4h") && !(l.key === "setup" && tf === "1h"));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Layers size={14} className="text-gray-500" />
      {defs.map((l) => (
        <button key={l.key} title={l.hint} onClick={() => setLayers({ ...layers, [l.key]: !layers[l.key] })}
          className={cx("text-xs px-2.5 py-1 rounded-full border transition-colors",
            layers[l.key] ? "border-gold/50 bg-gold/10 text-gold" : "border-border text-gray-500 hover:text-gray-300")}>
          {l.label}
        </button>
      ))}
      <span className="w-px h-4 bg-border mx-0.5" />
      <button onClick={() => setLayers(Object.fromEntries(LAYER_DEFS.map((l) => [l.key, false])))}
        title="Candles only" className="text-xs px-2.5 py-1 rounded-full border border-border text-gray-400 hover:text-gray-100">Clean</button>
      <button onClick={() => setLayers({ ...DEFAULT_LAYERS })}
        className="text-xs px-2.5 py-1 rounded-full border border-border text-gray-400 hover:text-gray-100">All</button>
    </div>
  );
}

function PanelTitle({ step, title, bias, right }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-5 h-5 rounded-full bg-gold/15 text-gold text-[11px] font-bold flex items-center justify-center shrink-0">{step}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-300 truncate">{title}</span>
        {bias && <span className={cx("text-xs font-semibold uppercase", biasColor(bias))}>{bias}</span>}
      </div>
      {right}
    </div>
  );
}

function ExpandBtn({ onClick }) {
  return (
    <button onClick={onClick} title="Expand chart (full screen)" aria-label="Expand chart"
      className="w-8 h-8 rounded-lg border border-border bg-panel2 flex items-center justify-center text-gray-400 hover:text-gold hover:border-gold/50 shrink-0">
      <Expand size={15} />
    </button>
  );
}

/** Full-viewport chart with its own timeframe + layer controls. Esc closes. */
function Expanded({ tf: tf0, layers: l0, onClose }) {
  const { prefs } = useLive();
  const [tf, setTfRaw] = useState(tf0);
  const [layers, setLayers] = useState(l0);
  const setTf = (t) => { setTfRaw(t); setLayers(presetFor(t)); };
  const [fs, setFs] = useState(false);
  const info = symbolInfo(prefs.symbol);

  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; if (document.fullscreenElement) document.exitFullscreen?.(); };
  }, [onClose]);
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);
  const toggleBrowserFs = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-[70] bg-bg flex flex-col pt-[env(safe-area-inset-top)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">{info.short}</span>
          <LivePrice />
        </div>
        <Segmented size="sm" value={tf} onChange={setTf} options={TIMEFRAMES} />
        <div className="hidden md:block"><LayerChips layers={layers} setLayers={setLayers} tf={tf} /></div>
        <div className="ml-auto flex items-center gap-2">
          {document.documentElement.requestFullscreen && (
            <button onClick={toggleBrowserFs} title="Browser full screen" className="hidden sm:flex w-9 h-9 rounded-lg border border-border bg-panel items-center justify-center text-gray-400 hover:text-gold">
              {fs ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          )}
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-lg border border-border bg-panel flex items-center justify-center text-gray-300 hover:text-bear"><X size={18} /></button>
        </div>
        <div className="md:hidden w-full"><LayerChips layers={layers} setLayers={setLayers} tf={tf} /></div>
      </div>
      <div className="flex-1 min-h-0">
        <LiveChart tf={tf} layers={layers} heightClass="h-full" limit={800} />
      </div>
    </div>
  );
}

export default function ChartPanel({ tall = false }) {
  const { prefs, setPref, live } = useLive();
  const [layers, setLayers] = useState(() => presetFor(prefs.chartTF));
  const [expanded, setExpanded] = useState(null); // {tf, layers}
  const changeTf = (v) => { setPref("chartTF", v); setLayers(presetFor(v)); };
  const a = live?.analysis;
  const sess = live?.sessions;
  const close = React.useCallback(() => setExpanded(null), []);

  const modeSwitch = (
    <Segmented size="sm" value={prefs.layout} onChange={(v) => setPref("layout", v)}
      options={[{ value: "single", label: <span className="flex items-center gap-1"><Square size={12} /> Single</span> },
                { value: "topdown", label: <span className="flex items-center gap-1"><LayoutGrid size={12} /> Top-down</span> }]} />
  );

  if (prefs.layout === "topdown") {
    const h = tall ? "h-[300px] md:h-[360px]" : "h-[260px] md:h-[300px]";
    const L4 = { own: true, levels: true, sessions: false };
    const L1 = { own: true, sessions: layers.sessions };
    const LE = { own: true, setup: true, trigger: true, sessions: layers.sessions };
    return (
      <div className="space-y-3">
        {expanded && <Expanded tf={expanded.tf} layers={expanded.layers} onClose={close} />}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-gray-500">Top-down: 4H direction → 1H setup → {prefs.entryTF} trigger</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLayers({ ...layers, sessions: !layers.sessions })}
              className={cx("text-xs px-2.5 py-1 rounded-full border", layers.sessions ? "border-gold/50 bg-gold/10 text-gold" : "border-border text-gray-500")}>Sessions</button>
            {modeSwitch}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-panel border border-border rounded-2xl overflow-hidden">
            <PanelTitle step="1-2" title="4H direction + map" bias={a?.["4h"]?.bias}
              right={<div className="flex items-center gap-2"><Chip tone="gray">4H</Chip><ExpandBtn onClick={() => setExpanded({ tf: "4h", layers: presetFor("4h") })} /></div>} />
            <LiveChart tf="4h" layers={L4} heightClass={h} limit={300} />
          </div>
          <div className="bg-panel border border-border rounded-2xl overflow-hidden">
            <PanelTitle step="3" title="1H structure + liquidity" bias={a?.["1h"]?.bias}
              right={<div className="flex items-center gap-2"><Chip tone="gray">1H</Chip><ExpandBtn onClick={() => setExpanded({ tf: "1h", layers: presetFor("1h") })} /></div>} />
            <LiveChart tf="1h" layers={L1} heightClass={h} limit={400} />
          </div>
          <div className="bg-panel border border-border rounded-2xl overflow-hidden lg:col-span-2">
            <PanelTitle step="4" title={`${prefs.entryTF} entry trigger`}
              right={<div className="flex items-center gap-2"><span className="text-[11px] text-gray-500 hidden sm:inline">{sess?.label}</span><ExpandBtn onClick={() => setExpanded({ tf: prefs.entryTF, layers: presetFor(prefs.entryTF) })} /></div>} />
            <LiveChart tf={prefs.entryTF} layers={LE} heightClass={tall ? "h-[340px] md:h-[440px]" : "h-[300px] md:h-[380px]"} limit={400} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-panel border border-border rounded-2xl overflow-hidden">
      {expanded && <Expanded tf={expanded.tf} layers={expanded.layers} onClose={close} />}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3">
        <Segmented size="sm" value={prefs.chartTF} onChange={changeTf} options={TIMEFRAMES} className="max-w-full" />
        <div className="flex items-center gap-2">{modeSwitch}<ExpandBtn onClick={() => setExpanded({ tf: prefs.chartTF, layers: { ...layers } })} /></div>
      </div>
      <div className="px-3 pt-2.5"><LayerChips layers={layers} setLayers={setLayers} tf={prefs.chartTF} /></div>
      <LiveChart tf={prefs.chartTF} layers={layers}
        heightClass={tall ? "h-[420px] md:h-[620px]" : "h-[340px] md:h-[460px] xl:h-[600px]"} />
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3 text-[11px] text-gray-500">
        <Legend c="#12b886" t="Demand / bull OB" /><Legend c="#ff4d4f" t="Supply / bear OB" />
        <Legend c="#3b82f6" t="Bull FVG" /><Legend c="#f59e0b" t="Bear FVG · CHoCH · PDH/PDL" />
        <Legend c="#a78bfa" t="Liquidity (EQH/EQL/BSL/SSL)" /><Legend c="#c084fc" t="Trend line" />
        <Legend c="#22d3ee" t="Mini BOS" /><Legend c="#d4af37" t="Zone hit / entry" />
        <SessionKey />
      </div>
    </div>
  );
}

function SessionKey() {
  return (
    <span className="flex items-center gap-3 sm:ml-auto">
      {Object.entries(SESSION_LABELS).map(([k, v]) => (
        <span key={k} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SESSION_COLORS[k] }} />{v}</span>
      ))}
    </span>
  );
}

function Legend({ c, t }) {
  return <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 rounded-sm" style={{ background: c }} />{t}</span>;
}
