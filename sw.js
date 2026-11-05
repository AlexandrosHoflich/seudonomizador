// sw.js — Guarda la app en el dispositivo para que funcione sin internet. No envía datos a ninguna parte.
// AUD R-11/S-13 (v0.8.0): la página se pide primero a la red para recibir la versión publicada; sin internet, la copia guardada.
// v0.11 (CRI-01, CRI-02, INT-11):
//  · la huella SHA-256 de la página publicada va escrita aquí; la copia guardada se comprueba con ella ANTES de usarla
//    (otra página del mismo sitio no puede reemplazarla por una falsa) y solo se guarda una página que coincide;
//  · si la red tarda más de 3 segundos (señal débil), se usa la copia guardada ya comprobada;
//  · la app puede pedir esta huella para mostrarla en «Sobre esta aplicación» y compararla con la del INFORME del Lenovo.
const CACHE = 'seudonimizador-v0.15.1-e09c4dcf77';
const HUELLA = 'e09c4dcf777aecde547f6a333860af7a67ccad177715ed8e9d3bf1db2f8ce53c';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const okPage = async r => r && r.ok && hex(await crypto.subtle.digest('SHA-256', await r.clone().arrayBuffer())) === HUELLA;
const BAD = () => new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Copia dañada</title><body style="font:18px system-ui;padding:24px;max-width:560px"><h1>La copia guardada de la app no es la original</h1><p>Por seguridad no se abrió. Conéctese a internet y vuelva a abrir la app para descargar la versión publicada. Si el aviso sigue, no escriba su clave y lleve el caso al chat de construcción.</p></body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
self.addEventListener('install', e => { e.waitUntil((async () => { const c = await caches.open(CACHE); await c.addAll(FILES.map(u => new Request(u, { cache: 'reload' }))); if (!(await okPage(await c.match('./index.html')))) { await caches.delete(CACHE); throw new Error('index.html no coincide con la huella'); } await self.skipWaiting(); })()); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if (e.data === 'huella') e.source?.postMessage({ huella: HUELLA, cache: CACHE }); });
async function cached() { const r = await caches.match('./index.html'); if (!r) return null; if (await okPage(r)) return r; await (await caches.open(CACHE)).delete('./index.html'); return BAD(); }
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  const page = e.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  if (page) { e.respondWith((async () => {
    const net = fetch(e.request, { cache: 'no-store' }).then(async r => { if (await okPage(r)) { const c = await caches.open(CACHE); await c.put('./index.html', r.clone()); } return r; });
    const slow = new Promise(res => setTimeout(() => res('lento'), 3000));
    try { const w = await Promise.race([net, slow]); if (w !== 'lento') return w; const c = await cached(); return c || await net; }
    catch { return (await cached()) || BAD(); }
  })()); return; }
  if (!FILES.some(f => url.pathname.endsWith(f.replace('./', '/')))) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
