/* ============ db.js : IndexedDB 永続化とセーブデータ ============ */
(function (g) {
  'use strict';

  var DB_NAME = 'chemipoke', DB_VER = 1;
  var SAVE_VERSION = 1;
  var db = null;

  // ------------------------------------------------------------------ IndexedDB
  function open() {
    return new Promise(function (res, rej) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        if (!d.objectStoreNames.contains('qstate')) d.createObjectStore('qstate', { keyPath: 'i' });
      };
      req.onsuccess = function () { db = req.result; res(db); };
      req.onerror = function () { rej(req.error); };
    });
  }
  function tx(store, mode) { return db.transaction(store, mode).objectStore(store); }
  function pReq(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function kvGet(k) { return pReq(tx('kv', 'readonly').get(k)); }
  function kvPut(k, v) { return pReq(tx('kv', 'readwrite').put(v, k)); }

  // ------------------------------------------------------------------ 既定セーブ
  function defaultSave() {
    return {
      version: SAVE_VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      coins: 0,
      items: { ticket: 0, stone: 0, incense: 0 },
      candy: {},                 // lineId -> 個数
      owned: {},                 // speciesId -> {lv, forms:{imageId:1}}
      party: [],                 // 前回パーティ（imageId 配列）
      presets: [],               // [{name, members:[imageId]}]
      raids: {},                 // imageId -> {hp, cleared, clears}
      incense: null,             // {target: imageId, remain: n}
      lastType: 4,               // 直近の選択タイプ（くさ）
      quiz: { asked: 0, bag: [], bagPos: 0 },
      stats: {
        answered: 0, correct: 0, mastered: 0,
        wildRuns: 0, encounters: 0, defeated: 0, caught: 0, dup: 0, failed: 0,
        raidRuns: 0, raidClears: 0, evolved: 0, candyGained: 0, coinsEarned: 0, coinsSpent: 0
      },
      daily: { date: '', answered: 0, correct: 0, newQ: 0, revQ: 0, mastered: 0 },
      settings: { sound: false, confirmEvolve: true }
    };
  }

  // ------------------------------------------------------------------ 状態
  var S = {
    save: null,
    q: {},                      // qid -> {i,la,lc,sc,sw,ta,tc,na,d24}
    dirtyQ: {},
    loaded: false
  };

  S.SAVE_VERSION = SAVE_VERSION;

  S.defaultQ = function (id) {
    return { i: id, la: 0, lc: 0, sc: 0, sw: 0, ta: 0, tc: 0, na: 0, d24: 0 };
  };
  S.qs = function (id) {
    var v = S.q[id];
    if (!v) { v = S.q[id] = S.defaultQ(id); }
    return v;
  };

  // ------------------------------------------------------------------ 読み込み
  S.init = function () {
    return open().then(function () {
      return Promise.all([kvGet('save'), pReq(tx('qstate', 'readonly').getAll())]);
    }).then(function (r) {
      var sv = r[0], qs = r[1] || [];
      if (!sv) {
        S.save = defaultSave();
        grantStarter(S.save);
        S.loaded = true;
        return S.flush(true);
      }
      S.save = migrate(sv);
      qs.forEach(function (x) { S.q[x.i] = x; });
      S.loaded = true;
      S.rolloverDaily();
    });
  };

  function grantStarter(sv) {
    // 初期状態：フシギダネ Lv.1 のみ
    var bulba = D.pokemon.filter(function (p) { return p.i === 'n1'; })[0] || D.pokemon[0];
    sv.owned[bulba.sp] = { lv: 1, forms: {} };
    sv.owned[bulba.sp].forms[bulba.i] = 1;
    sv.party = [bulba.i];
  }

  function migrate(sv) {
    var d = defaultSave();
    // 未知/欠損キーを既定値で補完（前方互換）
    for (var k in d) if (!(k in sv)) sv[k] = d[k];
    for (var k2 in d.items) if (sv.items[k2] == null) sv.items[k2] = d.items[k2];
    for (var k3 in d.stats) if (sv.stats[k3] == null) sv.stats[k3] = d.stats[k3];
    for (var k4 in d.settings) if (sv.settings[k4] == null) sv.settings[k4] = d.settings[k4];
    if (!sv.quiz) sv.quiz = d.quiz;
    if (sv.version !== SAVE_VERSION) sv.version = SAVE_VERSION;
    return sv;
  }

  S.rolloverDaily = function () {
    var t = U.today();
    if (S.save.daily.date !== t) {
      S.save.daily = { date: t, answered: 0, correct: 0, newQ: 0, revQ: 0, mastered: 0 };
      S.touch();
    }
  };

  // ------------------------------------------------------------------ 保存
  var pending = false, pendingResolve = [];
  S.flush = function (force) {
    if (!S.loaded) return Promise.resolve();
    S.save.updatedAt = Date.now();
    var qids = Object.keys(S.dirtyQ);
    S.dirtyQ = {};
    return new Promise(function (res, rej) {
      var t = db.transaction(['kv', 'qstate'], 'readwrite');
      t.objectStore('kv').put(S.save, 'save');
      var qst = t.objectStore('qstate');
      qids.forEach(function (id) { if (S.q[id]) qst.put(S.q[id]); });
      t.oncomplete = function () { res(); };
      t.onerror = function () { rej(t.error); };
    });
  };
  var flushSoon = U.debounce(function () { S.flush().catch(function (e) { console.error('save error', e); }); }, 250);

  S.touch = function () { flushSoon(); };
  S.touchQ = function (id) { S.dirtyQ[id] = 1; flushSoon(); };

  // ------------------------------------------------------------------ ゲーム操作
  S.isOwned = function (speciesId) { return !!S.save.owned[speciesId]; };
  S.lvOf = function (speciesId) { var o = S.save.owned[speciesId]; return o ? o.lv : 0; };
  S.isFormUnlocked = function (imageId) {
    var p = D.p(imageId); if (!p) return false;
    var o = S.save.owned[p.sp];
    return !!(o && o.forms[imageId]);
  };
  S.ownedFormIds = function (speciesId) {
    var o = S.save.owned[speciesId]; if (!o) return [];
    return D.sp(speciesId).forms.filter(function (f) { return o.forms[f]; });
  };
  S.allOwnedForms = function () {
    var out = [];
    Object.keys(S.save.owned).forEach(function (sid) {
      S.ownedFormIds(sid).forEach(function (f) { out.push(D.p(f)); });
    });
    return out;
  };
  S.ownedCount = function () { return Object.keys(S.save.owned).length; };

  // 種を新規取得（Lv.1）。既に所持なら false
  S.acquireSpecies = function (speciesId, formId) {
    if (S.save.owned[speciesId]) {
      // 形態だけ開放
      if (formId && !S.save.owned[speciesId].forms[formId]) {
        S.save.owned[speciesId].forms[formId] = 1; S.touch(); return 'form';
      }
      return false;
    }
    var o = { lv: 1, forms: {} };
    var base = D.sp(speciesId).base;
    o.forms[base] = 1;
    if (formId && formId !== base) o.forms[formId] = 1;
    S.save.owned[speciesId] = o;
    S.touch();
    return true;
  };

  S.candyOf = function (lineId) { return S.save.candy[lineId] || 0; };
  S.addCandy = function (lineId, n) {
    S.save.candy[lineId] = (S.save.candy[lineId] || 0) + n;
    if (n > 0) S.save.stats.candyGained += n;
    S.touch();
    return S.save.candy[lineId];
  };
  S.spendCandy = function (lineId, n) {
    if ((S.save.candy[lineId] || 0) < n) return false;
    S.save.candy[lineId] -= n; S.touch(); return true;
  };

  S.addCoins = function (n) {
    S.save.coins += n;
    if (n > 0) S.save.stats.coinsEarned += n; else S.save.stats.coinsSpent += -n;
    S.touch();
  };
  S.addItem = function (key, n) { S.save.items[key] = (S.save.items[key] || 0) + n; S.touch(); };

  // レイド状態
  S.raidState = function (imageId) {
    var r = S.save.raids[imageId];
    if (!r) { r = S.save.raids[imageId] = { hp: null, cleared: 0, clears: 0 }; }
    return r;
  };

  // ------------------------------------------------------------------ Export / Import
  S.exportObj = function () {
    return {
      app: 'chemipoke',
      saveVersion: SAVE_VERSION,
      exportedAt: new Date().toISOString(),
      save: S.save,
      qstate: Object.keys(S.q).map(function (k) { return S.q[k]; })
    };
  };
  S.exportJSON = function () { return JSON.stringify(S.exportObj()); };

  S.backupCurrent = function () {
    return kvPut('backup', { at: Date.now(), data: S.exportObj() });
  };
  S.getBackup = function () { return kvGet('backup'); };

  S.importObj = function (obj) {
    if (!obj || obj.app !== 'chemipoke' || !obj.save) throw new Error('このファイルはケミポケのセーブデータではありません。');
    return S.backupCurrent().then(function () {
      return new Promise(function (res, rej) {
        var t = db.transaction(['kv', 'qstate'], 'readwrite');
        t.objectStore('qstate').clear();
        var qst = t.objectStore('qstate');
        (obj.qstate || []).forEach(function (x) { qst.put(x); });
        t.objectStore('kv').put(migrate(obj.save), 'save');
        t.oncomplete = function () { res(); };
        t.onerror = function () { rej(t.error); };
      });
    }).then(function () {
      S.q = {}; S.dirtyQ = {};
      (obj.qstate || []).forEach(function (x) { S.q[x.i] = x; });
      S.save = migrate(obj.save);
      S.rolloverDaily();
    });
  };

  S.newGame = function () {
    return S.backupCurrent().then(function () {
      return new Promise(function (res, rej) {
        var t = db.transaction(['kv', 'qstate'], 'readwrite');
        t.objectStore('qstate').clear();
        var sv = defaultSave(); grantStarter(sv);
        t.objectStore('kv').put(sv, 'save');
        t.oncomplete = function () { S.save = sv; S.q = {}; S.dirtyQ = {}; res(); };
        t.onerror = function () { rej(t.error); };
      });
    });
  };

  S.wipeAll = function () {
    return new Promise(function (res, rej) {
      var t = db.transaction(['kv', 'qstate'], 'readwrite');
      t.objectStore('kv').clear();
      t.objectStore('qstate').clear();
      t.oncomplete = function () {
        var sv = defaultSave(); grantStarter(sv);
        S.save = sv; S.q = {}; S.dirtyQ = {};
        kvPut('save', sv).then(res, rej);
      };
      t.onerror = function () { rej(t.error); };
    });
  };

  g.S = S;
})(window);
