import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, Check, Minus, X } from "lucide-react";
import api from "../api";
import { Card, Chip, Empty, Segmented } from "./ui";
import { useLive } from "../context/LiveContext";
import { cx, fmtTime } from "../lib/format";

const STATUS_TONE = {
  signal: "gold", waiting_trigger: "blue", waiting_zone: "gray", not_aligned: "gray",
  no_bias: "gray", out_of_session: "gray", risk_too_wide: "amber", low_agreement: "amber",
  market_closed: "gray",
};

function Checks({ checks }) {
  if (!checks?.length) return <div className="text-xs text-gray-500 py-1.5">No check breakdown stored for this row.</div>;
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 py-1.5">
      {checks.map((c) => (
        <li key={c.key} className="flex gap-2 text-xs">
          {c.ok === null ? <Minus size={13} className="text-gray-500 shrink-0 mt-0.5" />
            : c.ok ? <Check size={13} className="text-bull shrink-0 mt-0.5" /> : <X size={13} className="text-bear shrink-0 mt-0.5" />}
          <span><span className="text-gray-300">{c.label}</span><span className="text-gray-500"> — {c.detail}</span></span>
        </li>
      ))}
    </ul>
  );
}

function Previews({ previews }) {
  const entries = Object.entries(previews || {}).filter(([k, v]) => v && k !== "highlights");
  const highlights = previews?.highlights || [];
  if (!entries.length && !highlights.length) return null;
  return (
    <div className="mt-1 space-y-1 text-xs">
      {highlights.map((h, i) => <div key={i} className="text-gray-400">• {h}</div>)}
      {entries.map(([k, v]) => (
        <div key={k} className="text-gray-500"><span className="text-gray-400 capitalize">{k.replace(/_/g, " ")}:</span> {v.note || v.detail || JSON.stringify(v)}</div>
      ))}
    </div>
  );
}

export default function ScanLogPanel() {
  const { prefs } = useLive();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(null);
  const [live, setLiveOn] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/signals/scan-log", {
        params: { symbol: prefs.symbol, entry_interval: prefs.entryTF, limit: 60, detail: true },
      });
      setRows(data);
      setErr(null);
    } catch (e) { setErr(e?.message || "Could not load the log"); }
  }, [prefs.symbol, prefs.entryTF]);

  useEffect(() => {
    load();
    if (!live) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load, live]);

  return (
    <Card title="Engine log" right={
      <Segmented size="sm" options={[{ value: true, label: "Live" }, { value: false, label: "Paused" }]} value={live} onChange={setLiveOn} />
    }>
      <p className="text-[11px] text-gray-500 -mt-1 mb-2">
        Every evaluation the engine has made for {prefs.symbol} / {prefs.entryTF} - not just the ones that fired.
      </p>
      {err && <div className="text-xs text-bear mb-2">{err}</div>}
      {!rows.length ? <Empty>No scans logged yet for this symbol/timeframe.</Empty> : (
        <ul className="divide-y divide-border/60 max-h-[420px] overflow-y-auto">
          {rows.map((r, idx) => (
            <li key={idx} className="py-2">
              <button className="w-full text-left flex items-center gap-2" onClick={() => setOpen(open === idx ? null : idx)}>
                <span className="text-[11px] text-gray-500 tabular-nums w-12 shrink-0">{fmtTime(r.ts)}</span>
                <Chip tone={STATUS_TONE[r.status] || "gray"} className="shrink-0">{r.status.replace(/_/g, " ")}</Chip>
                {r.direction && <span className={cx("text-xs font-bold", r.direction === "BUY" ? "text-bull" : "text-bear")}>{r.direction}</span>}
                <span className="text-xs text-gray-400 truncate flex-1">{r.headline}</span>
                {r.agreement != null && <span className="text-[11px] text-gold shrink-0">{Math.round(r.agreement)}%{r.grade ? ` · ${r.grade}` : ""}</span>}
                {r.volatility_spike && <Chip tone="amber" className="shrink-0">spike</Chip>}
                <ChevronDown size={14} className={cx("text-gray-500 shrink-0 transition-transform", open === idx && "rotate-180")} />
              </button>
              {open === idx && (
                <div className="pl-14 pr-2">
                  <Checks checks={r.checks} />
                  <Previews previews={r.previews} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
