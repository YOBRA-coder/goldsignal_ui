import React, { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";
import { Card, Chip } from "./ui";
import { useLive } from "../context/LiveContext";
import { SESSION_COLORS } from "../lib/constants";
import { cx, fmtCountdown, fmtTime } from "../lib/format";

export default function SessionsPanel() {
  const { live } = useLive();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const s = live?.sessions;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <Card title="Sessions" icon={Globe2}
      right={s && <Chip tone={s.trade_allowed ? "bull" : "bear"}>{s.trade_allowed ? "Trading window open" : s.market_open ? "Outside London/NY" : "Market closed"}</Chip>}>
      {!s ? <div className="text-sm text-gray-500 py-3">Loading…</div> : (
        <>
          <ul className="divide-y divide-border/60">
            {s.sessions.map((x) => (
              <li key={x.key} className="flex items-center gap-3 py-2.5">
                <span className={cx("w-2.5 h-2.5 rounded-full shrink-0", x.open && s.market_open ? "animate-pulse" : "opacity-30")}
                  style={{ background: SESSION_COLORS[x.key] }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {x.label}
                    {x.key !== "asia" && <span className="text-[9px] font-bold text-gold/80 border border-gold/30 rounded px-1">SIGNALS</span>}
                  </div>
                  <div className="text-xs text-gray-500">{x.hours_local} local · now {x.local_time}</div>
                </div>
                <div className="text-right">
                  <div className={cx("text-xs font-semibold", x.open ? "text-bull" : "text-gray-500")}>{x.open ? "OPEN" : "CLOSED"}</div>
                  <div className="text-[11px] text-gray-500 tabular-nums">{x.next_change_kind} in {fmtCountdown(x.next_change)}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="text-[11px] text-gray-500 mt-2 flex justify-between">
            <span>Your time: <b className="text-gray-300">{fmtTime(Math.floor(Date.now() / 1000))}</b> ({tz})</span>
            <span>{s.label}</span>
          </div>
        </>
      )}
    </Card>
  );
}
