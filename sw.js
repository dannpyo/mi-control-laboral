// Cambiar VERSION al modificar cualquier archivo del shell.
const VERSION = "v1.1.0";
// Aísla las cachés de esta ruta de otras PWA del mismo dominio.
const PREFIX = `mi-control-laboral:${self.registration.scope}:`;
const CACHE = `${PREFIX}${VERSION}`;
const SHELL = [
  "./",
  "./index.html",
  "./css/styles.css?v=1.1.0",
  "./js/app.js?v=1.1.0",
  "./js/modules/domain.js",
  "./js/storage/db.js",
  "./manifest.webmanifest",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
].map((path) => new URL(path, self.registration.scope).href);
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || !url.href.startsWith(self.registration.scope))
    return;
  if (request.mode === "navigate") {
    // Mantener HTML y módulos de una misma versión durante una actualización.
    event.respondWith(
      caches
        .open(CACHE)
        .then(
          async (cache) =>
            (await cache.match(request)) ||
            (await cache.match(
              new URL("./index.html", self.registration.scope).href,
            )) ||
            fetch(request),
        ),
    );
    return;
  }
  // Solo archivos estáticos conocidos; nunca registros, API o exportaciones.
  if (SHELL.includes(url.href)) {
    event.respondWith(
      caches
        .open(CACHE)
        .then(async (cache) => (await cache.match(request)) || fetch(request)),
    );
  }
});
