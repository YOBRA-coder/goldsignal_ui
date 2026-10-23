import React from "react";
import { AlertTriangle, Hourglass, Radar, Split, Zap } from "lucide-react";
import { Card, Chip } from "./ui";
import { ApprovalBar, ConfirmMeter, PctRing, ShiftStrip, StagePipeline, StateBadge, ViewToggles } from "./BrainBits";
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

/** The candle being built right now next to the last five closed ones, with the previous candle's body marked
 *  (an engulfing has to close beyond it) and the zone it is trading in. */
function FormingCandle({ brain, side, precision, nowMs }) {
  const f = brain.forming;
  if (!f) return null;
  const closed = (brain.candles || []).slice(-6).map((c) => ({ o: c[1], h: c[2], l: c[3], c: c[4] }));
  const bars = [...closed, { o: f.o, h: f.h, l: f.l, c: f.c, forming: true }];
  const prev = closed[closed.length - 1];
  const W = 320, H = 132, padR = 50, padT = 10, padB = 8;
  let lo = Math.min(...bars.map((b) => b.l)), hi = Math.max(...bars.map((b) => b.h));
  const span0 = Math.max(hi - lo, 1e-9);
  const z = side?.zone && side.zone.top >= lo - span0 && side.zone.bottom <= hi + span0 ? side.zone : null;
  if (z) { lo = Math.min(lo, z.bottom); hi = Math.max(hi, z.top); }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const bw = (W - padR) / bars.length, cw = bw * 0.58;
  const left = Math.max(0, f.open_ts + f.step - nowMs / 1000);
  const elapsedPct = Math.min(100, ((f.step - left) / f.step) * 100);
  const buy = side?.direction === "BUY";
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-gray-400 flex items-center gap-1.5"><Hourglass size={12} className="text-gold" /> Candle being built</span>
        <span className="tabular-nums font-semibold text-gold">{mmss(left)} left</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-black/20 border border-border" role="img" aria-label="The forming candle next to the last closed candles">
        {z && <rect x="0" width={W - padR} y={y(z.top)} height={Math.max(2, y(z.bottom) - y(z.top))} fill={buy ? "#12b886" : "#ff4d4f"} opacity=".16" />}
        {prev && [prev.o, prev.c].map((v, i) => <line key={i} x1={bw * 5} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#94a3b8" strokeWidth=".7" strokeDasharray="2 3" />)}
        {prev && <text x={W - padR + 3} y={y(prev.o) + 3} fontSize="7.5" fill="#94a3b8">prev {prev.c >= prev.o ? "open" : "close"}</text>}
        {prev && <text x={W - padR + 3} y={y(prev.c) + 3} fontSize="7.5" fill="#94a3b8" opacity={Math.abs(y(prev.c) - y(prev.o)) < 9 ? 0 : 1}>prev {prev.c >= prev.o ? "close" : "open"}</text>}
        {bars.map((b, i) => {
          const up = b.c >= b.o, col = up ? "#12b886" : "#ff4d4f", cx0 = i * bw + bw / 2;
          const top = y(Math.max(b.o, b.c)), bot = y(Math.min(b.o, b.c));
          return (
            <g key={i}>
              <line x1={cx0} x2={cx0} y1={y(b.h)} y2={y(b.l)} stroke={col} strokeWidth={b.forming ? 1.6 : 1} />
              <rect x={cx0 - cw / 2} y={top} width={cw} height={Math.max(1.5, bot - top)} fill={b.forming ? col : col} fillOpacity={b.forming ? 0.35 : 1} stroke={col} strokeWidth={b.forming ? 1.6 : 0.6} strokeDasharray={b.forming ? "3 2" : undefined} />
            </g>
          );
        })}
        <rect x={W - padR + 1} y={y(f.c) - 7} width={padR - 2} height="14" rx="3" fill="#d4af37" />
        <text x={W - padR + 4} y={y(f.c) + 3} fontSize="9" fontWeight="700" fill="#000">{fmtPrice(f.c, precision)}</text>
      </svg>
      <div className="h-1 rounded-full bg-white/10 mt-1.5 overflow-hidden"><div className="h-full bg-gold/70 rounded-full transition-all" style={{ width: `${elapsedPct}%` }} /></div>
      <div className="flex justify-between text-[10px] text-gray-600 mt-0.5 tabular-nums">
        <span>O {fmtPrice(f.o, precision)} · H {fmtPrice(f.h, precision)} · L {fmtPrice(f.l, precision)}</span>
        <span>closes {fmtTime(f.open_ts + f.step, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      </div>
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
