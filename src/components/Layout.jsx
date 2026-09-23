import React, { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AlertTriangle, BarChart3, Bell, CheckCircle2, CircleUser, FlaskConical, GitCompareArrows, Info,
  LayoutDashboard, LineChart, ListChecks, LogOut, RefreshCw, X, XCircle, Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { LiveProvider, useLive } from "../context/LiveContext";
import { Chip, Segmented } from "./ui";
import LivePrice from "./LivePrice";
import { ENTRY_TFS, SYMBOLS } from "../lib/constants";
import { cx, fmtAgo, timeModeLabel } from "../lib/format";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/charts", label: "Charts", icon: LineChart },
  { to: "/market", label: "Market", icon: BarChart3 },
  { to: "/signals", label: "Signals", icon: ListChecks },
  { to: "/backtest", label: "Backtest", icon: FlaskConical },
  { to: "/profile", label: "Profile", icon: CircleUser },
];

const kindStyle = {
  signal: { icon: Zap, cls: "text-gold border-gold/40 bg-gold/10" },
  win: { icon: CheckCircle2, cls: "text-bull border-bull/40 bg-bull/10" },
  loss: { icon: XCircle, cls: "text-bear border-bear/40 bg-bear/10" },
  shift: { icon: GitCompareArrows, cls: "text-violet-400 border-violet-400/40 bg-violet-400/10" },
  info: { icon: Info, cls: "text-blue-400 border-blue-400/40 bg-blue-400/10" },
};

function Toasts() {
  const { toasts, dismissToast } = useLive();
  return (
    <div className="fixed z-[60] top-3 right-3 left-3 sm:left-auto sm:w-96 space-y-2 pointer-events-none">
      {toasts.map((t) => {
        const k = kindStyle[t.kind] || kindStyle.info;
        const Icon = k.icon;
        return (
          <div key={t.id} onClick={() => dismissToast(t.id)}
            className={cx("pointer-events-auto cursor-pointer rounded-xl border backdrop-blur bg-panel/95 shadow-2xl p-3 flex gap-3 animate-[slidein_.25s_ease-out]", k.cls)}>
            <Icon size={22} className="shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-bold text-sm text-gray-100">{t.title}</div>
              <div className="text-xs text-gray-300 mt-0.5 break-words">{t.message}</div>
            </div>
            <X size={14} className="ml-auto shrink-0 text-gray-500" />
          </div>
        );
      })}
    </div>
  );
}

function AlertBell() {
  const { alerts, unseen, markRead } = useLive();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Alerts"
        className="relative w-10 h-10 rounded-xl border border-border bg-panel flex items-center justify-center hover:border-gold/50">
        <Bell size={18} className={unseen ? "text-gold" : "text-gray-400"} />
        {unseen > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-bear text-[10px] font-bold flex items-center justify-center">{unseen > 9 ? "9+" : unseen}</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-[min(92vw,380px)] bg-panel border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold">Alerts</span>
              <button onClick={() => markRead(null)} className="text-xs text-gold hover:underline">Mark all read</button>
            </div>
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border/60">
              {alerts.length === 0 && <li className="p-6 text-center text-sm text-gray-500">No alerts yet. Signals, take-profits and stop-losses show up here.</li>}
              {alerts.map((a) => {
                const k = kindStyle[a.kind] || kindStyle.info;
                const Icon = k.icon;
                return (
                  <li key={a.id} className={cx("flex gap-3 px-4 py-3", !a.seen && "bg-white/[0.03]")}>
                    <Icon size={18} className={cx("mt-0.5 shrink-0", k.cls.split(" ")[0])} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium flex items-center gap-2">{a.title}{!a.seen && <span className="w-1.5 h-1.5 rounded-full bg-gold" />}</div>
                      <div className="text-xs text-gray-400 break-words">{a.message}</div>
                      <div className="text-[11px] text-gray-600 mt-0.5">{fmtAgo(a.created_at)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function StatusBanners() {
  const { error, live, lastUpdate, refresh } = useLive();
  const d = live?.data;
  return (
    <div className="space-y-2">
      {error && (
        <div className="flex items-start gap-2 text-sm bg-bear/10 border border-bear/30 text-bear rounded-xl px-3 py-2.5">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <b>Data feed problem:</b> <span className="break-words">{error}</span>
            <div className="text-xs text-red-300/80 mt-0.5">
              Showing the last good data{lastUpdate ? ` (${fmtAgo(Math.floor(lastUpdate / 1000))})` : ""}.{" "}
              {/offline|cannot reach/i.test(error)
                ? <>The backend is not running or crashed — check its terminal, then start it again with <code className="bg-black/30 px-1 rounded">./run_backend.sh</code> (it auto-restarts).</>
                : <>Fix: <code className="bg-black/30 px-1 rounded">pip install -U -r requirements.txt</code> then restart the backend.</>}
            </div>
          </div>
          <button onClick={refresh} className="text-xs underline shrink-0">Retry</button>
        </div>
      )}
      {d?.demo && (
        <div className="text-xs bg-amber-400/10 border border-amber-400/30 text-amber-300 rounded-xl px-3 py-2">
          <b>DEMO DATA</b> — synthetic prices for testing (GOLDSIGNAL_DEMO=1). Do not trade off these signals.
        </div>
      )}
      {d && !d.demo && d.stale && !error && (
        <div className="text-xs bg-amber-400/10 border border-amber-400/30 text-amber-300 rounded-xl px-3 py-2">
          Price feed is about <b>{Math.max(1, Math.round((d.lag_sec || 0) / 60))} min behind</b> (source: {d.source}) — signals are paused until it catches up.
          Yahoo may be throttling; the app keeps retrying automatically.
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const { prefs, setPref, refresh, loading, live, lastUpdate } = useLive();
  const d = live?.data;
  return (
    <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-border">
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 lg:px-6 h-14">
        <div className="lg:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-gold to-yellow-600 flex items-center justify-center font-black text-black">G</div>
        <select value={prefs.symbol} onChange={(e) => setPref("symbol", e.target.value)}
          className="bg-panel border border-border rounded-xl px-2.5 sm:px-3 h-10 text-sm font-semibold outline-none focus:border-gold max-w-[46vw]">
          {SYMBOLS.map((s) => <option key={s.value} value={s.value}>{s.short} · {s.label}</option>)}
        </select>
        <div className="hidden sm:block px-3 py-1 rounded-xl border border-border bg-panel"><LivePrice /></div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
          <span className="whitespace-nowrap">Entry TF</span>
          <Segmented size="sm" options={ENTRY_TFS} value={prefs.entryTF} onChange={(v) => setPref("entryTF", v)} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
            <span className={cx("w-2 h-2 rounded-full", d?.stale || !lastUpdate ? "bg-amber-400" : "bg-bull animate-pulse")} />
            {lastUpdate ? `Analysis ${fmtAgo(Math.floor(lastUpdate / 1000))}` : "Connecting…"}
            <span className="text-gray-600">· {timeModeLabel(prefs.timeMode)}</span>
            {d?.lag_sec != null && <span className="text-gray-600">· feed lag {d.lag_sec < 90 ? `${d.lag_sec}s` : `${Math.round(d.lag_sec / 60)}m`}</span>}
            {d?.demo && <Chip tone="amber">DEMO</Chip>}
          </div>
          <button onClick={refresh} aria-label="Refresh" className="w-10 h-10 rounded-xl border border-border bg-panel flex items-center justify-center hover:border-gold/50">
            <RefreshCw size={16} className={cx("text-gray-400", loading && "animate-spin")} />
          </button>
          <AlertBell />
        </div>
      </div>
      <div className="sm:hidden flex items-center justify-between gap-2 px-3 pb-2 text-xs text-gray-500">
        <LivePrice />
        <Segmented size="sm" options={ENTRY_TFS} value={prefs.entryTF} onChange={(v) => setPref("entryTF", v)} />
      </div>
    </header>
  );
}

function Shell() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-bg text-gray-100 lg:pl-60">
      {/* desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-border bg-panel/60 px-3 py-5">
        <div className="flex items-center gap-2.5 px-2 mb-7">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold to-yellow-600 flex items-center justify-center font-black text-black">G</div>
          <div><div className="font-bold leading-tight">Gold<span className="text-gold">Signal</span></div><div className="text-[10px] text-gray-500 uppercase tracking-wider">4H → 1H → 5/15m</div></div>
        </div>
        <nav className="space-y-1 flex-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cx("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive ? "bg-gold/10 text-gold" : "text-gray-400 hover:text-gray-100 hover:bg-white/5")}>
              <Icon size={18} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border pt-3 flex items-center gap-2 px-1">
          <div className="w-8 h-8 rounded-full bg-gold/15 text-gold flex items-center justify-center text-sm font-bold">{user?.name?.[0]?.toUpperCase() || "U"}</div>
          <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{user?.name}</div><div className="text-[11px] text-gray-500 truncate">@{user?.username}</div></div>
          <button onClick={logout} aria-label="Log out" className="p-2 text-gray-500 hover:text-bear"><LogOut size={16} /></button>
        </div>
      </aside>

      <TopBar />
      <main className="px-3 sm:px-5 lg:px-6 py-4 pb-28 lg:pb-8 max-w-[1700px] mx-auto space-y-4" key={loc.pathname}>
        <StatusBanners />
        <Outlet />
      </main>

      {/* mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-panel/95 backdrop-blur border-t border-border grid grid-cols-6 pb-[env(safe-area-inset-bottom)]">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => cx("flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium", isActive ? "text-gold" : "text-gray-500")}>
            <Icon size={20} />{label}
          </NavLink>
        ))}
      </nav>
      <Toasts />
    </div>
  );
}

export default function Layout() {
  return (
    <LiveProvider>
      <Shell />
    </LiveProvider>
  );
}
