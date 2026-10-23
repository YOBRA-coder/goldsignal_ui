import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import { errText, setTimeMode } from "../lib/format";
import { playAlert, unlockAudio } from "../lib/sound";
import { showNotice } from "../lib/pwa";
import { symbolInfo } from "../lib/constants";

const LiveCtx = createContext(null);
export const useLive = () => useContext(LiveCtx);

const DEFAULTS = {
  symbol: "XAUUSD=X", entryTF: "15m", chartTF: "15m", layout: "single", timeMode: "server",
  minAgreement: 70, sessionsOnly: true, rr: 2, sound: true, toastSecs: 8, notify: false, scalp: false, sens: "normal", showReplay: true, chartType: "candles",
  alertReady: true, alertCounter: true, alertApproval: true, alertShift: true,
};
const POLL_MS = 10000;
const QUOTE_MS = 6000;

function loadPrefs() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("gs_prefs") || "{}") }; }
  catch { return DEFAULTS; }
}

export function LiveProvider({ children }) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [live, setLive] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [unseen, setUnseen] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [history, setHistory] = useState([]);
  const [quote, setQuote] = useState(null);
  const [dataRev, setDataRev] = useState(0);
  const [chartItem, setChartItem] = useState(null);      // pair shown in the full-chart pop-up (null = closed)
  const openChart = useCallback((item) => setChartItem(item), []);
  const closeChart = useCallback(() => setChartItem(null), []);
  const reqId = useRef(0);
  const liveCtl = useRef(null);      // aborts the analysis request that is still running when inputs change
  const lastAlertId = useRef(null);
  const symRef = useRef(prefs.symbol);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  setTimeMode(prefs.timeMode);

  const setPref = useCallback((k, v) => {
    setPrefs((p) => {
      const n = { ...p, [k]: v };
      localStorage.setItem("gs_prefs", JSON.stringify(n));
      return n;
    });
  }, []);

  useEffect(() => {
    const h = () => unlockAudio();
    window.addEventListener("pointerdown", h, { once: true });
    return () => window.removeEventListener("pointerdown", h);
  }, []);

  const pushToast = useCallback((t) => {
    const id = `${Date.now()}-${Math.random()}`;
    const secs = Number(prefsRef.current.toastSecs);
    setToasts((x) => [...x.slice(-3), { id, secs: Number.isFinite(secs) ? secs : 8, ...t }]);
  }, []);
  const dismissToast = useCallback((id) => setToasts((x) => x.filter((q) => q.id !== id)), []);

  const fetchHistory = useCallback(async () => {
    try {
      const { data } = await api.get("/signals/history", { params: { symbol: prefsRef.current.symbol } });
      setHistory(data);
    } catch { /* non-fatal */ }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const { data } = await api.get("/alerts", { params: { limit: 30 } });
      setAlerts(data.alerts);
      setUnseen(data.unseen);
      const maxId = data.alerts.reduce((m, a) => Math.max(m, a.id), 0);
      if (lastAlertId.current === null) { lastAlertId.current = maxId; return; }
      const fresh = data.alerts.filter((a) => a.id > lastAlertId.current).reverse();
      lastAlertId.current = Math.max(lastAlertId.current, maxId);
      fresh.forEach((a) => {
        pushToast(a);
        if (prefsRef.current.sound) playAlert(a.kind);
        if (prefsRef.current.notify && document.hidden) showNotice(a.title, a.message || "", `${a.kind}-${a.id}`);
      });
      if (fresh.length) fetchHistory();
    } catch { /* non-fatal */ }
  }, [pushToast, fetchHistory]);

  const fetchLive = useCallback(async (opts = {}) => {
    // a poll that fires while the previous one is still running is skipped; a change of inputs cancels the old one
    if (liveCtl.current && !opts.force) return;
    if (liveCtl.current) liveCtl.current.abort();
    const ctl = new AbortController();
    liveCtl.current = ctl;
    const id = ++reqId.current;
    const p = prefsRef.current;
    try {
      const { data } = await api.get("/signals/live", {
        params: { symbol: p.symbol, entry_interval: p.entryTF, min_agreement: p.minAgreement,
                  sessions_only: p.sessionsOnly, rr: p.rr, scalp: p.scalp, sens: p.sens },
        signal: ctl.signal,
      });
      if (id !== reqId.current) return;
      setLive(data);
      setError(null);
      setLastUpdate(Date.now());
      fetchAlerts();
      if (data.record_id || data.closed_now?.length) fetchHistory();
    } catch (e) {
      if (id !== reqId.current || e?.code === "ERR_CANCELED" || e?.name === "CanceledError") return;
      setError(errText(e));
    } finally {
      if (liveCtl.current === ctl) liveCtl.current = null;
      if (id === reqId.current) setLoading(false);
    }
  }, [fetchAlerts, fetchHistory]);

  // reload when the inputs to the analysis change
  useEffect(() => {
    setLoading(true);
    setError(null);
    if (symRef.current !== prefs.symbol) { setLive(null); symRef.current = prefs.symbol; }
    fetchLive({ force: true });
    fetchHistory();
    const t = setInterval(() => fetchLive(), POLL_MS);
    return () => {
      clearInterval(t);
      if (liveCtl.current) { liveCtl.current.abort(); liveCtl.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.symbol, prefs.entryTF, prefs.minAgreement, prefs.sessionsOnly, prefs.rr, prefs.scalp, prefs.sens]);

  // live price tape (market watch + top bar) - light call, refreshed every few seconds
  useEffect(() => {
    let dead = false, busy = false;
    const ctl = new AbortController();
    setQuote((q) => (q?.symbol === prefs.symbol ? q : null));
    const run = async () => {
      if (busy) return;
      busy = true;
      try {
        const { data } = await api.get("/market/quote", { params: { symbol: prefs.symbol }, signal: ctl.signal });
        if (!dead) setQuote({ ...data, fetchedAt: Date.now() });
      } catch { /* the banner from the live call reports feed problems */ }
      finally { busy = false; }
    };
    run();
    const t = setInterval(run, QUOTE_MS);
    return () => { dead = true; ctl.abort(); clearInterval(t); };
  }, [prefs.symbol]);

  // keep alerts fresh even if the live call is slow / failing
  useEffect(() => {
    fetchAlerts();
    const t = setInterval(fetchAlerts, POLL_MS * 2);
    return () => clearInterval(t);
  }, [fetchAlerts]);

  useEffect(() => {
    document.title = `${unseen ? `(${unseen}) ` : ""}GoldSignal`;
  }, [unseen]);


  // ---- brain alerts: readiness / candle approval / quick shifts, found by comparing this poll with the last one.
  // Client side only (the server's own "signal" alerts are untouched). The first read of a pair never alerts.
  const brainPrev = useRef(null);
  const brainSeen = useRef({});
  useEffect(() => {
    const b = live?.signal?.brain;
    if (!b) return;
    const p = prefsRef.current;
    const short = symbolInfo(p.symbol).short;
    const cur = { sym: p.symbol, tf: b.tf, sides: Object.fromEntries(["BUY", "SELL"].map((k) => [k, b.sides[k]])), shifts: new Set((b.shifts || []).map((x) => x.key)) };
    const prev = brainPrev.current;
    brainPrev.current = cur;
    if (!prev || prev.sym !== cur.sym || prev.tf !== cur.tf) return;
    const once = (key, ms) => {
      const t = Date.now();
      if (brainSeen.current[key] && t - brainSeen.current[key] < ms) return false;
      brainSeen.current[key] = t;
      return true;
    };
    const fire = (kind, title, message, secs) => {
      pushToast({ kind, title, message, symbol: p.symbol, secs });
      if (p.sound) playAlert(kind);
      if (p.notify && document.hidden) showNotice(title, message, `brain-${kind}-${Date.now()}`);
    };
    ["BUY", "SELL"].forEach((k) => {
      const now = cur.sides[k], was = prev.sides[k];
      if (!now || !was) return;
      const wanted = now.counter ? p.alertCounter !== false : p.alertReady !== false;
      const live_ = (s) => s.state === "ready" || s.state === "fire";
      if (wanted && live_(now) && !live_(was) && now.state === "ready" && once(`ready-${k}`, 5 * 60 * 1000)) {
        fire(now.counter ? "counter" : "ready", `${k} READY - ${short}${now.counter ? " (counter-trend)" : " (with the trend)"}`,
          `${now.pct}% - every stage passes. ${now.counter ? "Counter-trend: the engine's own tests found these lose. " : ""}Check the entry is still valid before you act.`, 25);
      } else if (wanted && now.state === "armed" && was.state !== "armed" && !live_(was) && once(`armed-${k}`, 10 * 60 * 1000)) {
        fire("setup", `${k} armed - ${short}`, `${now.pct}% - ${now.next || "one step from tradeable"}`, 12);
      }
      if (p.alertApproval !== false && wanted) {
        const a = now.approval?.state, wa = was.approval?.state;
        if (a === "approved" && wa !== "approved" && once(`appr-${k}-${now.approval.candle_open_ts}`, 20 * 60 * 1000)) {
          fire("approve", `${k} candle approved - ${short}`, now.approval.detail, 10);
        } else if (a === "forming" && wa !== "forming" && once(`form-${k}-${now.approval.candle_open_ts}`, 20 * 60 * 1000)) {
          fire("approve", `${k} trigger candle forming - ${short}`, now.approval.detail, 8);
        }
      }
    });
    if (p.alertShift !== false) {
      (b.shifts || []).filter((x) => x.severity !== "info" && !prev.shifts.has(x.key)).forEach((x) => {
        if (once(`shift-${cur.sym}-${x.key}`, 3 * 60 * 1000)) fire("shift", `Quick shift - ${short}`, x.text, 14);
      });
    }
  }, [live]);   // eslint-disable-line react-hooks/exhaustive-deps

  // flash the tab title while a side is tradeable and the tab is in the background
  useEffect(() => {
    const b = live?.signal?.brain;
    const s = b && ["BUY", "SELL"].map((k) => b.sides[k]).find((x) => (x.state === "ready" || x.state === "fire")
      && (x.counter ? prefs.alertCounter !== false : prefs.alertReady !== false));
    if (!s) return undefined;
    const short = symbolInfo(prefs.symbol).short;
    let on = false;
    const base = document.title;
    const t = setInterval(() => { on = !on; document.title = on && document.hidden ? `>> ${s.direction} READY ${short}` : base; }, 1000);
    return () => { clearInterval(t); document.title = base; };
  }, [live, prefs.symbol, prefs.alertReady, prefs.alertCounter]);   // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = useCallback(async (ids = null) => {
    try { await api.post("/alerts/read", { ids }); } catch { /* ignore */ }
    fetchAlerts();
  }, [fetchAlerts]);

  const enableDesktop = useCallback(async () => {
    if (!("Notification" in window)) return "unsupported";
    const r = await Notification.requestPermission();
    setPref("notify", r === "granted");
    return r;
  }, [setPref]);

  const sendTest = useCallback(async (kind) => {
    unlockAudio();
    await api.post("/alerts/test", null, { params: { kind } });
    fetchAlerts();
  }, [fetchAlerts]);

  const bumpData = useCallback(() => { setDataRev((r) => r + 1); fetchLive({ force: true }); }, [fetchLive]);
  const refresh = useCallback(() => fetchLive({ force: true }), [fetchLive]);

  const value = useMemo(() => ({
    prefs, setPref, live, quote, dataRev, bumpData, error, loading, lastUpdate, refresh,
    alerts, unseen, markRead, toasts, dismissToast, history, fetchHistory, enableDesktop, sendTest,
    chartItem, openChart, closeChart,
  }), [chartItem, openChart, closeChart, prefs, setPref, live, quote, dataRev, bumpData, error, loading, lastUpdate, refresh, alerts, unseen, markRead, toasts,
       dismissToast, history, fetchHistory, enableDesktop, sendTest]);

  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}
