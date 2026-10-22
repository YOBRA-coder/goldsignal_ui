import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import { Checks, Previews } from "./ScanLogPanel";
import { Bell, ChevronDown, Maximize2, Radar, RefreshCw, ScrollText } from "lucide-react";
import { Card, Chip, Empty } from "./ui";
import PreviewLine from "./PreviewLine";
import { useLive } from "../context/LiveContext";
import { CATS, describe, stageOf, useActivity, useBoard } from "../lib/board";
import { symbolInfo } from "../lib/constants";
import { cx, fmtAgo, fmtPrice } from "../lib/format";
import { KIND_STYLE } from "../lib/alertKinds";

const hasLevels = (s) => s && s.entry != null && s.sl != null && s.tp != null;

/** 4 dots = the 4 steps (4H direction, 4H map, 1H setup, entry trigger): how close the pair is to a signal. */
export function Progress({ n }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`${n} of 4 steps done`}>
      {[0, 1, 2, 3].map((i) => <i key={i} className={cx("w-1.5 h-1.5 rounded-full", i < n ? "bg-gold" : "bg-white/10")} />)}
    </span>
  );
}

export function PairRow({ r, entryTF, onOpen, compact = false }) {
  const [open, setOpen] = useState(false);
  const info = symbolInfo(r.symbol);
  const cat = CATS[r.category] || CATS.none;
  const s = r.snapshot || {};
  const dir = r.direction || (s.trade_type?.endsWith("BUY") ? "BUY" : s.trade_type?.endsWith("SELL") ? "SELL" : null);
  const canPreview = !compact && hasLevels(s) && (r.category === "signal" || r.category === "setup");
  return (
    <li className="py-2">
      <div className="flex items-start gap-2">
        <button onClick={() => onOpen(r)} className="min-w-0 flex-1 text-left group" title="Open the full chart">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm group-hover:text-gold">{info.label.includes("/") ? info.label : info.short}</span>
            {s.price != null && <span className="text-xs text-gray-500 tabular-nums">{fmtPrice(s.price, info.precision)}</span>}
            {dir && r.category !== "aside" && <span className={cx("text-[11px] font-bold", dir === "BUY" ? "text-bull" : "text-bear")}>{dir}</span>}
            <Progress n={stageOf(r)} />
          </div>
          <p className="text-[11px] text-gray-500 leading-snug mt-0.5 break-words">{describe(r, entryTF)}</p>
        </button>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <Chip tone={cat.tone}>{cat.label}</Chip>
            {r.agreement != null && <Chip tone="gray">{Math.round(r.agreement)}%{r.grade ? ` · ${r.grade}` : ""}</Chip>}
          </div>
          <div className="flex items-center gap-1">
            {r.open_trades?.length > 0 && <span className="text-[10px] text-gold">{r.open_trades.length} open trade{r.open_trades.length > 1 ? "s" : ""}</span>}
            {canPreview && (
              <button onClick={() => setOpen((v) => !v)} className="text-[10px] text-gray-400 hover:text-gold flex items-center gap-0.5">
                preview <ChevronDown size={11} className={cx("transition-transform", open && "rotate-180")} />
              </button>
            )}
            <button onClick={() => onOpen(r)} aria-label="Open chart" className="text-gray-500 hover:text-gold"><Maximize2 size={12} /></button>
          </div>
        </div>
      </div>
      {open && canPreview && (
        <div className="mt-2"><PreviewLine symbol={r.symbol} interval={entryTF} direction={dir} entry={s.entry} sl={s.sl} tp={s.tp} status="plan" zone={s.zone && s.zone.top != null ? s.zone : null} /></div>
      )}
    </li>
  );
}

function Section({ title, rows, ...rest }) {
  if (!rows.length) return null;
  return (
    <div className="mt-3 first:mt-0">
      <div className="text-[10px] font-semibold tracking-wider text-amber-400/90 uppercase mb-0.5">{title}</div>
      <ul className="divide-y divide-border/50">{rows.map((r) => <PairRow key={r.symbol} r={r} {...rest} />)}</ul>
    </div>
  );
}

export function useOpenFromRow() {
  const { openChart, prefs } = useLive();
  return (r) => {
    const s = r.snapshot || {};
    openChart({ symbol: r.symbol, tf: prefs.entryTF, category: r.category, title: r.status?.replace(/_/g, " "),
      note: describe(r, prefs.entryTF),
      plan: r.category === "signal" && hasLevels(s) ? { ts: r.ts, direction: r.direction, entry: s.entry, sl: s.sl, tp: s.tp } : undefined });
  };
}

/** "Happening now": which pair is doing what, and whether it is ready. */
export function HappeningNow({ board, entryTF, minAgreement }) {
  const { live } = useLive();
  const onOpen = useOpenFromRow();
  const { rows, scanning, scanAll, err } = board;
  const by = (c) => rows.filter((r) => r.category === c).sort((a, b) => (b.agreement || 0) - (a.agreement || 0));
  const sig = by("signal"), setup = by("setup"), watch = by("watch"), aside = by("aside"), none = rows.filter((r) => r.category === "none");
  const [showAside, setShowAside] = useState(false);
  return (
    <Card title={`Happening now · entry ${entryTF.toUpperCase()} · min ${minAgreement}%`} icon={Radar}
      right={<button onClick={scanAll} disabled={!!scanning} className="text-[11px] px-2.5 py-1 rounded-lg border border-border text-gray-300 hover:border-gold/50 flex items-center gap-1 disabled:opacity-60">
        <RefreshCw size={11} className={scanning ? "animate-spin" : ""} />{scanning ? `Scanning ${Math.min(scanning.done + 3, scanning.total)}/${scanning.total}` : "Scan all pairs"}</button>}>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {live?.sessions?.label && <Chip tone="blue">{live.sessions.label}</Chip>}
        <Chip tone="bull">{sig.length} signal{sig.length === 1 ? "" : "s"} live</Chip>
        <Chip tone="amber">{setup.length} setup{setup.length === 1 ? "" : "s"} waiting</Chip>
        <Chip tone="blue">{watch.length} on watch</Chip>
        <Chip tone="gray">{aside.length} standing aside</Chip>
      </div>
      {err && <div className="text-xs text-bear mb-2">{err}</div>}
      {!rows.length && <Empty>Loading pairs…</Empty>}
      <Section title="Signals live — fired and being tracked" rows={sig} entryTF={entryTF} onOpen={onOpen} />
      <Section title="Setups waiting for a trigger" rows={setup} entryTF={entryTF} onOpen={onOpen} />
      <Section title="Watching for a pullback" rows={watch} entryTF={entryTF} onOpen={onOpen} />
      {(aside.length > 0 || none.length > 0) && (
        <div className="mt-3">
          <button onClick={() => setShowAside((v) => !v)} className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase flex items-center gap-1">
            Standing aside / not scanned ({aside.length + none.length}) <ChevronDown size={11} className={cx(showAside && "rotate-180")} />
          </button>
          {showAside && <ul className="divide-y divide-border/50 mt-1">{[...aside, ...none].map((r) => <PairRow key={r.symbol} r={r} entryTF={entryTF} onOpen={onOpen} compact />)}</ul>}
        </div>
      )}
    </Card>
  );
}

/** Everything the engine knew when a pair changed state: levels, zone, bias, smart-money facts, every check and preview. */
function ActivityDetail({ r }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let dead = false;
    if (!r.id) return undefined;
    api.get(`/signals/activity/${r.id}`).then((x) => { if (!dead) setD(x.data); }).catch(() => { if (!dead) setErr(true); });
    return () => { dead = true; };
  }, [r.id]);
  const s = (d?.snapshot || r.snapshot) || {};
  const z = s.zone;
  const smc = s.smc;
  const px = (v) => (v == null ? "-" : fmtPrice(v, r.symbol));
  const facts = [
    ["Headline", d?.headline || r.headline],
    ["4H / 1H bias", `${r.bias_4h || "-"} / ${r.bias_1h || "-"}`],
    ["Price then", s.price != null ? px(s.price) : null],
    ["Entry / SL / TP", s.entry != null ? `${px(s.entry)} / ${px(s.sl)} / ${px(s.tp)}${s.rr ? ` (${s.rr}R)` : ""}` : null],
    ["Zone", z ? `${z.tf || ""} ${z.source || ""} ${z.type || ""} ${px(z.bottom)}–${px(z.top)}${z.distance_atr != null ? ` · ${Number(z.distance_atr).toFixed(1)} ATR away` : ""}` : null],
    ["Zone tapped / trigger", `${s.zone_tapped ? "tapped" : "not tapped"} · ${s.trigger_ready ? "trigger ready" : "no trigger yet"}${s.pattern ? ` (${s.pattern})` : ""}`],
    ["Candle forming", s.forming],
    ["Session", s.session],
    ["AMD phase", s.amd],
    ["Grade / type", [r.grade, s.trade_type].filter(Boolean).join(" · ") || null],
  ].filter(([, v]) => v);
  return (
    <div className="pl-5 pr-1 pb-2 text-xs">
      <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1">
        {facts.map(([k, v]) => (<React.Fragment key={k}><dt className="text-gray-500">{k}</dt><dd className="text-gray-300 break-words">{v}</dd></React.Fragment>))}
      </dl>
      {smc && (
        <div className="flex flex-wrap gap-1 mt-2">
          {smc.idm && <Chip tone="gold">IDM swept</Chip>}{smc.breaker && <Chip tone="blue">Breaker</Chip>}
          {smc.htf && <Chip tone="bull">Inside 4H zone</Chip>}{smc.disp && <Chip tone="bull">Displacement</Chip>}
          {smc.fresh && <Chip tone="bull">Fresh zone</Chip>}{smc.kz && <Chip tone="gray">Kill zone</Chip>}
        </div>
      )}
      {!d && !err && <div className="text-gray-500 mt-2">Loading the full breakdown…</div>}
      {err && <div className="text-gray-500 mt-2">The full breakdown is no longer stored for this row.</div>}
      {d && <div className="mt-2"><div className="text-[10px] uppercase text-gray-500">Every check</div><Checks checks={d.checks} /><Previews previews={d.previews} /></div>}
    </div>
  );
}

const CLEAR_KEY = "gs_log_cleared";
export function ActivityLog({ rows, entryTF, limit = 60 }) {
  const { openChart } = useLive();
  const [clearedAt, setClearedAt] = useState(() => { try { return +localStorage.getItem(CLEAR_KEY) || 0; } catch { return 0; } });
  const [open, setOpen] = useState(null);
  const list = rows.filter((r) => r.ts > clearedAt).slice(0, limit);
  const clear = () => { const t = Math.floor(Date.now() / 1000); setClearedAt(t); try { localStorage.setItem(CLEAR_KEY, String(t)); } catch { /* ignore */ } };
  return (
    <Card title="Activity log" icon={ScrollText} right={<button onClick={clear} className="text-[11px] px-2.5 py-1 rounded-lg border border-border text-gray-300 hover:border-gold/50">Clear</button>}>
      {!list.length ? <Empty>Nothing yet — changes show here as pairs move from watch → setup → signal.</Empty> : (
        <ul className="max-h-[560px] overflow-y-auto -mr-2 pr-2 space-y-0.5">
          {list.map((r, i) => {
            const to = CATS[r.to] || CATS.none, from = CATS[r.from] || CATS.none;
            const short = symbolInfo(r.symbol).label.includes("/") ? symbolInfo(r.symbol).label.replace("/", "") : symbolInfo(r.symbol).short;
            return (
              <li key={`${r.symbol}-${r.ts}-${i}`}>
                <div className="flex items-center gap-1">
                  <button onClick={() => setOpen(open === r.ts + r.symbol ? null : r.ts + r.symbol)}
                    className="flex-1 min-w-0 flex items-center gap-2 py-1.5 text-left hover:bg-white/[0.03] rounded-lg px-1 -mx-1" title="Show every detail">
                    <i className={cx("w-2 h-2 rounded-full shrink-0", to.dot)} />
                    <span className={cx("text-xs text-gray-200 min-w-0 flex-1", open === r.ts + r.symbol ? "" : "truncate")}>
                      <b>{short}</b> <span className="text-gray-500">{from.label.toLowerCase()} → </span>
                      <span className={cx(r.to === "signal" && "text-bull font-semibold")}>{to.label.toLowerCase()}</span>
                      {r.direction && r.to !== "aside" && <span className={r.direction === "BUY" ? " text-bull" : " text-bear"}> {r.direction}</span>}
                      <span className="text-gray-500"> ({r.agreement != null ? `${Math.round(r.agreement * 10) / 10}%, ` : ""}{r.entry_interval})</span>
                    </span>
                    <span className="text-[11px] text-gray-500 shrink-0">{fmtAgo(r.ts)}</span>
                    <ChevronDown size={13} className={cx("text-gray-500 shrink-0 transition-transform", open === r.ts + r.symbol && "rotate-180")} />
                  </button>
                  <button aria-label="Open chart" title="Open the full chart" className="p-1.5 text-gray-500 hover:text-gold shrink-0"
                    onClick={() => openChart({ symbol: r.symbol, tf: r.entry_interval || entryTF, category: r.to, title: r.status?.replace(/_/g, " "), note: r.headline,
                      plan: r.to === "signal" && r.snapshot?.entry != null ? { ts: r.ts, direction: r.direction, entry: r.snapshot.entry, sl: r.snapshot.sl, tp: r.snapshot.tp } : undefined })}>
                    <Maximize2 size={13} />
                  </button>
                </div>
                {open === r.ts + r.symbol && <ActivityDetail r={r} />}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function AlertsFeed({ limit = 30 }) {
  const { alerts, markRead, openChart, history, prefs } = useLive();
  return (
    <Card title="Alerts" icon={Bell} right={<button onClick={() => markRead(null)} className="text-[11px] text-gold hover:underline">Mark all read</button>}>
      {!alerts.length ? <Empty>No alerts yet. Signals, take-profits, stop-losses, setups and news show up here.</Empty> : (
        <ul className="divide-y divide-border/60 max-h-[420px] overflow-y-auto">
          {alerts.slice(0, limit).map((a) => {
            const k = KIND_STYLE[a.kind] || KIND_STYLE.info;
            const Icon = k.icon;
            const rec = a.signal_id ? history.find((h) => h.id === a.signal_id) : null;
            return (
              <li key={a.id}>
                <button disabled={!a.symbol} onClick={() => { markRead([a.id]); a.symbol && openChart({ symbol: a.symbol, tf: rec?.entry_interval || prefs.entryTF, title: a.title, note: a.message,
                    firedTs: rec ? (rec.trigger_ts || Math.floor(new Date(rec.created_at).getTime() / 1000)) : undefined,
                    plan: rec ? { ts: rec.trigger_ts || Math.floor(new Date(rec.created_at).getTime() / 1000), direction: rec.direction, entry: rec.entry_price, sl: rec.stop_loss, tp: rec.take_profit } : undefined }); }}
                  className={cx("w-full flex gap-3 py-2.5 text-left", !a.seen && "bg-white/[0.03]")}>
                  <Icon size={18} className={cx("mt-0.5 shrink-0", k.cls.split(" ")[0])} />
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium flex items-center gap-2">{a.title}{!a.seen && <i className="w-1.5 h-1.5 rounded-full bg-gold" />}</span>
                    <span className="block text-xs text-gray-400 break-words">{a.message}</span>
                    <span className="block text-[11px] text-gray-600 mt-0.5">{fmtAgo(a.created_at)}{a.symbol ? ` · ${symbolInfo(a.symbol).short} · tap to open chart` : ""}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function useBoardAndLog() {
  const { prefs } = useLive();
  const board = useBoard(prefs);
  const log = useActivity();
  return { board, log };
}
