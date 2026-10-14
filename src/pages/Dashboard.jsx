import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import ChartPanel from "../components/ChartPanel";
import SignalCard from "../components/SignalCard";
import BuildingPanel from "../components/BuildingPanel";
import OpenTrades from "../components/OpenTrades";
import Outlook from "../components/Outlook";
import Checklist from "../components/Checklist";
import SessionsPanel from "../components/SessionsPanel";
import MarketWatch from "../components/MarketWatch";
import NewsPanel from "../components/NewsPanel";
import { Card, Chip, Empty } from "../components/ui";
import { useLive } from "../context/LiveContext";
import { fmtAgo, fmtPrice } from "../lib/format";

function RecentSignals() {
  const { history } = useLive();
  const rows = history.slice(0, 6);
  return (
    <Card title="Recent signals" right={<Link to="/signals" className="text-xs text-gold hover:underline">View all</Link>}>
      {!rows.length ? <Empty>No signals yet — they appear when every gate passes.</Empty> : (
        <ul className="divide-y divide-border/60">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              {r.status === "won" ? <CheckCircle2 size={18} className="text-bull shrink-0" />
                : r.status === "lost" ? <XCircle size={18} className="text-bear shrink-0" />
                : r.status === "breakeven" ? <CheckCircle2 size={18} className="text-gray-400 shrink-0" />
                : <span className="w-[18px] h-[18px] rounded-full border-2 border-gold/60 shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold"><span className={r.direction === "BUY" ? "text-bull" : "text-bear"}>{r.direction}</span> <span className="text-gray-400 font-normal">@ {fmtPrice(r.entry_price, 2)}</span></div>
                <div className="text-[11px] text-gray-500">{fmtAgo(r.created_at)} · {r.trade_type ? `${r.trade_type} · ` : ""}{r.agreement != null ? `${Math.round(r.agreement)}% agreement` : "—"}</div>
              </div>
              <Chip tone={r.status === "won" ? "bull" : r.status === "lost" ? "bear" : r.status === "open" ? "gold" : "gray"}>
                {r.status === "won" ? `+${r.result_r}R` : r.status === "lost" ? "-1R" : r.status === "breakeven" ? "BE 0R" : r.status}
              </Chip>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Dashboard() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="order-1 xl:order-none xl:col-span-4 xl:col-start-9 xl:row-start-1 space-y-4">
          <SignalCard />
          <BuildingPanel />
          <OpenTrades />
          <Outlook />
          <NewsPanel compact />
        </div>
        <div className="order-2 xl:order-none xl:col-span-8 xl:col-start-1 xl:row-start-1 xl:row-span-2 min-w-0">
          <ChartPanel />
        </div>
        <div className="order-3 xl:order-none xl:col-span-4 xl:col-start-9 xl:row-start-2">
          <SessionsPanel />
        </div>
      </div>
      <Checklist />
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        <MarketWatch />
        <RecentSignals />
      </div>
    </div>
  );
}
