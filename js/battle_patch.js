/* ============ battle_patch.js : 戦闘UX拡張 ============ */
(function (g) {
  'use strict';

  var Battle = g.Battle;
  if (!Battle || !g.E || !g.U) return;

  // ---------------------------------------------------------------- 最低ダメージ
  // タイプ相性が「効果なし」でも、戦闘が完全停止しないよう最終ダメージを最低1にする。
  var baseDamage = E.damage;
  E.damage = function () {
    var r = baseDamage.apply(E, arguments);
    if (r && r.dmg < 1) r.dmg = 1;
    return r;
  };

  // ---------------------------------------------------------------- 問題履歴
  var answered = [];
  var explanationPaused = false;
  var pauseOverlay = null;

  function snapshotCurrent() {
    if (!Battle.cur || !Battle.cur.q) return null;
    var q = Battle.cur.q;
    return {
      id: q.i,
      question: q.q || '',
      answer: q.o || '',
      explanation: (q.e && q.e.length) ? q.e : ('正解：' + q.o)
    };
  }

  function rememberAnswered() {
    var snap = snapshotCurrent();
    if (!snap) return;
    if (!answered.length || answered[answered.length - 1].id !== snap.id) answered.push(snap);
    if (answered.length > 30) answered.shift();
  }

  function previousExplanation() {
    if (!answered.length) return null;
    var currentId = Battle.cur && Battle.cur.q ? Battle.cur.q.i : null;
    var i = answered.length - 1;
    // 誤答解説中など「回答済みの現在問題」がまだ画面に残っている場合は、その1つ前を返す。
    if (currentId != null && answered[i] && answered[i].id === currentId) i--;
    return i >= 0 ? answered[i] : null;
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('#battle .choice') : null;
    if (!btn || btn.disabled || !Battle.active) return;
    rememberAnswered();
  }, true);

  // ---------------------------------------------------------------- 誤答解説の一時停止
  function setExplanationPaused(on) {
    explanationPaused = !!on;
    if (!Battle.active) return;
    Battle.paused = explanationPaused;
    var b = document.getElementById('explanationPauseBtn');
    if (b) b.textContent = explanationPaused ? '▶ 解説を再開' : '⏸ 解説を一時停止';
  }

  // visibility/focus側の既存処理で解除されても、解説停止中は戦闘時計を止め続ける。
  setInterval(function () {
    if (explanationPaused && Battle.active && !pauseOverlay) Battle.paused = true;
  }, 100);

  function patchExplanation() {
    var box = document.querySelector('#battle .expl:not([hidden])');
    if (!box || document.getElementById('explanationPauseBtn')) return;
    var b = U.el('button', {
      id: 'explanationPauseBtn',
      class: 'btn xsm explanation-pause-btn',
      text: explanationPaused ? '▶ 解説を再開' : '⏸ 解説を一時停止',
      onclick: function (e) {
        e.stopPropagation();
        setExplanationPaused(!explanationPaused);
      }
    });
    box.insertBefore(b, box.firstChild);
  }

  // ---------------------------------------------------------------- 戦闘ポーズメニュー
  function closePause(resume) {
    if (pauseOverlay && pauseOverlay.parentNode) pauseOverlay.parentNode.removeChild(pauseOverlay);
    pauseOverlay = null;
    if (resume && Battle.active) {
      explanationPaused = false;
      Battle.paused = false;
      var eb = document.getElementById('explanationPauseBtn');
      if (eb) eb.textContent = '⏸ 解説を一時停止';
    }
  }

  function openPause() {
    if (!Battle.active || pauseOverlay) return;
    Battle.paused = true;

    var card = U.el('div', { class: 'pause-menu-card' });
    card.appendChild(U.el('div', { class: 'big', text: '一時停止中' }));
    card.appendChild(U.el('div', {
      class: 'small dim',
      style: { marginTop: '4px' },
      text: '戦闘時間と敵の攻撃タイマーは停止しています'
    }));

    var prev = previousExplanation();
    var exp = U.el('div', { class: 'pause-prev-expl' });
    exp.appendChild(U.el('div', { class: 'pause-prev-title', text: '一つ前の問題の解説' }));
    if (prev) {
      exp.appendChild(U.el('div', { class: 'small dim', text: prev.question }));
      exp.appendChild(U.el('div', { class: 'pause-prev-answer', text: '正解：' + prev.answer }));
      exp.appendChild(U.el('div', { class: 'pause-prev-text', text: prev.explanation }));
    } else {
      exp.appendChild(U.el('div', { class: 'small dim', text: 'まだ前の問題はありません。' }));
    }
    card.appendChild(exp);

    var buttons = U.el('div', { class: 'btn-grid c2 pause-menu-actions' });
    buttons.appendChild(U.el('button', {
      class: 'btn pri', text: '再開', onclick: function () { closePause(true); }
    }));
    var isRaid = Battle.cfg && Battle.cfg.mode === 'raid';
    buttons.appendChild(U.el('button', {
      class: 'btn dan', text: isRaid ? 'リタイア' : '逃げる', onclick: function () {
        closePause(false);
        explanationPaused = false;
        if (Battle.active) Battle.finish(isRaid ? 'retire' : 'escape');
      }
    }));
    card.appendChild(buttons);

    pauseOverlay = U.el('div', { class: 'pause battle-menu-pause', id: 'battleMenuPause' }, [card]);
    document.body.appendChild(pauseOverlay);
  }

  function patchTopButton() {
    var old = document.querySelector('#battle .bt-top button');
    if (!old || old.dataset.pausePatched === '1') return;
    var b = old.cloneNode(true);
    b.dataset.pausePatched = '1';
    b.className = 'btn xsm';
    b.textContent = '⏸ ポーズ';
    b.addEventListener('click', openPause);
    old.parentNode.replaceChild(b, old);
  }

  function sync() {
    if (!Battle.active) {
      explanationPaused = false;
      if (pauseOverlay) closePause(false);
      return;
    }
    patchTopButton();
    patchExplanation();
    // 解説が次の問題に切り替わったら専用停止状態は解除する。
    var expl = document.querySelector('#battle .expl:not([hidden])');
    if (!expl && explanationPaused && !pauseOverlay) setExplanationPaused(false);
  }

  var observer = new MutationObserver(sync);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  sync();
})(window);
