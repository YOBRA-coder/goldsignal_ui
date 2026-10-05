import React from "react";
import { CalendarClock, Target } from "lucide-react";
import { Card, Chip } from "./ui";
import { useLive } from "../context/LiveContext";
import { symbolInfo } from "../lib/constants";
import { cx, fmtCountdown, fmtDateTime, fmtPrice, fmtTime } from "../lib/format";

export function Plan({ plan, precision }) {
  const buy = plan.direction === "BUY";
  const pl = plan.plan, eta = plan.eta;
  return (
    <div className={cx("rounded-xl border p-3", buy ? "border-bull/25 bg-bull/5" : "border-bear/25 bg-bear/5")}>
      <div className="flex items-center justify-between gap-2">
        <span className={cx("text-sm font-bold", buy ? "text-bull" : "text-bear")}>{plan.direction}</span>
        <Chip tone={plan.role === "primary" ? "gold" : "gray"}>{plan.role === "primary" ? "with the trend" : "counter-trend"}</Chip>
      </div>
      <p className="text-[12px] text-gray-200 mt-1 leading-snug">{plan.headline}</p>
      {pl && (
        <div className="grid grid-cols-4 gap-1 text-center mt-2 text-[11px] tabular-nums">
          <div><div className="text-[9px] text-gray-500 uppercase">Entry</div>{fmtPrice(pl.entry, precision)}</div>
          <div><div className="text-[9px] text-gray-500 uppercase">Stop</div><span className="text-bear">{fmtPrice(pl.stop, precision)}</span></div>
          <div><div className="text-[9px] text-gray-500 uppercase">Target</div><span className="text-bull">{fmtPrice(pl.target, precision)}</span></div>
          <div><div className="text-[9px] text-gray-500 uppercase">R:R</div>{pl.reward_r}</div>
        </div>
      )}
      {pl?.target_why && <p className="text-[10px] text-gray-500 mt-1">Target: {pl.target_why}</p>}
      {eta && !eta.in_zone && eta.p50_ts && (
        <p className="text-[11px] text-gray-300 mt-1.5">
          <CalendarClock size={12} className="inline mr-1 text-gold" />
          Likely at the zone: <b>{fmtDateTime(eta.p25_ts)}</b> – <b>{eta.p75_ts ? fmtDateTime(eta.p75_ts) : "later / may not reach"}</b>
          <span className="text-gray-500"> (typical {fmtDateTime(eta.p50_ts)})</span>
        </p>
      )}
      {eta?.in_zone && <p className="text-[11px] text-gold mt-1.5">Price is inside the zone now - waiting for the confirmation candle.</p>}
      {plan.trigger && <p className="text-[10px] text-gray-500 mt-1.5 leading-snug">Needs: {plan.trigger}</p>}
      {plan.invalidation && <p className="text-[10px] text-amber-400/80 mt-1 leading-snug">Off if: {plan.invalidation.text}</p>}
      {plan.note && <p className="text-[10px] text-gray-500 mt-1 leading-snug">{plan.note}</p>}
    </div>
  );
}

/** "What do I expect next, and when" - buy and sell plans with clock times. */
export default function Outlook({ outlook: given }) {
  const { live, prefs } = useLive();
  const o = given || live?.signal?.outlook;
  if (!o) return null;
  const p = symbolInfo(prefs.symbol).precision;
  const v = o.verdict;
  return (
    <Card title="Outlook - what to expect and when" icon={Target}>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {o.when?.next_candle_close || o.plans?.[0]?.when?.next_candle_close ? (
          <Chip tone="gray">next candle closes {fmtTime(o.when?.next_candle_close || o.plans[0].when.next_candle_close)}</Chip>
        ) : null}
        <Chip tone={o.session_open_now ? "bull" : "amber"}>{o.session_open_now ? "trade window open" : o.next_trade_window ? `window opens ${fmtDateTime(o.next_trade_window)} (in ${fmtCountdown(o.next_trade_window)})` : "outside trade window"}</Chip>
        {v?.kind === "eta" && v.p50_ts && <Chip tone="gold">{v.direction} setup typical ~{fmtDateTime(v.p50_ts)}</Chip>}
        {v?.kind === "in_zone" && <Chip tone="gold">{v.direction}: in the zone now</Chip>}
      </div>
      <div className="space-y-2">{(o.plans || []).map((pl, i) => <Plan key={i} plan={pl} precision={p} />)}</div>
      {o.windows?.length > 0 && (
        <ul className="mt-2.5 border-t border-border/60 pt-2 space-y-0.5">
          {o.windows.slice(0, 4).map((w, i) => (
            <li key={i} className="text-[11px] text-gray-400"><span className="text-gray-300">{fmtDateTime(w.ts)}</span> · {w.label} <span className="text-gray-600">(in {fmtCountdown(w.ts)})</span></li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-gray-600 mt-2">Times are estimates from recent volatility (random-walk ranges), not promises.</p>
    </Card>
  );
}
