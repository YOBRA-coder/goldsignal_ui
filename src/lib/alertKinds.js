import { Activity, CheckCircle2, Crosshair, GitCompareArrows, Info, Newspaper, XCircle, Zap } from "lucide-react";

export const KIND_STYLE = {
  signal: { icon: Zap, cls: "text-gold border-gold/40 bg-gold/10" },
  win: { icon: CheckCircle2, cls: "text-bull border-bull/40 bg-bull/10" },
  loss: { icon: XCircle, cls: "text-bear border-bear/40 bg-bear/10" },
  shift: { icon: GitCompareArrows, cls: "text-violet-400 border-violet-400/40 bg-violet-400/10" },
  info: { icon: Info, cls: "text-blue-400 border-blue-400/40 bg-blue-400/10" },
  setup: { icon: Crosshair, cls: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10" },
  news: { icon: Newspaper, cls: "text-red-400 border-red-400/40 bg-red-400/10" },
  update: { icon: Activity, cls: "text-amber-400 border-amber-400/40 bg-amber-400/10" },
};
