/* ============ quiz.js : 出題スケジューラ（20枠シャッフルバッグ） ============ */
(function (g) {
  'use strict';
  var Q = {};

  var BAG = { 'new': 10, 'rev': 8, 'd24': 2 };   // 合計20枠
  var MASTER_STREAK = 3;

  function newBag() {
    var b = [];
    Object.keys(BAG).forEach(function (k) { for (var i = 0; i < BAG[k]; i++) b.push(k); });
    return U.shuffle(b);
  }

  // 24時間経過した習得済み問題を復習候補へ戻す
  Q.refresh24 = function () {
    var now = Date.now(), n = 0;
    for (var i = 0; i < D.questions.length; i++) {
      var id = D.questions[i].i, st = S.q[id];
      if (!st) continue;
      if (st.sc >= MASTER_STREAK && st.lc && (now - st.lc) >= U.DAY) {
        st.sc = 0; st.d24 = 1; S.touchQ(id); n++;
      }
    }
    return n;
  };

  Q.isMastered = function (st) {
    return st.sc >= MASTER_STREAK && st.lc && (Date.now() - st.lc) < U.DAY;
  };

  // 各枠の候補を集める
  function pools() {
    var asked = S.save.quiz.asked;
    var res = { 'new': [], 'rev': [], 'd24': [], any: [] };
    for (var i = 0; i < D.questions.length; i++) {
      var q = D.questions[i], st = S.q[q.i];
      if (!st) { res['new'].push(q); continue; }
      if (Q.isMastered(st)) continue;
      if (st.ta === 0) { res['new'].push(q); continue; }
      if (st.d24) { res['d24'].push(q); }
      if (st.na <= asked) res['rev'].push(q);
      res.any.push(q);
    }
    return res;
  }
  Q.pools = pools;

  var FALLBACK = { 'new': ['new', 'd24', 'rev'], 'rev': ['rev', 'd24', 'new'], 'd24': ['d24', 'rev', 'new'] };

  // 最終フォールバック：最も長く出題されていない問題
  function oldest() {
    var best = null, bestT = Infinity, bestM = null, bestMT = Infinity;
    for (var i = 0; i < D.questions.length; i++) {
      var q = D.questions[i], st = S.q[q.i];
      var la = st ? st.la : 0;
      if (st && Q.isMastered(st)) { if (la < bestMT) { bestMT = la; bestM = q; } continue; }
      if (la < bestT) { bestT = la; best = q; }
    }
    return best || bestM || D.questions[0];
  }

  // 次の問題を1問取り出す
  Q.draw = function () {
    Q.refresh24();
    var qz = S.save.quiz;
    if (!qz.bag || qz.bagPos >= qz.bag.length) { qz.bag = newBag(); qz.bagPos = 0; }
    var kind = qz.bag[qz.bagPos++];
    var p = pools(), chosen = null, usedKind = kind;
    var order = FALLBACK[kind];
    for (var i = 0; i < order.length; i++) {
      var arr = p[order[i]];
      if (arr && arr.length) { chosen = arr[Math.floor(Math.random() * arr.length)]; usedKind = order[i]; break; }
    }
    if (!chosen) { chosen = oldest(); usedKind = 'fb'; }

    qz.asked++;
    var st = S.qs(chosen.i);
    st.la = Date.now();
    S.touchQ(chosen.i);
    S.touch();

    // 4択（正解1＋誤答3）をランダム順に
    var opts = U.shuffle([chosen.o].concat(chosen.w));
    return { q: chosen, options: opts, kind: usedKind, slot: kind, state: st };
  };

  // 回答を反映
  Q.answer = function (qid, chosenText) {
    var q = D.qById[qid], st = S.qs(qid);
    var ok = (chosenText === q.o);
    var was24 = !!st.d24;
    st.ta++;
    st.d24 = 0;
    var justMastered = false;
    if (ok) {
      st.tc++; st.sc++; st.sw = 0; st.lc = Date.now();
      if (st.sc === MASTER_STREAK) justMastered = true;
    } else {
      st.sw++; st.sc = 0;
    }
    st.na = S.save.quiz.asked + (st.sw >= 2 ? U.randInt(20, 35) : U.randInt(35, 50));
    st.lp = chosenText;                       // 直近に選んだ選択肢
    S.touchQ(qid);

    S.rolloverDaily();
    var sv = S.save;
    sv.stats.answered++; sv.daily.answered++;
    if (ok) { sv.stats.correct++; sv.daily.correct++; }
    if (st.ta === 1) sv.daily.newQ++; else sv.daily.revQ++;
    if (justMastered) { sv.stats.mastered++; sv.daily.mastered++; }
    S.touch();

    return { correct: ok, mastered: justMastered, was24: was24, state: st, q: q };
  };

  // 学習状態の集計
  Q.summary = function () {
    var t = { total: D.questions.length, seen: 0, mastered: 0, due24: 0, wrongList: 0, correctList: 0, unseen: 0, revReady: 0 };
    var asked = S.save.quiz.asked;
    for (var i = 0; i < D.questions.length; i++) {
      var id = D.questions[i].i, st = S.q[id];
      if (!st || st.ta === 0) { t.unseen++; continue; }
      t.seen++;
      if (Q.isMastered(st)) t.mastered++;
      if (st.d24) t.due24++;
      if (st.ta - st.tc > 0) t.wrongList++;
      if (st.tc > 0) t.correctList++;
      if (!Q.isMastered(st) && st.na <= asked) t.revReady++;
    }
    return t;
  };

  g.Q = Q;
})(window);
