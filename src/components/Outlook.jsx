import React, { useState } from "react";
import { CalendarClock, ChevronDown, ChevronUp, Target } from "lucide-react";
import { Card, Chip } from "./ui";
import { AlertPrefs, ApprovalBar, ConfirmMeter, MiniChart, PctRing, ShiftStrip, StagePipeline, StateBadge, Timeline, TradeLadder, ViewToggles } from "./BrainBits";
import { useLive } from "../context/LiveContext";
import { stateOf, useNow, useView } from "../lib/brain";
import { symbolInfo } from "../lib/constants";
import { cx, fmtCountdown, fmtDateTime, fmtPrice, fmtTime } from "../lib/format";

/** Plain plan card (used by the log and the full-screen SIGNALS tab, and as the fallback when there is no brain read). */
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

/** One side (BUY or SELL): how ready it is, what is missing, the trade drawn to scale, the confirmations behind it. */
function PlanCard({ plan, side, price, precision, view, nowMs }) {
  const buy = plan.direction === "BUY";
  const st = stateOf(side);
  const pl = plan.plan, eta = plan.eta;
  const live = side.state === "ready" || side.state === "fire";
  const glow = live ? (side.counter ? "blink-counter" : st.blink) : "";
  const roleChip = side.role === "primary" ? ["gold", "with the trend"] : side.role === "alternative" ? ["gray", "counter-trend"] : ["gray", "range"];
  return (
    <div className={cx("rounded-xl border p-3 transition-colors", buy ? "border-bull/25 bg-bull/[0.04]" : "border-bear/25 bg-bear/[0.04]", glow)}>
      <div className="flex items-start gap-3">
        <PctRing value={side.pct} size={62} color={st.hex} blink="" label={st.short.toLowerCase()} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cx("text-base font-black tracking-tight", buy ? "text-bull" : "text-bear")}>{plan.direction}</span>
            <Chip tone={roleChip[0]}>{roleChip[1]}</Chip>
            <StateBadge side={side} />
          </div>
          <p className="text-[11px] text-gray-300 mt-1 leading-snug">{plan.headline}</p>
          {side.next && !live && <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{side.next}</p>}
        </div>
      </div>

      <div className="mt-2.5"><StagePipeline stages={side.stages} compact={!live && !view.preview} /></div>

      {view.preview && pl && (
        <div className="mt-2.5">
          <TradeLadder plan={pl} price={price} buy={buy} precision={precision} />
          <div className="grid grid-cols-4 gap-1 text-center text-[11px] tabular-nums">
            <div><div className="text-[9px] text-gray-500 uppercase">Entry</div>{fmtPrice(pl.entry, precision)}</div>
            <div><div className="text-[9px] text-gray-500 uppercase">Stop</div><span className="text-bear">{fmtPrice(pl.stop, precision)}</span></div>
            <div><div className="text-[9px] text-gray-500 uppercase">Target</div><span className="text-bull">{fmtPrice(pl.target, precision)}</span></div>
            <div><div className="text-[9px] text-gray-500 uppercase">R:R</div>{pl.reward_r}</div>
          </div>
          {pl.target_why && <p className="text-[10px] text-gray-500 mt-1">Target: {pl.target_why}</p>}
        </div>
      )}

      {view.patterns && (
        <div className="mt-2.5 space-y-1.5">
          <ApprovalBar ap={side.approval} nowMs={nowMs} />
        </div>
      )}
      {view.confirm && <div className="mt-2.5"><ConfirmMeter confirm={side.confirm} /></div>}

      {eta && !eta.in_zone && eta.p50_ts && (
        <p className="text-[11px] text-gray-300 mt-2.5">
          <CalendarClock size={12} className="inline mr-1 text-gold" />
          Likely at the zone: <b>{fmtDateTime(eta.p25_ts)}</b> – <b>{eta.p75_ts ? fmtDateTime(eta.p75_ts) : "later / may not reach"}</b>
          <span className="text-gray-500"> (typical {fmtDateTime(eta.p50_ts)})</span>
        </p>
      )}
      {eta?.in_zone && <p className="text-[11px] text-gold mt-2.5">Price is inside the zone now - waiting for the confirmation candle.</p>}
      {plan.invalidation && <p className="text-[10px] text-amber-400/80 mt-1 leading-snug">Off if: {plan.invalidation.text}</p>}
      {side.caution && <p className="text-[10px] text-amber-300/90 mt-1.5 leading-snug border-t border-amber-400/20 pt-1.5">{side.caution}</p>}
    </div>
  );
}

const OPEN_KEY = "gs_outlook_open";
const readOpen = () => { try { return localStorage.getItem(OPEN_KEY) !== "0"; } catch { return true; } };

/** "What do I expect next, and when" - how ready each side is, a timeline, a live mini chart, patterns and confirmations. */
export default function Outlook({ outlook: given, brain: givenBrain }) {
  const { live, prefs } = useLive();
  const nowMs = useNow(1000);
  const { view } = useView();
  const [open, setOpenRaw] = useState(readOpen);
  const setOpen = (v) => { setOpenRaw(v); try { localStorage.setItem(OPEN_KEY, v ? "1" : "0"); } catch { /* ignore */ } };
  const o = given || live?.signal?.outlook;
  const brain = givenBrain === undefined ? live?.signal?.brain : givenBrain;
  if (!o) return null;
  const p = symbolInfo(prefs.symbol).precision;
  const v = o.verdict;
  const sides = brain?.sides || {};
  const nextClose = o.when?.next_candle_close || o.plans?.[0]?.when?.next_candle_close;
  const anyLive = ["BUY", "SELL"].some((s) => sides[s] && (sides[s].state === "ready" || sides[s].state === "fire"));

  return (
    <Card title="Outlook - what to expect and when" icon={Target} className={cx(anyLive && "border-bull/40")}
      right={(
        <div className="flex items-center gap-1.5">
          {brain && <AlertPrefs />}
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Collapse outlook" : "Expand outlook"}
            className="w-6 h-6 rounded-md border border-border text-gray-400 hover:text-gold flex items-center justify-center">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      )}>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {nextClose ? <Chip tone="gray">next candle closes {fmtTime(nextClose)} · {fmtCountdown(nextClose)}</Chip> : null}
        <Chip tone={o.session_open_now ? "bull" : "amber"}>{o.session_open_now ? "trade window open" : o.next_trade_window ? `window opens ${fmtDateTime(o.next_trade_window)} (in ${fmtCountdown(o.next_trade_window)})` : "outside trade window"}</Chip>
        {v?.kind === "eta" && v.p50_ts && <Chip tone="gold">{v.direction} setup typical ~{fmtDateTime(v.p50_ts)}</Chip>}
        {v?.kind === "in_zone" && <Chip tone="gold">{v.direction}: in the zone now</Chip>}
        {brain && ["BUY", "SELL"].map((s) => sides[s] && (
          <Chip key={s} tone={stateOf(sides[s]).chip}>{s} {sides[s].pct}%</Chip>
        ))}
      </div>

      {open && (
        <div className="space-y-3">
          {brain && <ViewToggles />}
          {brain && <ShiftStrip shifts={brain.shifts} />}
          {brain && view.timeline && <Timeline outlook={o} brain={brain} />}
          {brain && view.candles && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Live preview · {brain.tf} candles, zones, lead plan</div>
              <MiniChart brain={brain} precision={p} showPatterns={view.patterns} nowMs={nowMs} />
              {view.patterns && brain.recent_patterns?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[...brain.recent_patterns].slice(-4).reverse().map((q, i) => (
                    <span key={i} className={cx("text-[10px] px-1.5 py-0.5 rounded-md border", q.dir === "BUY" ? "border-bull/30 text-bull" : "border-bear/30 text-bear")}>
                      {q.dir === "BUY" ? "▲" : "▼"} {q.label} · {fmtTime(q.ts + brain.step, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="space-y-2">
            {(o.plans || []).map((pl, i) => (
              sides[pl.direction]
                ? <PlanCard key={i} plan={pl} side={sides[pl.direction]} price={brain.price} precision={p} view={view} nowMs={nowMs} />
                : <Plan key={i} plan={pl} precision={p} />
            ))}
          </div>
          {o.windows?.length > 0 && !brain && (
            <ul className="mt-2.5 border-t border-border/60 pt-2 space-y-0.5">
              {o.windows.slice(0, 4).map((w, i) => (
                <li key={i} className="text-[11px] text-gray-400"><span className="text-gray-300">{fmtDateTime(w.ts)}</span> · {w.label} <span className="text-gray-600">(in {fmtCountdown(w.ts)})</span></li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-gray-600">
            Times are estimates from recent volatility (random-walk ranges), not promises.{brain ? " The % is how close each side is to a tradeable entry - not a probability of profit." : ""}
          </p>
        </div>
      )}
    </Card>
  );
}
