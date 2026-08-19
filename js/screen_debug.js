/* ============ screen_debug.js : データ管理 / 隠しデバッグ ============ */
(function () {
  'use strict';

  // ---------------------------------------------------------------- データ管理
  UI.register('dataMgr', {
    title: 'データ管理', tab: 'home',
    render: function (v) {
      var sv = S.save;
      var c = U.el('div', { class: 'card' });
      c.appendChild(UI.kv('セーブ形式バージョン', sv.version));
      c.appendChild(UI.kv('作成日時', U.fmtDT(sv.createdAt)));
      c.appendChild(UI.kv('最終保存', U.fmtDT(sv.updatedAt)));
      c.appendChild(UI.kv('所持ポケモン（種類）', S.ownedCount()));
      c.appendChild(UI.kv('開放済み形態', S.allOwnedForms().length));
      c.appendChild(UI.kv('学習記録がある問題', Object.keys(S.q).length));
      v.appendChild(c);

      v.appendChild(UI.section('バックアップ'));
      var b = U.el('div', { class: 'stack' });
      b.appendChild(U.el('button', {
        class: 'btn pri block', text: 'エクスポート（JSONを保存）',
        onclick: function () {
          var name = 'chemipoke_save_' + U.today().replace(/-/g, '') + '.json';
          U.download(name, S.exportJSON());
          U.toast('エクスポートしました');
        }
      }));
      b.appendChild(U.el('button', {
        class: 'btn block', text: 'インポート（JSONを読み込み）',
        onclick: function () {
          U.readFile('application/json,.json', function (text) {
            var obj;
            try { obj = JSON.parse(text); } catch (e) { U.toast('JSONの解析に失敗しました'); return; }
            U.confirm('インポートしますか？', '現在のデータは自動でバックアップされてから、読み込んだデータで上書きされます。', function () {
              S.importObj(obj).then(function () {
                U.toast('インポートしました');
                UI.go('home', null, { root: true });
              }).catch(function (e) { U.modal({ title: 'エラー', body: '<div class="warn-box">' + U.esc(e.message) + '</div>' }); });
            }, { yesLabel: 'インポートする', danger: true });
          });
        }
      }));
      b.appendChild(U.el('button', {
        class: 'btn block', text: '直前の自動バックアップに戻す',
        onclick: function () {
          S.getBackup().then(function (bk) {
            if (!bk) { U.toast('バックアップがありません'); return; }
            U.confirm('バックアップを復元', U.fmtDT(bk.at) + ' 時点のデータに戻します。\n現在のデータはバックアップされます。', function () {
              S.importObj(bk.data).then(function () { U.toast('復元しました'); UI.go('home', null, { root: true }); });
            }, { yesLabel: '復元する', danger: true });
          });
        }
      }));
      v.appendChild(b);

      v.appendChild(UI.section('危険な操作'));
      var d = U.el('div', { class: 'stack' });
      d.appendChild(U.el('button', {
        class: 'btn dan block', text: 'ニューゲーム（最初から始める）',
        onclick: function () { hardConfirm('ニューゲーム', 'すべての所持ポケモン・アメ・コイン・アイテム・レイド進行・学習記録が消去され、フシギダネLv.1のみ／その他0の状態から始まります。\n現在のデータは自動バックアップされます。', function () {
          S.newGame().then(function () { U.toast('ニューゲームを開始しました'); UI.go('home', null, { root: true }); });
        }); }
      }));
      d.appendChild(U.el('button', {
        class: 'btn dan block', text: '全データリセット（バックアップも削除）',
        onclick: function () { hardConfirm('全データリセット', 'バックアップを含むすべての保存データを削除します。この操作は取り消せません。', function () {
          S.wipeAll().then(function () { U.toast('全データを削除しました'); UI.go('home', null, { root: true }); });
        }); }
      }));
      v.appendChild(d);
    }
  });

  function hardConfirm(title, msg, onYes) {
    var inp = U.el('input', { type: 'text', placeholder: 'ここに「実行」と入力', style: { marginTop: '10px' } });
    var w = U.el('div');
    w.appendChild(U.el('div', { class: 'warn-box', html: U.esc(msg).replace(/\n/g, '<br>') }));
    w.appendChild(inp);
    U.modal({
      title: title, body: w,
      buttons: [{ label: 'やめる' }, {
        label: '実行する', cls: 'dan', onClick: function (close) {
          if (inp.value.trim() !== '実行') { U.toast('「実行」と入力してください'); return false; }
          onYes();
        }
      }]
    });
  }

  // ---------------------------------------------------------------- デバッグ
  UI.register('debug', {
    title: 'デバッグ', tab: 'home',
    render: function (v) {
      v.appendChild(U.el('div', { class: 'warn-box', text: '動作確認用の画面です。ここでの操作はゲームバランスを壊す可能性があります。' }));

      // --- 所持品
      v.appendChild(UI.section('所持品'));
      var c = U.el('div', { class: 'card' });
      [['coins', 'コイン', null], ['ticket', 'レイド挑戦券', 'items'], ['stone', '変化の石', 'items'], ['incense', 'お香', 'items']].forEach(function (x) {
        var get = function () { return x[2] ? S.save.items[x[0]] : S.save.coins; };
        var set = function (n) { if (x[2]) S.save.items[x[0]] = n; else S.save.coins = n; S.touch(); UI.reload(); };
        var row = U.el('div', { class: 'row', style: { padding: '4px 0' } });
        row.appendChild(U.el('div', { class: 'sp small', text: x[1] + '：' + U.comma(get()) }));
        [['+10', 10], ['+100', 100], ['+1000', 1000]].forEach(function (q) {
          row.appendChild(U.el('button', { class: 'btn xsm', text: q[0], onclick: function () { set(get() + q[1]); } }));
        });
        row.appendChild(U.el('button', {
          class: 'btn xsm pri', text: '指定', onclick: function () {
            U.promptNum(x[1] + 'を設定', { value: get(), min: 0, max: 9999999 }, set);
          }
        }));
        c.appendChild(row);
      });
      v.appendChild(c);

      // --- ポケモン取得
      v.appendChild(UI.section('ポケモンを取得 / Lv・アメ変更'));
      var pc = U.el('div', { class: 'card tight' });
      var si = U.el('input', { type: 'search', placeholder: 'ポケモン名で検索' });
      pc.appendChild(si);
      var res = U.el('div', { style: { marginTop: '8px' } });
      pc.appendChild(res);
      si.addEventListener('input', U.debounce(function () {
        U.clear(res);
        var s = si.value.trim();
        if (!s) return;
        D.pokemon.filter(function (p) { return p.n.indexOf(s) >= 0; }).slice(0, 30).forEach(function (p) {
          var right = U.el('div', { class: 'row', style: { gap: '4px' } });
          right.appendChild(U.el('button', {
            class: 'btn xsm ok', text: '取得', onclick: function () {
              S.acquireSpecies(p.sp, p.i);
              if (S.save.owned[p.sp]) S.save.owned[p.sp].forms[p.i] = 1;
              S.touch(); U.toast(p.n + ' を取得'); UI.reload();
            }
          }));
          right.appendChild(U.el('button', {
            class: 'btn xsm', text: 'Lv', onclick: function () {
              if (!S.isOwned(p.sp)) { U.toast('未所持です'); return; }
              U.promptNum(p.n + ' のLv', { value: S.lvOf(p.sp), min: 1, max: 100 }, function (n) {
                S.save.owned[p.sp].lv = n; S.touch(); U.toast('Lv.' + n); UI.reload();
              });
            }
          }));
          right.appendChild(U.el('button', {
            class: 'btn xsm', text: 'アメ', onclick: function () {
              U.promptNum(D.candyName(p.ev), { value: S.candyOf(p.ev), min: 0, max: 999999 }, function (n) {
                S.save.candy[p.ev] = n; S.touch(); U.toast('アメ ' + n); UI.reload();
              });
            }
          }));
          res.appendChild(UI.pokeRow(p, { size: 36, right: right, sub: p.sp + ' / ' + p.ev + ' / 段階' + p.st + (p.v ? ' / 貴重' : '') }));
        });
      }, 200));
      var bulk = U.el('div', { class: 'btn-grid c2', style: { marginTop: '8px' } });
      bulk.appendChild(U.el('button', {
        class: 'btn sm', text: '全アメ +1000', onclick: function () {
          Object.keys(D.lines).forEach(function (l) { S.save.candy[l] = (S.save.candy[l] || 0) + 1000; });
          S.touch(); U.toast('全系列のアメ +1000'); UI.reload();
        }
      }));
      bulk.appendChild(U.el('button', {
        class: 'btn sm dan', text: '全ポケモン取得', onclick: function () {
          U.confirm('全ポケモン取得', '全1244形態を開放します。動作確認用です。', function () {
            D.pokemon.forEach(function (p) {
              S.acquireSpecies(p.sp, p.i);
              if (S.save.owned[p.sp]) S.save.owned[p.sp].forms[p.i] = 1;
            });
            S.touch(); U.toast('全取得しました'); UI.reload();
          }, { danger: true });
        }
      }));
      pc.appendChild(bulk);
      v.appendChild(pc);

      // --- レイドHP
      v.appendChild(UI.section('レイド残HP'));
      var rc = U.el('div', { class: 'card tight' });
      var ri = U.el('input', { type: 'search', placeholder: 'レイド対象を検索' });
      rc.appendChild(ri);
      var rres = U.el('div', { style: { marginTop: '8px' } });
      rc.appendChild(rres);
      ri.addEventListener('input', U.debounce(function () {
        U.clear(rres);
        var s = ri.value.trim(); if (!s) return;
        D.raidList.filter(function (p) { return p.n.indexOf(s) >= 0; }).slice(0, 20).forEach(function (p) {
          var max = E.raidMaxHP(p), rs = S.raidState(p.i);
          var cur = rs.hp == null ? max : rs.hp;
          var right = U.el('div', { class: 'row', style: { gap: '4px' } });
          right.appendChild(U.el('button', {
            class: 'btn xsm', text: 'HP', onclick: function () {
              U.promptNum(p.n + ' の残HP', { value: cur, min: 0, max: max, note: '最大 ' + U.comma(max) }, function (n) {
                rs.hp = n; S.touch(); U.toast('残HP ' + U.comma(n)); UI.reload();
              });
            }
          }));
          right.appendChild(U.el('button', {
            class: 'btn xsm', text: '1%', onclick: function () { rs.hp = Math.max(1, Math.floor(max * 0.01)); S.touch(); U.toast('残HP 1%'); UI.reload(); }
          }));
          right.appendChild(U.el('button', {
            class: 'btn xsm', text: '満', onclick: function () { rs.hp = null; S.touch(); UI.reload(); }
          }));
          rres.appendChild(UI.pokeRow(p, { size: 36, right: right, sub: U.comma(cur) + ' / ' + U.comma(max) + '　撃破 ' + rs.clears }));
        });
      }, 200));
      v.appendChild(rc);

      // --- 問題状態
      v.appendChild(UI.section('問題データ'));
      var qc = U.el('div', { class: 'card' });
      var sum = Q.summary(), pools = Q.pools();
      qc.appendChild(UI.kv('総問題数', U.comma(sum.total)));
      qc.appendChild(UI.kv('累計出題カウンタ', U.comma(S.save.quiz.asked)));
      qc.appendChild(UI.kv('バッグ残り', (S.save.quiz.bag.length - S.save.quiz.bagPos) + ' / ' + S.save.quiz.bag.length));
      qc.appendChild(UI.kv('候補：新規 / 通常復習 / 24h復習', pools['new'].length + ' / ' + pools.rev.length + ' / ' + pools.d24.length));
      qc.appendChild(UI.kv('習得中', U.comma(sum.mastered)));
      var qb = U.el('div', { class: 'btn-grid c2', style: { marginTop: '8px' } });
      qb.appendChild(U.el('button', {
        class: 'btn sm', text: '24h経過を強制反映', onclick: function () {
          var n = 0;
          Object.keys(S.q).forEach(function (k) {
            var s = S.q[k];
            if (s.sc >= 3 && s.lc) { s.lc = Date.now() - U.DAY - 1000; S.touchQ(k); n++; }
          });
          Q.refresh24(); S.flush(); U.toast(n + '問を24時間経過扱いにしました'); UI.reload();
        }
      }));
      qb.appendChild(U.el('button', {
        class: 'btn sm', text: '再出題クールを解除', onclick: function () {
          Object.keys(S.q).forEach(function (k) { S.q[k].na = 0; S.touchQ(k); });
          S.flush(); U.toast('全問題の再出題待ちを解除しました'); UI.reload();
        }
      }));
      qb.appendChild(U.el('button', {
        class: 'btn sm dan', text: '学習記録を全消去', onclick: function () {
          U.confirm('学習記録を消去', 'すべての問題の出題履歴・正誤・連続正解数を消去します（ポケモンのデータは残ります）。', function () {
            S.q = {};
            S.save.quiz = { asked: 0, bag: [], bagPos: 0 };
            S.save.stats.answered = 0; S.save.stats.correct = 0; S.save.stats.mastered = 0;
            S.save.daily = { date: U.today(), answered: 0, correct: 0, newQ: 0, revQ: 0, mastered: 0 };
            var t = indexedDB; // 明示的にクリア
            S.flush().then(function () { return new Promise(function (r) { var req = indexedDB.open('chemipoke'); req.onsuccess = function () { var dd = req.result; var tx2 = dd.transaction('qstate', 'readwrite'); tx2.objectStore('qstate').clear(); tx2.oncomplete = function () { dd.close(); r(); }; }; }); })
              .then(function () { U.toast('学習記録を消去しました'); UI.reload(); });
          }, { danger: true });
        }
      }));
      qb.appendChild(U.el('button', {
        class: 'btn sm', text: '出題シミュレーション', onclick: simulate
      }));
      qc.appendChild(qb);
      v.appendChild(qc);

      // --- 計算チェック
      v.appendChild(UI.section('計算チェック'));
      var cc = U.el('div', { class: 'card' });
      cc.appendChild(U.el('button', { class: 'btn sm block', text: 'ダメージ計算を試す', onclick: damageTest }));
      cc.appendChild(U.el('button', { class: 'btn sm block', style: { marginTop: '6px' }, text: '野生出現率を確認', onclick: distTest }));
      v.appendChild(cc);
    }
  });

  function simulate() {
    var counts = { 'new': 0, rev: 0, d24: 0, fb: 0 };
    var pools = Q.pools();
    var body = U.el('div');
    body.appendChild(U.el('div', { class: 'small', text: '現在の候補数：新規 ' + pools['new'].length + ' / 通常復習 ' + pools.rev.length + ' / 24h復習 ' + pools.d24.length }));
    body.appendChild(U.el('div', { class: 'xs dim', style: { marginTop: '6px' }, text: '※ 実際に出題はされません（バッグの内訳のみ表示）' }));
    var bag = S.save.quiz.bag.slice(S.save.quiz.bagPos);
    bag.forEach(function (k) { counts[k]++; });
    body.appendChild(U.el('div', { class: 'small', style: { marginTop: '8px' }, text: '残りバッグ：新規 ' + counts['new'] + ' / 通常復習 ' + counts.rev + ' / 24h復習 ' + counts.d24 }));
    U.modal({ title: '出題シミュレーション', body: body });
  }

  function damageTest() {
    var body = U.el('div');
    var a = U.el('input', { type: 'text', placeholder: '攻撃側の名前（例：フシギダネ）', value: 'フシギダネ' });
    var b = U.el('input', { type: 'text', placeholder: '防御側の名前（例：ヒトカゲ）', value: 'ヒトカゲ', style: { marginTop: '6px' } });
    var lv = U.el('input', { type: 'number', value: 50, min: 1, max: 100, style: { marginTop: '6px' } });
    var out = U.el('div', { class: 'expl', style: { marginTop: '10px', maxHeight: 'none' } });
    body.appendChild(a); body.appendChild(b); body.appendChild(lv); body.appendChild(out);
    var run = function () {
      var pa = D.pokemon.filter(function (p) { return p.n === a.value.trim(); })[0];
      var pb = D.pokemon.filter(function (p) { return p.n === b.value.trim(); })[0];
      if (!pa || !pb) { out.textContent = 'ポケモンが見つかりません'; return; }
      var L = U.clamp(Number(lv.value) || 50, 1, 100);
      var sa = E.statsFor(pa, L), sb = E.statsFor(pb, L);
      var sel = E.chooseType(pa.t, sa, sb, pb.t, L);
      var lo = E.damage(sa, sel.type, sb, pb.t, L, 85).dmg;
      var hi = E.damage(sa, sel.type, sb, pb.t, L, 100).dmg;
      out.textContent = pa.n + '(Lv' + L + ') → ' + pb.n + '(Lv' + L + ')\n'
        + '選択タイプ：' + D.types[sel.type] + '（' + (D.phys[sel.type] ? '物理' : '特殊') + '）\n'
        + 'タイプ相性：×' + sel.eff + '\n'
        + 'ダメージ：' + lo + ' 〜 ' + hi + '（相手HP ' + sb[0] + '）\n'
        + '確定数：' + Math.ceil(sb[0] / hi) + '〜' + Math.ceil(sb[0] / Math.max(1, lo)) + '発';
    };
    [a, b, lv].forEach(function (x) { x.addEventListener('input', run); });
    run();
    U.modal({ title: 'ダメージ計算', body: body });
  }

  function distTest() {
    var body = U.el('div');
    var sel = U.el('select');
    D.types.forEach(function (t, i) { sel.appendChild(U.el('option', { value: i, text: t })); });
    sel.value = S.save.lastType;
    body.appendChild(sel);
    var out = U.el('div', { class: 'expl', style: { marginTop: '10px', maxHeight: '50vh' } });
    body.appendChild(out);
    var run = function () {
      var ti = Number(sel.value);
      var d = E.wildDistribution(ti, S.save.incense ? S.save.incense.target : null);
      var rows = d.list.map(function (p, i) { return { p: p, q: d.prob[i] }; }).sort(function (x, y) { return y.q - x.q; });
      var sum = rows.reduce(function (s, r) { return s + r.q; }, 0);
      var byStage = [0, 0, 0];
      rows.forEach(function (r) { byStage[U.clamp(r.p.st, 0, 2)] += r.q; });
      out.textContent = '候補 ' + rows.length + ' 種 / 合計確率 ' + sum.toFixed(6) + '\n'
        + '段階別：0=' + (byStage[0] * 100).toFixed(2) + '% 1=' + (byStage[1] * 100).toFixed(2) + '% 2=' + (byStage[2] * 100).toFixed(2) + '%\n\n'
        + rows.slice(0, 40).map(function (r) { return (r.q * 100).toFixed(3) + '%  ' + r.p.n + '（捕獲度' + r.p.c + '・段階' + r.p.st + '）'; }).join('\n');
    };
    sel.addEventListener('change', run); run();
    U.modal({ title: '野生出現率', body: body });
  }
})();
