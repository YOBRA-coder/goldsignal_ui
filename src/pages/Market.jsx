import React from "react";
import MarketWatch, { Watchlist } from "../components/MarketWatch";
import SessionsPanel from "../components/SessionsPanel";

export default function Market() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <div className="xl:col-span-8"><MarketWatch full /></div>
      <div className="xl:col-span-4 space-y-4"><SessionsPanel /><Watchlist /></div>
    </div>
  );
}
