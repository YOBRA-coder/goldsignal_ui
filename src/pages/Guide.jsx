import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { cx } from "../lib/format";

// ---- tiny legend drawings (same colours as the chart)
const C = { bull: "#12b886", bear: "#ff4d4f", gold: "#d4af37", blue: "#3b82f6", amber: "#f59e0b", violet: "#a78bfa", cyan: "#22d3ee", grey: "#94a3b8", tl: "#c084fc" };
function Sw({ children }) { return <svg width="64" height="26" viewBox="0 0 64 26" className="shrink-0 rounded bg-black/30">{children}</svg>; }
const SWATCH = {
  ob_bull: <Sw><rect x="6" y="6" width="52" height="14" fill={C.bull} opacity=".18" stroke={C.bull} /></Sw>,
  ob_bear: <Sw><rect x="6" y="6" width="52" height="14" fill={C.bear} opacity=".18" stroke={C.bear} /></Sw>,
  fvg_bull: <Sw><rect x="6" y="6" width="52" height="14" fill={C.blue} opacity=".18" stroke={C.blue} strokeDasharray="4 3" /></Sw>,
  fvg_bear: <Sw><rect x="6" y="6" width="52" height="14" fill={C.amber} opacity=".18" stroke={C.amber} strokeDasharray="4 3" /></Sw>,
  bos: <Sw><line x1="4" x2="60" y1="13" y2="13" stroke={C.bull} strokeWidth="1.5" /></Sw>,
  choch: <Sw><line x1="4" x2="60" y1="13" y2="13" stroke={C.amber} strokeWidth="1.5" strokeDasharray="5 3" /></Sw>,
  liq: <Sw><line x1="4" x2="60" y1="13" y2="13" stroke={C.violet} strokeWidth="1.2" strokeDasharray="2 3" /></Sw>,
  sweep: <Sw><path d="M32 8 l-5 10 h10 z" fill={C.violet} /></Sw>,
  tl: <Sw><line x1="4" y1="21" x2="60" y2="5" stroke={C.tl} strokeWidth="1.6" /></Sw>,
  lvl: <Sw><line x1="4" x2="60" y1="13" y2="13" stroke={C.amber} strokeDasharray="6 4" /></Sw>,
  eq: <Sw><rect x="4" y="3" width="56" height="10" fill={C.bear} opacity=".12" /><rect x="4" y="13" width="56" height="10" fill={C.bull} opacity=".12" /><line x1="4" x2="60" y1="13" y2="13" stroke={C.grey} strokeDasharray="8 5" /></Sw>,
  strong: <Sw><line x1="4" x2="60" y1="13" y2="13" stroke={C.gold} strokeWidth="1.8" /></Sw>,
  weak: <Sw><line x1="4" x2="60" y1="13" y2="13" stroke={C.grey} strokeDasharray="3 3" /></Sw>,
  range: <Sw><rect x="6" y="6" width="52" height="14" fill="#64748b" opacity=".15" stroke="#64748b" strokeDasharray="4 3" /></Sw>,
  amd: <Sw><rect x="4" y="6" width="30" height="14" fill={C.violet} opacity=".15" stroke={C.violet} strokeDasharray="3 3" /><path d="M48 18 l4 -10 l4 10z" fill={C.amber} /></Sw>,
  trade: <Sw><rect x="6" y="3" width="52" height="10" fill={C.bull} opacity=".15" /><rect x="6" y="13" width="52" height="10" fill={C.bear} opacity=".15" /><line x1="6" x2="58" y1="13" y2="13" stroke={C.gold} strokeWidth="1.5" /></Sw>,
  news: <Sw><rect x="24" y="0" width="16" height="26" fill={C.bear} opacity=".12" /><line x1="32" x2="32" y1="0" y2="26" stroke={C.bear} strokeDasharray="5 4" /></Sw>,
  nearmiss: <Sw><circle cx="32" cy="13" r="5" fill={C.amber} /></Sw>,
  zonehit: <Sw><circle cx="32" cy="13" r="7" fill="none" stroke={C.gold} strokeWidth="1.5" /></Sw>,
  minibos: <Sw><line x1="4" x2="60" y1="13" y2="13" stroke={C.cyan} strokeWidth="1.6" /></Sw>,
  retest: <Sw><line x1="4" x2="60" y1="13" y2="13" stroke={C.cyan} strokeDasharray="6 4" /></Sw>,
};

const LEGEND = [
  ["ob_bull", "Demand / bullish order block (green box)", "The last down-candle before a strong move up. Price often returns here and bounces — this is where BUY setups are looked for. Solid border = untouched (fresh), dashed = already tested."],
  ["ob_bear", "Supply / bearish order block (red box)", "The last up-candle before a strong move down. SELL setups are looked for here."],
  ["fvg_bull", "Bullish FVG — fair value gap (blue dashed)", "A gap left by a fast move: price tends to come back to fill it. Acts as support."],
  ["fvg_bear", "Bearish FVG (amber dashed)", "The same, pushing down: acts as resistance."],
  ["bos", "BOS — break of structure (solid line)", "Price closed beyond the last swing in the trend direction: the trend continues. Green = up, red = down."],
  ["choch", "CHoCH — change of character (amber dashed line)", "Price closed beyond the last swing AGAINST the trend: the first sign the trend may be turning. Bias flips on the next confirmation."],
  ["liq", "Liquidity pools — EQH / EQL / BSL / SSL (violet dots)", "Equal highs/lows and obvious swing highs/lows where stop-losses sit. Price is drawn to them and often reverses after taking them."],
  ["sweep", "Liquidity sweep (violet triangle)", "A wick that poked through a pool and closed back — stops were taken, then price reversed. A strong confirmation for the trade."],
  ["tl", "Trend line (purple)", "Support / resistance drawn through swings. Faint dashed = already broken. Holding or breaking one adds to the checklist."],
  ["eq", "Premium / discount + EQ 50%", "Upper half of the current range = premium (sell area, red tint); lower half = discount (buy area, green tint). The dashed line is the 50% equilibrium. Buys are best in discount, sells in premium."],
  ["strong", "Strong high / strong low (solid gold)", "The swing that protects the current trend. If it breaks, the trend is in danger."],
  ["weak", "Weak high / weak low (grey dashed)", "The swing price is expected to take next (the target side)."],
  ["lvl", "Key levels — PDH / PDL / PWH / PWL, day & week open", "Yesterday's / last week's high & low and the opens. Price reacts to them; they are also used to find targets."],
  ["range", "Asia range / London range boxes", "The high–low of the session. Breakouts and raids of these ranges often start the day's move."],
  ["amd", "AMD — accumulate → manipulate → distribute", "A tight range (A), a fake raid of one edge that closes back inside (M), then a real move through the middle (D). The engine uses it as extra confirmation."],
  ["trade", "Trade plan — entry (gold), stop (red), target (green)", "Drawn on the chart from the candle the signal fired on. When the stop is moved to breakeven the red part fades."],
  ["minibos", "Mini BOS (cyan line) · zone touch (gold circle)", "The small break of structure on your entry timeframe that triggers the entry, and the candle that touched the zone."],
  ["retest", "Retest entry (cyan dashed) · move-to-breakeven line", "A cheaper limit entry at the trigger candle's mid-point (better R:R but may not fill), and the price where the stop is moved to entry."],
  ["news", "News release (red dashed line + band)", "High-impact releases. Signals are paused inside the band. The label shows how far price moved afterwards."],
  ["nearmiss", "Near-miss (amber dot) / past signal arrows", "Arrows show past signals and how they ended (✓ win, ✗ loss). Amber dots are setups a rule blocked — tap Past signals to hide them."],
  ["zonehit", "Zone hit", "The 1H zone price has just entered (gold outline)."],
];

const STATUS = [
  ["SIGNAL", "bull", "Every gate passed and the agreement is above your minimum. Entry, stop and target are on the card. It is tracked automatically until TP / SL."],
  ["SETUP", "amber", "Price is in a zone, or a trigger is close, but something is still missing (trigger candle, session, room to target, news…). Open the pair to see the one check that is failing. Can turn into a signal within minutes."],
  ["WATCH", "blue", "The 4H direction is clear but price has not reached an entry zone yet. The row tells you which zone and how far away it is."],
  ["STAND ASIDE", "gray", "No clear 4H direction, 1H fights the 4H, or the market is closed. Nothing to do on this pair."],
];

const STEPS = [
  ["1 · 4H direction", "The engine reads 4H structure (BOS / CHoCH, higher highs / lower lows). No clear direction = no trade."],
  ["2 · 4H map", "Where is price in the 4H range (premium / discount)? Is there a fresh 4H zone nearby and room to the next obstacle?"],
  ["3 · 1H setup", "1H must agree with the 4H. Price has to reach a 1H order block or FVG, ideally after a liquidity sweep."],
  ["4 · Entry trigger", "On your entry timeframe (5m / 15m / 30m) a trigger candle forms at the zone: engulfing, rejection wick, displacement, mini BOS… Only then does a signal fire."],
];

const SECTIONS = [
  ["start", "Quick start"], ["dash", "The dashboard"], ["engine", "How a signal is built"], ["status", "Reading pair status"], ["legend", "Chart legend"],
  ["previews", "Previews & full chart"], ["alerts", "Alerts & notifications"], ["trade", "Taking a trade safely"], ["news", "News protection"], ["mt5", "Match MetaTrader 5"],
  ["invite", "Invite traders"], ["faq", "Troubleshooting"], ["risk", "Risk warning"],
];

function H({ id, children }) { return <h2 id={id} className="text-lg font-bold mt-8 mb-3 scroll-mt-20 text-gold">{children}</h2>; }
const P = ({ children }) => <p className="text-sm text-gray-300 leading-relaxed mb-2">{children}</p>;
const Li = ({ children }) => <li className="text-sm text-gray-300 leading-relaxed">{children}</li>;
function Faq({ q, children }) {
  return (
    <details className="group border border-border rounded-xl px-3 py-2 mb-2 bg-panel">
      <summary className="cursor-pointer text-sm font-medium text-gray-100 list-none flex justify-between gap-2">{q}<span className="text-gray-500 group-open:rotate-45 transition-transform">+</span></summary>
      <div className="text-sm text-gray-400 leading-relaxed mt-2">{children}</div>
    </details>
  );
}

export default function Guide({ standalone = false }) {
  const [active, setActive] = useState("start");
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-20% 0px -70% 0px" });
    SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  const body = (
    <div className="grid grid-cols-1 lg:grid-cols-[210px_1fr] gap-6 max-w-5xl mx-auto">
      <nav className="hidden lg:block sticky top-20 self-start text-sm space-y-0.5">
        {SECTIONS.map(([id, t]) => (
          <a key={id} href={`#${id}`} className={cx("block px-3 py-1.5 rounded-lg", active === id ? "bg-gold/10 text-gold" : "text-gray-400 hover:text-gray-100")}>{t}</a>
        ))}
      </nav>
      <article className="min-w-0">
        <div className="flex items-center gap-2 mb-1"><BookOpen className="text-gold" size={22} /><h1 className="text-2xl font-black">GoldSignal manual</h1></div>
        <P>Everything you need to read the app, understand a signal and trade it with a plan. About 10 minutes. Tap a heading on the left (or scroll) to jump.</P>

        <H id="start">Quick start</H>
        <ol className="list-decimal ml-5 space-y-1.5">
          <Li><b>Pick a pair</b> at the top left (Gold Spot XAUUSD is the default). Pick your <b>entry timeframe</b> (5m / 15m / 30m) next to it.</Li>
          <Li><b>Open the Alerts page.</b> It lists every pair and whether it is ready: SIGNAL, SETUP, WATCH or STAND ASIDE. Tap a pair to open its full chart.</Li>
          <Li><b>Turn on notifications</b> (Profile → Alerts, and Profile → Install as an app for phone alerts while the app is closed).</Li>
          <Li><b>Wait for a SIGNAL.</b> Do not trade a SETUP or WATCH — they are heads-ups only.</Li>
          <Li><b>When a signal fires</b> place the trade at your broker with the entry, stop-loss and take-profit shown. Risk a small fixed % of your account (see "Taking a trade safely").</Li>
          <Li>The app <b>tracks the trade for you</b> and alerts you on breakeven, take-profit or stop-loss.</Li>
        </ol>

        <H id="dash">The dashboard</H>
        <ul className="list-disc ml-5 space-y-1">
          <Li><b>Signal card</b> — the current verdict for this pair: BUY / SELL / WAIT, the agreement ring, the four steps, the trade plan and a <b>preview line chart</b> of the plan (entry, stop, target on live price).</Li>
          <Li><b>Building now</b> — what is forming before it fires (the open candle, a lagging 1H, a counter-trend setup).</Li>
          <Li><b>Open trades</b> — every running trade with live R, health, and a mini chart.</Li>
          <Li><b>Chart</b> — candles with the smart-money overlay. Toggle layers with the chips; "Top-down" shows 4H, 1H and entry side by side. The expand button goes full screen.</Li>
          <Li><b>Checklist</b> — every rule behind the verdict, with a ✓ / ✗ and the reason. Gates (mandatory) must all pass.</Li>
          <Li><b>Market watch / Recent signals / Sessions / Outlook</b> — price, key levels, the clock for London / New York, and what the engine expects next.</Li>
        </ul>

        <H id="engine">How a signal is built</H>
        <P>The engine works top-down, exactly like a discretionary smart-money trader:</P>
        <div className="grid sm:grid-cols-2 gap-2 mb-3">
          {STEPS.map(([t, d]) => <div key={t} className="rounded-xl border border-border bg-panel p-3"><div className="text-sm font-semibold text-gold">{t}</div><div className="text-xs text-gray-400 mt-1 leading-snug">{d}</div></div>)}
        </div>
        <P><b>Agreement %</b> is the weighted share of checks that pass. <b>Grade</b>: A+ ≥ 85%, A ≥ 70%, B ≥ 55%, C below. A signal needs every mandatory gate <i>and</i> the minimum agreement (Profile → Strategy settings, default 70%). Higher minimum = fewer, cleaner signals.</P>
        <P><b>Mandatory gates include:</b> London / New York session, stop not too wide, enough room to the next wall (≥ 1.5R), spread small next to the stop, market not choppy, no high-impact news, not over-stretched. If one fails the pair shows SETUP with the reason.</P>

        <H id="status">Reading pair status</H>
        <div className="space-y-2">
          {STATUS.map(([n, tone, d]) => (
            <div key={n} className="flex gap-3 items-start rounded-xl border border-border bg-panel p-3">
              <span className={cx("text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0", tone === "bull" && "text-bull border-bull/30 bg-bull/10", tone === "amber" && "text-amber-400 border-amber-400/30 bg-amber-400/10", tone === "blue" && "text-blue-400 border-blue-400/30 bg-blue-400/10", tone === "gray" && "text-gray-300 border-white/10 bg-white/5")}>{n}</span>
              <span className="text-sm text-gray-300 leading-snug">{d}</span>
            </div>
          ))}
        </div>
        <P>The four small dots next to a pair show how many of the four steps are done. Four = a signal.</P>

        <H id="legend">Chart legend — every drawing explained</H>
        <P>Use the chips above the chart to switch layers on and off ("Clean" = candles only). On small timeframes fewer layers are on by default so the candles stay readable.</P>
        <div className="grid md:grid-cols-2 gap-2">
          {LEGEND.map(([k, t, d]) => (
            <div key={k} className="flex gap-3 rounded-xl border border-border bg-panel p-2.5">
              {SWATCH[k]}
              <div className="min-w-0"><div className="text-[13px] font-semibold text-gray-100 leading-snug">{t}</div><div className="text-xs text-gray-400 mt-0.5 leading-snug">{d}</div></div>
            </div>
          ))}
        </div>
        <P>Swing labels: <b className="text-bull">HH</b> higher high, <b className="text-bull">HL</b> higher low (up-trend), <b className="text-bear">LH</b> lower high, <b className="text-bear">LL</b> lower low (down-trend).</P>

        <H id="previews">Previews & the full-chart pop-up</H>
        <ul className="list-disc ml-5 space-y-1">
          <Li>Every signal in <b>Signals</b> has a <b>preview line</b>: price with the target (green), stop (red), entry (blue dotted), the moment it fired (▲ / ▼) and where it ended (● target hit / stopped out). "Hide preview" collapses it.</Li>
          <Li>Tap <b>Full chart</b> — or any pair on the Alerts page, any alert, any line in the log — to open the <b>full chart pop-up</b> for that pair with all timeframes, all layers, the checklist and the trade. You can switch pair inside the pop-up. Esc or ✕ closes it.</Li>
          <Li>"Open on dashboard" in the pop-up makes that pair your main pair.</Li>
        </ul>

        <H id="alerts">Alerts & notifications</H>
        <ul className="list-disc ml-5 space-y-1">
          <Li><b>Bell icon</b> (top right) — three tabs: <b>Alerts</b> (new signals, TP / SL, setups, news), <b>Happening now</b> (every pair and its status) and <b>Log</b> (what changed, newest first).</Li>
          <Li><b>Alerts page</b> — the same in full: the board of pairs on the left, the alert feed and the activity log on the right. "Scan all pairs" evaluates everything now; the server keeps scanning in the background while it runs.</Li>
          <Li><b>Sound & phone alerts</b> — Profile → Alerts. For alerts while the app is closed: Profile → Install as an app → Background alerts. iPhone needs "Add to Home Screen" first.</Li>
          <Li>Alert types: <b>signal</b>, <b>win</b> (take-profit), <b>loss</b> (stop-loss), <b>setup</b> (zone tapped, watch the next candle), <b>shift</b> (4H / 1H bias flipped), <b>news</b>.</Li>
        </ul>

        <H id="trade">Taking a trade safely</H>
        <ol className="list-decimal ml-5 space-y-1.5">
          <Li><b>Risk 0.5–1% of your account per trade</b> — never more. Position size = (account × risk %) ÷ (distance from entry to stop in price × value per point). Example on gold (1.00 lot = 100 oz, so a 5.00 move = $500 per lot or $5 per 0.01 lot): $1,000 account, 1% risk = $10; stop 5.00 away → $10 ÷ $5 = 0.02 lots. Contract sizes differ per broker and pair — confirm with your broker's calculator.</Li>
          <Li>Enter at the signal price (or the retest entry if you prefer a better R:R and accept it may not fill). Set <b>both</b> stop-loss and take-profit.</Li>
          <Li>When price reaches +1R the engine suggests moving the stop to breakeven (shown on the open-trade card and as an alert).</Li>
          <Li>Do not add to losers, do not move the stop further away, do not trade right before high-impact news.</Li>
          <Li>The engine pauses a pair after a set number of stop-outs in a day (daily stop) — respect it.</Li>
          <Li>Check the <b>Backtest</b> page for the pair and timeframe you trade before using real money. Win rate matters less than average R and drawdown.</Li>
        </ol>

        <H id="news">News protection</H>
        <P>High-impact releases (CPI, NFP, FOMC, rate decisions…) move price violently. Signals pause from about 30 minutes before to 20 minutes after, and a banner explains it. Change the window on the News page. Open trades: consider tightening or closing before the release.</P>

        <H id="mt5">Match MetaTrader 5</H>
        <P>Prices come from Yahoo Finance, not your broker. Profile → "Match MetaTrader 5" fixes the four causes of differences: instrument (use Gold Spot, not futures), candle times (NY close vs UTC), chart clock, and a price calibration offset. Do this once, then trade your broker's chart with the app's levels.</P>

        <H id="invite">Invite traders</H>
        <P>Profile → <b>Invite other traders</b> gives you a personal link. Send it by WhatsApp, Telegram, email or copy it. People who register through it are counted under "joined with your link".</P>

        <H id="faq">Troubleshooting</H>
        <Faq q="Why has there been no signal today?">Most of the day every pair is WATCH or SETUP — signals are rare by design. Open the Alerts page or the Signals page → Engine log to see exactly which check is failing for the pair. Outside London / New York, signals are off unless you disable "sessions only".</Faq>
        <Faq q="The app says 'Data feed problem'.">The free price feed (Yahoo) can throttle. The app keeps retrying and shows the last good data. Profile → Data feed → "Test connection" tells you which download method works. If you run it yourself, restart the backend and run <code>pip install -U -r requirements.txt</code>.</Faq>
        <Faq q="The price does not match my MT5.">Use Gold Spot (XAUUSD), then Profile → Match MetaTrader 5 → type the price you see in MT5 and Calibrate. A small difference always remains with a free feed — trade the levels, not the pip.</Faq>
        <Faq q="I don't get notifications.">Profile → Alerts → Enable, and allow notifications for this site in the browser. For alerts with the app closed install it (Profile → Install as an app → Background alerts). The server must be running.</Faq>
        <Faq q="A setup disappeared.">Setups age out: if the trigger does not come within a few candles the idea is no longer valid. That is normal, not an error.</Faq>
        <Faq q="The chart shows too much / too little.">Use the layer chips. "Clean" removes everything, "All" shows everything. Different timeframes have sensible presets.</Faq>
        <Faq q="Why did a trade stop out although the setup looked perfect?">Every setup is a probability, not a promise. A 40–50% win rate with 2R targets is profitable. Judge the system over 50+ trades, not three.</Faq>

        <H id="risk">Risk warning</H>
        <P>GoldSignal is an analysis tool, not financial advice and not a guarantee of profit. Trading leveraged products carries a high risk of loss. Never risk money you cannot afford to lose, test on a demo account first, and make your own decisions.</P>
      </article>
    </div>
  );
  if (!standalone) return body;
  return (
    <div className="min-h-screen bg-bg text-gray-100">
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-border px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-bold">Gold<span className="text-gold">Signal</span></Link>
        <div className="flex gap-2 text-sm"><Link to="/login" className="px-3 py-1.5 rounded-lg border border-border">Sign in</Link><Link to="/register" className="px-3 py-1.5 rounded-lg bg-gold text-black font-semibold">Create account</Link></div>
      </header>
      <div className="px-4 py-6">{body}</div>
    </div>
  );
}
