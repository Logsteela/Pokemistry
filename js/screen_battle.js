/* ============ screen_battle.js : 戦闘エンジン + 戦闘UI ============ */
(function (g) {
  'use strict';

  var B = {
    active: false, cfg: null, clock: 0, raf: null, lastTs: 0, paused: false,
    allies: [], ai: 0, foe: null,
    interval: 10, nextAt: 0, pending: false,
    cdUntil: 0, cur: null, locked: false, ses: null, dist: null,
    els: {}
  };

  var GRACE = 0.100;   // 敵攻撃予定時刻に対する猶予

  // ---------------------------------------------------------------- 開始
  B.start = function (cfg) {
    B.cfg = cfg;
    B.clock = 0; B.paused = false; B.locked = false; B.pending = false; B.cdUntil = 0;
    B.interval = cfg.mode === 'raid' ? 5 : 10;
    B.allies = cfg.party.map(function (id) { return E.makeAlly(id); });
    B.ai = 0;
    B.ses = {
      mode: cfg.mode, start: Date.now(),
      encounters: 0, defeated: 0, caught: 0, dup: 0, failed: 0,
      candy: {}, newIds: [],
      correct: 0, wrong: 0, streak: 0, bestStreak: 0,
      startHP: 0, endHP: 0, cleared: false, reward: '',
      log: []
    };
    if (cfg.mode === 'wild') {
      B.dist = E.wildDistribution(cfg.typeIdx, S.save.incense ? S.save.incense.target : null);
      B.enemyLv = E.wildEnemyLevel(Math.max.apply(null, B.allies.map(function (a) { return a.lv; })));
      spawnWild();
    } else {
      var rs = S.raidState(cfg.raidId);
      var p = D.p(cfg.raidId);
      B.foe = E.makeRaidBoss(p, rs.hp);
      if (B.foe.hp <= 0) B.foe.hp = B.foe.maxhp;
      B.ses.startHP = B.foe.hp;
      B.ses.maxHP = B.foe.maxhp;
      B.ses.encounters = 1;
      resetTimer();
    }
    B.active = true;
    UI.go('battle', {}, { root: false });
  };

  function spawnWild() {
    var p = E.rollWild(B.dist);
    B.foe = E.makeWildFoe(p, B.enemyLv);
    B.ses.encounters++;
    resetTimer();
  }

  function resetTimer() { B.nextAt = B.clock + B.interval; B.pending = false; }

  function ally() { return B.allies[B.ai]; }
  function aliveAllies() { return B.allies.filter(function (a) { return a.hp > 0; }); }

  // ---------------------------------------------------------------- ループ
  function loop(ts) {
    if (!B.active) return;
    B.raf = requestAnimationFrame(loop);
    if (B.paused) { B.lastTs = ts; return; }
    if (!B.lastTs) { B.lastTs = ts; return; }
    var dt = (ts - B.lastTs) / 1000;
    B.lastTs = ts;
    if (dt > 0.25) dt = 0.25;          // 復帰直後の飛びを吸収
    B.clock += dt;
    tick();
    paint();
  }

  function tick() {
    if (!B.foe || B.foe.hp <= 0) return;
    if (!B.pending && B.clock >= B.nextAt) B.pending = true;
    if (B.pending && B.clock >= B.nextAt + GRACE) doEnemyAttack();
    if (B.cdUntil && B.clock >= B.cdUntil) { B.cdUntil = 0; nextQuestion(); }
  }

  function pause(on) {
    B.paused = on;
    var ov = document.getElementById('battlePause');
    if (on && !ov && B.active) {
      ov = U.el('div', { class: 'pause', id: 'battlePause' }, [
        U.el('div', {}, [
          U.el('div', { class: 'big', text: '一時停止中' }),
          U.el('div', { class: 'small dim', style: { marginTop: '6px' }, text: '戦闘時間は停止しています' }),
          U.el('button', { class: 'btn pri', style: { marginTop: '14px' }, text: 'タップして再開' })
        ])
      ]);
      ov.addEventListener('click', function () { if (!document.hidden) pause(false); });
      document.body.appendChild(ov);
    } else if (!on && ov) { ov.parentNode.removeChild(ov); }
  }

  document.addEventListener('visibilitychange', function () { if (B.active) pause(document.hidden); });
  window.addEventListener('blur', function () { if (B.active) pause(true); });
  window.addEventListener('focus', function () { if (B.active && !document.hidden) pause(false); });

  // ---------------------------------------------------------------- 攻撃
  function doEnemyAttack() {
    B.pending = false;
    B.nextAt = B.clock + B.interval;
    var a = ally();
    if (!a || a.hp <= 0 || !B.foe || B.foe.hp <= 0) return;
    var r = E.attack({ types: B.foe.types, stats: B.foe.stats }, { types: a.types, stats: a.stats }, B.foe.lv);
    a.hp = Math.max(0, a.hp - r.dmg);
    floatText('-' + U.comma(r.dmg), 'dmg', 'ally');
    shake('ally');
    log(B.foe.p.n + ' の攻撃！ ' + a.p.n + ' -' + U.comma(r.dmg) + (r.eff > 1 ? '（効果ばつぐん）' : (r.eff === 0 ? '（効果なし）' : (r.eff < 1 ? '（いまひとつ）' : ''))), 'miss');
    if (a.hp <= 0) {
      log(a.p.n + ' は倒れた');
      var el = B.els.allySpr; if (el) el.classList.add('faint');
      setTimeout(function () { switchAlly(); }, 320);
    }
    paint();
  }

  function switchAlly() {
    var next = -1;
    for (var i = 0; i < B.allies.length; i++) if (B.allies[i].hp > 0) { next = i; break; }
    if (next < 0) { finish('wipe'); return; }
    B.ai = next;
    resetTimer();                    // 交代時は敵タイマーを0からリセット
    log(ally().p.n + ' に交代');
    renderStage();
    paint();
  }

  function doPlayerAttack() {
    var a = ally();
    if (!a || a.hp <= 0 || !B.foe) return;
    var r = E.attack({ types: a.types, stats: a.stats }, { types: B.foe.types, stats: B.foe.stats }, a.lv);
    B.foe.hp = Math.max(0, B.foe.hp - r.dmg);
    var cls = r.eff > 1 ? 'crit' : 'dmg';
    floatText('-' + U.comma(r.dmg) + (r.eff > 1 ? ' 効果ばつぐん' : (r.eff === 0 ? ' 効果なし' : (r.eff < 1 ? ' いまひとつ' : ''))), cls, 'foe');
    shake('foe');
    return r;
  }

  // ---------------------------------------------------------------- 敵撃破
  function onFoeDown() {
    if (B.cfg.mode === 'wild') {
      B.ses.defeated++;
      var p = B.foe.p;
      var ok = E.tryCatch(p);
      if (!ok) {
        B.ses.failed++;
        log(p.n + ' の捕獲に失敗…', 'miss');
        floatText('捕獲失敗', 'dmg', 'foe');
      } else if (!S.isOwned(p.sp)) {
        S.acquireSpecies(p.sp, p.i);
        B.ses.caught++; B.ses.newIds.push(p.i);
        log('NEW! ' + p.n + ' を捕まえた！', 'hi');
        floatText('NEW! ' + p.n, 'new', 'foe');
      } else {
        var n = E.dupCandy(p);
        var lid = p.ev;
        S.addCandy(lid, n);
        B.ses.dup++;
        B.ses.candy[lid] = (B.ses.candy[lid] || 0) + n;
        log(p.n + ' を捕獲 → ' + D.candyName(lid) + ' +' + n, 'candy');
        floatText(D.candyName(lid) + ' +' + n, 'new', 'foe');
      }
      S.save.stats.defeated++;
      if (ok && B.ses.newIds.indexOf(p.i) >= 0) S.save.stats.caught++;
      S.save.stats.encounters++;
      S.flush();
      spawnWild(); renderStage(); paint();
      if (B.els.foeSpr) { B.els.foeSpr.classList.add('appear'); }
    } else {
      B.ses.defeated = 1; B.ses.cleared = true;
      finish('clear');
    }
  }

  // ---------------------------------------------------------------- 出題
  function nextQuestion() {
    B.cur = Q.draw();
    B.locked = false;
    renderQuiz();
  }

  function onChoice(text, btn) {
    if (B.locked || !B.cur) return;
    B.locked = true;
    var res = Q.answer(B.cur.q.i, text);
    if (res.correct) {
      B.ses.correct++; B.ses.streak++;
      if (B.ses.streak > B.ses.bestStreak) B.ses.bestStreak = B.ses.streak;
      btn.classList.add('correct');
      var wasPending = B.pending;
      if (B.foe && B.foe.hp > 0) {
        doPlayerAttack();
        if (B.foe.hp <= 0) {
          B.pending = false;                // 予定されていた敵の攻撃は行わない
          paint();
          onFoeDown();
          if (B.active) nextQuestion();
          return;
        }
        if (wasPending) doEnemyAttack();    // 倒せなかった場合は予定通り敵が攻撃
      }
      paint();
      if (B.active) nextQuestion();
    } else {
      B.ses.wrong++; B.ses.streak = 0;
      btn.classList.add('wrong');
      U.$$('.choice', B.els.choices).forEach(function (b) {
        b.disabled = true;
        if (b.dataset.v === B.cur.q.o) b.classList.add('correct');
      });
      showExplanation();
      B.cdUntil = B.clock + 3;              // 3秒クールダウン（敵タイマーは進行）
    }
  }

  function showExplanation() {
    var q = B.cur.q;
    var box = B.els.expl;
    U.clear(box);
    box.hidden = false;
    var txt = q.e && q.e.length ? q.e : ('正解：' + q.o);
    box.appendChild(U.el('div', { text: txt }));
    var cd = U.el('div', { class: 'cooldown' });
    var i = U.el('i');
    cd.appendChild(i);
    box.appendChild(cd);
    B.els.cdBar = i;
  }

  // ---------------------------------------------------------------- 終了
  B.retreat = function () {
    var isRaid = B.cfg.mode === 'raid';
    U.confirm(isRaid ? 'リタイアしますか？' : '逃げますか？',
      isRaid ? '消費したレイド券は返却されません。ボスの残りHPはそのまま保存されます。'
             : '獲得したポケモン・アメはそのまま残ります。',
      function () { finish(isRaid ? 'retire' : 'escape'); }, { yesLabel: isRaid ? 'リタイア' : '逃げる', danger: true });
  };

  function finish(reason) {
    if (!B.active) return;
    B.active = false;
    if (B.raf) cancelAnimationFrame(B.raf);
    B.raf = null; B.lastTs = 0;
    pause(false);
    var ses = B.ses;
    ses.reason = reason;

    if (B.cfg.mode === 'wild') {
      S.save.stats.wildRuns++;
      // お香：野生モード終了（逃走・全滅どちらも）を1回とカウント
      if (S.save.incense) {
        S.save.incense.remain--;
        if (S.save.incense.remain <= 0) { S.save.incense = null; ses.incenseExpired = true; }
      }
      S.save.party = B.cfg.party.slice();
      S.save.lastType = B.cfg.typeIdx;
    } else {
      var rs = S.raidState(B.cfg.raidId);
      var p = D.p(B.cfg.raidId);
      ses.endHP = B.foe.hp;
      if (reason === 'clear') {
        rs.clears++;
        S.save.stats.raidClears++;
        if (!rs.cleared) {
          rs.cleared = 1;
          var r = S.acquireSpecies(p.sp, p.i);
          ses.reward = (r === true ? p.n + ' を仲間にした！' : (r === 'form' ? p.n + ' の形態を開放！' : p.n + ' を開放！'));
          ses.firstClear = true;
        } else {
          S.addCandy(p.ev, 50);
          ses.reward = D.candyName(p.ev) + ' +50';
          ses.candy[p.ev] = 50;
        }
        rs.hp = null;                 // 満タンへ戻す
        ses.endHP = 0;
      } else {
        rs.hp = B.foe.hp;             // 残HPを永久保存
      }
      S.save.party = B.cfg.party.slice();
    }
    S.flush();
    B.foe = null; B.cur = null;
    UI.go('result', { ses: ses, cfg: B.cfg }, { replace: true });
  }
  B.finish = finish;

  function log(msg, cls) {
    B.ses.log.push(msg);
    B.ses.logEntries = B.ses.logEntries || [];
    B.ses.logEntries.push({ t: msg, c: cls || '' });
    if (B.ses.log.length > 40) B.ses.log.shift();
    if (B.ses.logEntries.length > 40) B.ses.logEntries.shift();
    paintLog();
    if (B.els.mini) paintMini();
  }

  function paintLog() {
    var el = B.els.log; if (!el) return;
    U.clear(el);
    var arr = (B.ses.logEntries || []).slice(-14).reverse();
    arr.forEach(function (e) { el.appendChild(U.el('div', { class: e.c, text: '· ' + e.t })); });
  }

  // ---------------------------------------------------------------- 描画
  function floatText(text, cls, side) {
    var host = B.els.stage; if (!host) return;
    var anchor = side === 'foe' ? B.els.foeSpr : B.els.allySpr;
    var f = U.el('div', { class: 'float ' + cls, text: text });
    if (anchor) {
      var hr = host.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
      f.style.left = (ar.left - hr.left + ar.width / 2) + 'px';
      f.style.top = (ar.top - hr.top + ar.height * 0.15) + 'px';
    } else { f.style.left = '58px'; f.style.top = '6px'; }
    host.appendChild(f);
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 1100);
  }
  function shake(side) {
    var el = side === 'foe' ? B.els.foeSpr : B.els.allySpr;
    if (!el) return;
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
  }

  function combatant(u, isFoe) {
    var box = U.el('div', { class: 'combatant' + (isFoe ? ' foe' : '') });
    var spr = D.spriteEl(u.id, isFoe ? 72 : 60, 'cb-spr');
    box.appendChild(spr);
    var info = U.el('div', { class: 'cb-info' });
    var nm = U.el('div', { class: 'cb-name' }, [U.el('span', { text: u.p.n, class: 'trunc' }), U.el('span', { class: 'lv', text: 'Lv.' + u.lv })]);
    info.appendChild(nm);
    var tr = U.el('div', { class: 'row', style: { gap: '4px', margin: '3px 0' } });
    u.p.t.forEach(function (ti) { tr.appendChild(D.typeBadge(ti)); });
    info.appendChild(tr);
    var bar = UI.hpBar(u.hp, u.maxhp, isFoe ? 'tall' : '');
    if (isFoe && B.cfg.mode === 'raid' && B.ses.startHP != null && B.ses.startHP < u.maxhp) {
      var mk = U.el('div', { class: 'hpmark' });
      mk.style.left = (B.ses.startHP / u.maxhp * 100) + '%';
      bar.appendChild(mk);
    }
    info.appendChild(bar);
    info.appendChild(U.el('div', { class: 'cb-hpnum', text: U.comma(u.hp) + ' / ' + U.comma(u.maxhp) }));
    box.appendChild(info);
    return { box: box, spr: spr, bar: bar, info: info };
  }

  function renderStage() {
    var st = B.els.stage; if (!st) return;
    U.clear(st);
    var foe = combatant(B.foe, true);
    st.appendChild(foe.box);
    B.els.foeSpr = foe.spr; B.els.foeBar = foe.bar;
    B.els.foeHP = foe.info.querySelector('.cb-hpnum');

    var tw = U.el('div', { class: 'timer-wrap' }, [
      U.el('span', { class: 'timer-lab', text: '敵の次の攻撃' }),
      U.el('div', { class: 'timer-bar' }, [U.el('i')]),
      U.el('span', { class: 'timer-num', text: '' })
    ]);
    st.appendChild(tw);
    B.els.timerWrap = tw;
    B.els.timerBar = tw.querySelector('i');
    B.els.timerNum = tw.querySelector('.timer-num');

    var a = ally();
    var al = combatant(a, false);
    st.appendChild(al.box);
    B.els.allySpr = al.spr; B.els.allyBar = al.bar;
    B.els.allyHP = al.info.querySelector('.cb-hpnum');

    // 控えの状態
    var row = U.el('div', { class: 'row', style: { gap: '5px', padding: '0 2px' } });
    B.allies.forEach(function (x, i) {
      var d = U.el('span', {
        title: x.p.n,
        style: {
          width: '100%', height: '4px', borderRadius: '3px',
          background: x.hp <= 0 ? '#3a2430' : (i === B.ai ? 'var(--acc)' : '#2f3d58')
        }
      });
      row.appendChild(d);
    });
    st.appendChild(row);
  }

  function paint() {
    if (!B.els.stage || !B.foe) return;
    UI.setHP(B.els.foeBar, B.foe.hp, B.foe.maxhp);
    B.els.foeHP.textContent = U.comma(B.foe.hp) + ' / ' + U.comma(B.foe.maxhp);
    var a = ally();
    if (a) {
      UI.setHP(B.els.allyBar, a.hp, a.maxhp);
      B.els.allyHP.textContent = U.comma(a.hp) + ' / ' + U.comma(a.maxhp);
    }
    var rem = Math.max(0, B.nextAt - B.clock);
    B.els.timerBar.style.width = U.clamp(rem / B.interval, 0, 1) * 100 + '%';
    B.els.timerNum.textContent = rem.toFixed(1) + 's';
    B.els.timerWrap.classList.toggle('danger', rem <= 2);
    if (B.els.cdBar && B.cdUntil) {
      B.els.cdBar.style.width = U.clamp((B.cdUntil - B.clock) / 3, 0, 1) * 100 + '%';
    }
    paintMini();
  }

  function paintMini() {
    if (!B.els.mini) return;
    var s = B.ses;
    if (B.cfg.mode === 'wild') {
      var candy = 0; Object.keys(s.candy).forEach(function (k) { candy += s.candy[k]; });
      B.els.mini.textContent = '撃破 ' + s.defeated + ' / 捕獲 ' + s.caught + ' / 重複 ' + s.dup + ' / 失敗 ' + s.failed + ' / アメ ' + candy
        + (s.log.length ? '　— ' + s.log[s.log.length - 1] : '');
    } else {
      var cut = B.ses.startHP - B.foe.hp;
      B.els.mini.textContent = '削ったHP ' + U.comma(Math.max(0, cut)) + '（' + U.pct(Math.max(0, cut), B.ses.maxHP, 1) + '）'
        + '　正解 ' + s.correct + ' / 誤答 ' + s.wrong;
    }
  }

  function renderQuiz() {
    var q = B.cur.q;
    B.els.expl.hidden = true; U.clear(B.els.expl); B.els.cdBar = null;
    B.els.qmeta.textContent = q.a + ' · ' + q.c + ' · ' + q.i
      + (B.cur.kind === 'new' ? ' · 新規' : (B.cur.kind === 'd24' ? ' · 24h復習' : (B.cur.kind === 'rev' ? ' · 復習' : ' · 補充')));
    B.els.qtext.textContent = q.q;
    U.clear(B.els.choices);
    var keys = ['A', 'B', 'C', 'D'];
    B.cur.options.forEach(function (o, i) {
      var b = U.el('button', { class: 'choice', 'data-v': o });
      b.appendChild(U.el('span', { class: 'k', text: keys[i] }));
      b.appendChild(U.el('span', { text: o, class: 'sp' }));
      b.addEventListener('click', function () { onChoice(o, b); });
      B.els.choices.appendChild(b);
    });
  }

  // 戦闘背景：野生は選択タイプ、レイドは raid / raid_boost
  function applyBackground(wrap, layer, scrim) {
    var key;
    if (B.cfg.mode === 'raid') {
      key = E.raidHasBonus(D.p(B.cfg.raidId)) ? 'raid_boost' : 'raid';
    } else {
      key = D.bgKeyForType(B.cfg.typeIdx);
    }
    var tryKeys = (B.cfg.mode === 'raid' && key === 'raid_boost') ? ['raid_boost', 'raid'] : [key];
    (function next(i) {
      if (i >= tryKeys.length) return;
      D.resolveBG(tryKeys[i], function (url) {
        if (!url) { next(i + 1); return; }
        layer.style.backgroundImage = 'url("' + url + '")';
        layer.classList.add('on'); scrim.classList.add('on');
        wrap.classList.add('hasbg');
      });
    })(0);
  }

  // ---------------------------------------------------------------- 画面登録
  UI.register('battle', {
    title: '', fullscreen: true, nopad: true, noBack: true,
    render: function (v) {
      var wrap = U.el('div', { id: 'battle' });
      var bgLayer = U.el('div', { id: 'bgLayer' });
      var bgScrim = U.el('div', { id: 'bgScrim' });
      wrap.appendChild(bgLayer); wrap.appendChild(bgScrim);
      applyBackground(wrap, bgLayer, bgScrim);
      var top = U.el('div', { class: 'bt-top' });
      var mini = U.el('div', { class: 'bt-mini' });
      top.appendChild(mini);
      top.appendChild(U.el('button', {
        class: 'btn xsm ' + (B.cfg.mode === 'raid' ? 'dan' : ''), text: B.cfg.mode === 'raid' ? 'リタイア' : '逃げる',
        onclick: function () { B.retreat(); }
      }));
      wrap.appendChild(top);

      var stage = U.el('div', { class: 'bt-stage' });
      wrap.appendChild(stage);

      var quiz = U.el('div', { class: 'bt-quiz' });
      var qmeta = U.el('div', { class: 'q-meta' });
      var qtext = U.el('div', { class: 'q-text' });
      var logEl = U.el('div', { class: 'bt-log' });
      var choices = U.el('div', { class: 'choices' });
      var expl = U.el('div', { class: 'expl', hidden: true });
      quiz.appendChild(qmeta); quiz.appendChild(qtext); quiz.appendChild(logEl);
      quiz.appendChild(choices); quiz.appendChild(expl);
      wrap.appendChild(quiz);

      document.getElementById('view').appendChild(wrap);
      B.els = { stage: stage, mini: mini, qmeta: qmeta, qtext: qtext, choices: choices, expl: expl, log: logEl };
      renderStage(); paintLog();
      if (!B.cur || B.locked) nextQuestion(); else renderQuiz();
      paint();
      B.lastTs = 0;
      if (B.raf) cancelAnimationFrame(B.raf);
      B.raf = requestAnimationFrame(loop);
    },
    onLeave: function () {
      if (B.raf) cancelAnimationFrame(B.raf);
      B.raf = null;
      B.els = {};
    }
  });

  // ---------------------------------------------------------------- 結果画面
  UI.register('result', {
    title: '結果', noBack: true, tab: 'home',
    render: function (v, params) {
      var s = params.ses, cfg = params.cfg;
      var head = U.el('div', { class: 'card center' });
      var msg = s.mode === 'wild'
        ? (s.reason === 'wipe' ? '味方が全滅しました' : '野生バトル終了')
        : (s.reason === 'clear' ? 'レイド撃破！' : (s.reason === 'wipe' ? '味方が全滅しました' : 'リタイアしました'));
      head.appendChild(U.el('div', { class: 'big', text: msg }));
      if (s.mode === 'raid' && s.reward) head.appendChild(U.el('div', { class: 'small', style: { color: 'var(--ok)', marginTop: '4px' }, text: s.reward }));
      v.appendChild(head);

      var c = U.el('div', { class: 'card' });
      if (s.mode === 'wild') {
        c.appendChild(line('遭遇数', s.encounters));
        c.appendChild(line('撃破数', s.defeated));
        c.appendChild(line('新規捕獲', s.caught));
        c.appendChild(line('重複捕獲', s.dup));
        c.appendChild(line('捕獲失敗', s.failed));
        var tot = 0; Object.keys(s.candy).forEach(function (k) { tot += s.candy[k]; });
        c.appendChild(line('獲得アメ（合計）', tot));
      } else {
        c.appendChild(line('開始時HP', U.comma(s.startHP)));
        c.appendChild(line('終了時HP', U.comma(s.endHP)));
        var cut = Math.max(0, s.startHP - s.endHP);
        c.appendChild(line('今回削ったHP', U.comma(cut) + '（全体の ' + U.pct(cut, s.maxHP, 1) + '）'));
      }
      c.appendChild(line('正解 / 不正解', s.correct + ' / ' + s.wrong));
      c.appendChild(line('正答率', U.pct(s.correct, s.correct + s.wrong)));
      c.appendChild(line('最高連続正解', s.bestStreak));
      v.appendChild(c);

      if (s.newIds && s.newIds.length) {
        v.appendChild(UI.section('新しく仲間になったポケモン'));
        var g2 = U.el('div', { class: 'dex-grid' });
        s.newIds.forEach(function (id) {
          var p = D.p(id);
          var cell = U.el('div', { class: 'dex-cell have' });
          cell.appendChild(D.spriteEl(id, 44));
          cell.appendChild(U.el('div', { class: 'nm', text: p.n }));
          cell.appendChild(U.el('span', { class: 'badge', html: '<span class="badge-new">NEW</span>' }));
          g2.appendChild(cell);
        });
        v.appendChild(g2);
      }

      var ck = Object.keys(s.candy);
      if (ck.length) {
        v.appendChild(UI.section('獲得したアメ'));
        var cc = U.el('div', { class: 'card' });
        ck.forEach(function (lid) { cc.appendChild(line(D.candyName(lid), '+' + s.candy[lid])); });
        v.appendChild(cc);
      }

      if (s.incenseExpired) v.appendChild(U.el('div', { class: 'warn-box', text: 'お香の効果が切れました。' }));
      else if (s.mode === 'wild' && S.save.incense) v.appendChild(U.el('div', { class: 'info-box', text: 'お香：残り ' + S.save.incense.remain + ' 回' }));

      var btns = U.el('div', { class: 'btn-grid c2', style: { marginTop: '12px' } });
      btns.appendChild(U.el('button', {
        class: 'btn pri', text: 'もう一度', onclick: function () {
          if (s.mode === 'wild') UI.go('wildSetup', { typeIdx: cfg.typeIdx }, { replace: true });
          else UI.go('raidDetail', { id: cfg.raidId }, { replace: true });
        }
      }));
      btns.appendChild(U.el('button', { class: 'btn', text: 'ホームへ', onclick: function () { UI.go('home', null, { root: true }); } }));
      v.appendChild(btns);

      if (s.log && s.log.length) {
        v.appendChild(UI.section('ログ'));
        var lc = U.el('div', { class: 'card small dim' });
        s.log.slice(-15).forEach(function (m) { lc.appendChild(U.el('div', { text: '· ' + m })); });
        v.appendChild(lc);
      }
    }
  });

  function line(k, v2) {
    return U.el('div', { class: 'res-line' }, [U.el('span', { text: k }), U.el('b', { text: String(v2) })]);
  }

  g.Battle = B;
})(window);
