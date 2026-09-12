const CACHE_NAME = "lumina-v1";
const STATIC_ASSETS = ["/", "/login", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static")) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  );
});

self.addEventListener("push", (event) => {
  let data;
  try {
    data = JSON.parse(event.data.text());
  } catch {
    data = { title: "Lumina 流光", body: "新消息" };
  }

  const options = {
    body: data.body || "",
    icon: "/manifest-icon-192.png",
    badge: "/manifest-icon-192.png",
    tag: data.conversationId || "lumina-notification",
    data: { conversationId: data.conversationId },
  };

  event.waitUntil(self.registration.showNotification(data.title || "Lumina 流光", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const conversationId = event.notification.data?.conversationId;
  const url = conversationId ? `/?conv=${conversationId}` : "/";
  event.waitUntil(self.clients.matchAll({ type: "window" }).then((clients) => {
    for (const client of clients) {
      if (client.url.includes(url) && "focus" in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
