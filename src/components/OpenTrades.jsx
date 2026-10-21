import React from "react";
import { Activity } from "lucide-react";
import { Card, Chip } from "./ui";
import PreviewLine from "./PreviewLine";
import { useLive } from "../context/LiveContext";
import { symbolInfo } from "../lib/constants";
import { cx, fmtAgo, fmtDateTime, fmtPrice } from "../lib/format";

const HEALTH = {
  healthy: { tone: "bull", label: "On plan" }, building: { tone: "blue", label: "Building" },
  protected: { tone: "bull", label: "Protected (BE)" }, near_target: { tone: "gold", label: "Near target" },
  caution: { tone: "amber", label: "Caution" }, danger: { tone: "bear", label: "Danger" },
};

function Trade({ a }) {
  const p = symbolInfo(a.symbol).precision;
  const buy = a.direction === "BUY";
  const h = HEALTH[a.health] || HEALTH.healthy;
  const r = a.live_r ?? 0;
  const prog = Math.max(0, Math.min(1, a.progress ?? 0));
  const events = (a.events || []).slice(-3).reverse();
  return (
    <div className={cx("rounded-xl border p-3", buy ? "border-bull/30" : "border-bear/30")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cx("text-lg font-black", buy ? "text-bull" : "text-bear")}>{a.direction}</span>
          <span className="text-xs text-gray-400 truncate">{symbolInfo(a.symbol).label || a.symbol} · {a.trade_type || (a.style === "scalp" ? "Scalp" : "Swing")}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Chip tone={h.tone}>{h.label}</Chip>
          <Chip tone={r >= 0 ? "bull" : "bear"}>{r >= 0 ? "+" : ""}{r}R</Chip>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mt-2 text-sm tabular-nums">
        <div><div className="text-[10px] text-gray-500 uppercase">Entry</div>{fmtPrice(a.entry_price, p)}</div>
        <div><div className="text-[10px] text-gray-500 uppercase">{a.be_moved ? "Stop (BE)" : "Stop"}</div>
          <span className={a.be_moved ? "text-gray-300" : "text-bear"}>{fmtPrice(a.current_sl ?? a.stop_loss, p)}</span></div>
        <div><div className="text-[10px] text-gray-500 uppercase">Target</div><span className="text-bull">{fmtPrice(a.take_profit, p)}</span></div>
      </div>
      <div className="mt-2.5">
        <PreviewLine symbol={a.symbol} interval={a.entry_interval || "15m"} direction={a.direction} entry={a.entry_price} sl={a.current_sl ?? a.stop_loss} tp={a.take_profit}
          firedTs={a.trigger_ts || Math.floor(new Date(a.created_at).getTime() / 1000)} status="open" height={120} legend={false} />
      </div>
      <div className="h-1.5 rounded-full bg-white/5 mt-2.5 overflow-hidden">
        <div className={cx("h-full rounded-full", r >= 0 ? "bg-bull" : "bg-bear")} style={{ width: `${Math.max(4, prog * 100)}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
        <span>opened {fmtAgo(a.created_at)}</span>
        <span>best {a.max_r ?? 0}R · worst {a.min_r ?? 0}R</span>
      </div>
      {(a.notes?.length ? a.notes : a.health_note ? [a.health_note] : []).slice(0, 3).map((n, i) => (
        <p key={i} className="text-[11px] text-gray-400 leading-snug mt-1.5">• {n}</p>
      ))}
      {events.length > 0 && (
        <ul className="mt-2 border-t border-border/60 pt-1.5 space-y-0.5">
          {events.map((e, i) => (
            <li key={i} className="text-[10px] text-gray-500"><span className="text-gray-400">{fmtDateTime(e.ts)}</span> · {e.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Every trade that is running right now (all pairs), each watched and updated on its own. */
export default function OpenTrades({ allPairs = false }) {
  const { live, prefs } = useLive();
  const list = (live?.open_trades || []).filter((t) => allPairs || t.symbol === prefs.symbol);
  if (!list.length) return null;
  return (
    <Card title={`Open trades (${list.length}) · auto-tracked`} icon={Activity}>
      <div className="space-y-2">{list.map((a) => <Trade key={a.id} a={a} />)}</div>
      <p className="text-[11px] text-gray-500 mt-2">Each trade is re-checked on every refresh: stop moves, structure flips and warnings show here and as alerts.</p>
    </Card>
  );
}
