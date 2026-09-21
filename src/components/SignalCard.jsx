import React, { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, Minus, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Card, Chip, Ring } from "./ui";
import { useLive } from "../context/LiveContext";
import { symbolInfo, SESSION_LABELS } from "../lib/constants";
import { cx, fmtAgo, fmtDateTime, fmtPrice, fmtTime } from "../lib/format";

const STEPS = ["4H direction", "4H map", "1H setup", "Entry trigger"];

export default function SignalCard() {
  const { live, prefs, loading, error } = useLive();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 15000); return () => clearInterval(t); }, []);
  const s = live?.signal;
  const p = symbolInfo(prefs.symbol).precision;

  if (!s) {
    return (
      <Card title="Signal" icon={Target}>
        <div className="py-6 text-sm text-gray-500 text-center">{loading ? "Analysing 4H → 1H → entry…" : error || "No data yet"}</div>
      </Card>
    );
  }

  const buy = s.direction === "BUY", sell = s.direction === "SELL";
  const tone = buy ? "bull" : sell ? "bear" : "gray";
  const showPlan = (buy || sell) || (s.entry_price && s.zone);
  const planDir = buy || sell ? s.direction : s.bias_4h === "bullish" ? "BUY" : "SELL";

  return (
    <Card title="Signal" icon={Target}
      right={<Chip tone={s.session?.allowed ? "bull" : "gray"}><Clock size={11} /> {s.session?.label}</Chip>}
      className={cx(buy && "border-bull/40", sell && "border-bear/40")}>
      <div className="flex items-center gap-4">
        <Ring value={s.agreement} tone={buy ? "bull" : sell ? "bear" : s.agreement >= prefs.minAgreement ? "gold" : "gray"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cx("text-3xl font-black tracking-tight", buy ? "text-bull" : sell ? "text-bear" : "text-gray-300")}>
              {s.direction}
            </span>
            {buy && <ArrowUpRight className="text-bull" size={26} />}
            {sell && <ArrowDownRight className="text-bear" size={26} />}
            {!buy && !sell && <Minus className="text-gray-500" size={22} />}
            <Chip tone={s.grade === "A+" ? "gold" : s.grade === "A" ? "bull" : "gray"}>Grade {s.grade}</Chip>
          </div>
          <p className="text-[13px] text-gray-300 leading-snug mt-1">{s.headline}</p>
        </div>
      </div>

      {/* 4-step progress */}
      <div className="grid grid-cols-4 gap-1.5 mt-4">
        {STEPS.map((name, i) => {
          const ok = s.steps_ok?.[i] && i < s.stage;
          const cur = i === s.stage;
          return (
            <div key={name} className={cx("rounded-lg border px-1.5 py-1.5 text-center",
              ok ? "border-bull/40 bg-bull/10" : cur ? "border-gold/40 bg-gold/5" : "border-border")}>
              <div className={cx("text-[10px] font-bold", ok ? "text-bull" : cur ? "text-gold" : "text-gray-600")}>
                {ok ? <CheckCircle2 size={12} className="inline" /> : `STEP ${i + 1}`}
              </div>
              <div className="text-[10px] text-gray-400 leading-tight mt-0.5">{name}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-4 text-sm">
        <Row k="4H bias" v={<span className={s.bias_4h === "bullish" ? "text-bull" : s.bias_4h === "bearish" ? "text-bear" : "text-gray-400"}>{s.bias_4h}</span>} />
        <Row k="1H bias" v={<span className={s.bias_1h === "bullish" ? "text-bull" : s.bias_1h === "bearish" ? "text-bear" : "text-gray-400"}>{s.bias_1h}</span>} />
        <Row k="Agreement" v={`${s.agreement}% (min ${prefs.minAgreement}%)`} />
        <Row k="Price" v={fmtPrice(s.last_price, p)} />
      </div>

      {showPlan && (
        <div className={cx("mt-4 rounded-xl border p-3", planDir === "BUY" ? "border-bull/30 bg-bull/5" : "border-bear/30 bg-bear/5")}>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-gray-400 mb-2">
            <span className="flex items-center gap-1">{planDir === "BUY" ? <TrendingUp size={13} /> : <TrendingDown size={13} />} Trade plan {!(buy || sell) && "(preview – not confirmed)"}</span>
            <span>R:R 1:{s.rr}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Level k="Entry" v={fmtPrice(s.entry_price, p)} c="text-gold" />
            <Level k="Stop" v={fmtPrice(s.stop_loss, p)} c="text-bear" />
            <Level k="Target" v={fmtPrice(s.take_profit, p)} c="text-bull" />
          </div>
          {s.risk != null && <div className="text-[11px] text-gray-500 mt-2 text-center">Risk {s.risk.toFixed(p)} pts per unit</div>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        {(buy || sell) ? (
          <>
            <span>Signal time <b className="text-gray-300">{fmtDateTime(s.signal_time)}</b></span>
            <span>· {fmtAgo(s.signal_time)}</span>
            {s.age_bars > 0 && <span>· {s.age_bars} bar{s.age_bars > 1 ? "s" : ""} old</span>}
          </>
        ) : (
          <span>Checked {fmtTime(live.updated_at)} · last closed {prefs.entryTF} candle {fmtTime(s.candle_ts)}</span>
        )}
        {s.session?.active?.length > 0 && <span>· {s.session.active.map((k) => SESSION_LABELS[k] || k).join(" + ")}</span>}
      </div>
    </Card>
  );
}

const Row = ({ k, v }) => (
  <div className="flex justify-between gap-2 border-b border-border/60 py-1"><span className="text-gray-500">{k}</span><span className="tabular-nums capitalize">{v}</span></div>
);
const Level = ({ k, v, c }) => (
  <div><div className="text-[10px] uppercase text-gray-500">{k}</div><div className={cx("text-base font-bold tabular-nums", c)}>{v}</div></div>
);
