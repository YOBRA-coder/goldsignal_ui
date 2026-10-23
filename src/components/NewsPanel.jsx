import React, { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, ChevronDown, ChevronUp, ClipboardList, ExternalLink, Newspaper, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../api";
import { Card, Chip, Empty, Segmented, Spinner } from "./ui";
import { useLive } from "../context/LiveContext";
import { symbolInfo } from "../lib/constants";
import { cx, fmtAgo, fmtCountdown, fmtDateTime, fmtTime } from "../lib/format";

const IMPACT_TONE = { high: "bear", medium: "amber", low: "gray" };
const FILTERS = [{ value: "off", label: "Off" }, { value: "high", label: "High impact" }, { value: "all", label: "High + medium" }];

/** One calendar row: when, what, forecast / previous, and (after the release) what price did. */
const DIR_ICON = { up: <ArrowUp size={12} className="text-bull" />, down: <ArrowDown size={12} className="text-bear" />, none: <ArrowRight size={12} className="text-gray-500" /> };
const PHASE_TONE = { blackout: "bear", settling: "amber", prepare: "amber", digest: "blue", later: "gray", done: "gray" };

/** "What next" briefing for one event: what to do now, the beat / miss scenarios for the selected pair, a before / during / after plan. */
function PrepBox({ p }) {
  return (
    <div className="mt-2 rounded-xl border border-border bg-panel2/60 p-3 space-y-3 text-xs">
      <div className="flex items-start gap-2">
        <Chip tone={PHASE_TONE[p.phase] || "gray"}>{p.phase_label}</Chip>
        <div className="text-gray-100 leading-snug"><b>Now:</b> {p.now}</div>
      </div>
      {p.blackout && p.phase !== "done" && (
        <div className="text-[11px] text-gray-400">Signals paused {fmtTime(p.blackout.start)} – {fmtTime(p.blackout.end)}.</div>
      )}
      {p.result && (
        <div className={cx("rounded-lg px-2.5 py-2 border", p.result.dir === "up" ? "border-bull/40 bg-bull/10" : p.result.dir === "down" ? "border-bear/40 bg-bear/10" : "border-border bg-panel")}>
          <div className="text-gray-100 leading-snug">{p.result.text}</div>
          {p.result.next && <div className="text-gray-300 mt-1 leading-snug"><b>What next:</b> {p.result.next}</div>}
        </div>
      )}
      <div>
        <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Why it matters</div>
        <p className="text-gray-300 leading-snug">{p.why}</p>
        <p className="text-gray-500 leading-snug mt-1">{p.typical}</p>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Scenarios for {p.pair}</div>
        <ul className="space-y-1">
          {p.scenarios.map((sc) => (
            <li key={sc.case} className="flex items-start gap-1.5 leading-snug">
              <span className="mt-0.5 shrink-0">{DIR_ICON[sc.dir] || DIR_ICON.none}</span>
              <span className="text-gray-300"><b className="text-gray-100">{sc.case}</b> ({sc.read}): {sc.text}</span>
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-gray-600 mt-1">Typical tendencies, not predictions - the first spike often reverses.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        {p.checklist.map((c) => (
          <div key={c.when} className="rounded-lg bg-panel border border-border/70 p-2">
            <div className="text-[10px] uppercase tracking-wide text-gold mb-1">{c.when}</div>
            <ul className="space-y-1 list-disc pl-3.5 text-gray-300 leading-snug">{c.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EventRow({ e, unit }) {
  const past = e.minutes < 0;
  const r = e.reaction;
  const [open, setOpen] = useState(false);
  return (
    <li className={cx("py-2 flex gap-2.5", !e.relevant && "opacity-60")}>
      <span className={cx("w-1.5 rounded-full shrink-0 mt-0.5 self-stretch", e.impact === "high" ? "bg-bear" : e.impact === "medium" ? "bg-amber-400" : "bg-gray-600")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-gray-500 tabular-nums">{fmtDateTime(e.ts)}</span>
          <Chip tone="gray">{e.currency}</Chip>
          {e.source === "rule" && <Chip tone="gray" className="opacity-70">scheduled</Chip>}
          {e.source === "manual" && <Chip tone="violet">yours</Chip>}
          <span className={cx("text-[11px] ml-auto tabular-nums", past ? "text-gray-500" : e.minutes <= 60 ? "text-amber-400 font-semibold" : "text-gray-400")}>
            {past ? fmtAgo(e.ts) : `in ${fmtCountdown(e.ts)}`}
          </span>
        </div>
        <div className="text-sm text-gray-100 leading-snug">{e.title}</div>
        {(e.forecast || e.previous || e.actual) && (
          <div className="text-[11px] text-gray-500 tabular-nums">
            {e.actual && <>actual <b className="text-gray-200">{e.actual}</b> · </>}
            {e.forecast && <>forecast {e.forecast}</>}{e.forecast && e.previous && " · "}{e.previous && <>previous {e.previous}</>}
          </div>
        )}
        {r && (
          <div className={cx("text-[11px] mt-0.5", r.dir === "up" ? "text-bull" : "text-bear")}>
            {r.dir === "up" ? "▲" : "▼"} 30 min after: moved {r.move > 0 ? "+" : ""}{Number(r.move).toFixed(unit)} (range {Number(r.range).toFixed(unit)}
            {r.atr_x ? ` = ${r.atr_x}× a normal 5m candle` : ""})
          </div>
        )}
        {e.prep && (
          <>
            <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
              className="mt-1 flex items-center gap-1 text-[11px] text-gold hover:underline">
              <ClipboardList size={12} /> {past ? "What it meant & what next" : "How to prepare"} {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {open && <PrepBox p={e.prep} />}
          </>
        )}
      </div>
    </li>
  );
}

function AddEvent({ onDone }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", currency: "USD", when: "", impact: "high" });
  const [busy, setBusy] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)} className="text-xs text-gold hover:underline flex items-center gap-1"><Plus size={12} /> Add your own event</button>;
  const save = async () => {
    if (!f.title.trim() || !f.when) return;
    setBusy(true);
    try {
      await api.post("/news/manual", { title: f.title, currency: f.currency, impact: f.impact, ts: Math.floor(new Date(f.when).getTime() / 1000) });
      setOpen(false); setF({ title: "", currency: "USD", when: "", impact: "high" }); onDone?.();
    } finally { setBusy(false); }
  };
  const inp = "bg-panel2 border border-border rounded-lg px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gold/50";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className={cx(inp, "flex-1 min-w-[140px]")} placeholder="e.g. Powell speech" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <input className={cx(inp, "w-16")} value={f.currency} maxLength={3} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} />
      <input type="datetime-local" className={inp} value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} />
      <select className={inp} value={f.impact} onChange={(e) => setF({ ...f, impact: e.target.value })}><option value="high">high</option><option value="medium">medium</option></select>
      <button disabled={busy} onClick={save} className="text-xs px-3 py-1.5 rounded-lg bg-gold text-black font-semibold">Add</button>
      <button onClick={() => setOpen(false)} className="text-xs text-gray-500">Cancel</button>
    </div>
  );
}

/** Economic calendar + headlines for the selected pair, and the news-blackout setting.
 *  compact = the dashboard card (next events only); otherwise the full News page. */
export default function NewsPanel({ compact = false }) {
  const { prefs, live } = useLive();
  const info = symbolInfo(prefs.symbol);
  const [cal, setCal] = useState(null);
  const [heads, setHeads] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [set, setSet] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/news/calendar", { params: { symbol: prefs.symbol, days_back: compact ? 1 : 3, days_ahead: compact ? 3 : 10, impact: compact ? "high" : "medium", all_currencies: !compact } });
      setCal(data); setSet(data.settings); setErr(null);
    } catch (e) { setErr(e?.response?.data?.detail || e?.message || "Could not load the calendar"); }
    if (!compact) {
      try { const { data } = await api.get("/news/headlines", { params: { symbol: prefs.symbol, limit: 15 } }); setHeads(data.items || []); } catch { /* optional */ }
    }
  }, [prefs.symbol, compact]);
  useEffect(() => { setCal(null); load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const refresh = async () => { setBusy(true); try { await api.post("/news/refresh"); await load(); } finally { setBusy(false); } };
  const save = async (patch) => { setSet((s) => ({ ...s, ...patch })); try { const { data } = await api.put("/news/settings", patch); setSet(data); } catch { /* ignore */ } };

  const nw = live?.signal?.news;
  const evs = cal?.events || [];
  const upcoming = evs.filter((e) => e.minutes >= -5).slice(0, compact ? 4 : 40);
  const recent = evs.filter((e) => e.minutes < -5).reverse().slice(0, compact ? 0 : 20);
  const unit = info.precision;
  const feedDown = cal?.status && !cal.status.last_ok;

  const body = (
    <>
      {nw?.blackout && (
        <div className="flex items-start gap-2 text-xs rounded-xl border border-bear/40 bg-bear/10 text-bear px-3 py-2 mb-2">
          <ShieldAlert size={15} className="mt-0.5 shrink-0" />
          <div><b>Signals paused:</b> {nw.blackout.label} — until {fmtTime(nw.blackout.end)}. Spreads widen and candles jump around a release.</div>
        </div>
      )}
      {err && !cal && <div className="text-xs text-amber-400">{err}</div>}
      {!cal && !err && <div className="flex items-center gap-2 text-xs text-gray-500"><Spinner /> Loading the calendar…</div>}
      {feedDown && (
        <div className="text-[11px] text-amber-400/90 mb-2">
          Live calendar feed not reachable{cal.status.error ? ` (${cal.status.error.slice(0, 60)})` : ""} — showing the built-in NFP / FOMC / jobless-claims schedule and anything you add. It retries every 30 min.
        </div>
      )}
      {cal && !upcoming.length && <Empty>No {compact ? "high-impact " : ""}events for {info.short} in the next days.</Empty>}
      {upcoming.length > 0 && <ul className="divide-y divide-border/60">{upcoming.map((e, i) => <EventRow key={`${e.ts}-${e.title}-${i}`} e={e} unit={unit} />)}</ul>}
      {recent.length > 0 && (<>
        <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-4 mb-1">Already released — and what price did</div>
        <ul className="divide-y divide-border/60">{recent.map((e, i) => <EventRow key={`${e.ts}-${e.title}-${i}`} e={e} unit={unit} />)}</ul>
      </>)}
    </>
  );

  if (compact) {
    return (
      <Card title="News ahead" icon={Newspaper}
        right={<Link to="/news" className="text-xs text-gold hover:underline">All news</Link>}>
        {body}
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
      <div className="xl:col-span-7 space-y-4">
        <Card title={`Economic calendar · ${info.short} (all currencies shown, yours highlighted)`} icon={Newspaper}
          right={<button onClick={refresh} aria-label="Refresh calendar" className="text-gray-400 hover:text-gold"><RefreshCw size={14} className={cx(busy && "animate-spin")} /></button>}>
          {body}
          <div className="mt-3 pt-3 border-t border-border/60"><AddEvent onDone={load} /></div>
        </Card>
      </div>
      <div className="xl:col-span-5 space-y-4">
        <Card title="News protection" icon={ShieldAlert}>
          <p className="text-xs text-gray-400 mb-2 leading-snug">
            CPI, NFP, FOMC and similar releases move gold and the dollar pairs several times a normal candle, both ways, in seconds.
            With protection on the engine gives <b>no new signals</b> in a window around them — live, in the chart replay and in backtests — and tells you before it starts.
          </p>
          <Segmented size="sm" value={set?.filter || "high"} onChange={(v) => save({ filter: v })} options={FILTERS} />
          <div className="grid grid-cols-2 gap-3 mt-3 text-xs text-gray-400">
            {[["before", "Minutes before"], ["after", "Minutes after"]].map(([k, lab]) => (
              <label key={k} className="flex items-center justify-between gap-2">{lab}
                <input type="number" min={0} max={240} step={5} value={set?.[k] ?? 0} onChange={(e) => save({ [k]: Number(e.target.value) })}
                  className="w-20 bg-panel2 border border-border rounded-lg px-2 py-1 text-gray-100 text-right" />
              </label>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 mt-2">CPI / NFP / FOMC / rate decisions use 1.5× these minutes. "High + medium" also pauses 10 min before / 5 after medium releases.</p>
        </Card>
        <Card title="Headlines" icon={Newspaper}>
          {!heads.length ? <Empty>No headlines reachable right now (FXStreet / ForexLive feeds).</Empty> : (
            <ul className="divide-y divide-border/60">
              {heads.map((h, i) => (
                <li key={i} className="py-2.5">
                  <div className="text-sm text-gray-100 leading-snug font-medium">{h.major && <Chip tone="amber" className="mr-1.5">key</Chip>}{h.title}</div>
                  {h.summary && <p className="text-xs text-gray-400 leading-relaxed mt-1">{h.summary}</p>}
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-600">
                    <span>{h.source} · {fmtAgo(h.ts)}</span>
                    {h.link && (
                      <a href={h.link} target="_blank" rel="noreferrer" className="ml-auto text-xs text-gold hover:underline inline-flex items-center gap-1">
                        Read more <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
