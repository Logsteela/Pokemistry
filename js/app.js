/* ============ app.js : 起動処理 ============ */
(function () {
  'use strict';

  var bar = document.getElementById('bootBar');
  var msg = document.getElementById('bootMsg');
  function prog(r, t) { if (bar) bar.style.width = (r * 100) + '%'; if (t && msg) msg.textContent = t; }

  // スプライト画像の場所（単一HTML版では data URL が入る）
  // カスタムプロパティ内の相対URLはCSSファイル基準で解決されるため、必ず絶対URLにする
  (function () {
    var src = window.SPRITE_URL || 'img/sprites.png';
    var abs = src.indexOf('data:') === 0 ? src : new URL(src, document.baseURI).href;
    document.documentElement.style.setProperty('--sprite', 'url("' + abs + '")');
  })();

  // 起動画面のロゴ（img/logo.png があれば文字の代わりに表示）
  D.loadAssets().then(function () {
    D.resolveLogo(function (url) {
      if (!url) return;
      var box = document.querySelector('.boot-logo');
      if (!box) return;
      box.textContent = '';
      box.classList.add('img');
      box.appendChild(U.el('img', { src: url, alt: 'ケミポケ' }));
    });
  });

  function fail(e) {
    console.error(e);
    if (msg) { msg.textContent = '起動に失敗しました：' + (e && e.message ? e.message : e); msg.style.color = '#ff6b7a'; }
  }

  D.load(prog).then(function () {
    prog(0.95, 'セーブデータ読み込み中…');
    return S.init();
  }).then(function () {
    Q.refresh24();          // 24時間経過した習得済み問題を復習候補へ戻す
    prog(1, '準備完了');
    document.getElementById('app').hidden = false;
    var boot = document.getElementById('boot');
    boot.classList.add('hide');
    setTimeout(function () { boot.style.display = 'none'; }, 400);

    // タブ
    U.$$('#tabbar button').forEach(function (b) {
      b.addEventListener('click', function () { UI.go(b.dataset.nav, null, { root: true }); });
    });
    document.getElementById('backBtn').addEventListener('click', function () { UI.back(); });

    // 戻る操作（ブラウザ / Android）
    history.replaceState({ n: 0 }, '');
    window.addEventListener('popstate', function () {
      history.pushState({ n: 1 }, '');
      if (Battle.active) { Battle.retreat(); return; }
      UI.back();
    });
    history.pushState({ n: 1 }, '');

    UI.go('home', null, { root: true });

    // 定期的に保存
    window.addEventListener('pagehide', function () { S.flush(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) S.flush(); });
  }).catch(fail);

  // Service Worker（PWA）※単一HTML版では登録しない
  if (!window.SINGLE_FILE && 'serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('SW登録失敗', e); });
    });
  }
})();
