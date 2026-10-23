import { useEffect, useState } from "react";
import { useLive } from "../context/LiveContext";

/** One-second local ticker so countdowns and the "now" line never freeze between the 10 s polls. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Look + words for each readiness state the brain reports (see app/brain.py). */
export const STATE = {
  fire:     { label: "FIRED",          short: "FIRED",    hex: "#d4af37", chip: "gold",   box: "border-gold/60 bg-gold/10",         text: "text-gold",       blink: "blink-fire" },
  ready:    { label: "TRADEABLE NOW",  short: "READY",    hex: "#12b886", chip: "bull",   box: "border-bull/60 bg-bull/10",         text: "text-bull",       blink: "blink-ready" },
  armed:    { label: "ARMED",          short: "ARMED",    hex: "#f59e0b", chip: "amber",  box: "border-amber-400/40 bg-amber-400/5", text: "text-amber-400",  blink: "" },
  paused:   { label: "GATE CLOSED",    short: "PAUSED",   hex: "#f59e0b", chip: "amber",  box: "border-amber-400/30 bg-amber-400/5", text: "text-amber-300",  blink: "" },
  building: { label: "BUILDING",       short: "BUILDING", hex: "#3b82f6", chip: "blue",   box: "border-blue-400/25 bg-blue-400/5",   text: "text-blue-400",   blink: "" },
  watching: { label: "WATCHING",       short: "WATCHING", hex: "#94a3b8", chip: "gray",   box: "border-border bg-white/[0.02]",      text: "text-gray-300",   blink: "" },
  far:      { label: "FAR FROM SETUP", short: "FAR",      hex: "#4b5563", chip: "gray",   box: "border-border bg-white/[0.02]",      text: "text-gray-500",   blink: "" },
};
export const stateOf = (s) => STATE[s?.state] || STATE.far;
export const isTradeable = (s) => !!s && (s.state === "ready" || s.state === "fire");

/** Which sections of the Outlook / Building-now panels are visible. Remembered with the other prefs. */
export const VIEW_KEYS = [
  ["preview", "Preview", "Trade ladder and early heads-up previews"],
  ["timeline", "Timeline", "When things are expected: candle closes, sessions, setups, news"],
  ["candles", "Candles", "Live mini chart / the candle being built"],
  ["patterns", "Patterns", "Candle patterns seen and being approved"],
  ["confirm", "Confirm", "The confirmation checklist behind the trigger"],
];
export const DEFAULT_VIEW = { preview: true, timeline: true, candles: true, patterns: true, confirm: true };

export function useView() {
  const { prefs, setPref } = useLive();
  const view = { ...DEFAULT_VIEW, ...(prefs.outView || {}) };
  const toggle = (k) => setPref("outView", { ...view, [k]: !view[k] });
  const setAll = (on) => setPref("outView", Object.fromEntries(Object.keys(DEFAULT_VIEW).map((k) => [k, on])));
  return { view, toggle, setAll };
}

export function useBrain() {
  const { live } = useLive();
  return live?.signal?.brain || null;
}

export const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
