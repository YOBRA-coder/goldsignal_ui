import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, Check, X, Minus } from "lucide-react";
import api from "../api";
import { Card, Chip, Empty, Segmented, Stat } from "../components/ui";
import { useLive } from "../context/LiveContext";
import { cx, errText, fmtDateTime, fmtPrice } from "../lib/format";
import { symbolInfo } from "../lib/constants";

const FILTERS = [{ value: "all", label: "All" }, { value: "open", label: "Open" }, { value: "won", label: "Won" },
  { value: "lost", label: "Lost" }, { value: "expired", label: "Expired" }];

function Detail({ id }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get(`/signals/${id}/checks`).then((r) => setRows(r.data.checks)).catch(() => setRows([])); }, [id]);
  if (!rows) return <div className="text-xs text-gray-500 py-2">Loading…</div>;
  if (!rows.length) return <div className="text-xs text-gray-500 py-2">No checklist stored for this (older) signal.</div>;
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 py-2">
      {rows.map((c) => (
        <li key={c.key} className="flex gap-2 text-xs">
          {c.ok === null ? <Minus size={14} className="text-gray-500 shrink-0" /> : c.ok ? <Check size={14} className="text-bull shrink-0" /> : <X size={14} className="text-bear shrink-0" />}
          <span><span className="text-gray-300">{c.label}</span><span className="text-gray-500"> — {c.detail}</span></span>
        </li>
      ))}
    </ul>
  );
}

export default function Signals() {
  const { history, fetchHistory } = useLive();
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null);
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => { api.get("/profile/me").then((r) => setStats(r.data)).catch(() => {}); }, [history]);

  const rows = useMemo(() => history.filter((r) => filter === "all" || r.status === filter), [history, filter]);

  async function close(id, result) {
    setBusy(id); setErr(null);
    try { await api.post(`/signals/${id}/close`, null, { params: { result } }); await fetchHistory(); }
    catch (e) { setErr(errText(e)); } finally { setBusy(null); }
  }

  const badge = (r) => (
    <Chip tone={r.status === "won" ? "bull" : r.status === "lost" ? "bear" : r.status === "open" ? "gold" : "gray"}>
      {r.status === "won" ? `WON +${r.result_r}R` : r.status === "lost" ? "LOST -1R" : r.status.toUpperCase()}
    </Chip>
  );

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <Stat label="Win rate" value={`${stats.win_rate}%`} tone={stats.win_rate >= 40 ? "bull" : "amber"} sub={`${stats.won}W / ${stats.lost}L`} />
          <Stat label="Net R" value={`${stats.net_r > 0 ? "+" : ""}${stats.net_r}R`} tone={stats.net_r >= 0 ? "bull" : "bear"} />
          <Stat label="Open" value={stats.open_signals} tone="gold" />
          <Stat label="Total" value={stats.total_signals} />
          <Stat label="Expired" value={stats.expired} />
          <Stat label="Avg agreement" value={`${stats.avg_agreement}%`} />
        </div>
      )}
      <Card title="Signal history" right={<Segmented size="sm" options={FILTERS} value={filter} onChange={setFilter} />}>
        {err && <div className="text-sm text-bear mb-2">{err}</div>}
        {!rows.length ? <Empty>No signals in this view yet.</Empty> : (
          <ul className="divide-y divide-border/60">
            {rows.map((r) => {
              const p = symbolInfo(r.symbol).precision;
              return (
                <li key={r.id} className="py-3">
                  <button className="w-full text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
                    <div className="flex items-center gap-3">
                      <span className={cx("text-lg font-black w-14", r.direction === "BUY" ? "text-bull" : "text-bear")}>{r.direction}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium flex flex-wrap items-center gap-x-2">
                          {r.symbol} <span className="text-gray-500 font-normal">{r.entry_interval || ""}</span>
                          {r.agreement != null && <span className="text-xs text-gold">{Math.round(r.agreement)}% · {r.grade}</span>}
                        </div>
                        <div className="text-[11px] text-gray-500">{fmtDateTime(r.created_at)}{r.session_label ? ` · ${r.session_label}` : ""}</div>
                      </div>
                      <div className="hidden md:grid grid-cols-3 gap-6 text-sm tabular-nums text-right">
                        <span><span className="block text-[10px] text-gray-500 uppercase">Entry</span>{fmtPrice(r.entry_price, p)}</span>
                        <span><span className="block text-[10px] text-gray-500 uppercase">SL</span><span className="text-bear">{fmtPrice(r.stop_loss, p)}</span></span>
                        <span><span className="block text-[10px] text-gray-500 uppercase">TP</span><span className="text-bull">{fmtPrice(r.take_profit, p)}</span></span>
                      </div>
                      {badge(r)}
                      <ChevronDown size={16} className={cx("text-gray-500 transition-transform", open === r.id && "rotate-180")} />
                    </div>
                    <div className="md:hidden grid grid-cols-3 gap-2 mt-2 text-xs tabular-nums">
                      <span><span className="text-gray-500">E </span>{fmtPrice(r.entry_price, p)}</span>
                      <span><span className="text-gray-500">SL </span><span className="text-bear">{fmtPrice(r.stop_loss, p)}</span></span>
                      <span><span className="text-gray-500">TP </span><span className="text-bull">{fmtPrice(r.take_profit, p)}</span></span>
                    </div>
                  </button>
                  {open === r.id && (
                    <div className="mt-2 pl-1">
                      <Detail id={r.id} />
                      {r.status === "open" && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-xs text-gray-500 self-center">Auto-tracked. Manual override:</span>
                          {["won", "lost", "cancelled"].map((x) => (
                            <button key={x} disabled={busy === r.id} onClick={() => close(r.id, x)}
                              className="text-xs px-3 py-1.5 rounded-lg border border-border hover:border-gold/50 capitalize">{x === "cancelled" ? "Cancel" : `Mark ${x}`}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
