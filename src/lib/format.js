export const cx = (...a) => a.filter(Boolean).join(" ");

export function fmtPrice(v, p = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: p, maximumFractionDigits: p });
}

// ---- chart / display clock: my local time, UTC, or the MT5 server clock (New York + 7h = GMT+2/+3)
let TIME_MODE = "server";
export const setTimeMode = (m) => { TIME_MODE = m; };
export const getTimeMode = () => TIME_MODE;

function nyOffsetMs(ms) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "numeric",
    day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(new Date(ms));
  const g = (t) => +parts.find((p) => p.type === t).value;
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - Math.floor(ms / 1000) * 1000;
}
export function serverGmtOffset(ms = Date.now()) { return Math.round(nyOffsetMs(ms) / 3600000 + 7); }
export function timeModeLabel(mode = TIME_MODE) {
  if (mode === "utc") return "UTC";
  if (mode === "server") { const h = serverGmtOffset(); return `MT5 server (GMT${h >= 0 ? "+" : ""}${h})`; }
  return "My local time";
}

export function fmtTime(ts, opts = {}) {
  if (!ts) return "—";
  const ms = typeof ts === "number" ? ts * 1000 : new Date(ts).getTime();
  let d = new Date(ms), tz;
  if (TIME_MODE === "utc") tz = "UTC";
  else if (TIME_MODE === "server") { d = new Date(ms + nyOffsetMs(ms) + 7 * 3600000); tz = "UTC"; }
  return d.toLocaleString([], { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz, ...opts });
}

export function fmtDateTime(ts) {
  return fmtTime(ts, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function fmtAgo(ts) {
  if (!ts) return "";
  const t = typeof ts === "number" ? ts * 1000 : new Date(ts).getTime();
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function fmtCountdown(ts) {
  if (!ts) return "—";
  const s = Math.max(0, ts - Math.floor(Date.now() / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

export const biasColor = (b) =>
  b === "bullish" ? "text-bull" : b === "bearish" ? "text-bear" : "text-gray-400";

export function errText(err) {
  const d = err?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (d?.message) return d.message + (d.diagnostics?.length ? `  (${d.diagnostics[0]})` : "");
  if (err?.code === "ERR_NETWORK") return "Backend offline: cannot reach the API. Start it with ./run_backend.sh (port 8000).";
  return err?.message || "Something went wrong";
}
