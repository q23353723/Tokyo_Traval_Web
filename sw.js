/* =========================================================
   離線快取
   - 自己的檔案：網路優先（拿到最新版），3 秒沒回應或離線就用快取
   - Tailwind CDN：快取優先（離線也有樣式）
   - 天氣、匯率 API、Google Maps：不攔截，由頁面自己處理
   ========================================================= */
const CACHE = 'tokyo-trip-v1';
const CORE = ['./', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
const CDN = 'https://cdn.tailwindcss.com/';
const TIMEOUT = 3000;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    try { await c.put(CDN, await fetch(CDN, { mode: 'no-cors' })); } catch (err) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    /* 頁面本身不論帶什麼參數（例如 ?now=）都存成同一份 */
    const key = req.mode === 'navigate' ? './' : req;
    e.respondWith(networkFirst(req, key));
    return;
  }
  if (url.href.startsWith(CDN)) e.respondWith(cacheFirst(req));
});

async function networkFirst(req, key) {
  const c = await caches.open(CACHE);
  const net = fetch(req, { cache: 'no-store' }).then((res) => {
    if (res.ok) c.put(key, res.clone());
    return res;
  });
  const cached = await c.match(key, { ignoreSearch: true });
  if (!cached) return net;
  /* 有快取時最多等 3 秒，訊號差就先用快取（背景仍會更新，下次開啟就是新版） */
  const timer = new Promise((res) => setTimeout(() => res(cached), TIMEOUT));
  return Promise.race([net.catch(() => cached), timer]);
}

async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  c.put(req, res.clone());
  return res;
}
