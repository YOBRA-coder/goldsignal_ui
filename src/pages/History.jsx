import React, { useEffect, useState } from "react";
import api from "../api";

const statusColor = {
  open: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  won: "text-bull bg-bull/10 border-bull/30",
  lost: "text-bear bg-bear/10 border-bear/30",
  cancelled: "text-gray-500 bg-gray-500/10 border-gray-500/30",
};

export default function History() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/signals/history", {
      params: filter ? { status_filter: filter } : {},
    });
    setRows(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const closeSignal = async (id, result) => {
    await api.post(`/signals/${id}/close`, null, { params: { result } });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Signal History</h1>
        <select
          className="bg-panel2 border border-border rounded-lg px-3 py-2 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-panel border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-panel2 text-gray-400 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Symbol</th>
              <th className="text-left px-4 py-3">Direction</th>
              <th className="text-left px-4 py-3">Entry</th>
              <th className="text-left px-4 py-3">SL</th>
              <th className="text-left px-4 py-3">TP</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Result R</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="text-center text-gray-500 py-8">No signals yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3 text-gray-400">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">{r.symbol}</td>
                <td className={`px-4 py-3 font-semibold ${r.direction === "BUY" ? "text-bull" : "text-bear"}`}>
                  {r.direction}
                </td>
                <td className="px-4 py-3 font-mono">{r.entry_price?.toFixed(2)}</td>
                <td className="px-4 py-3 font-mono">{r.stop_loss?.toFixed(2)}</td>
                <td className="px-4 py-3 font-mono">{r.take_profit?.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full border ${statusColor[r.status]}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono">{r.result_r ?? "—"}</td>
                <td className="px-4 py-3">
                  {r.status === "open" && (
                    <div className="flex gap-1">
                      <button onClick={() => closeSignal(r.id, "won")} className="text-xs px-2 py-1 rounded border border-bull/40 text-bull hover:bg-bull/10">Won</button>
                      <button onClick={() => closeSignal(r.id, "lost")} className="text-xs px-2 py-1 rounded border border-bear/40 text-bear hover:bg-bear/10">Lost</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
