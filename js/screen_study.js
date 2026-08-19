/* ============ screen_study.js : 学習・履歴・統計 ============ */
(function () {
  'use strict';

  var st = { tab: 'summary', search: '', limit: 60, app: 'all', sort: 'recent' };

  UI.register('study', {
    title: '学習', tab: 'study', noBack: true,
    render: function (v) {
      var tabs = U.el('div', { class: 'scroller' });
      [['summary', '概要'], ['wrong', '間違えた問題'], ['right', '正解した問題'], ['fav', 'お気に入り'], ['recent', '最近'], ['all', 'すべて']].forEach(function (t) {
        tabs.appendChild(U.el('button', {
          class: 'chip' + (st.tab === t[0] ? ' on' : ''), text: t[1],
          onclick: function () { st.tab = t[0]; st.limit = 60; UI.reload(); }
        }));
      });
      v.appendChild(tabs);

      if (st.tab === 'summary') return renderSummary(v);
      renderList(v);
    }
  });

  function renderSummary(v) {
    var sv = S.save, sum = Q.summary();
    v.appendChild(UI.section('今日の学習'));
    var g = U.el('div', { class: 'stat-grid' });
    var d = sv.daily;
    [[d.answered, '回答'], [d.correct, '正解'], [U.pct(d.correct, d.answered, 0), '正答率'],
     [d.newQ, '新規'], [d.revQ, '復習'], [d.mastered, '3連正解']].forEach(function (x) {
      g.appendChild(U.el('div', { class: 'stat-box' }, [U.el('b', { text: String(x[0]) }), U.el('span', { text: x[1] })]));
    });
    var c1 = U.el('div', { class: 'card' }); c1.appendChild(g); v.appendChild(c1);

    v.appendChild(UI.section('累計統計'));
    var c2 = U.el('div', { class: 'card' });
    c2.appendChild(UI.kv('総回答数', U.comma(sv.stats.answered)));
    c2.appendChild(UI.kv('総正解数', U.comma(sv.stats.correct)));
    c2.appendChild(UI.kv('通算正答率', U.pct(sv.stats.correct, sv.stats.answered)));
    c2.appendChild(UI.kv('3連続正解 達成回数', U.comma(sv.stats.mastered)));
    v.appendChild(c2);

    v.appendChild(UI.section('問題の状態（全' + U.comma(sum.total) + '問）'));
    var c3 = U.el('div', { class: 'card' });
    c3.appendChild(UI.kv('未出題', U.comma(sum.unseen)));
    c3.appendChild(UI.kv('出題済み', U.comma(sum.seen)));
    c3.appendChild(UI.kv('習得中（3連正解・24h待機）', U.comma(sum.mastered)));
    c3.appendChild(UI.kv('24時間経過の復習待ち', U.comma(sum.due24)));
    c3.appendChild(UI.kv('いま復習可能', U.comma(sum.revReady)));
    c3.appendChild(UI.kv('間違えた問題（履歴）', U.comma(sum.wrongList)));
    c3.appendChild(UI.kv('正解した問題（履歴）', U.comma(sum.correctList)));
    var bar = U.el('div', { class: 'bar-mini' });
    bar.appendChild(U.el('i', { style: { width: (sum.seen / sum.total * 100) + '%' } }));
    c3.appendChild(bar);
    c3.appendChild(U.el('div', { class: 'xs dim', style: { marginTop: '4px' }, text: '出題進捗 ' + (sum.seen / sum.total * 100).toFixed(1) + '%' }));
    v.appendChild(c3);

    v.appendChild(UI.section('分野別'));
    var byApp = {};
    D.questions.forEach(function (q) {
      var a = byApp[q.a] || (byApp[q.a] = { total: 0, seen: 0, mastered: 0, correct: 0, asked: 0 });
      a.total++;
      var s = S.q[q.i];
      if (s && s.ta) { a.seen++; a.asked += s.ta; a.correct += s.tc; if (Q.isMastered(s)) a.mastered++; }
    });
    var c4 = U.el('div', { class: 'card' });
    Object.keys(byApp).forEach(function (k) {
      var a = byApp[k];
      c4.appendChild(U.el('div', { class: 'small', style: { fontWeight: '700', marginTop: '6px' }, text: k }));
      c4.appendChild(U.el('div', { class: 'xs dim', text: '出題済 ' + a.seen + '/' + a.total + '　習得 ' + a.mastered + '　正答率 ' + U.pct(a.correct, a.asked) }));
      var b = U.el('div', { class: 'bar-mini' });
      b.appendChild(U.el('i', { style: { width: (a.seen / a.total * 100) + '%' } }));
      c4.appendChild(b);
    });
    v.appendChild(c4);
  }

  function renderList(v) {
    var tools = U.el('div', { class: 'card tight' });
    var si = U.el('input', { type: 'search', placeholder: '問題文・選択肢・解説を検索', value: st.search });
    si.addEventListener('input', U.debounce(function () { st.search = si.value.trim(); st.limit = 60; redraw(); }, 250));
    tools.appendChild(si);
    var ac = U.el('div', { class: 'scroller', style: { marginTop: '6px' } });
    var apps = ['all'].concat(Object.keys(D.questions.reduce(function (m, q) { m[q.a] = 1; return m; }, {})));
    apps.forEach(function (a) {
      ac.appendChild(U.el('button', {
        class: 'chip', 'data-a': a, text: a === 'all' ? '全分野' : a,
        onclick: function () { st.app = a; st.limit = 60; sync(); redraw(); }
      }));
    });
    tools.appendChild(ac);
    var sc = U.el('div', { class: 'chips', style: { marginTop: '6px' } });
    [['recent', '最近回答順'], ['wrongN', '間違い多い順'], ['streak', '連続正解順'], ['id', 'ID順']].forEach(function (s) {
      sc.appendChild(U.el('button', { class: 'chip sm', 'data-s': s[0], text: s[1], onclick: function () { st.sort = s[0]; sync(); redraw(); } }));
    });
    tools.appendChild(sc);
    v.appendChild(tools);

    var info = U.el('div', { class: 'xs dim', style: { margin: '6px 2px' } });
    v.appendChild(info);
    var body = U.el('div');
    v.appendChild(body);
    var more = U.el('div');
    v.appendChild(more);

    function sync() {
      U.$$('[data-a]', ac).forEach(function (b) { b.classList.toggle('on', b.dataset.a === st.app); });
      U.$$('[data-s]', sc).forEach(function (b) { b.classList.toggle('on', b.dataset.s === st.sort); });
    }

    function collect() {
      var out = [];
      for (var i = 0; i < D.questions.length; i++) {
        var q = D.questions[i], s = S.q[q.i];
        if (st.app !== 'all' && q.a !== st.app) continue;
        if (st.tab === 'wrong') { if (!s || (s.ta - s.tc) <= 0) continue; }
        else if (st.tab === 'right') { if (!s || s.tc <= 0) continue; }
        else if (st.tab === 'fav') { if (!s || !s.fav) continue; }
        else if (st.tab === 'recent') { if (!s || !s.la) continue; }
        if (st.search) {
          var t = q.q + ' ' + q.o + ' ' + q.w.join(' ') + ' ' + q.e + ' ' + q.i;
          if (t.indexOf(st.search) < 0) continue;
        }
        out.push({ q: q, s: s || S.defaultQ(q.i) });
      }
      if (st.sort === 'recent') out.sort(function (a, b) { return (b.s.la || 0) - (a.s.la || 0); });
      else if (st.sort === 'wrongN') out.sort(function (a, b) { return (b.s.ta - b.s.tc) - (a.s.ta - a.s.tc); });
      else if (st.sort === 'streak') out.sort(function (a, b) { return b.s.sc - a.s.sc || (b.s.lc || 0) - (a.s.lc || 0); });
      else out.sort(function (a, b) { return a.q.i < b.q.i ? -1 : 1; });
      return out;
    }

    function redraw() {
      U.clear(body); U.clear(more);
      var list = collect();
      info.textContent = list.length + ' 問';
      if (!list.length) { body.appendChild(UI.empty('該当する問題がありません')); return; }
      list.slice(0, st.limit).forEach(function (x) { body.appendChild(card(x.q, x.s)); });
      if (list.length > st.limit) {
        more.appendChild(U.el('button', {
          class: 'btn block', text: 'さらに表示（残り ' + (list.length - st.limit) + '）',
          onclick: function () { st.limit += 60; redraw(); }
        }));
      }
    }

    function card(q, s) {
      var c = U.el('button', { class: 'q-card', onclick: function () { detail(q); } });
      c.appendChild(U.el('div', { class: 'qc-q', text: q.q }));
      var meta = U.el('div', { class: 'qc-meta' });
      meta.appendChild(U.el('span', { text: q.a + ' · ' + q.c }));
      meta.appendChild(U.el('span', { text: '出題 ' + s.ta + ' / 正解 ' + s.tc }));
      meta.appendChild(U.el('span', { text: '連続 ' + s.sc, style: { color: s.sc >= 3 ? 'var(--ok)' : '' } }));
      meta.appendChild(U.el('span', { text: U.fmtAgo(s.la) }));
      if (s.fav) meta.appendChild(U.el('span', { text: '★', style: { color: 'var(--gold)' } }));
      if (s.d24) meta.appendChild(U.el('span', { text: '24h復習', style: { color: 'var(--warn)' } }));
      if (Q.isMastered(s)) meta.appendChild(U.el('span', { text: '習得中', style: { color: 'var(--ok)' } }));
      c.appendChild(meta);
      return c;
    }

    function detail(q) {
      var s = S.q[q.i] || S.defaultQ(q.i);
      var w = U.el('div');
      w.appendChild(U.el('div', { class: 'q-text', style: { maxHeight: 'none' }, text: q.q }));
      w.appendChild(U.el('div', { class: 'sec-title', text: '選択肢' }));
      var opts = [q.o].concat(q.w);
      opts.forEach(function (o, i) {
        w.appendChild(U.el('div', { class: 'ans-line ' + (i === 0 ? 'ok' : 'ng'), text: (i === 0 ? '◎ ' : '・ ') + o }));
      });
      w.appendChild(U.el('div', { class: 'sec-title', text: '解説' }));
      w.appendChild(U.el('div', { class: 'expl', style: { maxHeight: 'none' }, text: q.e && q.e.length ? q.e : ('正解：' + q.o) }));
      w.appendChild(U.el('div', { class: 'sec-title', text: '学習状態' }));
      var st2 = U.el('div');
      st2.appendChild(UI.kv('問題ID', q.i));
      st2.appendChild(UI.kv('分野 / 区分', q.a + ' / ' + q.c));
      st2.appendChild(UI.kv('累計 出題 / 正解', s.ta + ' / ' + s.tc));
      st2.appendChild(UI.kv('正答率', U.pct(s.tc, s.ta)));
      st2.appendChild(UI.kv('連続正解数', s.sc));
      st2.appendChild(UI.kv('連続不正解数', s.sw));
      st2.appendChild(UI.kv('最終出題', U.fmtDT(s.la)));
      st2.appendChild(UI.kv('最終正解', U.fmtDT(s.lc)));
      st2.appendChild(UI.kv('次回出題可能', s.na <= S.save.quiz.asked ? '可能' : 'あと ' + (s.na - S.save.quiz.asked) + ' 問'));
      st2.appendChild(UI.kv('状態', Q.isMastered(s) ? '習得中（最後の正解から24時間は出題されません）' : (s.d24 ? '24時間経過・復習待ち' : (s.ta ? '復習対象' : '未出題'))));
      w.appendChild(st2);
      w.appendChild(U.el('div', { class: 'xs dim', style: { marginTop: '8px' }, text: '※ ここでの閲覧は学習状態に影響しません。' }));

      U.modal({
        title: '問題の詳細', body: w,
        buttons: [
          { label: s.fav ? '★ お気に入り解除' : '☆ お気に入り', onClick: function () {
            var ss = S.qs(q.i); ss.fav = ss.fav ? 0 : 1; S.touchQ(q.i); redraw();
          } },
          { label: '閉じる' }
        ]
      });
    }

    sync(); redraw();
  }
})();
