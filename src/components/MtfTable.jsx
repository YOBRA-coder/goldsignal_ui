import React from "react";
import { Layers3 } from "lucide-react";
import { Card, Chip } from "./ui";
import { fmtAgo } from "../lib/format";

const label = { "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1H", "4h": "4H", "1d": "1D", "1w": "1W" };

export default function MtfTable({ mtf, alignment }) {
  return (
    <Card title="Multi-timeframe bias" icon={Layers3}
      right={alignment && <Chip tone={alignment.bull >= 3 ? "bull" : alignment.bear >= 3 ? "bear" : "gray"}>{alignment.bull} bull · {alignment.bear} bear / {alignment.of}</Chip>}>
      {!mtf ? <div className="text-sm text-gray-500 py-3">Loading…</div> : (
        <ul className="divide-y divide-border/60">
          {mtf.map((m) => (
            <li key={m.tf} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-9 font-semibold text-gray-300">{label[m.tf]}</span>
              <Chip tone={m.bias === "bullish" ? "bull" : m.bias === "bearish" ? "bear" : "gray"} className="w-[74px] justify-center capitalize">{m.bias}</Chip>
              <span className="flex-1 text-xs text-gray-500 truncate">
                {m.last_event ? `${m.last_event.type} ${m.last_event.dir === "bull" ? "↑" : "↓"} · ${fmtAgo(m.last_event.ts)}` : "—"}
              </span>
              <span className="hidden sm:inline text-[11px] text-gray-600 font-mono">{(m.labels || []).join(" ")}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
