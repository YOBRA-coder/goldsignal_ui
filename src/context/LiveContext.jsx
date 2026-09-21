import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import { errText } from "../lib/format";
import { playAlert, unlockAudio } from "../lib/sound";

const LiveCtx = createContext(null);
export const useLive = () => useContext(LiveCtx);

const DEFAULTS = {
  symbol: "GC=F", entryTF: "15m", chartTF: "15m", layout: "single",
  minAgreement: 70, sessionsOnly: true, rr: 2, sound: true, notify: false,
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
  const reqId = useRef(0);
  const lastAlertId = useRef(null);
  const symRef = useRef(prefs.symbol);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

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
    setToasts((x) => [...x.slice(-3), { id, ...t }]);
    setTimeout(() => setToasts((x) => x.filter((q) => q.id !== id)), t.kind === "info" ? 6000 : 12000);
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
        if (prefsRef.current.notify && "Notification" in window && Notification.permission === "granted") {
          try { new Notification(a.title, { body: a.message || "" }); } catch { /* ignore */ }
        }
      });
      if (fresh.length) fetchHistory();
    } catch { /* non-fatal */ }
  }, [pushToast, fetchHistory]);

  const fetchLive = useCallback(async () => {
    const id = ++reqId.current;
    const p = prefsRef.current;
    try {
      const { data } = await api.get("/signals/live", {
        params: { symbol: p.symbol, entry_interval: p.entryTF, min_agreement: p.minAgreement,
                  sessions_only: p.sessionsOnly, rr: p.rr },
      });
      if (id !== reqId.current) return;
      setLive(data);
      setError(null);
      setLastUpdate(Date.now());
      fetchAlerts();
      if (data.record_id || data.closed_now?.length) fetchHistory();
    } catch (e) {
      if (id !== reqId.current) return;
      setError(errText(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [fetchAlerts, fetchHistory]);

  // reload when the inputs to the analysis change
  useEffect(() => {
    setLoading(true);
    if (symRef.current !== prefs.symbol) { setLive(null); symRef.current = prefs.symbol; }
    fetchLive();
    fetchHistory();
    const t = setInterval(fetchLive, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.symbol, prefs.entryTF, prefs.minAgreement, prefs.sessionsOnly, prefs.rr]);

  // live price tape (market watch + top bar) - light call, refreshed every few seconds
  useEffect(() => {
    let dead = false;
    setQuote((q) => (q?.symbol === prefs.symbol ? q : null));
    const run = async () => {
      try {
        const { data } = await api.get("/market/quote", { params: { symbol: prefs.symbol } });
        if (!dead) setQuote({ ...data, fetchedAt: Date.now() });
      } catch { /* the banner from the live call reports feed problems */ }
    };
    run();
    const t = setInterval(run, QUOTE_MS);
    return () => { dead = true; clearInterval(t); };
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

  const value = useMemo(() => ({
    prefs, setPref, live, quote, error, loading, lastUpdate, refresh: fetchLive,
    alerts, unseen, markRead, toasts, dismissToast, history, fetchHistory, enableDesktop, sendTest,
  }), [prefs, setPref, live, quote, error, loading, lastUpdate, fetchLive, alerts, unseen, markRead, toasts,
       dismissToast, history, fetchHistory, enableDesktop, sendTest]);

  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}
