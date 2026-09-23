import React, { useEffect, useState } from "react";
import { Bell, Cog, HeartPulse, LogOut, MonitorSmartphone, Volume2 } from "lucide-react";
import api from "../api";
import { useAuth } from "../context/AuthContext.jsx";
import { useLive } from "../context/LiveContext";
import { Card, Chip, Segmented, Stat, Toggle } from "../components/ui";
import { cx, errText, fmtAgo, fmtPrice, timeModeLabel } from "../lib/format";
import { symbolInfo } from "../lib/constants";

export default function Profile() {
  const { logout } = useAuth();
  const { prefs, setPref, enableDesktop, sendTest, bumpData } = useLive();
  const [mt5, setMt5] = useState(null);
  const [mt5Price, setMt5Price] = useState("");
  const [mt5Msg, setMt5Msg] = useState(null);
  const p = symbolInfo(prefs.symbol).precision;
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [hbusy, setHbusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => { api.get("/profile/me").then((r) => setStats(r.data)).catch(() => {}); }, []);

  const loadMt5 = React.useCallback(() => {
    api.get("/market/settings", { params: { symbol: prefs.symbol } }).then((r) => setMt5(r.data)).catch(() => setMt5(null));
  }, [prefs.symbol]);
  useEffect(() => { loadMt5(); }, [loadMt5]);

  async function setAnchor(anchor) {
    setMt5Msg(null);
    try {
      await api.post("/market/anchor", { anchor }, { params: { symbol: prefs.symbol } });
      setPref("timeMode", anchor === "utc" ? "utc" : "server");
      bumpData(); loadMt5();
    } catch (e) { setMt5Msg(errText(e)); }
  }
  async function calibrate(reset = false) {
    setMt5Msg(null);
    try {
      const price = reset ? null : parseFloat(mt5Price);
      if (!reset && !(price > 0)) { setMt5Msg("Type the price you see in MT5 right now."); return; }
      const { data } = await api.post("/market/calibrate", { symbol: prefs.symbol, mt5_price: price });
      setMt5(data); setMt5Price(""); bumpData();
      setMt5Msg(reset ? "Offset removed - showing raw Yahoo prices." : `Done. All candles, zones and signals for this symbol are now shifted by ${data.offset >= 0 ? "+" : ""}${data.offset.toFixed(p)}.`);
    } catch (e) { setMt5Msg(errText(e)); }
  }

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
        <Card title="Match MetaTrader 5" icon={MonitorSmartphone}>
          <p className="text-xs text-gray-500 mb-3">Yahoo is not your broker's feed. Four things make charts differ from MT5 — fix each one here:</p>

          <div className="text-sm text-gray-200 font-medium">1 · Instrument</div>
          {prefs.symbol === "GC=F" ? (
            <div className="text-xs text-amber-400 mt-1">You are on <b>GC=F (COMEX futures)</b> — it trades ~$20-40 above MT5's spot XAUUSD. Use Gold Spot, or calibrate below.
              <button onClick={() => setPref("symbol", "XAUUSD=X")} className="ml-2 underline text-gold">Switch to Gold Spot</button></div>
          ) : <div className="text-xs text-gray-500 mt-1">{symbolInfo(prefs.symbol).note}</div>}

          <div className="text-sm text-gray-200 font-medium mt-4">2 · Candle times (4H / Daily / Weekly boundaries)</div>
          <Segmented className="mt-2 w-fit" value={mt5?.anchor || "ny_close"} onChange={setAnchor}
            options={[{ value: "ny_close", label: "NY close · GMT+2/+3" }, { value: "utc", label: "UTC · GMT+0" }]} />
          <div className="text-[11px] text-gray-500 mt-1.5">Look at a 4H candle on your MT5 chart: if a new day starts when the clock says 00:00 and the server is GMT+2/+3 (most brokers) choose <b>NY close</b>; if the server is GMT+0 choose <b>UTC</b>.</div>

          <div className="text-sm text-gray-200 font-medium mt-4">3 · Clock shown on charts</div>
          <Segmented className="mt-2 w-fit" value={prefs.timeMode} onChange={(v) => { setPref("timeMode", v); bumpData(); }}
            options={[{ value: "server", label: "MT5 server" }, { value: "utc", label: "UTC" }, { value: "local", label: "My time" }]} />
          <div className="text-[11px] text-gray-500 mt-1.5">Now showing: <b className="text-gray-300">{timeModeLabel(prefs.timeMode)}</b>. Candle timestamps then read exactly like your MT5 chart.</div>

          <div className="text-sm text-gray-200 font-medium mt-4">4 · Price calibration ({symbolInfo(prefs.symbol).short})</div>
          {mt5 && (
            <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs">
              <div className="bg-panel2 rounded-lg p-2"><div className="text-gray-500">Yahoo</div><div className="tabular-nums text-sm">{fmtPrice(mt5.yahoo_price, p)}</div></div>
              <div className="bg-panel2 rounded-lg p-2"><div className="text-gray-500">Offset</div><div className={cx("tabular-nums text-sm", mt5.offset ? "text-gold" : "")}>{mt5.offset >= 0 ? "+" : ""}{Number(mt5.offset).toFixed(p)}</div></div>
              <div className="bg-panel2 rounded-lg p-2"><div className="text-gray-500">Shown in app</div><div className="tabular-nums text-sm">{fmtPrice(mt5.adjusted_price, p)}</div></div>
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <input value={mt5Price} onChange={(e) => setMt5Price(e.target.value)} inputMode="decimal" placeholder={`Price in MT5 now, e.g. ${mt5?.yahoo_price ? fmtPrice(mt5.yahoo_price, p) : "3340.25"}`}
              className="flex-1 min-w-0 h-10 bg-panel2 border border-border rounded-lg px-3 text-sm outline-none focus:border-gold" />
            <button onClick={() => calibrate(false)} className="h-10 px-4 rounded-lg bg-gold text-black text-sm font-bold shrink-0">Calibrate</button>
            {mt5?.offset ? <button onClick={() => calibrate(true)} className="h-10 px-3 rounded-lg border border-border text-sm text-gray-300 shrink-0">Reset</button> : null}
          </div>
          {mt5?.offset_set_at && <div className="text-[11px] text-gray-500 mt-1.5">Calibrated {fmtAgo(mt5.offset_set_at)}. Re-calibrate now and then (futures basis and broker spread drift). Do it while no signal is open.</div>}
          {mt5Msg && <div className="text-xs text-gray-300 mt-2">{mt5Msg}</div>}
          <div className="text-[11px] text-gray-600 mt-3">Even with all four, a free Yahoo feed will not be tick-identical to your broker (typically within a fraction of a dollar on gold). Volume is unavailable for spot symbols.</div>
        </Card>
        <Card title="Strategy settings" icon={Cog}>
          <label className="block text-sm text-gray-300">Minimum agreement to fire a signal — <b className="text-gold">{prefs.minAgreement}%</b>
            <input type="range" min="40" max="95" step="5" value={prefs.minAgreement} onChange={(e) => setPref("minAgreement", +e.target.value)} className="w-full mt-2" />
            <span className="block text-xs text-gray-500">Higher = fewer but better-aligned setups. Mandatory gates always apply.</span>
          </label>
          <label className="block text-sm text-gray-300 mt-4">Risk : reward — <b className="text-gold">1 : {prefs.rr}</b>
            <input type="range" min="1" max="5" step="0.5" value={prefs.rr} onChange={(e) => setPref("rr", +e.target.value)} className="w-full mt-2" />
            <span className="block text-xs text-gray-500">Signal frequency scales with this automatically: a smaller target (1:1) needs less room to work, so the required agreement is relaxed and setups fire more often; a bigger target (1:4-5) needs a much cleaner setup, so the bar goes up and signals get rarer. The exact % used is shown on the signal card.</span>
          </label>
          <div className="mt-3"><Toggle on={prefs.sessionsOnly} onChange={(v) => setPref("sessionsOnly", v)} label="London / New York sessions only" hint="Blocks signals outside those sessions (recommended)" /></div>
          <div className="mt-3 text-xs text-gray-500 bg-panel2 rounded-lg p-2.5">
            <b className="text-violet-400">Early warning:</b> you'll also get a separate "Bias shift" alert the instant 4H structure flips, or 1H moves in or out of agreement with 4H — well before all 4 steps line up into a full BUY/SELL. It's a heads-up to pay attention, not a trade signal.
          </div>
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
