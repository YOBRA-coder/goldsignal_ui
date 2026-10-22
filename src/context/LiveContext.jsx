import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import { errText, setTimeMode } from "../lib/format";
import { playAlert, unlockAudio } from "../lib/sound";
import { showNotice } from "../lib/pwa";

const LiveCtx = createContext(null);
export const useLive = () => useContext(LiveCtx);

const DEFAULTS = {
  symbol: "XAUUSD=X", entryTF: "15m", chartTF: "15m", layout: "single", timeMode: "server",
  minAgreement: 70, sessionsOnly: true, rr: 2, sound: true, toastSecs: 8, notify: false, scalp: false, sens: "normal", showReplay: true, chartType: "candles",
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
