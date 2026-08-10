/**
 * SERVICE WORKER
 *
 * Dos cosas hace, y ninguna es mágica:
 *
 *   1. Permite instalar NutriPlan como app (Android y escritorio lo exigen).
 *   2. Guarda una copia de la app para que abra sin conexión. Los datos ya
 *      viven en el navegador, así que sin internet sigue funcionando entera.
 *
 * Estrategia: red primero, caché como red de seguridad. Así una versión nueva
 * se ve al momento en vez de quedarse pegada la vieja, que es el problema
 * clásico de las apps instaladas.
 */

const CACHE = 'nutriplan-v1';

self.addEventListener('install', (e) => {
  // Entra en vigor sin esperar a que se cierren las pestañas viejas.
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html'])));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        // Copia al vuelo para la próxima vez que no haya red.
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia));
        return res;
      })
      .catch(async () => {
        const guardada = await caches.match(req);
        if (guardada) return guardada;
        // Al navegar sin red, el index sirve para cualquier ruta.
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      }),
  );
});
