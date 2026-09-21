import React, { useEffect, useRef, useState } from "react";
import { useLive } from "../context/LiveContext";
import { symbolInfo } from "../lib/constants";
import { cx, fmtPrice } from "../lib/format";

/** Ticking last price with up/down flash + % change. */
export default function LivePrice({ className = "", big = false }) {
  const { quote, prefs } = useLive();
  const p = symbolInfo(prefs.symbol).precision;
  const prev = useRef(null);
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (!quote) return;
    if (prev.current != null && quote.last !== prev.current) {
      setFlash(quote.last > prev.current ? "up" : "down");
      const t = setTimeout(() => setFlash(null), 700);
      prev.current = quote.last;
      return () => clearTimeout(t);
    }
    prev.current = quote.last;
  }, [quote]);
  if (!quote) return <span className={cx("text-gray-600 text-sm", className)}>—</span>;
  const up = quote.change >= 0;
  return (
    <span className={cx("inline-flex items-baseline gap-2 tabular-nums", className)}>
      <span className={cx(big ? "text-2xl font-black" : "text-base font-bold", "transition-colors",
        flash === "up" ? "text-bull" : flash === "down" ? "text-bear" : "text-gray-100")}>{fmtPrice(quote.last, p)}</span>
      <span className={cx("text-xs font-semibold", up ? "text-bull" : "text-bear")}>{up ? "+" : ""}{quote.change_pct.toFixed(2)}%</span>
    </span>
  );
}
