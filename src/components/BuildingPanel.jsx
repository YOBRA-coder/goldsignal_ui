import React, { useState } from "react";
import { AlertTriangle, Hourglass, Radar, Split, Zap } from "lucide-react";
import { Card, Chip } from "./ui";
import { ApprovalBar, ConfirmMeter, PctRing, ReactionNote, ShiftStrip, StagePipeline, StateBadge, ViewToggles, ZoomBar } from "./BrainBits";
import { useLive } from "../context/LiveContext";
import { mmss, stateOf, useNow, useView } from "../lib/brain";
import { symbolInfo } from "../lib/constants";
import { cx, fmtPrice, fmtTime } from "../lib/format";

function Row({ icon: Icon, tone, title, note }) {
  const tones = { gold: "border-gold/30 bg-gold/5 text-gold", blue: "border-blue-400/30 bg-blue-400/5 text-blue-400",
    violet: "border-violet-400/30 bg-violet-400/5 text-violet-400", amber: "border-amber-400/30 bg-amber-400/5 text-amber-400" };
  return (
    <div className={cx("rounded-xl border p-2.5 flex gap-2.5", tones[tone])}>
      <Icon size={16} className="shrink-0 mt-0.5" />
      <div className="min-w-0">
        <div className="text-xs font-semibold text-gray-200">{title}</div>
        <div className="text-[11px] text-gray-400 leading-snug mt-0.5">{note}</div>
      </div>
    </div>
  );
}

const FC_ZOOMS = [3, 6, 12, 24, 48];

/** The candle being built right now next to the closed ones before it, with the previous candle's body marked
 *  (an engulfing has to close beyond it), the zone it is trading in and the plan's stop / target. Zoom −/+ changes how many
 *  closed candles are shown; the details underneath say what this candle still has to do to count. */
function FormingCandle({ brain, side, precision, nowMs }) {
  const [zi, setZi] = useState(1);
  const f = brain.forming;
  if (!f) return null;
  const pool = (brain.candles || []).map((c) => ({ t: c[0], o: c[1], h: c[2], l: c[3], c: c[4] }));
  const n = Math.min(FC_ZOOMS[zi], pool.length);
  const closed = pool.slice(-n);
  const bars = [...closed, { t: f.open_ts, o: f.o, h: f.h, l: f.l, c: f.c, forming: true }];
  const prev = closed[closed.length - 1];
  const atr = brain.atr || 0;
  const plan = side?.plan;
  const W = 320, H = 150, padR = 50, padT = 10, padB = 8;
  let lo = Math.min(...bars.map((b) => b.l)), hi = Math.max(...bars.map((b) => b.h));
  const span0 = Math.max(hi - lo, 1e-9);
  const z = side?.zone && side.zone.top >= lo - span0 && side.zone.bottom <= hi + span0 ? side.zone : null;
  if (z) { lo = Math.min(lo, z.bottom); hi = Math.max(hi, z.top); }
  const lv = [];
  if (plan) {
    [["SL", plan.stop, "#ff4d4f"], ["TP", plan.target, "#12b886"]].forEach(([t, v, c]) => {
      if (v != null && v >= lo - span0 * 0.6 && v <= hi + span0 * 0.6) { lv.push({ t, v, c }); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    });
  }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const bw = (W - padR) / bars.length, cw = bw * 0.58;
  const left = Math.max(0, f.open_ts + f.step - nowMs / 1000);
  const elapsedPct = Math.min(100, ((f.step - left) / f.step) * 100);
  const buy = side?.direction === "BUY";
  const rx = brain.fundamentals?.reaction;
  const nxt = brain.fundamentals?.next;

  // what this candle is doing + what it still has to do
  const body = Math.abs(f.c - f.o), rng = f.h - f.l;
  const up = f.c >= f.o;
  const upW = f.h - Math.max(f.o, f.c), dnW = Math.min(f.o, f.c) - f.l;
  const pTop = prev ? Math.max(prev.o, prev.c) : null, pBot = prev ? Math.min(prev.o, prev.c) : null;
  const ap = side?.approval;
  const need = prev && side ? (buy ? { px: pTop, txt: `close above ${fmtPrice(pTop, precision)} (prev body top)` } : { px: pBot, txt: `close below ${fmtPrice(pBot, precision)} (prev body bottom)` }) : null;
  const beats = need ? (buy ? f.c > need.px : f.c < need.px) : null;
  const zd = side?.zone ? (f.c > side.zone.top ? f.c - side.zone.top : f.c < side.zone.bottom ? side.zone.bottom - f.c : 0) : null;
  const facts = [
    ["Direction", `${up ? "bullish" : "bearish"} so far${atr > 0 ? ` · body ${(body / atr).toFixed(2)} ATR, range ${(rng / atr).toFixed(2)} ATR` : ""}`, up ? "text-bull" : "text-bear"],
    ["Wicks", `upper ${fmtPrice(upW, precision)} · lower ${fmtPrice(dnW, precision)}${rng > 0 ? ` (${Math.round((upW / rng) * 100)}% / ${Math.round((dnW / rng) * 100)}% of range)` : ""}`, "text-gray-300"],
    ["Progress", `${Math.round(elapsedPct)}% done · closes ${fmtTime(f.open_ts + f.step, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`, "text-gold"],
  ];
  if (need) facts.push(["To trigger", `${need.txt} - ${beats ? "ABOVE the line now, must hold to the close" : "not there yet"}`, beats ? (buy ? "text-bull" : "text-bear") : "text-gray-400"]);
  if (zd != null) facts.push(["Zone", zd === 0 ? "price is inside the zone" : `${fmtPrice(zd, precision)}${atr > 0 ? ` (${(zd / atr).toFixed(1)} ATR)` : ""} from the ${side.direction} zone`, zd === 0 ? "text-gold" : "text-gray-300"]);
  if (ap && ap.state !== "idle") facts.push(["Approval", ap.detail, "text-gray-300"]);
  if (plan?.stop != null && plan?.target != null) facts.push(["If it triggers", `stop ${fmtPrice(plan.stop, precision)} · target ${fmtPrice(plan.target, precision)}${plan.reward_r ? ` · ${plan.reward_r}R` : ""}`, "text-gray-300"]);
  if (nxt && nxt.start > nowMs / 1000) facts.push(["News", `${nxt.label} pauses signals in ${Math.max(0, Math.round((nxt.start - nowMs / 1000) / 60))} min`, "text-amber-400"]);
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1 gap-2">
        <span className="text-gray-400 flex items-center gap-1.5"><Hourglass size={12} className="text-gold" /> Candle being built</span>
        <span className="flex items-center gap-2">
          <ZoomBar onIn={() => setZi((v) => Math.max(0, v - 1))} onOut={() => setZi((v) => Math.min(FC_ZOOMS.length - 1, v + 1))} onFit={() => setZi(1)}
            canIn={zi > 0} canOut={zi < FC_ZOOMS.length - 1 && FC_ZOOMS[zi] < pool.length} label={`${n}+1`} />
          <span className="tabular-nums font-semibold text-gold">{mmss(left)} left</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-black/20 border border-border" role="img" aria-label="The forming candle next to the last closed candles">
        {z && <rect x="0" width={W - padR} y={y(z.top)} height={Math.max(2, y(z.bottom) - y(z.top))} fill={buy ? "#12b886" : "#ff4d4f"} opacity=".16" />}
        {z && <text x="3" y={y(z.top) + 8} fontSize="7.5" fill={buy ? "#12b886" : "#ff4d4f"} fontWeight="700">{side.direction} zone</text>}
        {lv.map((l) => (
          <g key={l.t}>
            <line x1="0" x2={W - padR} y1={y(l.v)} y2={y(l.v)} stroke={l.c} strokeWidth=".9" strokeDasharray="5 3" opacity=".85" />
            <text x={W - padR - 3} y={y(l.v) - 2} fontSize="7.5" fill={l.c} textAnchor="end" fontWeight="700">{l.t} {fmtPrice(l.v, precision)}</text>
          </g>
        ))}
        {rx && rx.release_ts >= bars[0].t && rx.base >= lo && rx.base <= hi && (
          <g><line x1="0" x2={W - padR} y1={y(rx.base)} y2={y(rx.base)} stroke="#a78bfa" strokeWidth=".8" strokeDasharray="4 3" />
            <text x="3" y={y(rx.base) - 2} fontSize="7.5" fill="#a78bfa">pre-news close</text></g>
        )}
        {prev && [pTop, pBot].map((v, i) => <line key={i} x1={bw * (bars.length - 2)} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#94a3b8" strokeWidth=".7" strokeDasharray="2 3" />)}
        {prev && <text x={W - padR + 3} y={y(pTop) + 3} fontSize="7.5" fill="#94a3b8">prev body top</text>}
        {prev && <text x={W - padR + 3} y={y(pBot) + 3} fontSize="7.5" fill="#94a3b8" opacity={Math.abs(y(pBot) - y(pTop)) < 9 ? 0 : 1}>prev body bot</text>}
        {bars.map((b, i) => {
          const upb = b.c >= b.o, col = upb ? "#12b886" : "#ff4d4f", cx0 = i * bw + bw / 2;
          const top = y(Math.max(b.o, b.c)), bot = y(Math.min(b.o, b.c));
          return (
            <g key={i}>
              <line x1={cx0} x2={cx0} y1={y(b.h)} y2={y(b.l)} stroke={col} strokeWidth={b.forming ? 1.6 : 1} />
              <rect x={cx0 - cw / 2} y={top} width={cw} height={Math.max(1.5, bot - top)} fill={col} fillOpacity={b.forming ? 0.35 : 1} stroke={col} strokeWidth={b.forming ? 1.6 : 0.6} strokeDasharray={b.forming ? "3 2" : undefined} />
              <title>{`${fmtTime(b.t, { hour: "2-digit", minute: "2-digit" })} O ${fmtPrice(b.o, precision)} H ${fmtPrice(b.h, precision)} L ${fmtPrice(b.l, precision)} C ${fmtPrice(b.c, precision)}`}</title>
            </g>
          );
        })}
        <rect x={W - padR + 1} y={y(f.c) - 7} width={padR - 2} height="14" rx="3" fill="#d4af37" />
        <text x={W - padR + 4} y={y(f.c) + 3} fontSize="9" fontWeight="700" fill="#000">{fmtPrice(f.c, precision)}</text>
      </svg>
      <div className="h-1 rounded-full bg-white/10 mt-1.5 overflow-hidden"><div className="h-full bg-gold/70 rounded-full transition-all" style={{ width: `${elapsedPct}%` }} /></div>
      <div className="flex justify-between text-[10px] text-gray-600 mt-0.5 tabular-nums">
        <span>O {fmtPrice(f.o, precision)} · H {fmtPrice(f.h, precision)} · L {fmtPrice(f.l, precision)} · C {fmtPrice(f.c, precision)}</span>
        <span>{brain.tf}</span>
      </div>
      <dl className="mt-2 space-y-0.5 text-[11px]">
        {facts.map(([k, v, c]) => (
          <div key={k} className="flex gap-2"><dt className="text-gray-500 shrink-0 w-[78px]">{k}</dt><dd className={cx("min-w-0 leading-snug", c)}>{v}</dd></div>
        ))}
      </dl>
      {rx && <ReactionNote r={rx} className="mt-2" />}
    </div>
  );
}

export default function BuildingPanel() {
  const { live, lastUpdate, prefs } = useLive();
  const now = useNow();
  const { view } = useView();
  const s = live?.signal;
  if (!s) return null;

  const brain = s.brain;
  const forming = s.forming;
  const h1p = s.h1_preview, onehp = s.one_h_preview, shift = s.entry_shift_preview, counter = s.counter_watch;
  if (!brain && !forming && !h1p && !onehp && !shift && !counter) return null;
  const p = symbolInfo(prefs.symbol).precision;

  // Remaining time on the still-open candle, ticked forward locally between polls so it never looks frozen.
  let countdown = null;
  if (forming?.remaining_sec != null && lastUpdate) {
    const drift = Math.floor((now - lastUpdate) / 1000);
    countdown = mmss(Math.max(0, forming.remaining_sec - drift));
  }

  const lead = brain?.sides?.[brain.lead];
  const other = brain ? brain.sides[brain.lead === "BUY" ? "SELL" : "BUY"] : null;
  const st = stateOf(lead);
  const live_ = lead && (lead.state === "ready" || lead.state === "fire");
  const recent = (brain?.recent_patterns || []).slice(-3).reverse();

  return (
    <Card title="Building now" icon={Radar} className={cx(live_ && (lead.counter ? "border-amber-400/50" : "border-bull/40"))}
      right={brain ? <span className="text-[10px] text-gray-500 tabular-nums">{brain.tf} · {symbolInfo(prefs.symbol).short}</span> : null}>
      <div className="space-y-3">
        {brain && <ViewToggles />}

        {lead && (
          <div className={cx("rounded-xl border p-3", st.box, live_ && (lead.counter ? "blink-counter" : st.blink))}>
            <div className="flex items-center gap-3">
              <PctRing value={lead.pct} size={72} color={st.hex} label="ready" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cx("text-lg font-black tracking-tight", lead.direction === "BUY" ? "text-bull" : "text-bear")}>{lead.direction}</span>
                  <Chip tone={lead.with_trend ? "gold" : "gray"}>{lead.with_trend ? "with the trend" : lead.counter ? "counter-trend" : "range"}</Chip>
                </div>
                <div className="mt-1"><StateBadge side={lead} /></div>
                <p className="text-[11px] text-gray-400 leading-snug mt-1.5">{lead.next}</p>
              </div>
            </div>
            <div className="mt-3"><StagePipeline stages={lead.stages} /></div>
            {other && (
              <div className="mt-2.5 flex items-center gap-2 text-[10px] text-gray-500 border-t border-border/60 pt-2">
                <span>Other side:</span>
                <span className={cx("font-bold", other.direction === "BUY" ? "text-bull" : "text-bear")}>{other.direction}</span>
                <span className="tabular-nums">{other.pct}%</span>
                <Chip tone={stateOf(other).chip}>{stateOf(other).short.toLowerCase()}</Chip>
                <span className="truncate">{other.next}</span>
              </div>
            )}
          </div>
        )}

        {brain && view.candles && <FormingCandle brain={brain} side={lead} precision={p} nowMs={now} />}
        {brain && view.patterns && (
          <div className="space-y-1.5">
            <ApprovalBar ap={lead?.approval} nowMs={now} />
            {recent.length > 0 && (
              <div className="text-[10px] text-gray-500 leading-relaxed">
                Recent trigger patterns:{" "}
                {recent.map((q, i) => (
                  <span key={i} className={cx("mr-2 whitespace-nowrap", q.dir === "BUY" ? "text-bull" : "text-bear")}>{q.dir === "BUY" ? "▲" : "▼"} {q.label} <span className="text-gray-600">{fmtTime(q.ts + brain.step, { hour: "2-digit", minute: "2-digit" })}</span></span>
                ))}
              </div>
            )}
          </div>
        )}
        {brain && view.confirm && lead && <ConfirmMeter confirm={lead.confirm} />}

        {(!brain || view.preview) && (
          <div className="space-y-2">
            {brain && <ShiftStrip shifts={brain.shifts} />}
            {forming && (
              <div className="rounded-xl border border-gold/30 bg-gold/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-gold">
                    <Hourglass size={13} />
                    {forming.status === "approaching_zone" ? "Approaching the zone" : "Trigger candle forming"}
                  </span>
                  {countdown && <Chip tone="gold">{countdown} left</Chip>}
                </div>
                <p className="text-[12px] text-gray-300 mt-1.5 leading-snug">{forming.direction} · {forming.detail}</p>
              </div>
            )}
            {h1p && <Row icon={Split} tone="blue" title={`4H-led preview - would be ${h1p.would_be_direction}`} note={h1p.note} />}
            {onehp && <Row icon={Split} tone="violet" title={`1H-led preview - would be ${onehp.would_be_direction}`} note={onehp.note} />}
            {shift && !brain && <Row icon={Zap} tone="amber" title={`Possible shift - ${shift.would_be_direction} (${shift.pattern})`} note={shift.note} />}
            {counter && !brain && <Row icon={AlertTriangle} tone="amber" title={`Counter-signal watch - ${counter.direction} forming too`} note={counter.note} />}
          </div>
        )}
      </div>
    </Card>
  );
}
