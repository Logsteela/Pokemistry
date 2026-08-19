/* ============ screen_raid.js : レイド一覧 / 詳細 ============ */
(function () {
  'use strict';

  var state = { search: '', type: -1, filter: 'all', sort: 'dex' };

  function hpInfo(p) {
    var rs = S.raidState(p.i);
    var max = E.raidMaxHP(p);
    var hp = rs.hp == null ? max : U.clamp(rs.hp, 0, max);
    return { rs: rs, max: max, hp: hp, ratio: max ? hp / max : 1 };
  }

  UI.register('raidList', {
    title: 'レイド', tab: 'home',
    render: function (v) {
      var head = U.el('div', { class: 'card tight' });
      head.appendChild(U.el('div', { class: 'row small' }, [
        U.el('div', { class: 'sp', html: 'レイド券 <b style="color:var(--gold)">' + S.save.items.ticket + '</b> 枚　/　対象 ' + D.raidList.length + ' 件' }),
        U.el('button', { class: 'btn xsm', text: 'ショップ', onclick: function () { UI.go('shop'); } })
      ]));
      var si = U.el('input', { type: 'search', placeholder: '名前で検索', value: state.search, style: { marginTop: '8px' } });
      si.addEventListener('input', U.debounce(function () { state.search = si.value.trim(); draw(); }, 180));
      head.appendChild(si);

      var tchips = U.el('div', { class: 'scroller', style: { marginTop: '6px' } });
      [{ label: '全タイプ', value: -1 }].concat(D.types.map(function (t, i) { return { label: t, value: i }; })).forEach(function (it) {
        tchips.appendChild(U.el('button', {
          class: 'chip', 'data-t': it.value, text: it.label,
          onclick: function () { state.type = it.value; sync(); draw(); }
        }));
      });
      head.appendChild(tchips);

      var fchips = U.el('div', { class: 'scroller', style: { marginTop: '6px' } });
      [['all', 'すべて'], ['undone', '未撃破'], ['done', '撃破済'], ['damaged', '削り途中'], ['unowned', '未所持']].forEach(function (f) {
        fchips.appendChild(U.el('button', {
          class: 'chip', 'data-f': f[0], text: f[1],
          onclick: function () { state.filter = f[0]; sync(); draw(); }
        }));
      });
      head.appendChild(fchips);

      var schips = U.el('div', { class: 'chips', style: { marginTop: '6px' } });
      [['dex', '図鑑順'], ['hp', '残HP率が低い順'], ['damaged', '削り途中優先'], ['bst', '種族値順']].forEach(function (s) {
        schips.appendChild(U.el('button', {
          class: 'chip sm', 'data-s': s[0], text: s[1],
          onclick: function () { state.sort = s[0]; sync(); draw(); }
        }));
      });
      head.appendChild(schips);
      v.appendChild(head);

      var listEl = U.el('div');
      v.appendChild(listEl);

      function sync() {
        U.$$('[data-t]', tchips).forEach(function (b) { b.classList.toggle('on', Number(b.dataset.t) === state.type); });
        U.$$('[data-f]', fchips).forEach(function (b) { b.classList.toggle('on', b.dataset.f === state.filter); });
        U.$$('[data-s]', schips).forEach(function (b) { b.classList.toggle('on', b.dataset.s === state.sort); });
      }

      function draw() {
        U.clear(listEl);
        var list = D.raidList.slice();
        if (state.search) list = list.filter(function (p) { return p.n.indexOf(state.search) >= 0; });
        if (state.type >= 0) list = list.filter(function (p) { return p.t.indexOf(state.type) >= 0; });
        if (state.filter === 'undone') list = list.filter(function (p) { return !S.raidState(p.i).cleared; });
        else if (state.filter === 'done') list = list.filter(function (p) { return S.raidState(p.i).cleared; });
        else if (state.filter === 'damaged') list = list.filter(function (p) { var h = hpInfo(p); return h.ratio < 1 && h.hp > 0; });
        else if (state.filter === 'unowned') list = list.filter(function (p) { return !S.isFormUnlocked(p.i); });

        if (state.sort === 'hp') list.sort(function (a, b) { return hpInfo(a).ratio - hpInfo(b).ratio; });
        else if (state.sort === 'damaged') list.sort(function (a, b) {
          var ha = hpInfo(a), hb = hpInfo(b);
          var da = (ha.ratio < 1 && ha.hp > 0) ? 0 : 1, db = (hb.ratio < 1 && hb.hp > 0) ? 0 : 1;
          return da - db || ha.ratio - hb.ratio || a.idx - b.idx;
        });
        else if (state.sort === 'bst') list.sort(function (a, b) { return b.b - a.b; });
        else list.sort(function (a, b) { return a.idx - b.idx; });

        if (!list.length) { listEl.appendChild(UI.empty('該当するレイドがありません')); return; }
        listEl.appendChild(U.el('div', { class: 'xs dim', style: { margin: '8px 2px' }, text: list.length + ' 件' }));
        list.slice(0, 400).forEach(function (p) { listEl.appendChild(card(p)); });
        if (list.length > 400) listEl.appendChild(U.el('div', { class: 'xs dim center', text: '…他 ' + (list.length - 400) + ' 件（検索で絞り込んでください）' }));
      }

      function card(p) {
        var h = hpInfo(p);
        var owned = S.isFormUnlocked(p.i);
        var c = U.el('button', { class: 'raid-card' + (h.rs.cleared ? ' cleared' : ''), onclick: function () { UI.go('raidDetail', { id: p.i }); } });
        c.appendChild(D.spriteEl(p.i, 48, owned ? '' : 'silh'));
        var body = U.el('div', { class: 'rc-body' });
        var nm = U.el('div', { class: 'rc-name' }, [U.el('span', { class: 'trunc', text: p.n })]);
        if (!owned) nm.appendChild(U.el('span', { class: 'chip sm', text: '未所持' }));
        if (h.rs.cleared) nm.appendChild(U.el('span', { class: 'chip sm', style: { color: 'var(--ok)' }, text: '撃破 ' + h.rs.clears }));
        body.appendChild(nm);
        var tr = U.el('div', { class: 'row', style: { gap: '4px', margin: '3px 0' } });
        p.t.forEach(function (ti) { tr.appendChild(D.typeBadge(ti)); });
        if (E.raidHasBonus(p)) tr.appendChild(U.el('span', { class: 'chip sm', style: { color: 'var(--warn)' }, text: '強化ボス' }));
        body.appendChild(tr);
        var bar = UI.hpBar(h.hp, h.max, 'tall');
        body.appendChild(bar);
        body.appendChild(U.el('div', { class: 'rc-reward', text: U.comma(h.hp) + ' / ' + U.comma(h.max) + '　(' + (h.ratio * 100).toFixed(1) + '%)　次回報酬：' + (h.rs.cleared ? D.candyName(p.ev) + ' ×50' : (owned ? '形態開放' : p.n + 'を取得')) }));
        c.appendChild(body);
        return c;
      }

      sync(); draw();
    }
  });

  // ---------------------------------------------------------------- 詳細
  UI.register('raidDetail', {
    title: function (p) { return D.p(p.id).n + ' レイド'; }, tab: 'home',
    render: function (v, params) {
      var p = D.p(params.id);
      var h = hpInfo(p);
      var st = E.raidBossStats(p);

      var head = U.el('div', { class: 'card center' });
      head.appendChild(D.spriteEl(p.i, 96, S.isFormUnlocked(p.i) ? '' : 'silh'));
      head.appendChild(U.el('div', { class: 'big', text: p.n }));
      var tr = U.el('div', { class: 'chips center', style: { justifyContent: 'center', marginTop: '4px' } });
      p.t.forEach(function (ti) { tr.appendChild(D.typeBadge(ti)); });
      tr.appendChild(U.el('span', { class: 'chip sm', text: 'Lv.90' }));
      if (E.raidHasBonus(p)) tr.appendChild(U.el('span', { class: 'chip sm', style: { color: 'var(--warn)' }, text: '強化補正あり' }));
      head.appendChild(tr);
      var bar = UI.hpBar(h.hp, h.max, 'tall');
      bar.style.marginTop = '10px';
      head.appendChild(bar);
      head.appendChild(U.el('div', { class: 'small mono', style: { marginTop: '4px' }, text: U.comma(h.hp) + ' / ' + U.comma(h.max) + '（' + (h.ratio * 100).toFixed(2) + '%）' }));
      v.appendChild(head);

      var sc = U.el('div', { class: 'card' });
      sc.appendChild(U.el('div', { class: 'sec-title', style: { margin: '0 0 6px' }, text: 'ボス実数値' }));
      sc.appendChild(UI.kv('HP', U.comma(st[0])));
      sc.appendChild(UI.kv('こうげき', U.comma(st[1])));
      sc.appendChild(UI.kv('ぼうぎょ', U.comma(st[2])));
      sc.appendChild(UI.kv('とくこう', U.comma(st[3])));
      sc.appendChild(UI.kv('とくぼう', U.comma(st[4])));
      sc.appendChild(UI.kv('すばやさ', U.comma(st[5])));
      sc.appendChild(U.el('div', { class: 'xs dim', style: { marginTop: '6px' }, text: '全レイド共通：H×100 / B×5 / D×5' + (E.raidHasBonus(p) ? '　＋強化補正：H×2 / A・B・C・D×1.5' : '') }));
      v.appendChild(sc);

      // 報酬
      var rc = U.el('div', { class: h.rs.cleared ? 'info-box' : 'card' });
      rc.appendChild(U.el('div', { class: 'small', html: '<b>次回撃破報酬：</b>' + (h.rs.cleared ? U.esc(D.candyName(p.ev)) + ' ×50' : (S.isFormUnlocked(p.i) ? '形態開放' : U.esc(p.n) + ' を取得・開放')) }));
      rc.appendChild(U.el('div', { class: 'xs dim', text: '撃破回数 ' + h.rs.clears + ' 回　/　攻撃間隔 5秒' }));
      v.appendChild(rc);

      // パーティ
      var members = PartyUI.sanitize(S.save.party);
      var mc = U.el('div', { class: 'card' });
      mc.appendChild(U.el('div', { class: 'row', style: { marginBottom: '6px' } }, [
        U.el('b', { class: 'sp small', text: 'パーティ（' + members.length + '/6）' }),
        U.el('button', {
          class: 'btn xsm pri', text: '変更', onclick: function () {
            UI.go('partyPick', { members: members, onDone: function (list) { S.save.party = list; S.touch(); UI.go('raidDetail', { id: p.i }, { replace: true }); } });
          }
        })
      ]));
      var row = U.el('div', { class: 'scroller' });
      members.forEach(function (id) {
        var cell = U.el('div', { class: 'pick-cell', style: { minWidth: '66px' } });
        cell.appendChild(D.spriteEl(id, 38));
        cell.appendChild(U.el('div', { class: 'xs trunc', style: { maxWidth: '62px', textAlign: 'center' }, text: D.p(id).n }));
        cell.appendChild(U.el('div', { class: 'xs', style: { color: 'var(--gold)' }, text: 'Lv.' + S.lvOf(D.p(id).sp) }));
        row.appendChild(cell);
      });
      if (!members.length) mc.appendChild(UI.empty('パーティが空です'));
      mc.appendChild(row);
      var ab = U.el('div', { class: 'btn-grid c2', style: { marginTop: '8px' } });
      ab.appendChild(U.el('button', { class: 'btn sm', text: 'Lv順', onclick: function () { S.save.party = PartyUI.autoByLevel(); S.touch(); UI.go('raidDetail', { id: p.i }, { replace: true }); } }));
      ab.appendChild(U.el('button', { class: 'btn sm', text: p.t.map(function (t) { return D.types[t]; }).join('/') + 'に強い順', onclick: function () { S.save.party = PartyUI.autoByMatchup(p.t[0]); S.touch(); UI.go('raidDetail', { id: p.i }, { replace: true }); } }));
      mc.appendChild(ab);
      v.appendChild(mc);

      var go = U.el('button', {
        class: 'btn dan block', style: { marginTop: '12px', padding: '14px' },
        text: 'レイド券1枚を消費して挑戦（所持 ' + S.save.items.ticket + '）',
        onclick: function () {
          if (S.save.items.ticket < 1) { U.toast('レイド挑戦券が足りません'); return; }
          if (!members.length) { U.toast('パーティに1匹以上必要です'); return; }
          U.confirm('レイドに挑戦', 'レイド挑戦券を1枚消費します。敗北・リタイアしても返却されません。', function () {
            S.save.items.ticket--;
            S.save.stats.raidRuns++;
            S.touch();
            Battle.start({ mode: 'raid', party: members, raidId: p.i });
          }, { yesLabel: '挑戦する' });
        }
      });
      if (S.save.items.ticket < 1 || !members.length) go.setAttribute('disabled', '');
      v.appendChild(go);
    }
  });
})();
