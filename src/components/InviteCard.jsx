import React, { useEffect, useState } from "react";
import { Check, Copy, Mail, Send, Share2, UserPlus } from "lucide-react";
import api from "../api";
import { Card } from "./ui";
import { fmtAgo } from "../lib/format";

/** Invite link: the code is the user's username; whoever registers through it is counted as "joined with your link". */
export default function InviteCard() {
  const [inv, setInv] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { api.get("/profile/invite").then((r) => setInv(r.data)).catch(() => {}); }, []);
  const link = inv ? `${window.location.origin}/register?ref=${encodeURIComponent(inv.code)}` : "";
  const text = `I use GoldSignal for gold & forex trade signals (4H → 1H → entry, with news protection and live alerts). Join with my link: ${link}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); }
    catch { const t = document.createElement("textarea"); t.value = link; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: "GoldSignal", text, url: link }); return; } catch { /* cancelled */ } }
    copy();
  };
  const btn = "flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border hover:border-gold/50 text-gray-200";
  return (
    <Card title="Invite other traders" icon={UserPlus}>
      <p className="text-xs text-gray-400 leading-snug">Share your personal link. Anyone who creates an account through it joins GoldSignal with you listed as their inviter.</p>
      <div className="flex gap-2 mt-3">
        <input readOnly value={link || "Loading…"} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 h-10 bg-panel2 border border-border rounded-lg px-3 text-xs text-gray-300 outline-none" />
        <button onClick={copy} className="h-10 px-3 rounded-lg bg-gold text-black text-sm font-bold shrink-0 flex items-center gap-1.5">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
        <a className={btn} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(text)}`}><Send size={13} /> WhatsApp</a>
        <a className={btn} target="_blank" rel="noreferrer" href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Trade signals for gold & forex")}`}><Send size={13} /> Telegram</a>
        <a className={btn} href={`mailto:?subject=${encodeURIComponent("Join me on GoldSignal")}&body=${encodeURIComponent(text)}`}><Mail size={13} /> Email</a>
        <button className={btn} onClick={share}><Share2 size={13} /> Share…</button>
      </div>
      {inv && (
        <div className="mt-3 text-xs text-gray-400">
          <b className="text-gray-100 text-sm">{inv.joined}</b> trader{inv.joined === 1 ? "" : "s"} joined with your link
          {inv.recent?.length > 0 && <span className="text-gray-500"> · latest: {inv.recent.slice(0, 3).map((r) => `${r.name} (${fmtAgo(r.at)})`).join(", ")}</span>}
        </div>
      )}
    </Card>
  );
}
