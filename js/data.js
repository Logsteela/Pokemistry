/* ============ data.js : マスタデータ読込とインデックス ============ */
(function (g) {
  'use strict';
  var D = {
    ready: false,
    types: [], phys: [], chart: [],
    pokemon: [], byId: {}, species: {}, lines: {}, evo: [], fusion: [],
    evoFrom: {}, evoTo: {}, raidList: [], questions: [], qById: {},
    sprite: { cols: 40, rows: 32, size: 32, count: 0 }
  };

  function getInline(id) {
    var n = document.getElementById(id);
    return n ? JSON.parse(n.textContent) : null;
  }

  D.load = function (onProgress) {
    var steps = [];
    onProgress = onProgress || function () {};

    function fetchJSON(url, inlineId) {
      var inline = getInline(inlineId);
      if (inline) return Promise.resolve(inline);
      return fetch(url, { cache: 'force-cache' }).then(function (r) {
        if (!r.ok) throw new Error(url + ' の読み込みに失敗しました (' + r.status + ')');
        return r.json();
      });
    }

    onProgress(0.05, 'ポケモンデータ読み込み中…');
    return fetchJSON('data/pokedex.json', 'inline-pokedex').then(function (pd) {
      onProgress(0.45, 'インデックス構築中…');
      D.types = pd.types; D.phys = pd.phys; D.chart = pd.chart;
      D.sprite = pd.sprite;
      D.pokemon = pd.pokemon;
      D.pokemon.forEach(function (p, i) { p.idx = i; D.byId[p.i] = p; });

      D.species = {};
      Object.keys(pd.species).forEach(function (sid) {
        var s = pd.species[sid];
        D.species[sid] = {
          id: sid, name: s.n, forms: s.f, line: s.l, stage: s.st, order: s.o,
          base: s.f[0]
        };
      });
      D.lines = {};
      Object.keys(pd.lines).forEach(function (lid) {
        var l = pd.lines[lid];
        D.lines[lid] = { id: lid, rep: l.rep, name: l.name, members: l.m };
      });
      D.evo = pd.evo.map(function (e) { return { line: e.l, from: e.f, to: e.t, branch: !!e.b, cost: e.c }; });
      D.evo.forEach(function (e) {
        (D.evoFrom[e.from] = D.evoFrom[e.from] || []).push(e);
        (D.evoTo[e.to] = D.evoTo[e.to] || []).push(e);
      });
      D.fusion = pd.fusion;
      D.fusionByForm = {};
      D.fusion.forEach(function (f) { D.fusionByForm[f.form] = f; });

      D.raidList = D.pokemon.filter(function (p) { return p.v === 1; });

      onProgress(0.5, 'アセット一覧確認中…');
      return D.loadAssets();
    }).then(function () {
      onProgress(0.55, '問題データ読み込み中…');
      return fetchJSON('data/questions.json', 'inline-questions');
    }).then(function (qd) {
      onProgress(0.9, '問題インデックス構築中…');
      D.questions = qd.items;
      D.questions.forEach(function (q, i) { q.idx = i; D.qById[q.i] = q; });
      D.ready = true;
      onProgress(1, '準備完了');
      return D;
    });
  };

  // ---------- 参照ヘルパ ----------
  D.p = function (imageId) { return D.byId[imageId] || null; };
  D.sp = function (speciesId) { return D.species[speciesId] || null; };
  D.line = function (lineId) { return D.lines[lineId] || null; };
  D.lineOfSpecies = function (speciesId) { var s = D.sp(speciesId); return s ? D.lines[s.line] : null; };
  D.lineOfPoke = function (p) { return D.lines[p.ev]; };
  D.baseFormOf = function (p) { return D.byId[D.species[p.sp].forms[0]]; };
  D.formsOf = function (speciesId) { return D.species[speciesId].forms.map(function (id) { return D.byId[id]; }); };
  D.typeName = function (i) { return D.types[i]; };
  D.candyName = function (lineId) { return D.lines[lineId].name; };

  D.evolutionsFrom = function (speciesId) { return D.evoFrom[speciesId] || []; };
  D.hasPreEvo = function (speciesId) { return !!(D.evoTo[speciesId] && D.evoTo[speciesId].length); };

  // ---------- スプライト ----------
  var MISSING = null;
  D.spriteAvailable = function (p) {
    if (MISSING === null) MISSING = {};
    return !MISSING[p.i];
  };
  D.markSpriteMissing = function (id) { if (MISSING === null) MISSING = {}; MISSING[id] = 1; };

  // 端末ピクセル基準で整数倍になるスケールを選び、拡大時のドットの歪みを防ぐ
  function crispScale(cssTarget) {
    var dpr = window.devicePixelRatio || 1;
    var dev = Math.max(1, Math.round(cssTarget / D.sprite.size * dpr));
    return dev / dpr;
  }

  D.spriteEl = function (imageId, cssTarget, extraClass) {
    var p = D.byId[imageId];
    var sc = crispScale(cssTarget || 64);
    var S = D.sprite.size, px = S * sc;
    var e = document.createElement('span');
    e.className = 'spr' + (extraClass ? ' ' + extraClass : '');
    e.style.width = px + 'px';
    e.style.height = px + 'px';
    if (!p || p.sx == null) { e.classList.add('miss'); return e; }
    e.style.backgroundSize = (D.sprite.cols * px) + 'px ' + (D.sprite.rows * px) + 'px';
    e.style.backgroundPosition = (-(p.sx % D.sprite.cols) * px) + 'px ' + (-Math.floor(p.sx / D.sprite.cols) * px) + 'px';
    e.setAttribute('role', 'img');
    e.setAttribute('aria-label', p.n);
    return e;
  };

  // ---------------------------------------------------------------- 背景・ロゴ（後から差し替え可能）
  // img/bg/<key>.webp | .png | .jpg があれば自動で使用、無ければ既定のグラデーション
  D.BG_KEYS = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
               'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];
  var bgCache = {};

  D.bgKeyForType = function (ti) { return D.BG_KEYS[ti] || null; };

  D.assets = {};   // data/assets.json（ビルド時に生成される実在アセット一覧）
  var assetsP = null;
  D.loadAssets = function () {
    if (assetsP) return assetsP;
    var inline = document.getElementById('inline-assets');
    if (inline) {
      D.assets = JSON.parse(inline.textContent) || {};
      D.assetsLoaded = true;
      assetsP = Promise.resolve(D.assets);
      return assetsP;
    }
    assetsP = fetch('data/assets.json', { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (a) { D.assets = a || {}; D.assetsLoaded = true; return D.assets; });
    return assetsP;
  };

  D.resolveAsset = function (dir, key, exts, cb) {
    var ck = dir + '/' + key;
    if (ck in bgCache) { cb(bgCache[ck]); return; }
    var inl = window.ASSET_INLINE && window.ASSET_INLINE[ck];
    if (inl) { bgCache[ck] = inl; cb(inl); return; }
    if (D.assets && D.assets[ck]) { bgCache[ck] = D.assets[ck]; cb(D.assets[ck]); return; }
    if (D.assetsLoaded && D.assets && D.assets.__complete) { bgCache[ck] = null; cb(null); return; }
    var i = 0;
    (function next() {
      if (i >= exts.length) { bgCache[ck] = null; cb(null); return; }
      var url = dir + '/' + key + '.' + exts[i++];
      var im = new Image();
      im.onload = function () { bgCache[ck] = url; cb(url); };
      im.onerror = next;
      im.src = url;
    })();
  };

  D.resolveBG = function (key, cb) {
    if (!key) { cb(null); return; }
    D.resolveAsset('img/bg', key, ['webp', 'png', 'jpg'], cb);
  };
  D.resolveLogo = function (cb) {
    D.resolveAsset('img', 'logo', ['png', 'webp', 'svg'], cb);
  };

  // タイプバッジ
  D.typeBadge = function (ti) {
    var e = document.createElement('span');
    e.className = 'tb t' + ti;
    e.textContent = D.types[ti];
    return e;
  };
  D.typeBadges = function (p) {
    var f = document.createDocumentFragment();
    p.t.forEach(function (ti) { f.appendChild(D.typeBadge(ti)); });
    return f;
  };

  g.D = D;
})(window);
