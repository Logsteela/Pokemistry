/* ============ screen_party.js : パーティ編成 / プリセット / 自動編成 ============ */
(function (g) {
  'use strict';
  var P = {};

  // 所持している開放済み形態のうち、種ごとの代表（種族値合計が最大のもの）
  P.ownedForms = function () { return S.allOwnedForms(); };

  P.sanitize = function (members) {
    var out = [], seenSp = {};
    (members || []).forEach(function (id) {
      var p = D.p(id);
      if (!p || !S.isFormUnlocked(id)) return;
      if (seenSp[p.sp]) return;          // 同一ポケモンIDの重複は不可（1個体を共有するため）
      seenSp[p.sp] = 1;
      out.push(id);
    });
    return out.slice(0, 6);
  };

  P.autoByLevel = function () {
    var bySp = {};
    P.ownedForms().forEach(function (p) {
      var cur = bySp[p.sp];
      if (!cur || p.b > cur.b) bySp[p.sp] = p;
    });
    var arr = Object.keys(bySp).map(function (k) { return bySp[k]; });
    arr.sort(function (a, b) {
      var la = S.lvOf(a.sp), lb = S.lvOf(b.sp);
      return lb - la || b.b - a.b;
    });
    return arr.slice(0, 6).map(function (p) { return p.i; });
  };

  P.autoByMatchup = function (targetType) {
    var bySp = {};
    P.ownedForms().forEach(function (p) {
      var cur = bySp[p.sp];
      if (!cur || p.b > cur.b) bySp[p.sp] = p;
    });
    var arr = Object.keys(bySp).map(function (k) { return bySp[k]; });
    var score = function (p) {
      var off = 0;
      p.t.forEach(function (t) { off = Math.max(off, D.chart[t][targetType]); });
      var def = 1;
      p.t.forEach(function (t) { def *= D.chart[targetType][t]; });
      var lv = S.lvOf(p.sp);
      return (off + 0.001) * (1 / (def + 0.25)) * (1 + lv / 100) * (1 + p.b / 800);
    };
    arr.sort(function (a, b) { return score(b) - score(a) || S.lvOf(b.sp) - S.lvOf(a.sp); });
    return arr.slice(0, 6).map(function (p) { return p.i; });
  };

  // ---------------------------------------------------------------- 選択画面
  UI.register('partyPick', {
    title: 'パーティを選ぶ', tab: 'party',
    render: function (v, params) {
      var sel = P.sanitize(params.members || []);
      var filterType = -1, search = '', sort = 'lv';
      var onDone = params.onDone;

      var head = U.el('div', { class: 'card tight' });
      var cnt = U.el('div', { class: 'row' });
      var cntTxt = U.el('div', { class: 'sp small', text: '' });
      cnt.appendChild(cntTxt);
      cnt.appendChild(U.el('button', {
        class: 'btn xsm', text: 'クリア', onclick: function () { sel = []; redraw(); }
      }));
      head.appendChild(cnt);
      var selRow = U.el('div', { class: 'scroller', style: { marginTop: '6px' } });
      head.appendChild(selRow);
      v.appendChild(head);

      var tools = U.el('div', { class: 'card tight' });
      var si = U.el('input', { type: 'search', placeholder: '名前で検索' });
      si.addEventListener('input', function () { search = si.value.trim(); redrawGrid(); });
      tools.appendChild(si);
      var tchips = U.el('div', { class: 'scroller', style: { marginTop: '6px' } });
      var tlist = [{ label: '全タイプ', value: -1 }].concat(D.types.map(function (t, i) { return { label: t, value: i }; }));
      tlist.forEach(function (it) {
        tchips.appendChild(U.el('button', {
          class: 'chip', text: it.label, 'data-t': it.value,
          onclick: function () { filterType = it.value; syncChips(); redrawGrid(); }
        }));
      });
      tools.appendChild(tchips);
      var sortRow = U.el('div', { class: 'chips', style: { marginTop: '6px' } });
      [['lv', 'Lv順'], ['bst', '種族値順'], ['dex', '図鑑順']].forEach(function (s) {
        sortRow.appendChild(U.el('button', {
          class: 'chip sm', text: s[1], 'data-s': s[0],
          onclick: function () { sort = s[0]; syncChips(); redrawGrid(); }
        }));
      });
      tools.appendChild(sortRow);
      v.appendChild(tools);

      var grid = U.el('div', { class: 'pick-grid' });
      v.appendChild(grid);

      var foot = U.el('div', { class: 'btn-grid c2', style: { marginTop: '12px' } });
      foot.appendChild(U.el('button', { class: 'btn', text: 'キャンセル', onclick: function () { UI.back(); } }));
      foot.appendChild(U.el('button', {
        class: 'btn pri', text: '決定', onclick: function () {
          UI.back();
          if (onDone) onDone(sel.slice());
        }
      }));
      v.appendChild(foot);

      function syncChips() {
        U.$$('[data-t]', tchips).forEach(function (b) { b.classList.toggle('on', Number(b.dataset.t) === filterType); });
        U.$$('[data-s]', sortRow).forEach(function (b) { b.classList.toggle('on', b.dataset.s === sort); });
      }

      function redraw() { redrawSel(); redrawGrid(); }

      function redrawSel() {
        cntTxt.textContent = '選択中 ' + sel.length + ' / 6　（0匹でなければ出撃できます）';
        U.clear(selRow);
        sel.forEach(function (id, i) {
          var cell = U.el('button', {
            class: 'pick-cell on', style: { minWidth: '70px' },
            onclick: function () { sel.splice(i, 1); redraw(); }
          });
          cell.appendChild(U.el('span', { class: 'ord', text: String(i + 1) }));
          cell.appendChild(D.spriteEl(id, 40));
          cell.appendChild(U.el('div', { class: 'nm xs trunc', text: D.p(id).n, style: { maxWidth: '66px' } }));
          selRow.appendChild(cell);
        });
        if (!sel.length) selRow.appendChild(U.el('div', { class: 'xs dim', text: '未選択（下から選んでください）' }));
      }

      function redrawGrid() {
        U.clear(grid);
        var list = P.ownedForms();
        if (filterType >= 0) list = list.filter(function (p) { return p.t.indexOf(filterType) >= 0; });
        if (search) list = list.filter(function (p) { return p.n.indexOf(search) >= 0; });
        if (sort === 'lv') list.sort(function (a, b) { return S.lvOf(b.sp) - S.lvOf(a.sp) || b.b - a.b; });
        else if (sort === 'bst') list.sort(function (a, b) { return b.b - a.b; });
        else list.sort(function (a, b) { return a.idx - b.idx; });

        if (!list.length) { grid.appendChild(UI.empty('該当するポケモンがいません')); return; }
        list.forEach(function (p) {
          var idx = sel.indexOf(p.i);
          var usedSp = sel.some(function (x) { return D.p(x).sp === p.sp && x !== p.i; });
          var cell = U.el('button', { class: 'pick-cell' + (idx >= 0 ? ' on' : ''), style: usedSp ? { opacity: .35 } : null });
          if (idx >= 0) cell.appendChild(U.el('span', { class: 'ord', text: String(idx + 1) }));
          cell.appendChild(D.spriteEl(p.i, 40));
          cell.appendChild(U.el('div', { class: 'nm xs trunc', text: p.n, style: { maxWidth: '72px', textAlign: 'center' } }));
          cell.appendChild(U.el('div', { class: 'xs', style: { color: 'var(--gold)', fontWeight: '800' }, text: 'Lv.' + S.lvOf(p.sp) }));
          cell.addEventListener('click', function () {
            if (idx >= 0) { sel.splice(idx, 1); }
            else {
              if (usedSp) { U.toast('同じポケモンの別形態は同時に編成できません'); return; }
              if (sel.length >= 6) { U.toast('パーティは最大6匹です'); return; }
              sel.push(p.i);
            }
            redraw();
          });
          grid.appendChild(cell);
        });
      }

      syncChips(); redraw();
    }
  });

  // ---------------------------------------------------------------- 編成タブ
  UI.register('party', {
    title: 'パーティ編成', tab: 'party', noBack: true,
    render: function (v) {
      var members = P.sanitize(S.save.party);
      if (members.length !== S.save.party.length) { S.save.party = members; S.touch(); }

      var c = U.el('div', { class: 'card' });
      c.appendChild(U.el('div', { class: 'row', style: { marginBottom: '8px' } }, [
        U.el('b', { class: 'sp', text: '現在のパーティ（' + members.length + '/6）' }),
        U.el('button', { class: 'btn xsm pri', text: '変更', onclick: edit })
      ]));
      if (!members.length) c.appendChild(UI.empty('パーティが空です。\n「変更」から選んでください。'));
      members.forEach(function (id, i) {
        var p = D.p(id);
        var st = E.statsFor(p, S.lvOf(p.sp));
        var right = U.el('div', { class: 'xs dim mono', style: { textAlign: 'right' } });
        right.innerHTML = 'H' + st[0] + ' A' + st[1] + ' B' + st[2] + '<br>C' + st[3] + ' D' + st[4] + ' S' + st[5];
        var row = UI.pokeRow(p, { sub: '#' + (i + 1), right: right, onClick: function () { UI.go('pokeDetail', { id: id }); } });
        c.appendChild(row);
      });
      v.appendChild(c);

      v.appendChild(UI.section('自動編成'));
      var ab = U.el('div', { class: 'btn-grid c2' });
      ab.appendChild(U.el('button', {
        class: 'btn', text: 'Lvが高い順', onclick: function () {
          S.save.party = P.autoByLevel(); S.touch(); UI.reload(); U.toast('Lv順で編成しました');
        }
      }));
      ab.appendChild(U.el('button', {
        class: 'btn', text: 'タイプ相性順', onclick: function () { pickTypeForAuto(); }
      }));
      v.appendChild(ab);

      v.appendChild(UI.section('プリセット'));
      var pc = U.el('div', { class: 'card' });
      if (!S.save.presets.length) pc.appendChild(U.el('div', { class: 'xs dim', text: 'まだ保存されていません' }));
      S.save.presets.forEach(function (pr, i) {
        var row = U.el('div', { class: 'row', style: { padding: '6px 0', borderBottom: '1px solid var(--line)' } });
        var mini = U.el('div', { class: 'row', style: { gap: '2px' } });
        pr.members.slice(0, 6).forEach(function (id) { mini.appendChild(D.spriteEl(id, 26)); });
        row.appendChild(U.el('div', { class: 'sp' }, [U.el('b', { text: pr.name, class: 'small' }), mini]));
        row.appendChild(U.el('button', {
          class: 'btn xsm pri', text: '適用', onclick: function () {
            S.save.party = P.sanitize(pr.members); S.touch(); UI.reload(); U.toast('「' + pr.name + '」を適用しました');
          }
        }));
        row.appendChild(U.el('button', {
          class: 'btn xsm', text: '削除', onclick: function () {
            U.confirm('プリセット削除', '「' + pr.name + '」を削除します。', function () {
              S.save.presets.splice(i, 1); S.touch(); UI.reload();
            }, { danger: true });
          }
        }));
        pc.appendChild(row);
      });
      pc.appendChild(U.el('button', {
        class: 'btn sm block', style: { marginTop: '8px' }, text: '現在のパーティを保存',
        onclick: function () {
          if (!members.length) { U.toast('パーティが空です'); return; }
          var inp = U.el('input', { type: 'text', value: 'プリセット' + (S.save.presets.length + 1), maxlength: 20 });
          U.modal({
            title: 'プリセット名', body: inp,
            buttons: [{ label: 'キャンセル' }, {
              label: '保存', cls: 'pri', onClick: function () {
                S.save.presets.push({ name: inp.value.trim() || ('プリセット' + (S.save.presets.length + 1)), members: members.slice() });
                S.touch(); UI.reload(); U.toast('保存しました');
              }
            }]
          });
        }
      }));
      v.appendChild(pc);

      function edit() {
        UI.go('partyPick', {
          members: members, onDone: function (list) {
            S.save.party = list; S.touch(); UI.reload();
          }
        });
      }
      function pickTypeForAuto() {
        var body = U.el('div', { class: 'chips' });
        D.types.forEach(function (t, i) {
          body.appendChild(U.el('button', {
            class: 'chip', text: t, onclick: function () {
              S.save.party = P.autoByMatchup(i); S.touch();
              U.$$('.mask').forEach(function (m) { m.parentNode.removeChild(m); });
              UI.reload(); U.toast(t + 'に強い順で編成しました');
            }
          }));
        });
        U.modal({ title: '相手のタイプを選択', body: body, buttons: [{ label: '閉じる' }] });
      }
    }
  });

  g.PartyUI = P;
})(window);
