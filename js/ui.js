/* ============ ui.js : 画面ルータと共通部品 ============ */
(function (g) {
  'use strict';
  var UI = { screens: {}, stack: [], current: null };

  UI.register = function (name, def) { UI.screens[name] = def; };

  UI.go = function (name, params, opts) {
    opts = opts || {};
    var def = UI.screens[name];
    if (!def) { U.toast('画面が見つかりません: ' + name); return; }
    if (UI.current && UI.current.def.onLeave) {
      try { UI.current.def.onLeave(); } catch (e) { console.error(e); }
    }
    if (!opts.replace && UI.current && !opts.root) UI.stack.push(UI.current);
    if (opts.root) UI.stack.length = 0;
    UI.current = { name: name, params: params || {}, def: def };
    UI.render();
  };

  UI.back = function () {
    if (!UI.stack.length) { UI.go('home', null, { root: true }); return; }
    if (UI.current && UI.current.def.onLeave) { try { UI.current.def.onLeave(); } catch (e) {} }
    UI.current = UI.stack.pop();
    UI.render();
  };

  UI.reload = function () { if (UI.current) UI.render(); };

  UI.render = function () {
    var view = document.getElementById('view');
    U.clear(view);
    view.scrollTop = 0;
    view.className = UI.current.def.nopad ? 'nopad' : '';
    document.body.classList.toggle('battle', !!UI.current.def.fullscreen);
    var title = UI.current.def.title;
    document.getElementById('title').textContent = (typeof title === 'function' ? title(UI.current.params) : title) || '';
    document.getElementById('backBtn').hidden = !(UI.stack.length && !UI.current.def.noBack);
    document.getElementById('topbar').hidden = !!UI.current.def.fullscreen;
    // タブの選択状態
    var navName = UI.current.def.tab || UI.current.name;
    U.$$('#tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.nav === navName); });
    UI.updateWallet();
    try { UI.current.def.render(view, UI.current.params); } catch (e) {
      console.error(e);
      view.appendChild(U.el('div', { class: 'warn-box', text: 'エラー: ' + e.message }));
    }
  };

  UI.updateWallet = function () {
    if (!S.save) return;
    var set = function (id, v) { var n = document.querySelector('#' + id + ' b'); if (n) n.textContent = U.comma(v); };
    set('wCoin', S.save.coins);
    set('wTicket', S.save.items.ticket);
    set('wStone', S.save.items.stone);
    set('wIncense', S.save.items.incense);
  };

  // ---------------------------------------------------------------- 共通部品
  UI.hpBar = function (cur, max, cls) {
    var w = U.el('div', { class: 'hpwrap' + (cls ? ' ' + cls : '') });
    var r = max > 0 ? cur / max : 0;
    var b = U.el('div', { class: 'hpbar' + (r <= 0.2 ? ' low' : (r <= 0.5 ? ' mid' : '')) });
    b.style.width = (U.clamp(r, 0, 1) * 100) + '%';
    w.appendChild(b);
    w._bar = b;
    return w;
  };
  UI.setHP = function (wrap, cur, max) {
    var r = max > 0 ? cur / max : 0;
    var b = wrap._bar;
    b.style.width = (U.clamp(r, 0, 1) * 100) + '%';
    b.className = 'hpbar' + (r <= 0.2 ? ' low' : (r <= 0.5 ? ' mid' : ''));
  };

  UI.typeRow = function (p) {
    var r = U.el('span', { class: 'chips' });
    p.t.forEach(function (ti) { r.appendChild(D.typeBadge(ti)); });
    return r;
  };

  // ポケモン1行（画像 + 名前 + タイプ + Lv）
  UI.pokeRow = function (p, opts) {
    opts = opts || {};
    var owned = S.isOwned(p.sp);
    var lv = S.lvOf(p.sp);
    var row = U.el(opts.tag || 'div', { class: opts.class || 'party-slot' });
    row.appendChild(D.spriteEl(p.i, opts.size || 48, owned ? '' : 'silh'));
    var info = U.el('div', { class: 'cb-info' });
    var line1 = U.el('div', { class: 'row', style: { gap: '6px' } }, [
      U.el('b', { text: p.n, class: 'trunc', style: { fontSize: '13.5px' } })
    ]);
    if (p.v) line1.appendChild(U.el('span', { class: 'badge-vip', text: '貴重' }));
    info.appendChild(line1);
    var line2 = U.el('div', { class: 'row', style: { gap: '5px', marginTop: '3px' } });
    p.t.forEach(function (ti) { line2.appendChild(D.typeBadge(ti)); });
    if (owned) line2.appendChild(U.el('span', { class: 'xs', style: { color: 'var(--gold)', fontWeight: '800' }, text: 'Lv.' + lv }));
    info.appendChild(line2);
    if (opts.sub) info.appendChild(U.el('div', { class: 'xs dim', text: opts.sub, style: { marginTop: '2px' } }));
    row.appendChild(info);
    if (opts.right) row.appendChild(opts.right);
    if (opts.onClick) { row.addEventListener('click', opts.onClick); row.style.cursor = 'pointer'; }
    return row;
  };

  UI.kv = function (k, v) {
    return U.el('div', { class: 'kv' }, [U.el('span', { text: k, class: 'muted' }), U.el('b', { text: String(v) })]);
  };

  UI.section = function (t) { return U.el('div', { class: 'sec-title', text: t }); };

  UI.empty = function (msg) { return U.el('div', { class: 'empty-note', html: U.esc(msg).replace(/\n/g, '<br>') }); };

  // 検索/フィルタ用の簡易チップ行
  UI.chipRow = function (items, current, onPick, opts) {
    opts = opts || {};
    var row = U.el('div', { class: opts.scroll === false ? 'chips' : 'scroller' });
    items.forEach(function (it) {
      var b = U.el('button', {
        class: 'chip' + (it.value === current ? ' on' : ''), text: it.label,
        onclick: function () { onPick(it.value); }
      });
      row.appendChild(b);
    });
    return row;
  };

  g.UI = UI;
})(window);
