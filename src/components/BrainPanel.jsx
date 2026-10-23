import React, { useState } from "react";
import { BrainCircuit, Check, X } from "lucide-react";
import { AlertPrefs, PctRing, StagePipeline, StateBadge } from "./BrainBits";
import { Chip, Segmented, Spinner } from "./ui";
import { stateOf } from "../lib/brain";
import { symbolInfo } from "../lib/constants";
import { cx, fmtPrice, fmtTime } from "../lib/format";

const Section = ({ children, right }) => (
  <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-gray-500 mt-4 mb-1.5"><span>{children}</span>{right}</div>
);

/** Half-circle gauge: SELL on the left, BUY on the right, needle at the brain's lean. */
function LeanGauge({ lean }) {
  const buy = lean.buy_pct;
  const ang = Math.PI * (1 - buy / 100);                // buy 100% -> 0 rad (right), 0% -> pi (left)
  const cx0 = 110, cy0 = 100, r = 80;
  const nx = cx0 + Math.cos(ang) * (r - 8), ny = cy0 - Math.sin(ang) * (r - 8);
  const arc = (a0, a1, col) => {
    const p = (a) => `${cx0 + Math.cos(a) * r} ${cy0 - Math.sin(a) * r}`;
    return <path d={`M${p(a0)} A${r} ${r} 0 0 1 ${p(a1)}`} stroke={col} strokeWidth="12" fill="none" opacity=".85" />;
  };
  const label = lean.side === "NONE" ? "NO CLEAR LEAN" : `${lean.side} LEAN`;
  return (
    <div className="text-center">
      <svg viewBox="0 0 220 118" className="w-full max-w-[260px] mx-auto" role="img" aria-label={`Brain lean ${buy}% buy`}>
        {arc(Math.PI, Math.PI * 0.62, "#ff4d4f")}
        {arc(Math.PI * 0.62, Math.PI * 0.38, "#4b5563")}
        {arc(Math.PI * 0.38, 0, "#12b886")}
        <line x1={cx0} y1={cy0} x2={nx} y2={ny} stroke="#fff" strokeWidth="3" strokeLinecap="round" style={{ transition: "all .6s" }} />
        <circle cx={cx0} cy={cy0} r="6" fill="#fff" />
        <text x="14" y="116" fontSize="10" fill="#ff4d4f" fontWeight="700">SELL {lean.sell_pct}%</text>
        <text x="206" y="116" fontSize="10" fill="#12b886" fontWeight="700" textAnchor="end">BUY {lean.buy_pct}%</text>
      </svg>
      <div className={cx("text-lg font-black -mt-1", lean.side === "BUY" ? "text-bull" : lean.side === "SELL" ? "text-bear" : "text-gray-300")}>{label}</div>
      <div className="text-[10px] text-gray-500">brain score BUY {lean.buy_score} · SELL {lean.sell_score} (of 100)</div>
    </div>
  );
}

/** Cone of where one entry-timeframe bar's volatility can take price over the next 12 bars, with the lead plan on it. */
function Scenario({ brain, side, precision }) {
  const sigma = brain.sigma_bar || brain.atr * 0.6;
  const N = 12, W = 320, H = 150, padR = 52;
  const p0 = brain.price, plan = side?.plan;
  const band = (k) => sigma * Math.sqrt(k);
  const vals = [p0 + 1.2 * band(N), p0 - 1.2 * band(N), plan?.stop, plan?.target, plan?.entry].filter((v) => v != null);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
  const y = (v) => 8 + (1 - (v - lo) / (hi - lo)) * (H - 16);
  const x = (k) => 6 + (k / N) * (W - padR - 12);
  const poly = (m) => Array.from({ length: N + 1 }, (_, k) => `${x(k)},${y(p0 + m * band(k))}`).join(" ");
  const poly2 = [...Array.from({ length: N + 1 }, (_, k) => `${x(k)},${y(p0 + band(k))}`), ...Array.from({ length: N + 1 }, (_, k) => `${x(N - k)},${y(p0 - band(N - k))}`)].join(" ");
  const tilt = side ? (side.direction === "BUY" ? 1 : -1) * (side.pct / 100) * 0.5 * band(N) : 0;
  const minutes = Math.round((N * brain.step) / 60);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-black/20 border border-border" role="img" aria-label="Scenario cone">
        <polygon points={poly2} fill="#3b82f6" opacity=".12" />
        <polyline points={poly(1)} fill="none" stroke="#3b82f6" strokeWidth=".8" opacity=".6" />
        <polyline points={poly(-1)} fill="none" stroke="#3b82f6" strokeWidth=".8" opacity=".6" />
        <line x1={x(0)} y1={y(p0)} x2={x(N)} y2={y(p0 + tilt)} stroke="#d4af37" strokeWidth="1.5" strokeDasharray="4 3" />
        {plan && [[plan.stop, "#ff4d4f", "SL"], [plan.target, "#12b886", "TP"], [plan.entry, "#d4af37", "entry"]].map(([v, c, t]) => (
          <g key={t}><line x1="0" x2={W - padR} y1={y(v)} y2={y(v)} stroke={c} strokeWidth="1" strokeDasharray="5 3" opacity=".8" />
            <text x={W - padR + 3} y={y(v) + 3} fontSize="8" fill={c}>{t} {fmtPrice(v, precision)}</text></g>
        ))}
        <circle cx={x(0)} cy={y(p0)} r="3.5" fill="#fff" />
        <text x={x(0) + 6} y={y(p0) - 5} fontSize="8" fill="#e5e7eb">now {fmtPrice(p0, precision)}</text>
      </svg>
      <p className="text-[10px] text-gray-600 mt-1 leading-snug">Blue = ±1σ range price can cover in the next {N} bars (~{minutes} min) if it moves randomly; the gold dashes lean it toward the {side?.direction || "lead"} side by the readiness. A scenario, not a forecast.</p>
    </div>
  );
}

/** BRAIN tab of the full-screen panel: lean, readiness, perfect-entry checklist, factors, pattern memory, fundamentals. */
export default function BrainPanel({ b, err, symbol }) {
  const info = symbolInfo(symbol);
  const brain = b?.signal?.brain;
  const [view, setView] = useState("lead");
  if (!b && !err) return <div className="flex items-center gap-2 text-gray-500 text-xs py-3"><Spinner /> Thinking…</div>;
  if (!brain) return <div className="text-xs text-amber-400">{err || "The brain has no read yet (it needs 4H / 1H / entry candles)."}</div>;
  const p = info.precision;
  const sideKey = view === "lead" ? brain.lead : view;
  const side = brain.sides[sideKey];
  const st = stateOf(side);
  const live = side.state === "ready" || side.state === "fire";
  const pf = brain.perfect;
  const perfectNow = pf.perfect && pf.direction === sideKey;
  const mem = side.memory;
  const fund = brain.fundamentals;
  return (
    <div className="text-xs">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-gray-300 font-bold text-sm"><BrainCircuit size={16} className="text-gold" /> Brain <span className="text-gray-500 font-normal text-[11px]">{info.short} · {brain.tf}</span></div>
        <AlertPrefs />
      </div>

      <LeanGauge lean={brain.lean} />

      <div className={cx("rounded-xl border p-3 mt-3", st.box, live && (side.counter ? "blink-counter" : st.blink))}>
        <div className="flex items-center gap-3">
          <PctRing value={side.pct} size={74} color={st.hex} label="ready" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cx("text-lg font-black", side.direction === "BUY" ? "text-bull" : "text-bear")}>{side.direction}</span>
              <Chip tone={side.with_trend ? "gold" : "gray"}>{side.with_trend ? "with the trend" : side.counter ? "counter-trend" : "range"}</Chip>
            </div>
            <div className="mt-1"><StateBadge side={side} /></div>
          </div>
        </div>
        <p className="text-[11px] text-gray-300 mt-2 leading-snug">{side.next}</p>
        <div className="mt-2.5"><StagePipeline stages={side.stages} compact /></div>
        {side.caution && <p className="text-[10px] text-amber-300/90 mt-2 leading-snug">{side.caution}</p>}
      </div>
      <div className="mt-2 flex justify-center">
        <Segmented size="sm" value={view} onChange={setView} options={[{ value: "lead", label: `Lead (${brain.lead})` }, { value: "BUY", label: "BUY" }, { value: "SELL", label: "SELL" }]} />
      </div>

      <Section right={<span className={cx("normal-case tracking-normal font-semibold", pf.perfect ? "text-bull blink-text" : "text-gray-400")}>{pf.passed}/{pf.total}{pf.perfect ? " · PERFECT ENTRY" : ""}</span>}>
        Perfect-entry checklist ({pf.direction})
      </Section>
      <ul className={cx("space-y-1.5 rounded-xl border p-2.5", perfectNow ? "border-bull/60 bg-bull/5 blink-ready" : "border-border")}>
        {pf.items.map((x) => (
          <li key={x.key} className="flex gap-2 text-[11px] leading-snug">
            {x.ok ? <Check size={13} className="text-bull shrink-0 mt-0.5" strokeWidth={3} /> : <X size={13} className="text-bear shrink-0 mt-0.5" />}
            <span className={x.ok ? "text-gray-200" : "text-gray-500"}>{x.label}</span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-gray-600 mt-1 leading-snug">It only calls an entry "perfect" when every line passes, including the engine's own signal. The brain never fires a trade by itself.</p>

      <Section right={<span className="normal-case tracking-normal font-semibold text-gray-300">score {side.brain_score}/100</span>}>What the brain weighs ({side.direction})</Section>
      <ul className="space-y-2">
        {side.factors.map((f) => (
          <li key={f.key}>
            <div className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="text-gray-200">{f.label}</span>
              <span className="text-gray-500 tabular-nums shrink-0">{f.weight}% · <span className={f.score >= 0.7 ? "text-bull" : f.score >= 0.4 ? "text-amber-400" : "text-bear"}>{Math.round(f.score * 100)}</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 mt-1 overflow-hidden"><div className={cx("h-full rounded-full", f.score >= 0.7 ? "bg-bull" : f.score >= 0.4 ? "bg-amber-400" : "bg-bear")} style={{ width: `${f.score * 100}%` }} /></div>
            <div className="text-[10px] text-gray-500 leading-snug mt-0.5">{f.detail}</div>
          </li>
        ))}
      </ul>

      <Section>Pattern memory - what happened after this before</Section>
      {mem && mem.n > 0 ? (
        <div className="rounded-xl border border-border p-2.5">
          <div className="flex items-end justify-between gap-2">
            <div><div className="text-2xl font-black tabular-nums">{mem.win_rate}%</div><div className="text-[10px] text-gray-500">hit +{mem.target_atr} ATR before -{mem.stop_atr} ATR within {mem.horizon_bars} bars</div></div>
            <div className="text-right"><div className="text-sm font-bold tabular-nums text-gray-300">{mem.baseline}%</div><div className="text-[10px] text-gray-500">random bar</div></div>
          </div>
          <div className="text-[11px] text-gray-400 mt-1.5">{mem.scope} · <b>{mem.n}</b> past cases · edge{" "}
            <b className={mem.edge > 0 ? "text-bull" : mem.edge < 0 ? "text-bear" : ""}>{mem.edge > 0 ? "+" : ""}{mem.edge} pts</b>
            {mem.expectancy_r != null && <> · {mem.expectancy_r > 0 ? "+" : ""}{mem.expectancy_r}R per trade before costs</>}
          </div>
          {!mem.enough && <div className="text-[10px] text-amber-400 mt-1">Fewer than 20 cases - too thin to lean on.</div>}
          {mem.families?.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {mem.families.map((f) => <li key={f.family} className="flex justify-between text-[10px] text-gray-500"><span>{f.family.replace(/_/g, " ")}</span><span className="tabular-nums">{f.win_rate}% · n={f.n}</span></li>)}
            </ul>
          )}
          <p className="text-[10px] text-gray-600 mt-1.5 leading-snug">From the {mem.sample_bars}+ stored candles of this pair / timeframe. In-sample and before spread: a hint about the pattern, not a promise.</p>
        </div>
      ) : <div className="text-[11px] text-gray-500">Not enough stored candles to study this pattern yet. History grows as the app runs (or import MT5 history).</div>}

      <Section>Fundamentals</Section>
      <div className={cx("rounded-xl border p-2.5", fund.blackout ? "border-bear/40 bg-bear/5" : "border-border")}>
        <div className="text-[11px] text-gray-300">{fund.note}</div>
        {fund.events.length > 0 && (
          <ul className="mt-1.5 divide-y divide-border/50">
            {fund.events.slice(0, 6).map((e, i) => (
              <li key={i} className="flex items-center gap-2 py-1 text-[11px]">
                <span className={cx("w-1.5 h-3 rounded-sm shrink-0", e.impact === "high" ? "bg-bear" : "bg-amber-400")} />
                <span className="tabular-nums text-gray-500 w-10 shrink-0">{fmtTime(e.ts, { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="truncate text-gray-300">{e.currency} {e.title}</span>
                <span className="ml-auto tabular-nums text-gray-500 shrink-0">{e.minutes >= 0 ? `in ${e.minutes}m` : `${-e.minutes}m ago`}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[10px] text-gray-600 mt-1.5">The brain can say WHEN news can move price, not which way - so news only lowers readiness, it never picks a side.</p>
      </div>

      <Section>Your track record on {info.short} {side.direction}</Section>
      <div className="text-[11px] text-gray-400">{side.track.n ? `${side.track.wins} won · ${side.track.losses} lost in the last ${side.track.days} days · ${side.track.net_r > 0 ? "+" : ""}${side.track.net_r}R net` : "No closed signals on this pair / direction yet."}</div>

      <Section>Scenario - next {brain.step * 12 / 60 | 0} minutes</Section>
      <Scenario brain={brain} side={side} precision={p} />

      <p className="text-[10px] text-gray-600 mt-4 leading-snug">{brain.disclaimer}</p>
    </div>
  );
}
