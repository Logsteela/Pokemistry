/* ============ screen_dex.js : 図鑑一覧 / ポケモン詳細（強化・進化・形態） ============ */
(function () {
  'use strict';

  var st = { search: '', type: -1, own: 'all', extra: 'none', sort: 'dex', view: 'grid', limit: 240 };

  function canEvolve(sp) {
    if (!S.isOwned(sp)) return false;
    return E.evoOptions(sp).some(function (o) { return !o.owned && S.candyOf(D.sp(sp).line) >= o.cost; });
  }
  function hasEvoTarget(sp) {
    return E.evoOptions(sp).some(function (o) { return !o.owned; });
  }
  function canLevel(sp) {
    if (!S.isOwned(sp)) return false;
    var lv = S.lvOf(sp);
    return lv < 100 && S.candyOf(D.sp(sp).line) >= (lv + 1);
  }

  UI.register('dex', {
    title: '図鑑', tab: 'dex', noBack: true,
    render: function (v) {
      var head = U.el('div', { class: 'card tight' });
      var si = U.el('input', { type: 'search', placeholder: '名前で検索', value: st.search });
      si.addEventListener('input', U.debounce(function () { st.search = si.value.trim(); st.limit = 240; draw(); }, 180));
      head.appendChild(si);

      var tchips = U.el('div', { class: 'scroller', style: { marginTop: '6px' } });
      [{ label: '全タイプ', value: -1 }].concat(D.types.map(function (t, i) { return { label: t, value: i }; })).forEach(function (it) {
        tchips.appendChild(U.el('button', { class: 'chip', 'data-t': it.value, text: it.label, onclick: function () { st.type = it.value; st.limit = 240; sync(); draw(); } }));
      });
      head.appendChild(tchips);

      var ochips = U.el('div', { class: 'scroller', style: { marginTop: '6px' } });
      [['all', 'すべて'], ['own', '所持'], ['none', '未所持'], ['vip', '貴重']].forEach(function (o) {
        ochips.appendChild(U.el('button', { class: 'chip', 'data-o': o[0], text: o[1], onclick: function () { st.own = o[0]; st.limit = 240; sync(); draw(); } }));
      });
      head.appendChild(ochips);

      var echips = U.el('div', { class: 'scroller', style: { marginTop: '6px' } });
      [['none', '条件なし'], ['evo', '進化可能'], ['evoT', '進化先あり'], ['lvup', '強化可能'], ['forms', '形態あり'], ['locked', '未開放形態あり']].forEach(function (o) {
        echips.appendChild(U.el('button', { class: 'chip', 'data-e': o[0], text: o[1], onclick: function () { st.extra = o[0]; st.limit = 240; sync(); draw(); } }));
      });
      head.appendChild(echips);

      var schips = U.el('div', { class: 'chips', style: { marginTop: '6px' } });
      [['dex', '掲載順'], ['lv', 'Lv順'], ['bst', '種族値'], ['catch', '捕獲度'], ['name', '名前']].forEach(function (s) {
        schips.appendChild(U.el('button', { class: 'chip sm', 'data-s': s[0], text: s[1], onclick: function () { st.sort = s[0]; sync(); draw(); } }));
      });
      schips.appendChild(U.el('button', {
        class: 'chip sm', id: 'viewToggle', text: st.view === 'grid' ? 'リスト表示' : 'グリッド表示',
        onclick: function () { st.view = st.view === 'grid' ? 'list' : 'grid'; sync(); draw(); }
      }));
      head.appendChild(schips);
      v.appendChild(head);

      var info = U.el('div', { class: 'xs dim', style: { margin: '6px 2px' } });
      v.appendChild(info);
      var body = U.el('div');
      v.appendChild(body);
      var more = U.el('div', { style: { marginTop: '10px' } });
      v.appendChild(more);

      function sync() {
        U.$$('[data-t]', tchips).forEach(function (b) { b.classList.toggle('on', Number(b.dataset.t) === st.type); });
        U.$$('[data-o]', ochips).forEach(function (b) { b.classList.toggle('on', b.dataset.o === st.own); });
        U.$$('[data-e]', echips).forEach(function (b) { b.classList.toggle('on', b.dataset.e === st.extra); });
        U.$$('[data-s]', schips).forEach(function (b) { b.classList.toggle('on', b.dataset.s === st.sort); });
        var vt = document.getElementById('viewToggle');
        if (vt) vt.textContent = st.view === 'grid' ? 'リスト表示' : 'グリッド表示';
      }

      function filtered() {
        var list = D.pokemon.slice();
        if (st.search) list = list.filter(function (p) { return p.n.indexOf(st.search) >= 0; });
        if (st.type >= 0) list = list.filter(function (p) { return p.t.indexOf(st.type) >= 0; });
        if (st.own === 'own') list = list.filter(function (p) { return S.isFormUnlocked(p.i); });
        else if (st.own === 'none') list = list.filter(function (p) { return !S.isFormUnlocked(p.i); });
        else if (st.own === 'vip') list = list.filter(function (p) { return p.v === 1; });
        if (st.extra === 'evo') list = list.filter(function (p) { return canEvolve(p.sp); });
        else if (st.extra === 'evoT') list = list.filter(function (p) { return hasEvoTarget(p.sp); });
        else if (st.extra === 'lvup') list = list.filter(function (p) { return canLevel(p.sp); });
        else if (st.extra === 'forms') list = list.filter(function (p) { return D.sp(p.sp).forms.length > 1; });
        else if (st.extra === 'locked') list = list.filter(function (p) {
          return S.isOwned(p.sp) && D.sp(p.sp).forms.some(function (f) { return !S.isFormUnlocked(f); });
        });
        if (st.sort === 'lv') list.sort(function (a, b) { return S.lvOf(b.sp) - S.lvOf(a.sp) || a.idx - b.idx; });
        else if (st.sort === 'bst') list.sort(function (a, b) { return b.b - a.b; });
        else if (st.sort === 'catch') list.sort(function (a, b) { return b.c - a.c; });
        else if (st.sort === 'name') list.sort(function (a, b) { return a.n.localeCompare(b.n, 'ja'); });
        else list.sort(function (a, b) { return a.idx - b.idx; });
        return list;
      }

      function draw() {
        U.clear(body); U.clear(more);
        var list = filtered();
        var ownedN = list.filter(function (p) { return S.isFormUnlocked(p.i); }).length;
        info.textContent = list.length + ' 件（所持 ' + ownedN + '）';
        var show = list.slice(0, st.limit);
        if (!show.length) { body.appendChild(UI.empty('該当するポケモンがいません')); return; }
        if (st.view === 'grid') {
          var g = U.el('div', { class: 'dex-grid' });
          show.forEach(function (p) { g.appendChild(cell(p)); });
          body.appendChild(g);
        } else {
          show.forEach(function (p) { body.appendChild(listRow(p)); });
        }
        if (list.length > st.limit) {
          more.appendChild(U.el('button', {
            class: 'btn block', text: 'さらに表示（残り ' + (list.length - st.limit) + '）',
            onclick: function () { st.limit += 240; draw(); }
          }));
        }
      }

      function cell(p) {
        var owned = S.isFormUnlocked(p.i);
        var c = U.el('button', { class: 'dex-cell' + (owned ? ' have' : ''), onclick: function () { UI.go('pokeDetail', { id: p.i }); } });
        c.appendChild(D.spriteEl(p.i, 40, owned ? '' : 'silh'));
        c.appendChild(U.el('div', { class: 'nm', text: owned ? p.n : '???' }));
        if (owned) c.appendChild(U.el('span', { class: 'lv', text: S.lvOf(p.sp) }));
        if (p.v) c.appendChild(U.el('span', { class: 'badge', html: '<span class="badge-vip">貴</span>' }));
        return c;
      }

      function listRow(p) {
        var owned = S.isFormUnlocked(p.i);
        var r = U.el('button', { class: 'dex-list-row', onclick: function () { UI.go('pokeDetail', { id: p.i }); } });
        r.appendChild(D.spriteEl(p.i, 40, owned ? '' : 'silh'));
        var info2 = U.el('div', { class: 'sp', style: { minWidth: 0 } });
        info2.appendChild(U.el('div', { class: 'small trunc', style: { fontWeight: '700' }, text: (owned ? p.n : '???') }));
        var tr = U.el('div', { class: 'row', style: { gap: '4px', marginTop: '2px' } });
        p.t.forEach(function (ti) { tr.appendChild(D.typeBadge(ti)); });
        info2.appendChild(tr);
        r.appendChild(info2);
        r.appendChild(U.el('div', { class: 'xs dim mono', style: { textAlign: 'right' }, html: (owned ? 'Lv.' + S.lvOf(p.sp) + '<br>' : '') + 'BST ' + p.b }));
        return r;
      }

      sync(); draw();
    }
  });

  // ---------------------------------------------------------------- 詳細
  UI.register('pokeDetail', {
    title: function (pm) { return D.p(pm.id).n; }, tab: 'dex',
    render: function (v, params) {
      var p = D.p(params.id);
      var sp = D.sp(p.sp);
      var owned = S.isOwned(p.sp);
      var unlocked = S.isFormUnlocked(p.i);
      var lv = S.lvOf(p.sp);
      var lineId = sp.line;
      var candy = S.candyOf(lineId);

      var head = U.el('div', { class: 'card center' });
      head.appendChild(D.spriteEl(p.i, 96, unlocked ? '' : (owned ? 'gray' : 'silh')));
      head.appendChild(U.el('div', { class: 'big', text: p.n }));
      head.appendChild(U.el('div', { class: 'xs dim', text: '全国 No.' + p.d + '　/　' + p.r + (p.sc ? ' · ' + p.sc : '') + '　/　第' + p.g + '世代' }));
      var tr = U.el('div', { class: 'chips', style: { justifyContent: 'center', marginTop: '6px' } });
      p.t.forEach(function (ti) { tr.appendChild(D.typeBadge(ti)); });
      if (p.v) tr.appendChild(U.el('span', { class: 'badge-vip', text: '貴重（レイド対象）' }));
      head.appendChild(tr);
      if (owned) {
        head.appendChild(U.el('div', { class: 'big', style: { color: 'var(--gold)', marginTop: '6px' }, text: 'Lv.' + lv }));
        if (!unlocked) head.appendChild(U.el('div', { class: 'xs', style: { color: 'var(--warn)' }, text: 'この形態は未開放です' }));
      } else {
        head.appendChild(U.el('div', { class: 'small dim', style: { marginTop: '6px' }, text: '未所持' }));
      }
      v.appendChild(head);

      // ---- 種族値 / 実数値
      var sc = U.el('div', { class: 'card' });
      sc.appendChild(U.el('div', { class: 'sec-title', style: { margin: '0 0 6px' }, text: '種族値（合計 ' + p.b + '）' }));
      var names = ['HP', 'こうげき', 'ぼうぎょ', 'とくこう', 'とくぼう', 'すばやさ'];
      var real = owned ? E.statsFor(p, lv) : null;
      names.forEach(function (n, i) {
        var row = U.el('div', { class: 'row', style: { gap: '8px', margin: '3px 0' } });
        row.appendChild(U.el('span', { class: 'xs dim', style: { width: '54px' }, text: n }));
        row.appendChild(U.el('span', { class: 'xs mono', style: { width: '28px', textAlign: 'right' }, text: String(p.s[i]) }));
        var bar = U.el('div', { class: 'bar-mini sp', style: { marginTop: 0 } });
        bar.appendChild(U.el('i', { style: { width: U.clamp(p.s[i] / 190 * 100, 2, 100) + '%' } }));
        row.appendChild(bar);
        if (real) row.appendChild(U.el('span', { class: 'xs mono', style: { width: '52px', textAlign: 'right', color: 'var(--acc)' }, text: U.comma(real[i]) }));
        sc.appendChild(row);
      });
      sc.appendChild(U.el('div', { class: 'xs dim', style: { marginTop: '6px' }, text: '青字はLv.' + lv + '時の実数値（IV31 / EV0 / 性格補正なし）' }));
      sc.appendChild(UI.kv('被捕獲度', p.c + '（捕獲成功率 ' + (p.c / 256 * 100).toFixed(1) + '%）'));
      sc.appendChild(UI.kv('進化段階', p.st === 0 ? '無進化 / 進化前' : p.st + '進化'));
      v.appendChild(sc);

      // ---- アメ / 強化
      v.appendChild(UI.section('アメ・強化'));
      var cc = U.el('div', { class: 'card' });
      cc.appendChild(U.el('div', { class: 'row' }, [
        U.el('i', { class: 'ii ii-candy lg' }),
        U.el('div', { class: 'sp small', html: '<b>' + U.esc(D.candyName(lineId)) + '</b>　所持 <b style="color:var(--gold)">' + U.comma(candy) + '</b> 個' })
      ]));
      if (!owned) {
        cc.appendChild(U.el('div', { class: 'xs dim', style: { marginTop: '6px' }, text: 'まだ所持していないため強化できません。' }));
      } else if (lv >= 100) {
        cc.appendChild(U.el('div', { class: 'xs', style: { marginTop: '6px', color: 'var(--ok)' }, text: '最大レベルに達しています。' }));
      } else {
        var need1 = lv + 1;
        cc.appendChild(U.el('div', { class: 'xs dim', style: { margin: '6px 0' }, text: '次のLvに必要なアメ：' + need1 + ' 個　/　Lv.100まで：' + U.comma(E.candyToLevel(lv, 100)) + ' 個' }));
        var bg = U.el('div', { class: 'btn-grid c4' });
        [1, 5, 10].forEach(function (n) {
          var to = Math.min(100, lv + n);
          var cost = E.candyToLevel(lv, to);
          var b = U.el('button', {
            class: 'btn sm col', html: '+' + n + '<span class="xs dim">' + U.comma(cost) + '</span>',
            onclick: function () { doLevel(to); }
          });
          if (cost > candy || to === lv) b.setAttribute('disabled', '');
          bg.appendChild(b);
        });
        var maxLv = E.maxLevelWith(lv, candy);
        var bmax = U.el('button', {
          class: 'btn sm col ok', html: '最大<span class="xs">Lv.' + maxLv + '</span>',
          onclick: function () { doLevel(maxLv); }
        });
        if (maxLv <= lv) bmax.setAttribute('disabled', '');
        bg.appendChild(bmax);
        cc.appendChild(bg);
        cc.appendChild(U.el('button', {
          class: 'btn sm block', style: { marginTop: '8px' }, text: 'Lvを指定して強化',
          onclick: function () {
            U.promptNum('目標レベルを指定', {
              value: Math.min(100, lv + 10), min: lv + 1, max: 100,
              note: '現在 Lv.' + lv + '　所持アメ ' + U.comma(candy) + ' 個',
              live: function (n) {
                var cost = E.candyToLevel(lv, U.clamp(n, lv, 100));
                return 'Lv.' + U.clamp(n, lv, 100) + ' まで：アメ ' + U.comma(cost) + ' 個' + (cost > candy ? '（不足 ' + U.comma(cost - candy) + '）' : '');
              }
            }, function (n) { doLevel(U.clamp(n, lv, 100)); });
          }
        }));
      }
      v.appendChild(cc);

      function doLevel(to) {
        if (to <= lv) return;
        var cost = E.candyToLevel(lv, to);
        if (cost > candy) { U.toast('アメが足りません'); return; }
        S.spendCandy(lineId, cost);
        S.save.owned[p.sp].lv = to;
        S.touch();
        U.toast('Lv.' + to + ' になった！');
        UI.reload();
      }

      // ---- 進化
      var evos = E.evoOptions(p.sp);
      if (evos.length) {
        v.appendChild(UI.section('進化'));
        var ec = U.el('div', { class: 'card' });
        evos.forEach(function (o) {
          var target = D.p(D.sp(o.to).base);
          var right = U.el('div');
          if (o.owned) right.appendChild(U.el('span', { class: 'chip sm', text: '取得済' }));
          else {
            var b = U.el('button', {
              class: 'btn xsm pri', text: 'アメ' + o.cost,
              onclick: function () { doEvolve(o, target); }
            });
            if (!owned || candy < o.cost) b.setAttribute('disabled', '');
            right.appendChild(b);
          }
          ec.appendChild(UI.pokeRow(target, {
            size: 40, right: right,
            sub: (o.branch ? '分岐進化 / ' : '') + '必要アメ ' + o.cost + '　（' + (S.isOwned(o.to) ? '取得済み' : '未取得') + '）',
            onClick: function () { UI.go('pokeDetail', { id: target.i }); }
          }));
        });
        ec.appendChild(U.el('div', { class: 'xs dim', style: { marginTop: '4px' }, text: '進化しても元のポケモンは失われません。新しい種類として追加取得し、レイド挑戦券を1枚獲得します。' }));
        v.appendChild(ec);
      }

      function doEvolve(o, target) {
        if (S.candyOf(lineId) < o.cost) { U.toast('アメが足りません'); return; }
        U.confirm('進化させますか？', p.n + ' → ' + o.toName + '\n' + D.candyName(lineId) + ' を ' + o.cost + ' 個消費します。\n（元のポケモンは失われません）', function () {
          if (!S.spendCandy(lineId, o.cost)) { U.toast('アメが足りません'); return; }
          S.acquireSpecies(o.to, D.sp(o.to).base);
          S.addItem('ticket', 1);
          S.save.stats.evolved++;
          S.touch();
          U.modal({
            title: 'おめでとう！',
            body: (function () {
              var w = U.el('div', { class: 'center' });
              w.appendChild(D.spriteEl(D.sp(o.to).base, 96));
              w.appendChild(U.el('div', { class: 'big', text: o.toName + ' を取得！' }));
              w.appendChild(U.el('div', { class: 'small dim', text: 'Lv.1 で仲間になりました' }));
              w.appendChild(U.el('div', { class: 'small', style: { color: 'var(--gold)', marginTop: '6px' }, text: 'レイド挑戦券 +1' }));
              return w;
            })(),
            buttons: [{ label: 'OK', cls: 'pri', onClick: function () { UI.reload(); } }]
          });
        }, { yesLabel: '進化する' });
      }

      // ---- 形態
      if (sp.forms.length > 1) {
        v.appendChild(UI.section('形態（Lvは共有）'));
        var fc = U.el('div', { class: 'card' });
        sp.forms.forEach(function (fid, i) {
          var fp = D.p(fid);
          var ul = S.isFormUnlocked(fid);
          var fu = D.fusionByForm[fid];
          var right = U.el('div');
          if (i === 0) right.appendChild(U.el('span', { class: 'chip sm', text: '基本' }));
          else if (ul) right.appendChild(U.el('span', { class: 'chip sm', style: { color: 'var(--ok)' }, text: '開放済' }));
          else {
            var b = U.el('button', {
              class: 'btn xsm gold', text: '変化の石',
              onclick: function () { doUnlock(fp, fu); }
            });
            if (!owned || S.save.items.stone < 1 || (fu && !S.isOwned(fu.partner))) b.setAttribute('disabled', '');
            right.appendChild(b);
          }
          var sub = 'BST ' + fp.b + (fu ? '　合体条件：' + fu.partnerName + '所持' + (S.isOwned(fu.partner) ? '（OK）' : '（未所持）') : '');
          fc.appendChild(UI.pokeRow(fp, { size: 40, right: right, sub: sub, onClick: function () { UI.go('pokeDetail', { id: fid }); } }));
        });
        fc.appendChild(U.el('div', { class: 'xs dim', style: { marginTop: '4px' }, text: '変化の石1個で未開放形態を1種類、永久に開放できます。開放後はパーティ編成で自由に切り替えられます（戦闘中の変更は不可）。' }));
        v.appendChild(fc);
      }

      function doUnlock(fp, fu) {
        if (S.save.items.stone < 1) { U.toast('変化の石がありません'); return; }
        if (fu && !S.isOwned(fu.partner)) { U.toast(fu.partnerName + ' を所持している必要があります'); return; }
        U.confirm('変化の石を使いますか？', fp.n + ' を永久に開放します。\n変化の石を1個消費します。', function () {
          S.save.items.stone--;
          S.save.owned[p.sp].forms[fp.i] = 1;
          S.touch();
          U.toast(fp.n + ' を開放しました！');
          UI.reload();
        }, { yesLabel: '使う' });
      }

      // ---- レイド
      if (p.v) {
        var rb = U.el('button', {
          class: 'btn block', style: { marginTop: '10px' }, text: 'このポケモンのレイドを見る',
          onclick: function () { UI.go('raidDetail', { id: p.i }); }
        });
        v.appendChild(rb);
      }
    }
  });
})();
