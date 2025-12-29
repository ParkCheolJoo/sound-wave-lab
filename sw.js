// sw.js (즉시 반영/업데이트 친화 버전)

const CACHE_NAME = "sound-wave-lab-v2"; // 버전 올리기(한 번만 해도 효과 큼)
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// 1) 설치 단계: 핵심 정적 자산 프리캐시 + 새 SW 즉시 대기열 스킵
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// 2) 활성화 단계: 구 캐시 제거 + 페이지 제어권 즉시 획득
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// 유틸: 네트워크 우선 + 성공 시 캐시에 갱신
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    // cache: 'no-store'는 브라우저 HTTP 캐시를 우회하려는 의도(최신 반영에 도움)
    const fresh = await fetch(request, { cache: "no-store" });

    // GET 요청이고 응답이 정상일 때만 캐시에 저장
    if (request.method === "GET" && fresh && fresh.ok) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw e;
  }
}

// 유틸: 캐시 우선 + 없으면 네트워크, 가져오면 캐시에 저장 (아이콘/manifest 등 정적에 적합)
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const fresh = await fetch(request);
  if (request.method === "GET" && fresh && fresh.ok) {
    cache.put(request, fresh.clone());
  }
  return fresh;
}

// 3) fetch 전략:
// - index.html 및 네비게이션(페이지 로드)은 network-first로 "즉시 반영"
// - 나머지 정적 자산(아이콘/manifest 등)은 cache-first
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // GET만 처리 (POST 등은 그대로 네트워크로)
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 같은 오리진만 서비스워커가 캐싱 관리(외부 CDN은 제외)
  if (url.origin !== self.location.origin) return;

  const isNavigation = req.mode === "navigate";
  const isIndexHtml =
    url.pathname.endsWith("/index.html") || url.pathname === "/" || url.pathname.endsWith("/sound-wave-lab/");

  // 페이지/HTML은 네트워크 우선: 수정 즉시 반영
  if (isNavigation || isIndexHtml || req.destination === "document") {
    event.respondWith(networkFirst(req));
    return;
  }

  // manifest/아이콘 등 정적 파일은 캐시 우선
  event.respondWith(cacheFirst(req));
});
