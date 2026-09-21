import React from "react";
import { cx } from "../lib/format";

export function Card({ title, right, children, className = "", pad = true, icon: Icon }) {
  return (
    <section className={cx("bg-panel border border-border rounded-2xl", className)}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            {Icon && <Icon size={14} className="text-gold" />}
            {title}
          </h2>
          {right}
        </header>
      )}
      <div className={pad ? "px-4 pb-4" : ""}>{children}</div>
    </section>
  );
}

export function Chip({ children, tone = "gray", className = "" }) {
  const tones = {
    gray: "text-gray-300 bg-white/5 border-white/10",
    bull: "text-bull bg-bull/10 border-bull/30",
    bear: "text-bear bg-bear/10 border-bear/30",
    gold: "text-gold bg-gold/10 border-gold/30",
    amber: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    blue: "text-blue-400 bg-blue-400/10 border-blue-400/30",
    violet: "text-violet-400 bg-violet-400/10 border-violet-400/30",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Segmented({ options, value, onChange, size = "md", className = "" }) {
  return (
    <div className={cx("flex bg-panel2 border border-border rounded-lg p-0.5 overflow-x-auto no-scrollbar", className)}>
      {options.map((o) => {
        const v = o.value ?? o;
        const l = o.label ?? o;
        const on = v === value;
        return (
          <button key={v} onClick={() => onChange(v)}
            className={cx("rounded-md font-medium transition-colors whitespace-nowrap shrink-0",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              on ? "bg-gold text-black" : "text-gray-400 hover:text-gray-200")}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ on, onChange, label, hint }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center justify-between gap-3 w-full text-left py-2">
      <span>
        <span className="block text-sm text-gray-200">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
      <span className={cx("w-10 h-6 rounded-full p-0.5 transition-colors shrink-0", on ? "bg-bull" : "bg-gray-700")}>
        <span className={cx("block w-5 h-5 rounded-full bg-white transition-transform", on && "translate-x-4")} />
      </span>
    </button>
  );
}

export function Stat({ label, value, tone, sub }) {
  const t = { bull: "text-bull", bear: "text-bear", gold: "text-gold", amber: "text-amber-400" }[tone] || "text-gray-100";
  return (
    <div className="bg-panel border border-border rounded-xl p-3.5">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={cx("text-xl font-bold mt-0.5 tabular-nums", t)}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export function Spinner({ className = "" }) {
  return <div className={cx("w-5 h-5 rounded-full border-2 border-gray-600 border-t-gold animate-spin", className)} />;
}

export function Empty({ children }) {
  return <div className="text-sm text-gray-500 text-center py-8">{children}</div>;
}

export function Ring({ value, size = 76, tone = "gold", label = "agree" }) {
  const r = size / 2 - 6, c = 2 * Math.PI * r;
  const col = { bull: "#12b886", bear: "#ff4d4f", gold: "#d4af37", gray: "#4b5563" }[tone];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#232a35" strokeWidth="6" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth="6" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, value) / 100)} style={{ transition: "stroke-dashoffset .6s" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold leading-none tabular-nums">{Math.round(value)}%</span>
        <span className="text-[9px] uppercase tracking-wider text-gray-500 mt-0.5">{label}</span>
      </div>
    </div>
  );
}
