import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Minus, ShieldAlert, X } from "lucide-react";
import api from "../api";
import { BriefBody, useBrief } from "./BriefPanel";
import { EventRow } from "./NewsPanel";
import { Plan } from "./Outlook";
import { Chip, Spinner } from "./ui";
import { useLive } from "../context/LiveContext";
import { symbolInfo } from "../lib/constants";
import { cx, errText, fmtAgo, fmtDateTime, fmtPrice, fmtTime } from "../lib/format";

const TABS = [["log", "LOG"], ["news", "NEWS"], ["levels", "LEVELS"], ["signals", "SIGNALS"], ["vote", "VOTE"]];
const TAB_KEY = "gs_panel_tab";
// the market read weights the timeframes like this (see analyst.TF_WEIGHT) - shown so the vote can be checked by hand
const TF_WEIGHT = { "5m": 7, "15m": 10, "30m": 10, "1h": 25, "4h": 30, "1d": 18 };
const TF_LABEL = { "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1H", "4h": "4H", "1d": "1D" };

const readTab = () => { try { const t = localStorage.getItem(TAB_KEY); return TABS.some(([k]) => k === t) ? t : "log"; } catch { return "log"; } };

/** Poll one endpoint. Data from a previous pair / timeframe is dropped the moment the key changes, and a request that
 *  is still running when the key changes is cancelled (same rule as the chart: no stale data under a new view). */
function usePoll(path, params, key, ms, enabled = true, timeout = 20000) {
  const [st, setSt] = useState({ key: "", data: null, err: null });
  const ref = useRef(params);
  ref.current = params;
  useEffect(() => {
    if (!enabled) return undefined;
    const ctl = new AbortController();
    let dead = false, busy = false;
    const run = async () => {
      if (busy) return;
      busy = true;
      try {
        const { data } = await api.get(path, { params: ref.current, signal: ctl.signal, timeout });
        if (!dead) setSt({ key, data, err: null });
      } catch (e) {
        if (dead || e?.code === "ERR_CANCELED" || e?.name === "CanceledError") return;
        setSt((x) => ({ key, data: x.key === key ? x.data : null, err: errText(e) }));
      } finally { busy = false; }
    };
    run();
    const t = setInterval(run, ms);
    return () => { dead = true; ctl.abort(); clearInterval(t); };
  }, [path, key, ms, enabled, timeout]);
  return { data: st.key === key ? st.data : null, err: st.key === key ? st.err : null };
}

const Loading = ({ children = "Reading the market…" }) => <div className="flex items-center gap-2 text-gray-500 text-xs py-3"><Spinner /> {children}</div>;
const Section = ({ children, right }) => (
  <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-gray-500 mt-4 mb-1.5 first:mt-0"><span>{children}</span>{right}</div>
);

/* ------------------------------------------------------------------ NEWS */
function NewsTab({ symbol, blackout }) {
  const info = symbolInfo(symbol);
  const { data, err } = usePoll("/news/calendar", { symbol, days_back: 1, days_ahead: 7, impact: "medium", reactions: true }, symbol, 60000);
  const evs = data?.events || [];
  const upcoming = evs.filter((e) => e.minutes >= -5).slice(0, 14);
  const recent = evs.filter((e) => e.minutes < -5).reverse().slice(0, 6);
  return (
    <div>
      {blackout && (
        <div className="flex items-start gap-2 text-xs rounded-xl border border-bear/40 bg-bear/10 text-bear px-3 py-2 mb-2">
          <ShieldAlert size={15} className="mt-0.5 shrink-0" />
          <div><b>Signals paused:</b> {blackout.label} — until {fmtTime(blackout.end)}.</div>
        </div>
      )}
      {!data && !err && <Loading>Loading the calendar…</Loading>}
      {err && !data && <div className="text-xs text-amber-400">{err}</div>}
      {data && !upcoming.length && <div className="text-xs text-gray-500 py-4 text-center">No medium / high impact events for {info.short} in the next days.</div>}
      {upcoming.length > 0 && <ul className="divide-y divide-border/60">{upcoming.map((e, i) => <EventRow key={`${e.ts}-${e.title}-${i}`} e={e} unit={info.precision} />)}</ul>}
      {recent.length > 0 && (<>
        <Section>Released — and what price did</Section>
        <ul className="divide-y divide-border/60">{recent.map((e, i) => <EventRow key={`${e.ts}-${e.title}-${i}`} e={e} unit={info.precision} />)}</ul>
      </>)}
    </div>
  );
}

/* ---------------------------------------------------------------- LEVELS */
function LevelRow({ l, p }) {
  const zone = l.top != null;
  return (
    <li className="flex items-baseline justify-between gap-2 text-[12px] py-0.5">
      <span className="text-gray-300 truncate">{l.label}</span>
      <span className="tabular-nums text-gray-400 shrink-0">
        {zone ? `${fmtPrice(l.bottom, p)} – ${fmtPrice(l.top, p)}` : fmtPrice(l.price, p)}
        {l.dist_atr != null && <span className="text-gray-600"> · {l.dist_atr} ATR</span>}
      </span>
    </li>
  );
}

function LevelsTab({ d, err, symbol }) {
  const p = symbolInfo(symbol).precision;
  if (!d) return err ? <div className="text-xs text-amber-400">{err}</div> : <Loading />;
  const lv = d.levels || {};
  const above = [...(lv.above || [])].reverse();      // farthest first, so the list reads top-down like the chart
  return (
    <div>
      <Section>Overhead</Section>
      <ul>{above.map((l, i) => <LevelRow key={`a${i}`} l={l} p={p} />)}</ul>
      {!above.length && <div className="text-xs text-gray-600">Nothing mapped above price.</div>}
      <div className="my-2 flex items-center gap-2 text-sm font-bold tabular-nums text-gold border-y border-gold/30 py-1.5"><span>Price</span><span className="ml-auto">{fmtPrice(d.price, p)}</span></div>
      {(lv.inside || []).length > 0 && (<><Section>Price is inside</Section><ul>{lv.inside.map((l, i) => <LevelRow key={`i${i}`} l={l} p={p} />)}</ul></>)}
      <Section>Underneath</Section>
      <ul>{(lv.below || []).map((l, i) => <LevelRow key={`b${i}`} l={l} p={p} />)}</ul>
      {!(lv.below || []).length && <div className="text-xs text-gray-600">Nothing mapped below price.</div>}
      {(d.flags || []).map((f, i) => <p key={i} className="text-[11px] text-amber-400 mt-3">⚠ {f}</p>)}
    </div>
  );
}

/* --------------------------------------------------------------- SIGNALS */
const STATUS_TONE = { signal: "gold", waiting_trigger: "blue", waiting_zone: "gray", needs_confirmation: "amber", blocked: "amber", news: "bear" };

function SignalBlock({ title, s, p }) {
  if (!s) return null;
  const fired = s.direction === "BUY" || s.direction === "SELL";
  const buy = s.direction === "BUY";
  const ec = s.entry_check;
  return (
    <div className={cx("rounded-xl border p-3", fired ? (buy ? "border-bull/40 bg-bull/5" : "border-bear/40 bg-bear/5") : "border-border")}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">{title}</span>
        <span className={cx("text-lg font-black", buy ? "text-bull" : s.direction === "SELL" ? "text-bear" : "text-gray-400")}>{s.direction}</span>
        <Chip tone={STATUS_TONE[s.status] || "gray"}>{String(s.status || "").replace(/_/g, " ")}</Chip>
        {s.agreement != null && <Chip tone="gold">{Math.round(s.agreement)}%{s.grade ? ` · ${s.grade}` : ""}</Chip>}
      </div>
      <p className="text-[12px] text-gray-300 leading-snug mt-1">{s.headline}</p>
      {fired && s.entry_price != null && (
        <>
          <div className="grid grid-cols-4 gap-1 text-center mt-2 tabular-nums text-[12px]">
            <div><div className="text-[9px] text-gray-500 uppercase">Entry</div><span className="text-gold font-bold">{fmtPrice(s.entry_price, p)}</span></div>
            <div><div className="text-[9px] text-gray-500 uppercase">Stop</div><span className="text-bear font-bold">{fmtPrice(s.stop_loss, p)}</span></div>
            <div><div className="text-[9px] text-gray-500 uppercase">Target</div><span className="text-bull font-bold">{fmtPrice(s.take_profit, p)}</span></div>
            <div><div className="text-[9px] text-gray-500 uppercase">R:R</div><span className="font-bold">{s.reward_r ?? s.rr}</span></div>
          </div>
          {ec && (
            <div className={cx("mt-2 text-[11px] leading-snug rounded-lg border px-2 py-1.5", ec.ok ? "border-bull/30 text-bull bg-bull/5" : "border-amber-400/40 text-amber-300 bg-amber-400/5")}>
              <b>{ec.ok ? "Entry valid" : "Entry not clean"}</b> · {ec.note}
            </div>
          )}
          {s.confirmations?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">{s.confirmations.map((c, i) => <Chip key={i} tone="bull">{c.label || c}</Chip>)}</div>
          )}
          <div className="text-[10px] text-gray-500 mt-1.5">Signal time {fmtDateTime(s.signal_time)} · {fmtAgo(s.signal_time)}{s.age_bars > 0 ? ` · ${s.age_bars} bar${s.age_bars > 1 ? "s" : ""} old` : ""}</div>
        </>
      )}
    </div>
  );
}

function SignalsTab({ b, err, symbol }) {
  const p = symbolInfo(symbol).precision;
  const { data: hist } = usePoll("/signals/history", { symbol }, symbol, 60000);
  const rows = (hist || []).slice(0, 8);
  if (!b) return err ? <div className="text-xs text-amber-400">{err}</div> : <Loading />;
  const plans = b.signal?.outlook?.plans || [];
  return (
    <div className="space-y-3">
      <SignalBlock title="Swing" s={b.signal} p={p} />
      {b.scalp_signal && b.scalp_signal.status !== "market_closed" && <SignalBlock title="Scalp" s={b.scalp_signal} p={p} />}
      {b.open_trades?.length > 0 && (
        <div>
          <Section>Running trades</Section>
          {b.open_trades.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-[12px] py-1 border-b border-border/50">
              <span className={cx("font-bold", t.direction === "BUY" ? "text-bull" : "text-bear")}>{t.direction}</span>
              {t.style === "scalp" && <Chip tone="blue">scalp</Chip>}
              <span className="tabular-nums text-gray-300">{fmtPrice(t.entry_price, p)} → SL {fmtPrice(t.current_sl ?? t.stop_loss, p)} / TP {fmtPrice(t.take_profit, p)}</span>
              {t.live_r != null && <span className={cx("ml-auto tabular-nums font-semibold", t.live_r >= 0 ? "text-bull" : "text-bear")}>{t.live_r}R</span>}
            </div>
          ))}
        </div>
      )}
      {plans.length > 0 && (<div><Section>Next plans</Section><div className="space-y-2">{plans.map((pl, i) => <Plan key={i} plan={pl} precision={p} />)}</div></div>)}
      {rows.length > 0 && (
        <div>
          <Section>Recent signals</Section>
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-[12px] py-1 border-b border-border/50">
              <span className={cx("font-bold w-9", r.direction === "BUY" ? "text-bull" : "text-bear")}>{r.direction}</span>
              {r.style === "scalp" && <Chip tone="blue">scalp</Chip>}
              <span className="text-gray-500 tabular-nums">{fmtDateTime(r.trigger_ts || r.created_at)}</span>
              <span className="ml-auto flex items-center gap-1.5">
                <Chip tone={r.status === "won" ? "bull" : r.status === "lost" ? "bear" : r.status === "open" ? "gold" : "gray"}>{r.status}</Chip>
                {r.result_r != null && <span className="tabular-nums text-gray-300">{r.result_r > 0 ? "+" : ""}{r.result_r}R</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ VOTE */
const tfTone = (b) => (b === "bullish" ? "text-bull" : b === "bearish" ? "text-bear" : "text-gray-500");
const tfMark = (b) => (b === "bullish" ? "▲" : b === "bearish" ? "▼" : "●");

function VoteMeter({ score }) {
  const s = Math.max(-100, Math.min(100, score));
  return (
    <div className="relative h-2 rounded-full bg-white/5 mt-2">
      <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
      <div className={cx("absolute inset-y-0 rounded-full", s >= 0 ? "bg-bull/80" : "bg-bear/80")}
        style={s >= 0 ? { left: "50%", width: `${s / 2}%` } : { right: "50%", width: `${-s / 2}%` }} />
    </div>
  );
}

/** The vote the app already has: the market read's timeframe consensus (structure + EMA stack + MACD + RSI + ADX per
 *  timeframe, weighted), plus the entry engine's own checklist. There is no separate indicator-strategy vote here. */
function VoteTab({ d, err, b }) {
  if (!d) return err ? <div className="text-xs text-amber-400">{err}</div> : <Loading />;
  const c = d.consensus || {};
  const v = c.votes || { bull: 0, bear: 0, of: 0 };
  const neutral = Math.max(0, (v.of || 0) - v.bull - v.bear);
  const lean = c.lean === "BUY" ? "BUY LEAN" : c.lean === "SELL" ? "SELL LEAN" : "NO LEAN";
  const tfs = [...(d.timeframes || [])].reverse();            // 1D first, like reading top-down
  const checks = b?.signal?.checks || [];
  const passed = checks.filter((x) => x.ok).length;
  const failedGates = checks.filter((x) => x.ok === false && x.gate);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <div className={cx("text-xl font-black tracking-tight", c.lean === "BUY" ? "text-bull" : c.lean === "SELL" ? "text-bear" : "text-gray-300")}>
          {lean} <span className="tabular-nums">{c.score > 0 ? "+" : ""}{c.score}</span>
        </div>
        <div className="text-[11px] text-gray-500 text-right">{v.bull} bull · {v.bear} bear · {neutral} neutral</div>
      </div>
      <div className="text-[11px] text-gray-500">{c.label}</div>
      <VoteMeter score={c.score || 0} />

      <Section right={<span className="normal-case tracking-normal">weight · score</span>}>Timeframe votes</Section>
      <ul>
        {tfs.map((t) => (
          <li key={t.tf} className="py-2 border-b border-border/50 flex gap-2.5">
            <span className={cx("w-4 text-center text-sm shrink-0", tfTone(t.bias))}>{tfMark(t.bias)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-bold text-gray-100">{TF_LABEL[t.tf] || t.tf} <span className={cx("font-medium capitalize", tfTone(t.bias))}>{t.bias}</span></span>
                <span className="text-[11px] tabular-nums text-gray-500 shrink-0">{TF_WEIGHT[t.tf] ?? "–"}% · <span className={t.score > 0 ? "text-bull" : t.score < 0 ? "text-bear" : ""}>{t.score > 0 ? "+" : ""}{t.score}</span></span>
              </div>
              <div className="text-[11px] text-gray-500 leading-snug">
                EMA stack {t.stack} · RSI {t.rsi} ({t.rsi_zone}) · ADX {t.adx} ({t.trend_strength}) · MACD {t.macd}{t.squeeze ? " · squeeze" : ""}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Section right={checks.length ? <span className={cx("normal-case tracking-normal font-semibold", failedGates.length ? "text-amber-400" : "text-bull")}>{passed}/{checks.length} pass</span> : null}>Entry checklist ({b?.entry_interval || "entry TF"})</Section>
      {!checks.length && <div className="text-xs text-gray-600">Waiting for the engine…</div>}
      <ul className="space-y-1.5">
        {checks.map((x) => (
          <li key={x.key} className="flex gap-2 text-[11px] leading-snug">
            {x.ok === null ? <Minus size={13} className="text-gray-600 shrink-0 mt-0.5" /> : x.ok ? <Check size={13} className="text-bull shrink-0 mt-0.5" /> : <X size={13} className="text-bear shrink-0 mt-0.5" />}
            <span><span className="text-gray-300">{x.label}</span>{x.gate && <span className="text-[9px] text-gold/80 border border-gold/30 rounded px-1 ml-1">REQUIRED</span>}<span className="text-gray-500"> — {x.detail}</span></span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-gray-600 mt-3 leading-snug">Votes are the market read's own timeframe consensus (structure, EMA stack, MACD, RSI, ADX, weighted by timeframe) and the entry engine's checklist. A lean is context, not a trigger — only the checklist fires a signal.</p>
    </div>
  );
}

/* ----------------------------------------------------------------- PANEL */
/** Right-hand panel of the full-screen chart: LOG / NEWS / LEVELS / SIGNALS / VOTE for the pair on screen.
 *  Everything is read-only (nothing here records a signal or a trade). `symbol` defaults to the dashboard pair. */
export default function ChartSidePanel({ symbol, tf, onHide, className = "" }) {
  const { prefs } = useLive();
  const sym = symbol || prefs.symbol;
  const info = symbolInfo(sym);
  const [tab, setTabRaw] = useState(readTab);
  const setTab = useCallback((t) => { setTabRaw(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* ignore */ } }, []);
  const { b, err, etf } = useBrief(sym, tf, { scalp: true, every: 10000 });
  const needAnalysis = tab === "levels" || tab === "vote";
  const { data: analysis, err: aErr } = usePoll("/market/analysis",
    { symbol: sym, entry_interval: etf, rr: prefs.rr, min_agreement: prefs.minAgreement }, `${sym}|${etf}|${prefs.rr}|${prefs.minAgreement}`, 30000, needAnalysis, 45000);
  const blackout = b?.signal?.news?.blackout;

  return (
    <div className={cx("flex flex-col min-h-0 bg-bg", className)}>
      <div className="flex items-center border-b border-border shrink-0">
        <div className="flex-1 flex overflow-x-auto no-scrollbar" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cx("px-3 py-2.5 text-[11px] font-bold tracking-wider whitespace-nowrap border-b-2 -mb-px transition-colors",
                tab === k ? "border-gold text-gold" : "border-transparent text-gray-500 hover:text-gray-300")}>
              {label}{k === "news" && blackout ? <span className="inline-block w-1.5 h-1.5 rounded-full bg-bear ml-1 align-middle" /> : null}
            </button>
          ))}
        </div>
        {onHide && <button onClick={onHide} aria-label="Hide panel" className="px-3 text-gray-500 hover:text-bear"><X size={15} /></button>}
      </div>
      <div className="px-3 pt-2 text-[10px] text-gray-500 shrink-0 flex items-center gap-1.5">
        <span className="font-bold text-gray-300">{info.short}</span><span>·</span><span>entry {etf}</span>
        {b?.sessions?.label && <><span>·</span><span className={b.sessions.open ? "text-bull" : "text-amber-400"}>{b.sessions.label}</span></>}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {tab === "log" && <BriefBody b={b} err={err} etf={etf} symbol={sym} />}
        {tab === "news" && <NewsTab symbol={sym} blackout={blackout} />}
        {tab === "levels" && <LevelsTab d={analysis} err={aErr} symbol={sym} />}
        {tab === "signals" && <SignalsTab b={b} err={err} symbol={sym} />}
        {tab === "vote" && <VoteTab d={analysis} err={aErr} b={b} />}
      </div>
    </div>
  );
}
