import React from "react";
import { AlertsFeed, ActivityLog, HappeningNow, useBoardAndLog } from "../components/AlertsBoard";
import { useLive } from "../context/LiveContext";

export default function Alerts() {
  const { prefs } = useLive();
  const { board, log } = useBoardAndLog();
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
      <div className="space-y-4">
        <HappeningNow board={board} entryTF={prefs.entryTF} minAgreement={prefs.minAgreement} />
      </div>
      <div className="space-y-4">
        <AlertsFeed />
        <ActivityLog rows={log} entryTF={prefs.entryTF} />
      </div>
    </div>
  );
}
