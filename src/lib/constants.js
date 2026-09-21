export const SYMBOLS = [
  { value: "GC=F", label: "Gold Futures", short: "XAU/USD", note: "COMEX GC=F (best intraday data)", precision: 2 },
  { value: "XAUUSD=X", label: "Gold Spot", short: "XAU/USD spot", note: "Spot gold (no volume on Yahoo)", precision: 2 },
  { value: "SI=F", label: "Silver Futures", short: "XAG", note: "COMEX silver", precision: 3 },
  { value: "EURUSD=X", label: "EUR/USD", short: "EURUSD", note: "Forex", precision: 5 },
  { value: "GBPUSD=X", label: "GBP/USD", short: "GBPUSD", note: "Forex", precision: 5 },
  { value: "USDJPY=X", label: "USD/JPY", short: "USDJPY", note: "Forex", precision: 3 },
];

export const TIMEFRAMES = [
  { value: "1m", label: "1m", seconds: 60 },
  { value: "5m", label: "5m", seconds: 300 },
  { value: "15m", label: "15m", seconds: 900 },
  { value: "30m", label: "30m", seconds: 1800 },
  { value: "1h", label: "1H", seconds: 3600 },
  { value: "4h", label: "4H", seconds: 14400 },
  { value: "1d", label: "1D", seconds: 86400 },
  { value: "1w", label: "1W", seconds: 604800 },
];

export const ENTRY_TFS = ["5m", "15m", "30m"];

export const tfSeconds = (tf) => TIMEFRAMES.find((t) => t.value === tf)?.seconds ?? 900;
export const symbolInfo = (s) => SYMBOLS.find((x) => x.value === s) ?? { value: s, label: s, short: s, precision: 2 };

export const COLORS = {
  bull: "#12b886", bear: "#ff4d4f", gold: "#d4af37", blue: "#3b82f6", amber: "#f59e0b",
  cyan: "#22d3ee", violet: "#a78bfa", orange: "#fb923c", grey: "#94a3b8",
};

export const SESSION_COLORS = {
  asia: "#64748b", london: "#3b82f6", ny: "#f59e0b", overlap: "#a855f7",
};
export const SESSION_LABELS = { asia: "Asia", london: "London", ny: "New York", overlap: "London/NY" };
