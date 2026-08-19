/* ケミポケ Service Worker : 完全オフライン動作用 */
var CACHE = 'chemipoke-v5';
var ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './fonts/NotoSansJP-400.woff2',
  './fonts/NotoSansJP-700.woff2',
  './img/item/coin.png',
  './img/logo.png',
  './img/item/ticket.png',
  './img/item/stone.png',
  './img/item/incense.png',
  './img/item/candy.png',
  './manifest.webmanifest',
  './img/sprites.png',
  './data/pokedex.json',
  './data/questions.json',
  './data/assets.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './js/util.js', './js/data.js', './js/db.js', './js/engine.js', './js/quiz.js', './js/ui.js',
  './js/screen_home.js', './js/screen_battle.js', './js/battle_patch.js', './js/screen_wild.js', './js/screen_raid.js',
  './js/screen_dex.js', './js/screen_party.js', './js/screen_shop.js', './js/screen_study.js',
  './js/screen_debug.js', './js/app.js'
];

// 背景・ロゴなど「あれば使う」アセットを data/assets.json から取得してキャッシュ
function cacheOptional() {
  return fetch('./data/assets.json').then(function (r) { return r.ok ? r.json() : {}; }).then(function (a) {
    var urls = Object.keys(a || {}).filter(function (k) { return k.indexOf('__') !== 0; })
      .map(function (k) { return './' + a[k]; });
    return caches.open(CACHE).then(function (c) {
      return Promise.all(urls.map(function (u) { return c.add(u).catch(function () {}); }));
    });
  }).catch(function () {});
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(cacheOptional)
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var clone = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
