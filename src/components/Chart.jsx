import React, { useEffect, useRef } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";
import { drawOverlay } from "../lib/chartOverlay";

const fmtTick = (t, type) => {
  const d = new Date(t * 1000);
  if (type === 0) return String(d.getFullYear());
  if (type === 1) return d.toLocaleString([], { month: "short" });
  if (type === 2) return d.toLocaleString([], { day: "numeric", month: "short" });
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
};
const fmtCross = (t) =>
  new Date(t * 1000).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * Candlestick chart + strategy overlay.
 *  candles  : [{time, open, high, low, close, volume, session?}]  (UTC epoch seconds)
 *  analysis : the `analysis` object from /signals/live (4h / 1h / entry / levels / trade)
 *  layers   : {htf, setup, trigger, levels, sessions}
 */
export default function Chart({ candles, analysis, own, tf, layers, marks, precision = 2, barSeconds = 900,
  viewKey, hasVolume = true, heightClass = "h-[340px] md:h-[460px] xl:h-[540px]" }) {
  const wrapRef = useRef(null);
  const elRef = useRef(null);
  const canvasRef = useRef(null);
  const legendRef = useRef(null);
  const api = useRef({});          // chart, series, volume
  const state = useRef({ times: [], runs: [], n: 0, ver: 0, sig: "" });
  const props = useRef({});
  props.current = { analysis, own, tf, layers, precision, barSeconds };

  // ---------- create chart once
  useEffect(() => {
    const el = elRef.current;
    const chart = createChart(el, {
      width: el.clientWidth, height: el.clientHeight,
      layout: { background: { color: "transparent" }, textColor: "#9ca3af", fontSize: 11 },
      grid: { vertLines: { color: "rgba(35,42,53,0.45)" }, horzLines: { color: "rgba(35,42,53,0.45)" } },
      rightPriceScale: { borderColor: "#232a35", scaleMargins: { top: 0.08, bottom: 0.2 } },
      timeScale: { borderColor: "#232a35", timeVisible: true, secondsVisible: false, rightOffset: 8, tickMarkFormatter: fmtTick },
      localization: { timeFormatter: fmtCross },
      crosshair: { mode: CrosshairMode.Normal },
      kineticScroll: { touch: true, mouse: false },
    });
    const series = chart.addCandlestickSeries({
      upColor: "#12b886", downColor: "#ff4d4f", borderVisible: false,
      wickUpColor: "#12b886", wickDownColor: "#ff4d4f",
    });
    const vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol", lastValueVisible: false, priceLineVisible: false });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });
    api.current = { chart, series, vol };

    const setLegend = (c) => {
      if (!legendRef.current || !c) return;
      const p = props.current.precision;
      const up = c.close >= c.open;
      legendRef.current.innerHTML =
        `<span style="color:#6b7280">O</span> ${c.open.toFixed(p)} <span style="color:#6b7280">H</span> ${c.high.toFixed(p)} ` +
        `<span style="color:#6b7280">L</span> ${c.low.toFixed(p)} <span style="color:#6b7280">C</span> <b style="color:${up ? "#12b886" : "#ff4d4f"}">${c.close.toFixed(p)}</b>`;
    };
    api.current.setLegend = setLegend;
    chart.subscribeCrosshairMove((param) => {
      const c = param.seriesData?.get(series);
      if (c) setLegend(c);
      else if (api.current.last) setLegend(api.current.last);
    });

    const sizeCanvas = () => {
      const cv = canvasRef.current;
      const dpr = window.devicePixelRatio || 1;
      const w = el.clientWidth, h = el.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      state.current.sig = "";
    };
    sizeCanvas();
    const ro = new ResizeObserver(() => {
      chart.resize(el.clientWidth, el.clientHeight);
      sizeCanvas();
    });
    ro.observe(el);

    // ---------- overlay helpers (time/price -> pixels)
    const ts = chart.timeScale();
    const logicalOf = (t) => {
      const { times } = state.current;
      const n = times.length;
      if (!n) return null;
      const step = props.current.barSeconds;
      if (t <= times[0]) return (t - times[0]) / step;
      if (t >= times[n - 1]) return n - 1 + (t - times[n - 1]) / step;
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (times[m] <= t) lo = m; else hi = m; }
      return lo + (t - times[lo]) / (times[lo + 1] - times[lo]);
    };
    const timeAtLogical = (l) => {
      const { times } = state.current;
      const n = times.length;
      const step = props.current.barSeconds;
      if (l <= 0) return times[0] + l * step;
      if (l >= n - 1) return times[n - 1] + (l - (n - 1)) * step;
      const i = Math.floor(l);
      return times[i] + (l - i) * (times[i + 1] - times[i]);
    };
    const x = (t) => { const l = logicalOf(t); return l == null ? null : ts.logicalToCoordinate(l); };
    const y = (p) => series.priceToCoordinate(p);

    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const cv = canvasRef.current;
      const st = state.current;
      if (!cv || !st.n) return;
      const W = ts.width(), H = el.clientHeight - ts.height();
      const r = ts.getVisibleLogicalRange();
      const sig = [W, H, r?.from, r?.to, y(1000), y(2000), st.ver, cv.width].join("|");
      if (sig === st.sig) return;
      st.sig = sig;
      const ctx = cv.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { analysis: a, own: ownS, tf: tfc, layers: ly, precision: pr } = props.current;
      drawOverlay(ctx, {
        W, H, x, y, tAtX: (px) => timeAtLogical(ts.coordinateToLogical(px) ?? st.n - 1),
        analysis: a, own: ownS, tf: tfc, layers: ly || {}, precision: pr, sessionRuns: st.runs, compact: el.clientWidth < 560,
      });
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      chart.remove();
      api.current = {};
    };
  }, []);

  // ---------- precision
  useEffect(() => {
    const { series } = api.current;
    if (!series) return;
    series.applyOptions({ priceFormat: { type: "price", precision, minMove: 1 / 10 ** precision } });
  }, [precision]);

  // ---------- candle data
  useEffect(() => {
    const { chart, series, vol, setLegend } = api.current;
    if (!chart || !candles?.length) return;
    const data = candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }));
    const st = state.current;
    const prevN = st.n, fresh = st.viewKey !== viewKey;
    const vols = candles.map((c) => c.volume || 0);
    const hasVol = hasVolume && vols.some((v) => v > 0);
    const volPoint = (i) => {
      const c = candles[i];
      const w = vols.slice(Math.max(0, i - 20), i);
      const avg = w.length ? w.reduce((a, b) => a + b, 0) / w.length : 0;
      const spike = avg > 0 && c.volume >= 1.5 * avg;
      const up = c.close >= c.open;
      return { time: c.time, value: c.volume, color: spike ? "rgba(212,175,55,0.85)" : up ? "rgba(18,184,134,0.35)" : "rgba(255,77,79,0.35)" };
    };

    // Live flow: when the history is unchanged, only push the forming / new candles (no flicker, keeps the
    // user's zoom & scroll, auto-follows the right edge). A full reload happens on TF/symbol change and every 60 s.
    const incremental = !fresh && prevN > 0 && st.first === data[0].time && data.length >= prevN
      && data.length - prevN < 200 && Date.now() - (st.fullAt || 0) < 60000;
    const range = chart.timeScale().getVisibleLogicalRange();
    if (incremental) {
      for (let i = prevN - 1; i < data.length; i++) {
        series.update(data[i]);
        if (hasVol) vol.update(volPoint(i));
      }
    } else {
      series.setData(data);
      vol.setData(hasVol ? candles.map((_, i) => volPoint(i)) : []);
      st.fullAt = Date.now();
    }
    chart.priceScale("right").applyOptions({ scaleMargins: { top: 0.08, bottom: hasVol ? 0.2 : 0.1 } });

    st.first = data[0].time;
    st.times = data.map((d) => d.time);
    st.n = data.length;
    // session runs (contiguous bars sharing a session tag)
    const runs = [];
    candles.forEach((c, i) => {
      if (!c.session) return;
      const last = runs[runs.length - 1];
      const end = i + 1 < candles.length ? candles[i + 1].time : c.time + props.current.barSeconds;
      if (last && last.tag === c.session && last.i1 === i - 1) { last.t1 = end; last.i1 = i; }
      else if (c.session !== "off") runs.push({ tag: c.session, t0: c.time, t1: end, i1: i });
    });
    st.runs = runs;
    st.ver++;
    api.current.last = { ...data[data.length - 1] };
    setLegend?.(api.current.last);

    if (fresh || !range) {
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, data.length - 130), to: data.length + 8 });
      st.viewKey = viewKey;
    } else if (!incremental) {
      const atEdge = range.to >= prevN - 1;
      const shift = atEdge ? data.length - prevN : 0;
      chart.timeScale().setVisibleLogicalRange({ from: range.from + shift, to: range.to + shift });
    }
  }, [candles, viewKey, hasVolume]);

  // ---------- markers
  useEffect(() => {
    const { series } = api.current;
    const times = state.current.times;
    if (!series || !times.length) return;
    const snap = (t) => {
      let lo = 0, hi = times.length - 1;
      if (t < times[0]) return null;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (times[m] <= t) lo = m; else hi = m - 1; }
      return times[lo];
    };
    const list = (marks || []).map((m) => ({ ...m, time: snap(m.time) })).filter((m) => m.time)
      .sort((a, b) => a.time - b.time);
    series.setMarkers(list);
  }, [marks, candles]);

  useEffect(() => { state.current.ver++; }, [analysis, own, layers]);

  return (
    <div ref={wrapRef} className={`relative w-full ${heightClass}`}>
      <div ref={elRef} className="absolute inset-0" />
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
      <div ref={legendRef} className="absolute left-2 top-1.5 z-10 text-[11px] font-mono text-gray-300 pointer-events-none bg-bg/60 rounded px-1.5 py-0.5" />
    </div>
  );
}
