import React, { useEffect, useState } from "react";
import { BellRing, Download, MonitorSmartphone, Share, SquarePlus } from "lucide-react";
import { Card, Chip, Toggle } from "./ui";
import { cx } from "../lib/format";
import { disablePush, enablePush, pushState, promptInstall, usePwa } from "../lib/pwa";
import { useLive } from "../context/LiveContext";

/** Small "Install" pill for the top bar (hidden once installed / when the browser cannot install). */
export function InstallButton({ className = "" }) {
  const { canInstall, installed } = usePwa();
  if (installed || !canInstall) return null;
  return (
    <button onClick={promptInstall} title="Install GoldSignal as an app"
      className={cx("flex items-center gap-1.5 h-10 px-3 rounded-xl border border-gold/50 bg-gold/10 text-gold text-xs font-semibold", className)}>
      <Download size={14} /> Install
    </button>
  );
}

/** Profile card: install the app + notifications that arrive even when it is closed. */
export default function InstallCard() {
  const { canInstall, installed, ios } = usePwa();
  const { sendTest } = useLive();
  const [push, setPush] = useState({ supported: false, subscribed: false });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { pushState().then(setPush); }, []);

  const toggle = async (on) => {
    setBusy(true); setMsg(null);
    try {
      if (on) { await enablePush(); setMsg("Background alerts are on for this device."); } else { await disablePush(); setMsg("Background alerts are off for this device."); }
    } catch (e) { setMsg(e?.message || "Could not change notifications."); }
    setPush(await pushState()); setBusy(false);
  };

  return (
    <Card title="Install as an app" icon={MonitorSmartphone}
      right={installed ? <Chip tone="bull">installed</Chip> : canInstall ? <Chip tone="gold">ready</Chip> : null}>
      <p className="text-xs text-gray-400 leading-snug">
        GoldSignal opens in its own window like a normal app, starts instantly, keeps working on a weak connection (charts need the network for live prices),
        and can push signal / TP / SL / news alerts to your phone even when it is closed.
      </p>
      {!installed && canInstall && (
        <button onClick={promptInstall} className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl bg-gold text-black font-bold text-sm"><Download size={16} /> Install GoldSignal</button>
      )}
      {!installed && !canInstall && ios && (
        <div className="mt-3 text-xs text-gray-300 rounded-xl border border-border p-3 space-y-1.5">
          <div className="font-semibold text-gray-100">On iPhone / iPad (Safari):</div>
          <div className="flex items-center gap-1.5">1. Tap <Share size={14} className="text-gold" /> Share</div>
          <div className="flex items-center gap-1.5">2. Choose <SquarePlus size={14} className="text-gold" /> Add to Home Screen</div>
          <div>3. Open GoldSignal from the Home Screen, then switch on background alerts below (needs iOS 16.4+).</div>
        </div>
      )}
      {!installed && !canInstall && !ios && (
        <p className="mt-3 text-xs text-gray-500">Not offered right now: open the app over <b>https</b> (or localhost) in Chrome / Edge / Samsung Internet. You can also use the browser menu → "Install app" / "Add to Home screen".</p>
      )}
      <div className="mt-4 border-t border-border/60 pt-3">
        <Toggle on={push.subscribed} onChange={(v) => !busy && toggle(v)} label="Background alerts on this device"
          hint={push.supported ? "Signals, TP / SL, news warnings - delivered even when the app is closed" : "Not supported in this browser (on iPhone install to the Home Screen first)"} />
        {push.subscribed && (
          <button onClick={() => sendTest("signal")} className="mt-2 text-xs px-3 py-1.5 rounded-lg border border-border hover:border-gold/50 flex items-center gap-1.5"><BellRing size={12} /> Send a test (close the app to see it arrive)</button>
        )}
        {msg && <div className="text-xs text-gray-400 mt-2">{msg}</div>}
        <p className="text-[11px] text-gray-600 mt-2">The server keeps scanning while the app is closed, so these alerts come from the backend: it must be running and reachable over https.</p>
      </div>
    </Card>
  );
}
