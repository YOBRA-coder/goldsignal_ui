import React from "react";
import { Check, Minus, X } from "lucide-react";
import { Card, Chip } from "./ui";
import { useLive } from "../context/LiveContext";
import { cx } from "../lib/format";

const GROUPS = [
  { step: 1, title: "4H · Set the direction", sub: "Market structure bias" },
  { step: 2, title: "4H · Mark the map", sub: "Zones, levels, room to target" },
  { step: 3, title: "1H · Find the setup", sub: "Must align with 4H · OB/FVG · liquidity" },
  { step: 4, title: "Entry TF · Pull the trigger", sub: "Confirmation · session · volume" },
];

function Icon({ ok }) {
  if (ok === null) return <span className="w-5 h-5 rounded-full bg-gray-700/50 flex items-center justify-center shrink-0"><Minus size={12} className="text-gray-500" /></span>;
  return ok
    ? <span className="w-5 h-5 rounded-full bg-bull/20 flex items-center justify-center shrink-0"><Check size={12} className="text-bull" /></span>
    : <span className="w-5 h-5 rounded-full bg-bear/15 flex items-center justify-center shrink-0"><X size={12} className="text-bear" /></span>;
}

export default function Checklist() {
  const { live } = useLive();
  const checks = live?.signal?.checks || [];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {GROUPS.map((g) => {
        const rows = checks.filter((c) => c.step === g.step);
        const done = rows.filter((r) => r.ok).length;
        return (
          <Card key={g.step} title={`${g.step} · ${g.title.split("· ")[1]}`}
            right={<Chip tone={done === rows.length && rows.length ? "bull" : "gray"}>{done}/{rows.length}</Chip>}>
            <div className="text-[11px] text-gray-500 -mt-1 mb-2">{g.title.split(" ·")[0]} · {g.sub}</div>
            <ul className="space-y-2.5">
              {rows.map((c) => (
                <li key={c.key} className="flex gap-2.5">
                  <Icon ok={c.ok} />
                  <div className="min-w-0">
                    <div className="text-[13px] text-gray-200 leading-tight flex flex-wrap items-center gap-1.5">
                      {c.label}
                      {c.gate && <span className="text-[9px] font-bold tracking-wide text-gold/80 border border-gold/30 rounded px-1">REQUIRED</span>}
                    </div>
                    <div className={cx("text-xs mt-0.5 leading-snug", c.ok ? "text-gray-400" : "text-gray-500")}>{c.detail}</div>
                  </div>
                </li>
              ))}
              {!rows.length && <li className="text-xs text-gray-600">Waiting for data…</li>}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
