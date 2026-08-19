/* ============ screen_wild.js : 野生捕獲モードの準備画面 ============ */
(function () {
  'use strict';

  UI.register('wildSetup', {
    title: '野生捕獲モード', tab: 'home',
    render: function (v, params) {
      var typeIdx = params && params.typeIdx != null ? params.typeIdx : S.save.lastType;
      if (typeIdx == null) typeIdx = 4;

      // ---- タイプ選択
      v.appendChild(UI.section('出現タイプを選ぶ'));
      var tc = U.el('div', { class: 'card tight' });
      var chips = U.el('div', { class: 'chips' });
      D.types.forEach(function (t, i) {
        chips.appendChild(U.el('button', {
          class: 'chip' + (i === typeIdx ? ' on' : ''), text: t,
          onclick: function () {
            typeIdx = i; S.save.lastType = i; S.touch();
            UI.go('wildSetup', { typeIdx: i }, { replace: true });
          }
        }));
      });
      tc.appendChild(chips);
      v.appendChild(tc);

      // ---- 出現候補プレビュー
      var dist = E.wildDistribution(typeIdx, S.save.incense ? S.save.incense.target : null);
      var pc = U.el('div', { class: 'card tight' });
      pc.appendChild(U.el('div', { class: 'small', html: '<b>' + D.types[typeIdx] + '</b> タイプの出現候補：<b>' + dist.list.length + '</b> 種' }));
      if (!dist.list.length) {
        pc.appendChild(U.el('div', { class: 'warn-box', style: { marginTop: '8px' }, text: 'このタイプには出現候補がいません。別のタイプを選んでください。' }));
      } else {
        var order = dist.list.map(function (p, i) { return { p: p, q: dist.prob[i] }; })
          .sort(function (a, b) { return b.q - a.q; }).slice(0, 12);
        var sc = U.el('div', { class: 'scroller', style: { marginTop: '6px' } });
        order.forEach(function (o) {
          var cell = U.el('div', { class: 'pick-cell', style: { minWidth: '66px' } });
          cell.appendChild(D.spriteEl(o.p.i, 36, S.isOwned(o.p.sp) ? '' : 'silh'));
          cell.appendChild(U.el('div', { class: 'xs trunc', style: { maxWidth: '62px', textAlign: 'center' }, text: o.p.n }));
          cell.appendChild(U.el('div', { class: 'xs dim', text: (o.q * 100).toFixed(1) + '%' }));
          sc.appendChild(cell);
        });
        pc.appendChild(sc);
        pc.appendChild(U.el('div', { class: 'xs dim', text: '出現率の高い順（上位12種）。進化段階 無進化/進化前96% · 1進化3.7% · 2進化0.3%' }));
      }
      v.appendChild(pc);

      // ---- パーティ
      var members = PartyUI.sanitize(S.save.party);
      var maxLv = members.length ? Math.max.apply(null, members.map(function (id) { return S.lvOf(D.p(id).sp); })) : 1;
      var enemyLv = E.wildEnemyLevel(maxLv);

      v.appendChild(UI.section('パーティ（最大6匹・6匹未満でも出撃可）'));
      var mc = U.el('div', { class: 'card' });
      mc.appendChild(U.el('div', { class: 'row', style: { marginBottom: '8px' } }, [
        U.el('div', { class: 'sp small', html: '味方最高Lv <b>' + maxLv + '</b> → 敵Lv <b style="color:var(--warn)">' + enemyLv + '</b>（上限80）' }),
        U.el('button', {
          class: 'btn xsm pri', text: '変更', onclick: function () {
            UI.go('partyPick', {
              members: members, onDone: function (list) {
                S.save.party = list; S.touch();
                UI.go('wildSetup', { typeIdx: typeIdx }, { replace: true });
              }
            });
          }
        })
      ]));
      if (!members.length) mc.appendChild(UI.empty('パーティが空です。「変更」から選んでください。'));
      var sc2 = U.el('div', { class: 'scroller' });
      members.forEach(function (id, i) {
        var cell = U.el('div', { class: 'pick-cell', style: { minWidth: '70px' } });
        cell.appendChild(U.el('span', { class: 'ord', text: String(i + 1) }));
        cell.appendChild(D.spriteEl(id, 40));
        cell.appendChild(U.el('div', { class: 'xs trunc', style: { maxWidth: '66px', textAlign: 'center' }, text: D.p(id).n }));
        cell.appendChild(U.el('div', { class: 'xs', style: { color: 'var(--gold)' }, text: 'Lv.' + S.lvOf(D.p(id).sp) }));
        sc2.appendChild(cell);
      });
      mc.appendChild(sc2);
      var ab = U.el('div', { class: 'btn-grid c2', style: { marginTop: '8px' } });
      ab.appendChild(U.el('button', {
        class: 'btn sm', text: 'Lv順で自動編成', onclick: function () {
          S.save.party = PartyUI.autoByLevel(); S.touch(); UI.go('wildSetup', { typeIdx: typeIdx }, { replace: true });
        }
      }));
      ab.appendChild(U.el('button', {
        class: 'btn sm', text: D.types[typeIdx] + 'に強い順', onclick: function () {
          S.save.party = PartyUI.autoByMatchup(typeIdx); S.touch(); UI.go('wildSetup', { typeIdx: typeIdx }, { replace: true });
        }
      }));
      mc.appendChild(ab);
      v.appendChild(mc);

      // ---- お香
      v.appendChild(UI.section('お香'));
      var ic = U.el('div', { class: 'card tight' });
      if (S.save.incense) {
        var t = D.p(S.save.incense.target);
        var row = U.el('div', { class: 'row' });
        row.appendChild(D.spriteEl(t.i, 44));
        row.appendChild(U.el('div', { class: 'sp' }, [
          U.el('div', { class: 'small', html: '<b>' + U.esc(t.n) + '</b> を対象に使用中' }),
          U.el('div', { class: 'xs dim', text: '残り有効回数 ' + S.save.incense.remain + ' 回' }),
          U.el('div', { class: 'xs', style: { color: t.t.indexOf(typeIdx) >= 0 ? 'var(--ok)' : 'var(--bad)' },
            text: t.t.indexOf(typeIdx) >= 0 ? '選択中のタイプに出現します（出現率 20%＋通常×0.8）' : '⚠ 選択中のタイプでは出現しません（効果なし）' })
        ]));
        ic.appendChild(row);
      } else if (S.save.items.incense > 0) {
        ic.appendChild(U.el('div', { class: 'small dim', text: 'お香を使うと、対象ポケモンの出現率が 20%＋通常確率×0.8 になります。野生モードを3回終了するまで有効です。' }));
        ic.appendChild(U.el('button', {
          class: 'btn sm block', style: { marginTop: '8px' }, text: 'お香を使う（所持 ' + S.save.items.incense + ' 個）',
          onclick: function () { chooseIncense(typeIdx); }
        }));
      } else {
        ic.appendChild(U.el('div', { class: 'xs dim', text: 'お香を所持していません（ショップで250コイン）' }));
      }
      v.appendChild(ic);

      // ---- 出撃
      var go = U.el('button', {
        class: 'btn pri block', style: { marginTop: '14px', padding: '14px' }, text: '出撃する',
        onclick: function () {
          if (!members.length) { U.toast('パーティに1匹以上必要です'); return; }
          if (!dist.list.length) { U.toast('このタイプには出現候補がいません'); return; }
          S.save.party = members; S.save.lastType = typeIdx; S.touch();
          Battle.start({ mode: 'wild', party: members, typeIdx: typeIdx });
        }
      });
      if (!members.length || !dist.list.length) go.setAttribute('disabled', '');
      v.appendChild(go);
      v.appendChild(U.el('div', { class: 'xs dim center', style: { marginTop: '8px' }, text: '逃走または味方全滅まで、野生ポケモンが次々と出現します。' }));
    }
  });

  function chooseIncense(typeIdx) {
    var cands = E.incenseCandidates(typeIdx);
    var body = U.el('div');
    body.appendChild(U.el('div', { class: 'xs dim', text: '対象にできるのは「無進化または進化前・貴重NO・基本形態」かつ ' + D.types[typeIdx] + ' タイプを持つポケモンです。' }));
    var si = U.el('input', { type: 'search', placeholder: '名前で検索', style: { margin: '8px 0' } });
    body.appendChild(si);
    var grid = U.el('div', { class: 'pick-grid' });
    body.appendChild(grid);
    var draw = function () {
      U.clear(grid);
      var s = si.value.trim();
      var list = s ? cands.filter(function (p) { return p.n.indexOf(s) >= 0; }) : cands;
      list.slice(0, 200).forEach(function (p) {
        var cell = U.el('button', { class: 'pick-cell' });
        cell.appendChild(D.spriteEl(p.i, 38, S.isOwned(p.sp) ? '' : 'silh'));
        cell.appendChild(U.el('div', { class: 'xs trunc', style: { maxWidth: '72px', textAlign: 'center' }, text: p.n }));
        cell.addEventListener('click', function () { confirmIncense(p); });
        grid.appendChild(cell);
      });
      if (!list.length) grid.appendChild(UI.empty('候補がいません'));
    };
    si.addEventListener('input', draw); draw();
    var m = U.modal({ title: 'お香の対象を選ぶ', body: body, buttons: [{ label: '閉じる' }] });

    function confirmIncense(p) {
      U.confirm('お香を使う', p.n + ' を対象にお香を使います。\nお香が1個消費され、野生モードを3回終了するまで有効です。', function () {
        S.save.items.incense--;
        S.save.incense = { target: p.i, remain: 3 };
        S.touch();
        m.close();
        UI.go('wildSetup', { typeIdx: typeIdx }, { replace: true });
        U.toast('お香を使用しました');
      }, { yesLabel: '使う' });
    }
  }
})();
