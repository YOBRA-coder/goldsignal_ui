import React, { useEffect, useState } from "react";
import { Bell, Cog, HeartPulse, LogOut, Volume2 } from "lucide-react";
import api from "../api";
import { useAuth } from "../context/AuthContext.jsx";
import { useLive } from "../context/LiveContext";
import { Card, Chip, Segmented, Stat, Toggle } from "../components/ui";
import { cx, errText } from "../lib/format";

export default function Profile() {
  const { logout } = useAuth();
  const { prefs, setPref, enableDesktop, sendTest } = useLive();
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [hbusy, setHbusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => { api.get("/profile/me").then((r) => setStats(r.data)).catch(() => {}); }, []);

  const perm = "Notification" in window ? Notification.permission : "unsupported";

  async function checkFeed() {
    setHbusy(true);
    try { const { data } = await api.get("/market/health", { params: { symbol: prefs.symbol } }); setHealth(data); }
    catch (e) { setHealth({ ok: false, hint: errText(e), methods: [] }); } finally { setHbusy(false); }
  }
  async function desktop() {
    const r = await enableDesktop();
    setNote(r === "granted" ? "Desktop notifications enabled." : r === "unsupported" ? "This browser doesn't support notifications." : "Permission was not granted — allow notifications for this site in your browser settings.");
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="space-y-4">
        <Card title="Account">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gold/15 text-gold flex items-center justify-center text-xl font-bold">{stats?.user?.name?.[0]?.toUpperCase()}</div>
            <div className="min-w-0 flex-1"><div className="font-semibold">{stats?.user?.name}</div><div className="text-sm text-gray-500 truncate">@{stats?.user?.username} · {stats?.user?.email}</div></div>
            <button onClick={logout} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-bear border border-border rounded-lg px-3 py-2"><LogOut size={14} /> Log out</button>
          </div>
        </Card>
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Signals" value={stats.total_signals} />
            <Stat label="Win rate" value={`${stats.win_rate}%`} tone="gold" sub={`${stats.won}W / ${stats.lost}L`} />
            <Stat label="Net R" value={`${stats.net_r > 0 ? "+" : ""}${stats.net_r}R`} tone={stats.net_r >= 0 ? "bull" : "bear"} />
            <Stat label="Open" value={stats.open_signals} />
          </div>
        )}
        <Card title="Alerts" icon={Bell}>
          <Toggle on={prefs.sound} onChange={(v) => setPref("sound", v)} label="Sound alerts" hint="Different tones for a new signal, a take-profit win and a stop-loss loss" />
          <div className="flex items-center justify-between gap-3 py-2">
            <span><span className="block text-sm text-gray-200">Desktop / phone notifications</span>
              <span className="block text-xs text-gray-500">Status: {perm === "granted" && prefs.notify ? "on" : perm === "denied" ? "blocked in browser" : "off"}</span></span>
            <button onClick={desktop} className="text-sm px-3 py-1.5 rounded-lg border border-gold/50 text-gold shrink-0">Enable</button>
          </div>
          {note && <div className="text-xs text-gray-400">{note}</div>}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs text-gray-500 self-center">Send test:</span>
            {[["signal", "Signal"], ["win", "Win (TP)"], ["loss", "Loss (SL)"]].map(([k, l]) => (
              <button key={k} onClick={() => sendTest(k)} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:border-gold/50 flex items-center gap-1"><Volume2 size={12} />{l}</button>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-3">Alerts are generated while GoldSignal is open in a browser tab (it checks the market every 15 s and tracks every open signal for TP / SL).</p>
        </Card>
      </div>

      <div className="space-y-4">
        <Card title="Strategy settings" icon={Cog}>
          <label className="block text-sm text-gray-300">Minimum agreement to fire a signal — <b className="text-gold">{prefs.minAgreement}%</b>
            <input type="range" min="40" max="95" step="5" value={prefs.minAgreement} onChange={(e) => setPref("minAgreement", +e.target.value)} className="w-full mt-2" />
            <span className="block text-xs text-gray-500">Higher = fewer but better-aligned setups. Mandatory gates always apply.</span>
          </label>
          <label className="block text-sm text-gray-300 mt-4">Risk : reward — <b className="text-gold">1 : {prefs.rr}</b>
            <input type="range" min="1" max="5" step="0.5" value={prefs.rr} onChange={(e) => setPref("rr", +e.target.value)} className="w-full mt-2" />
          </label>
          <div className="mt-3"><Toggle on={prefs.sessionsOnly} onChange={(v) => setPref("sessionsOnly", v)} label="London / New York sessions only" hint="Blocks signals outside those sessions (recommended)" /></div>
          <div className="mt-2 text-sm text-gray-300">Default entry timeframe
            <Segmented className="mt-2 w-fit" options={["5m", "15m", "30m"]} value={prefs.entryTF} onChange={(v) => setPref("entryTF", v)} />
          </div>
        </Card>
        <Card title="Data feed" icon={HeartPulse}
          right={<button onClick={checkFeed} disabled={hbusy} className="text-xs px-3 py-1.5 rounded-lg border border-gold/50 text-gold">{hbusy ? "Testing…" : "Test connection"}</button>}>
          <p className="text-xs text-gray-500">Tries every download method against Yahoo Finance and shows which one works — use this if you see a "Data feed problem" banner.</p>
          {health && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2"><Chip tone={health.ok ? "bull" : "bear"}>{health.ok ? "Feed OK" : "Feed FAILED"}</Chip>{health.yfinance_version && <span className="text-xs text-gray-500">yfinance {health.yfinance_version}</span>}{health.demo && <Chip tone="amber">demo mode</Chip>}</div>
              {health.methods.map((m) => (
                <div key={m.method} className={cx("text-xs font-mono rounded-lg px-2.5 py-1.5 border break-words", m.ok ? "border-bull/30 text-bull" : "border-bear/30 text-bear")}>
                  {m.method}: {m.ok ? `ok · ${m.rows ?? ""} rows · ${m.ms}ms` : m.error}
                </div>
              ))}
              {health.hint && <div className="text-xs text-amber-400">{health.hint}</div>}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
