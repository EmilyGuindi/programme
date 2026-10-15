const CACHE = "byynd-1.2.0";
const FILES = ["./", "index.html", "manifest.json", "icon.svg", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{}); return r; })
    .catch(() => caches.match(e.request, {ignoreSearch: true}).then(r => r || caches.match("index.html"))));
});
/* Lot 3 : réception des notifications push (serveur à venir) */
self.addEventListener("push", e => {
  let data = {}; try { data = e.data ? e.data.json() : {}; } catch(_) {}
  const title = data.title || "BYYND"; const url = data.url || "./";
  e.waitUntil(self.registration.showNotification(title, { body: data.body || "", icon: "icon-192.png", badge: "icon-192.png", data: { url }, tag: data.tag || "byynd" }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close(); const url = new URL(e.notification.data?.url || "./", self.location.href).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => { for (const w of ws) { if (w.url.startsWith(self.registration.scope)) { w.navigate(url); return w.focus(); } } return clients.openWindow(url); }));
});
