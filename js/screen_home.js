/* ============ screen_home.js : ホーム ============ */
(function () {
  'use strict';

  UI.register('home', {
    title: 'ケミポケ', tab: 'home', noBack: true,
    render: function (v) {
      var sv = S.save;
      var sum = Q.summary();

      // --- ヒーロー
      var lead = sv.party.length ? sv.party[0] : (S.allOwnedForms()[0] || {}).i;
      var hero = U.el('div', { class: 'hero' });
      if (lead) hero.appendChild(D.spriteEl(lead, 64));
      hero.appendChild(U.el('div', { class: 'sp' }, [
        U.el('div', { class: 'big', text: S.ownedCount() + ' / ' + Object.keys(D.species).length }),
        U.el('div', { class: 'xs dim', text: '所持ポケモン（種類）' }),
        U.el('div', { class: 'xs muted', style: { marginTop: '4px' }, text: '形態開放 ' + S.allOwnedForms().length + ' / ' + D.pokemon.length })
      ]));
      v.appendChild(hero);

      // --- モード
      v.appendChild(modeBtn('wild', '野生捕獲モード', 'タイプを選んで捕獲・アメ集め', function () { UI.go('wildSetup'); }));

      var ticketNote = 'レイド券 ' + sv.items.ticket + ' 枚 / ボスLv.90';
      v.appendChild(modeBtn('raid', 'レイドモード', ticketNote, function () { UI.go('raidList'); }));

      // --- お香の状態
      if (sv.incense) {
        var inc = U.el('div', { class: 'card tight row' });
        inc.appendChild(D.spriteEl(sv.incense.target, 40));
        inc.appendChild(U.el('div', { class: 'sp' }, [
          U.el('div', { class: 'small', html: '<b>お香 使用中</b>：' + U.esc(D.p(sv.incense.target).n) }),
          U.el('div', { class: 'xs dim', text: '残り有効回数 ' + sv.incense.remain + ' 回（野生モード終了ごとに1減少）' })
        ]));
        v.appendChild(inc);
      }

      // --- 今日の学習
      v.appendChild(UI.section('今日の学習'));
      var d = sv.daily;
      var grid = U.el('div', { class: 'stat-grid' });
      grid.appendChild(statBox(d.answered, '回答'));
      grid.appendChild(statBox(d.correct, '正解'));
      grid.appendChild(statBox(U.pct(d.correct, d.answered, 0), '正答率'));
      grid.appendChild(statBox(d.newQ, '新規'));
      grid.appendChild(statBox(d.revQ, '復習'));
      grid.appendChild(statBox(d.mastered, '3連正解'));
      var c = U.el('div', { class: 'card' }); c.appendChild(grid);
      v.appendChild(c);

      // --- 進捗
      v.appendChild(UI.section('学習の進捗'));
      var pc = U.el('div', { class: 'card' });
      pc.appendChild(UI.kv('出題済み', sum.seen + ' / ' + sum.total + '問'));
      pc.appendChild(UI.kv('習得中（3連正解・24h待ち）', sum.mastered + '問'));
      pc.appendChild(UI.kv('24時間経過の復習待ち', sum.due24 + '問'));
      pc.appendChild(UI.kv('累計 回答 / 正解', U.comma(sv.stats.answered) + ' / ' + U.comma(sv.stats.correct)));
      var bar = U.el('div', { class: 'bar-mini' });
      bar.appendChild(U.el('i', { style: { width: (sum.seen / sum.total * 100) + '%' } }));
      pc.appendChild(bar);
      v.appendChild(pc);

      // --- その他
      v.appendChild(UI.section('その他'));
      var g2 = U.el('div', { class: 'btn-grid c2' });
      g2.appendChild(U.el('button', { class: 'btn', text: 'データ管理', onclick: function () { UI.go('dataMgr'); } }));
      g2.appendChild(U.el('button', { class: 'btn', text: 'デバッグ', onclick: function () { UI.go('debug'); } }));
      v.appendChild(g2);
      v.appendChild(U.el('div', { class: 'xs dim center', style: { marginTop: '14px' }, text: 'セーブ v' + sv.version + ' / 最終保存 ' + U.fmtDT(sv.updatedAt) }));
    }
  });

  function statBox(val, lab) {
    return U.el('div', { class: 'stat-box' }, [U.el('b', { text: String(val) }), U.el('span', { text: lab })]);
  }

  function modeBtn(kind, title, desc, onclick) {
    var icon = kind === 'wild'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l4-8 4 5 3-6 7 9"/><circle cx="7" cy="6" r="2"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 6 7 1-5 5 1.5 7L12 18l-6.5 3L7 14 2 9l7-1z"/></svg>';
    var b = U.el('button', { class: 'mode-btn', onclick: onclick });
    b.appendChild(U.el('span', { class: 'mode-ic ' + kind, html: icon }));
    b.appendChild(U.el('span', { class: 'sp' }, [
      U.el('div', { class: 'mode-t', text: title }),
      U.el('div', { class: 'mode-d', text: desc })
    ]));
    b.appendChild(U.el('span', { style: { fontSize: '22px', color: 'var(--fg3)' }, text: '›' }));
    return b;
  }
})();
