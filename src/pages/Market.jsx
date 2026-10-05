import React from "react";
import MarketWatch, { Watchlist } from "../components/MarketWatch";
import MarketStory from "../components/MarketStory";
import OpenTrades from "../components/OpenTrades";
import SessionsPanel from "../components/SessionsPanel";

export default function Market() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <div className="xl:col-span-5 space-y-4"><MarketStory /></div>
      <div className="xl:col-span-4 min-w-0"><MarketWatch full /></div>
      <div className="xl:col-span-3 space-y-4"><OpenTrades allPairs /><SessionsPanel /><Watchlist /></div>
    </div>
  );
}
