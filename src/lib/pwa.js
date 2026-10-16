// PWA plumbing: service worker registration + update flow, the install prompt, local notifications and Web Push.
import { useEffect, useState } from "react";
import api from "../api";

let deferred = null;                 // the browser's beforeinstallprompt event (Chrome / Edge / Android)
let waiting = null;                  // a downloaded-but-not-active service worker (= an update is ready)
let reg = null;
const listeners = new Set();
const emit = () => listeners.forEach((f) => f());

export const isStandalone = () =>
  (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; emit(); });
  window.addEventListener("appinstalled", () => { deferred = null; emit(); });
}

export async function registerSW() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  try {
    reg = await navigator.serviceWorker.register("/sw.js");
    const check = () => { if (reg.waiting && navigator.serviceWorker.controller) { waiting = reg.waiting; emit(); } };
    check();
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w?.addEventListener("statechange", () => { if (w.state === "installed") check(); });
    });
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);       // look for a new version every 30 min
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloading) { reloading = true; window.location.reload(); } });
  } catch { /* the app works without a service worker */ }
}

export function applyUpdate() { waiting?.postMessage("SKIP_WAITING"); }

export async function promptInstall() {
  if (!deferred) return "unavailable";
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  emit();
  return outcome;
}

export function usePwa() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); listeners.add(f); return () => listeners.delete(f); }, []);
  return { canInstall: !!deferred, installed: isStandalone(), ios: isIOS(), updateReady: !!waiting };
}

/** A notification that also works on Android Chrome (which refuses `new Notification`) - goes through the service worker. */
export async function showNotice(title, body, tag) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const r = reg || (await navigator.serviceWorker?.getRegistration());
    if (r) { await r.showNotification(title, { body, tag, icon: "/icons/icon-192.png", badge: "/icons/favicon-64.png", data: { url: "/" } }); return; }
  } catch { /* fall through */ }
  try { new Notification(title, { body }); } catch { /* ignore */ }
}

// ------------------------------------------------------------------------------------------------ Web Push
export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const toKey = (b64) => Uint8Array.from(atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export async function pushState() {
  if (!pushSupported()) return { supported: false, subscribed: false };
  try {
    const r = await navigator.serviceWorker.getRegistration();
    const sub = await r?.pushManager.getSubscription();
    return { supported: true, subscribed: !!sub, permission: Notification.permission };
  } catch { return { supported: true, subscribed: false, permission: Notification.permission }; }
}

export async function enablePush() {
  if (!pushSupported()) throw new Error("This browser cannot receive background notifications. On iPhone, install the app to the Home Screen first (iOS 16.4+).");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notifications are blocked - allow them for this site in the browser / phone settings.");
  const r = reg || (await navigator.serviceWorker.ready);
  const { data } = await api.get("/push/key");
  let sub = await r.pushManager.getSubscription();
  if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(data.public_key) });
  await api.post("/push/subscribe", sub.toJSON(), { params: { ua: navigator.userAgent.slice(0, 120) } });
  return true;
}

export async function disablePush() {
  const r = await navigator.serviceWorker.getRegistration();
  const sub = await r?.pushManager.getSubscription();
  if (sub) { try { await api.post("/push/unsubscribe", { endpoint: sub.endpoint }); } catch { /* ignore */ } await sub.unsubscribe(); }
}
