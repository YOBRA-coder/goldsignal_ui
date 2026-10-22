import React, { useCallback, useEffect, useState } from "react";
import { Check, Minus, X as XIcon } from "lucide-react";
import api from "../api";
import { Chip, Spinner } from "./ui";
import { Plan } from "./Outlook";
import { useLive } from "../context/LiveContext";
import { symbolInfo } from "../lib/constants";
import { cx, fmtDateTime, fmtTime } from "../lib/format";

const TONE = { signal: "gold", waiting_trigger: "blue", waiting_zone: "gray", not_aligned: "gray", no_bias: "gray", out_of_session: "gray",
  risk_too_wide: "amber", low_agreement: "amber", stretched: "amber", needs_confirmation: "amber", blocked: "amber", no_room: "amber", amd_against: "amber", news: "bear", choppy: "amber", market_closed: "gray" };
const ENTRY = ["1m", "5m", "15m", "30m"];
const PREV = ["forming", "h1_preview", "one_h_preview", "entry_shift_preview", "counter_watch"];

/** Read-only brief for one pair + entry timeframe (/signals/brief records nothing), refreshed every few seconds.
 *  Shared by the floating log and the full-screen side panel (LOG + SIGNALS tabs). The scalp view is always requested
 *  here so the panel can show it even when scalp mode is off on the dashboard. */
export function useBrief(symbol, tf, { scalp = true, every = 8000 } = {}) {
  const { prefs } = useLive();
  const etf = ENTRY.includes(tf) ? tf : prefs.entryTF;
  const [b, setB] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(async (ctl) => {
    try {
      const { data } = await api.get("/signals/brief", { signal: ctl?.signal, params: { symbol, entry_interval: etf,
        min_agreement: prefs.minAgreement, sessions_only: prefs.sessionsOnly, rr: prefs.rr, scalp, sens: prefs.sens } });
      if (ctl?.signal?.aborted) return;
      setB(data); setErr(null);
    } catch (e) { if (e?.code !== "ERR_CANCELED" && e?.name !== "CanceledError") setErr(e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || "Could not load"); }
  }, [symbol, etf, prefs.minAgreement, prefs.sessionsOnly, prefs.rr, scalp, prefs.sens]);
  useEffect(() => {
    setB(null); setErr(null);
    const ctl = new AbortController();
    load(ctl);
    const t = setInterval(() => load(ctl), every);
    return () => { ctl.abort(); clearInterval(t); };
  }, [load, every]);
  return { b, err, etf };
}

/** Floating "log" card (kept for compatibility; the full-screen chart now uses ChartSidePanel). */
export default function BriefPanel({ tf, onClose, symbol }) {
  const { prefs } = useLive();
  const sym = symbol || prefs.symbol;
  const info = symbolInfo(sym);
  const { b, err, etf } = useBrief(sym, tf, { scalp: prefs.scalp });
  return (
    <div className="absolute z-[75] left-2 right-2 top-2 md:left-3 md:right-auto md:w-[460px] max-h-[75%] overflow-y-auto rounded-2xl border border-gold/30 bg-bg/95 backdrop-blur shadow-2xl p-3 text-xs">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="font-bold text-sm">{info.short} <span className="text-gold">{etf}</span> <span className="text-gray-500 font-normal">log</span></div>
        <button onClick={onClose} aria-label="Close log" className="text-gray-400 hover:text-bear"><XIcon size={16} /></button>
      </div>
      <BriefBody b={b} err={err} etf={etf} symbol={sym} />
    </div>
  );
}

/** The log itself: what is happening, what is expected, open trades, last scans. */
export function BriefBody({ b, err, etf, symbol }) {
  const info = symbolInfo(symbol);
  const s = b?.signal;
  const sc = b?.scalp_signal;
  const plans = s?.outlook?.plans || [];
  const o = s?.outlook;
  const bad = (s?.checks || []).filter((c) => c.ok === false);
  const previews = PREV.map((k) => [k, s?.[k]]).filter(([, v]) => v && (v.note || v.detail));
  return (
    <div className="text-xs">
      {!b && !err && <div className="flex items-center gap-2 text-gray-500"><Spinner /> Reading the market…</div>}
      {err && !b && <div className="text-amber-400">{err}</div>}
      {s && (<>
        <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">What is happening</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone={TONE[s.status] || "gray"}>{String(s.status).replace(/_/g, " ")}</Chip>
          <Chip tone="gray">{s.direction}</Chip>
          {s.agreement != null && <Chip tone="gold">{Math.round(s.agreement)}% agree{s.grade ? ` · ${s.grade}` : ""}</Chip>}
          <Chip tone="gray">4H {s.bias_4h}</Chip><Chip tone="gray">1H {s.bias_1h}</Chip>
          {b.sessions?.label && <Chip tone={b.sessions.open ? "bull" : "amber"}>{b.sessions.label}</Chip>}
        </div>
        <p className="text-gray-200 mt-1.5 leading-snug">{s.headline}</p>
        {s.entry_check && <div className={cx("mt-1", s.entry_check.ok ? "text-bull" : "text-amber-400")}>Entry: {s.entry_check.note}</div>}
        {bad.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {bad.map((c) => <li key={c.key} className="flex gap-1.5 text-gray-400"><XIcon size={12} className="text-bear mt-0.5 shrink-0" /><span><span className="text-gray-300">{c.label}</span> — {c.detail}</span></li>)}
          </ul>
        )}
        {(s.highlights || []).map((h, i) => <div key={i} className="text-gray-400 mt-0.5">• {h}</div>)}
        {previews.map(([k, v]) => (
          <div key={k} className="text-gray-500 mt-0.5"><span className="text-gray-400 capitalize">{k.replace(/_/g, " ")}:</span> {v.note || v.detail}</div>
        ))}
        {sc && sc.status !== "market_closed" && (
          <div className="mt-1.5 text-gray-400"><span className="text-gold">Scalp:</span> {sc.direction !== "WAIT" ? `${sc.direction} ` : ""}{sc.headline}</div>
        )}
        {b.data?.note && <div className="text-amber-400/90 mt-1.5">{b.data.note}</div>}

        {s.amd_now && s.amd_now.phase && s.amd_now.phase !== "none" && (
          <div className="mt-1.5 text-violet-300">AMD ({etf}): {s.amd_now.note}</div>
        )}
        {s.news && (s.news.blackout || s.news.next) && (
          <div className={cx("mt-1.5", s.news.blackout ? "text-bear" : "text-amber-300")}>
            {s.news.blackout ? `News blackout: ${s.news.blackout.label} until ${fmtTime(s.news.blackout.end)}` : `News: ${s.news.next.label} — signals pause ${fmtDateTime(s.news.next.start)}`}
          </div>
        )}

        <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-3 mb-1">What is expected</div>
        {o && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {o.next_trade_window && !o.session_open_now && <Chip tone="amber">window opens {fmtDateTime(o.next_trade_window)}</Chip>}
            {o.verdict?.kind === "eta" && o.verdict.p50_ts && <Chip tone="gold">{o.verdict.direction} typical ~{fmtDateTime(o.verdict.p50_ts)}</Chip>}
            {o.verdict?.kind === "in_zone" && <Chip tone="gold">{o.verdict.direction}: in the zone now</Chip>}
          </div>
        )}
        <div className="space-y-2">{plans.map((p, i) => <Plan key={i} plan={p} precision={info.precision} />)}</div>
        {!plans.length && <div className="text-gray-500">No plan yet — the engine needs a 4H / 1H direction first.</div>}
        {(o?.windows || []).slice(0, 3).map((w, i) => (
          <div key={i} className="text-[11px] text-gray-400 mt-1"><span className="text-gray-300">{fmtDateTime(w.ts)}</span> · {w.label}</div>
        ))}

        {b.open_trades?.length > 0 && (<>
          <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-3 mb-1">Open trades</div>
          {b.open_trades.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-gray-300">
              <span className={cx("font-bold", t.direction === "BUY" ? "text-bull" : "text-bear")}>{t.direction}</span>
              <span className="tabular-nums">{t.entry_price} → SL {t.current_sl ?? t.stop_loss} / TP {t.take_profit}</span>
              {t.live_r != null && <span className="ml-auto text-gold">{t.live_r}R</span>}
            </div>
          ))}
        </>)}

        {b.recent?.length > 0 && (<>
          <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-3 mb-1">Last scans</div>
          <ul className="space-y-0.5">
            {b.recent.map((r, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="text-gray-500 tabular-nums w-11 shrink-0">{fmtTime(r.ts)}</span>
                <Chip tone={TONE[r.status] || "gray"} className="shrink-0">{String(r.status).replace(/_/g, " ")}</Chip>
                <span className="truncate text-gray-400">{r.headline}</span>
              </li>
            ))}
          </ul>
        </>)}
      </>)}
    </div>
  );
}
