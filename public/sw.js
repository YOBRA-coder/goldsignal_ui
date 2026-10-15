/* GoldSignal service worker: installable app shell, offline start, update flow and push notifications.
 * Market data is NEVER cached here (stale prices are worse than none): /api and every cross-origin request go straight
 * to the network. Bump VERSION to force clients to refresh the shell. */
const VERSION = "gs-v6";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/favicon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}));   // no skipWaiting: the page offers "Update"
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api")) return;       // data: always live
  if (req.mode === "navigate") {                                                              // pages: network first, shell offline
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(VERSION);
        c.put("/", res.clone()).catch(() => {});
        return res;
      } catch {
        return (await caches.match("/")) || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })());
    return;
  }
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {           // hashed build files: cache first
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(VERSION)).put(req, res.clone()).catch(() => {});
      return res;
    })());
  }
});

// ---- push: an alert arrives while the app is closed
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "GoldSignal", body: e.data ? e.data.text() : "" }; }
  const urgent = ["signal", "win", "loss", "news"].includes(d.kind);
  e.waitUntil(self.registration.showNotification(d.title || "GoldSignal", {
    body: d.body || "", tag: d.tag || undefined, icon: "/icons/icon-192.png", badge: "/icons/favicon-64.png",
    data: { url: d.url || "/" }, requireInteraction: d.kind === "signal", renotify: !!d.tag, vibrate: urgent ? [120, 60, 120] : undefined,
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if ("focus" in c) { await c.focus(); if ("navigate" in c) c.navigate(target).catch(() => {}); return; } }
    await self.clients.openWindow(target);
  })());
});
