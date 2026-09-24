import React, { useEffect, useState } from "react";
import { AlertTriangle, Hourglass, Radar, Split, Zap } from "lucide-react";
import { Card, Chip } from "./ui";
import { useLive } from "../context/LiveContext";
import { cx } from "../lib/format";

/** One-second local ticker so the countdown is always inline with the clock the user is actually
 * looking at right now, instead of only updating on the next 10s poll. */
function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

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

export default function BuildingPanel() {
  const { live, lastUpdate } = useLive();
  const now = useNow();
  const s = live?.signal;
  if (!s) return null;

  const forming = s.forming;
  const h1p = s.h1_preview, onehp = s.one_h_preview, shift = s.entry_shift_preview, counter = s.counter_watch;
  if (!forming && !h1p && !onehp && !shift && !counter) return null;

  // Remaining time on the still-open candle, ticked forward locally between polls so it never looks
  // frozen or drifts from the clock the person is watching.
  let countdown = null;
  if (forming?.remaining_sec != null && lastUpdate) {
    const drift = Math.floor((now - lastUpdate) / 1000);
    const left = Math.max(0, forming.remaining_sec - drift);
    const m = Math.floor(left / 60), sec = left % 60;
    countdown = `${m}:${String(sec).padStart(2, "0")}`;
  }

  return (
    <Card title="Building now" icon={Radar}>
      <div className="space-y-2">
        {forming && (
          <div className="rounded-xl border border-gold/30 bg-gold/5 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gold">
                <Hourglass size={13} />
                {forming.status === "approaching_zone" ? "Approaching the zone" : "Trigger candle forming"}
              </span>
              {countdown && <Chip tone="gold">{countdown} left</Chip>}
            </div>
            <p className="text-[12px] text-gray-300 mt-1.5 leading-snug">
              {forming.direction} · {forming.detail}
            </p>
          </div>
        )}
        {h1p && (
          <Row icon={Split} tone="blue" title={`4H-led preview - would be ${h1p.would_be_direction}`} note={h1p.note} />
        )}
        {onehp && (
          <Row icon={Split} tone="violet" title={`1H-led preview - would be ${onehp.would_be_direction}`} note={onehp.note} />
        )}
        {shift && (
          <Row icon={Zap} tone="amber" title={`Possible shift - ${shift.would_be_direction} (${shift.pattern})`} note={shift.note} />
        )}
        {counter && (
          <Row icon={AlertTriangle} tone="amber" title={`Counter-signal watch - ${counter.direction} forming too`} note={counter.note} />
        )}
      </div>
    </Card>
  );
}
