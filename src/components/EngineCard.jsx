import React, { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import api from "../api";
import { Card, Segmented } from "./ui";
import { useLive } from "../context/LiveContext";

export const SMC_OPTS = [{ value: "off", label: "Off" }, { value: "confirm", label: "Confirm" }, { value: "strict", label: "Strict" }];
export const AMD_OPTS = [{ value: "off", label: "Off" }, { value: "confirm", label: "Confirm" }, { value: "require", label: "Required" }];
export const QUALITY_OPTS = [{ value: "standard", label: "Standard" }, { value: "selective", label: "Selective" }];

/** Live engine strictness: AMD, quality and the daily stop. Same switches the backtest "Compare settings" table tests. */
export default function EngineCard({ reloadKey = 0 }) {
  const { refresh } = useLive();
  const [e, setE] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { api.get("/engine/settings").then(({ data }) => setE(data)).catch(() => {}); }, [reloadKey]);
  const save = async (patch) => {
    setE((x) => ({ ...x, ...patch }));
    try { const { data } = await api.put("/engine/settings", patch); setE(data); setMsg("Saved - live signals, chart history and backtests now use this."); refresh?.(); }
    catch { setMsg("Could not save."); }
  };
  if (!e) return null;
  return (
    <Card title="Engine strictness" icon={SlidersHorizontal}>
      <div className="space-y-3 text-xs text-gray-400">
        <div>
          <div className="text-sm text-gray-200 mb-1">AMD (accumulation → manipulation → distribution)</div>
          <Segmented size="sm" value={e.amd} onChange={(v) => save({ amd: v })} options={AMD_OPTS} />
          <p className="mt-1 leading-snug"><b>Confirm</b>: a range raid that matches the trade counts as an extra confirmation; a raid pointing the other way needs one more. <b>Required</b>: only trade when the raid → displacement agrees (fewest, cleanest trades).</p>
        </div>
        <div>
          <div className="text-sm text-gray-200 mb-1">Smart-money filters (breaker · inducement · zone quality)</div>
          <Segmented size="sm" value={e.smc || "confirm"} onChange={(v) => save({ smc: v })} options={SMC_OPTS} />
          <p className="mt-1 leading-snug"><b>Confirm</b>: breaker blocks count as zones, a breaker needs one extra confirmation, and a climax candle already stretched far from the zone is skipped (no chasing). <b>Strict</b>: also needs inducement (a small raid right before the tap), a quality zone, and scalps only inside London / New York kill zones. Fewer trades, fewer low-grade losers. Compare all three under Backtest.</p>
        </div>
        <div>
          <div className="text-sm text-gray-200 mb-1">Quality</div>
          <Segmented size="sm" value={e.quality} onChange={(v) => save({ quality: v })} options={QUALITY_OPTS} />
          <p className="mt-1 leading-snug"><b>Selective</b>: buys only in the 1H discount / sells in premium, momentum must agree, and agreement must be 5 points higher.</p>
        </div>
        <label className="flex items-center justify-between gap-3">
          <span><span className="block text-sm text-gray-200">Daily stop</span><span className="block">Pause a pair for the rest of the day after this many stop-outs (0 = off)</span></span>
          <input type="number" min={0} max={10} value={e.daily_stop} onChange={(ev) => save({ daily_stop: Number(ev.target.value) })}
            className="w-16 bg-panel2 border border-border rounded-lg px-2 py-1 text-gray-100 text-right" />
        </label>
        {msg && <div className="text-gray-500">{msg}</div>}
        <p className="text-[11px] text-gray-600">Not sure what to pick? Backtest → "Compare settings" runs every combination on your own data and shows which one loses least.</p>
      </div>
    </Card>
  );
}
