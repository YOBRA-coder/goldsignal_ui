export const cx = (...a) => a.filter(Boolean).join(" ");

export function fmtPrice(v, p = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: p, maximumFractionDigits: p });
}

export function fmtTime(ts, opts = {}) {
  if (!ts) return "—";
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleString([], { hour: "2-digit", minute: "2-digit", hour12: false, ...opts });
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
  if (err?.code === "ERR_NETWORK") return "Cannot reach the backend (is uvicorn running on port 8000?)";
  return err?.message || "Something went wrong";
}
