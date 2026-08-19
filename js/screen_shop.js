/* ============ screen_shop.js : ショップ（購入・アメ売却） ============ */
(function () {
  'use strict';

  var GOODS = [
    { key: 'ticket', name: 'レイド挑戦券', price: 250, ic: 'ii-ticket', desc: 'レイド1挑戦につき1枚消費します。' },
    { key: 'stone', name: '変化の石', price: 700, ic: 'ii-stone', desc: '所持ポケモンの未開放形態を1種類、永久に開放します。' },
    { key: 'incense', name: 'お香', price: 250, ic: 'ii-incense', desc: '野生モードで対象ポケモンの出現率を上げます（3回終了まで有効）。' }
  ];

  // その進化系列で、まだ取得していない進化先に必要なアメの合計
  function reserveFor(lineId) {
    var s = 0;
    D.evo.forEach(function (e) { if (e.line === lineId && !S.isOwned(e.to)) s += e.cost; });
    return s;
  }

  function candyLines() {
    var out = [];
    Object.keys(S.save.candy).forEach(function (lid) {
      var n = S.save.candy[lid];
      if (n > 0 && D.lines[lid]) out.push({ line: D.lines[lid], n: n, reserve: reserveFor(lid) });
    });
    out.sort(function (a, b) { return b.n - a.n; });
    return out;
  }

  UI.register('shop', {
    title: 'ショップ', tab: 'shop', noBack: true,
    render: function (v) {
      var coins = S.save.coins;
      var head = U.el('div', { class: 'card row' });
      head.appendChild(U.el('i', { class: 'ii ii-coin xl' }));
      head.appendChild(U.el('div', { class: 'sp' }, [
        U.el('div', { class: 'big', text: U.comma(coins) }),
        U.el('div', { class: 'xs dim', text: '所持コイン（アメの売却で入手できます）' })
      ]));
      v.appendChild(head);

      v.appendChild(UI.section('購入'));
      GOODS.forEach(function (gd) {
        var c = U.el('div', { class: 'card' });
        var top = U.el('div', { class: 'row' });
        top.appendChild(U.el('i', { class: 'ii ' + gd.ic + ' xl' }));
        top.appendChild(U.el('div', { class: 'sp' }, [
          U.el('div', { style: { fontWeight: '800' }, text: gd.name }),
          U.el('div', { class: 'xs dim', text: gd.desc }),
          U.el('div', { class: 'xs', style: { color: 'var(--gold)', marginTop: '2px' }, text: gd.price + ' コイン　/　所持 ' + S.save.items[gd.key] })
        ]));
        c.appendChild(top);
        var bg = U.el('div', { class: 'btn-grid c4', style: { marginTop: '8px' } });
        [1, 5, 10].forEach(function (n) {
          var b = U.el('button', {
            class: 'btn sm col', html: '×' + n + '<span class="xs dim">' + U.comma(gd.price * n) + '</span>',
            onclick: function () { buy(gd, n); }
          });
          if (coins < gd.price * n) b.setAttribute('disabled', '');
          bg.appendChild(b);
        });
        var maxN = Math.floor(coins / gd.price);
        bg.appendChild(U.el('button', {
          class: 'btn sm col pri', html: '指定<span class="xs">最大' + U.comma(maxN) + '</span>',
          onclick: function () {
            if (maxN < 1) { U.toast('コインが足りません'); return; }
            U.promptNum(gd.name + ' を購入', {
              value: 1, min: 1, max: maxN,
              note: '1個 ' + gd.price + ' コイン　/　最大 ' + maxN + ' 個',
              live: function (n) { return '合計 ' + U.comma(gd.price * U.clamp(n, 0, maxN)) + ' コイン'; },
              quick: [{ label: '最大', value: maxN }]
            }, function (n) { buy(gd, n); });
          }
        }));
        c.appendChild(bg);
        v.appendChild(c);
      });

      // ---------------- アメ売却
      v.appendChild(UI.section('アメの売却（1個 = 1コイン）'));
      var lines = candyLines();
      var tools = U.el('div', { class: 'card tight' });
      var total = lines.reduce(function (a, b) { return a + b.n; }, 0);
      var totalSellable = lines.reduce(function (a, b) { return a + Math.max(0, b.n - b.reserve); }, 0);
      tools.appendChild(U.el('div', { class: 'small', html: '所持アメ合計 <b>' + U.comma(total) + '</b> 個　/　進化分を残した売却可能量 <b>' + U.comma(totalSellable) + '</b> 個' }));
      var bg2 = U.el('div', { class: 'btn-grid c2', style: { marginTop: '8px' } });
      var b1 = U.el('button', {
        class: 'btn sm', text: '進化分を残して全売却',
        onclick: function () {
          if (totalSellable <= 0) { U.toast('売却できるアメがありません') ; return; }
          U.confirm('まとめて売却', '各系列で「まだ取得していない進化先に必要なアメ」を残し、余った ' + U.comma(totalSellable) + ' 個を売却します。\n' + U.comma(totalSellable) + ' コインを獲得します。', function () {
            lines.forEach(function (l) {
              var sell = Math.max(0, l.n - l.reserve);
              if (sell > 0) { S.save.candy[l.line.id] -= sell; S.addCoins(sell); }
            });
            S.touch(); UI.reload(); U.toast(U.comma(totalSellable) + ' コインを獲得');
          }, { yesLabel: '売却する', danger: true });
        }
      });
      if (totalSellable <= 0) b1.setAttribute('disabled', '');
      bg2.appendChild(b1);
      var b2 = U.el('button', {
        class: 'btn sm dan', text: 'すべて売却',
        onclick: function () {
          if (total <= 0) { U.toast('売却できるアメがありません'); return; }
          U.confirm('すべてのアメを売却', '所持しているアメ ' + U.comma(total) + ' 個をすべて売却します。\n進化・強化に必要なアメも失われます。本当によろしいですか？', function () {
            lines.forEach(function (l) { S.save.candy[l.line.id] = 0; });
            S.addCoins(total); S.touch(); UI.reload(); U.toast(U.comma(total) + ' コインを獲得');
          }, { yesLabel: 'すべて売却する', danger: true });
        }
      });
      if (total <= 0) b2.setAttribute('disabled', '');
      bg2.appendChild(b2);
      tools.appendChild(bg2);
      v.appendChild(tools);

      if (!lines.length) { v.appendChild(UI.empty('アメを持っていません。\n野生モードで既に所持しているポケモンを捕まえるとアメが手に入ります。')); return; }

      var si = U.el('input', { type: 'search', placeholder: 'アメ名で検索', style: { marginBottom: '8px' } });
      v.appendChild(si);
      var listEl = U.el('div');
      v.appendChild(listEl);
      si.addEventListener('input', U.debounce(drawList, 180));
      drawList();

      function drawList() {
        U.clear(listEl);
        var s = si.value.trim();
        var arr = s ? lines.filter(function (l) { return l.line.name.indexOf(s) >= 0; }) : lines;
        arr.slice(0, 150).forEach(function (l) {
          var rep = D.p(D.sp(l.line.rep).base);
          var c = U.el('div', { class: 'card tight' });
          var row = U.el('div', { class: 'row' });
          row.appendChild(D.spriteEl(rep.i, 36));
          row.appendChild(U.el('div', { class: 'sp' }, [
            U.el('div', { class: 'small', style: { fontWeight: '700' }, text: l.line.name }),
            U.el('div', { class: 'xs dim', text: '所持 ' + U.comma(l.n) + ' 個　/　進化に必要 ' + U.comma(l.reserve) + ' 個' })
          ]));
          c.appendChild(row);
          var bg3 = U.el('div', { class: 'btn-grid c3', style: { marginTop: '6px' } });
          bg3.appendChild(U.el('button', {
            class: 'btn xsm', text: '個数指定', onclick: function () {
              U.promptNum(l.line.name + ' を売却', {
                value: Math.max(0, l.n - l.reserve), min: 0, max: l.n,
                note: '所持 ' + U.comma(l.n) + ' 個　/　1個 = 1コイン',
                live: function (n) { return U.comma(U.clamp(n, 0, l.n)) + ' コインを獲得（残り ' + U.comma(l.n - U.clamp(n, 0, l.n)) + ' 個）'; },
                quick: [{ label: '進化分を残す', value: Math.max(0, l.n - l.reserve) }, { label: '全部', value: l.n }]
              }, function (n) { sell(l, n); });
            }
          }));
          var b3 = U.el('button', {
            class: 'btn xsm', text: '進化分を残す', onclick: function () { sell(l, Math.max(0, l.n - l.reserve)); }
          });
          if (l.n - l.reserve <= 0) b3.setAttribute('disabled', '');
          bg3.appendChild(b3);
          bg3.appendChild(U.el('button', { class: 'btn xsm dan', text: '全部', onclick: function () { sell(l, l.n); } }));
          c.appendChild(bg3);
          listEl.appendChild(c);
        });
        if (arr.length > 150) listEl.appendChild(U.el('div', { class: 'xs dim center', text: '…他 ' + (arr.length - 150) + ' 件' }));
      }

      function sell(l, n) {
        n = U.clamp(Math.floor(n), 0, l.n);
        if (n <= 0) return;
        var go = function () {
          S.save.candy[l.line.id] -= n;
          S.addCoins(n);
          S.touch(); UI.reload(); U.toast(U.comma(n) + ' コインを獲得');
        };
        if (n >= 100 || n > l.n - l.reserve) {
          U.confirm('アメを売却', l.line.name + ' を ' + U.comma(n) + ' 個売却します。\n' + U.comma(n) + ' コインを獲得します。'
            + (n > l.n - l.reserve ? '\n\n⚠ 進化に必要な分を下回ります。' : ''), go, { yesLabel: '売却する', danger: n > l.n - l.reserve });
        } else go();
      }

      function buy(gd, n) {
        n = Math.floor(n);
        if (n < 1) return;
        var cost = gd.price * n;
        if (S.save.coins < cost) { U.toast('コインが足りません'); return; }
        var go = function () {
          S.addCoins(-cost);
          S.addItem(gd.key, n);
          UI.reload(); U.toast(gd.name + ' ×' + n + ' を購入しました');
        };
        if (cost >= 2000) U.confirm('購入の確認', gd.name + ' ×' + n + ' を ' + U.comma(cost) + ' コインで購入します。', go, { yesLabel: '購入する' });
        else go();
      }
    }
  });
})();
