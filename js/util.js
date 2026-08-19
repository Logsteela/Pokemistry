/* ============ util.js : DOM / 汎用ヘルパ ============ */
(function (g) {
  'use strict';

  var U = {};

  // ---------- DOM ----------
  U.$ = function (sel, root) { return (root || document).querySelector(sel); };
  U.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  U.el = function (tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'style' && typeof attrs[k] === 'object') { for (var s in attrs[k]) e.style[s] = attrs[k][s]; }
      else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] === true) e.setAttribute(k, '');
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]);
    }
    if (children != null) {
      if (!Array.isArray(children)) children = [children];
      children.forEach(function (c) {
        if (c == null || c === false) return;
        e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return e;
  };

  U.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  U.clear = function (node) { while (node.firstChild) node.removeChild(node.firstChild); return node; };

  // ---------- 数値 ----------
  U.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  U.randInt = function (lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); };
  U.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  // 重み付き抽選（weights は同じ長さの配列）
  U.weighted = function (items, weights) {
    var total = 0, i;
    for (i = 0; i < weights.length; i++) total += weights[i];
    if (total <= 0) return items[U.randInt(0, items.length - 1)];
    var r = Math.random() * total;
    for (i = 0; i < items.length; i++) { r -= weights[i]; if (r < 0) return items[i]; }
    return items[items.length - 1];
  };
  U.comma = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  U.pct = function (a, b, d) { return b ? (a / b * 100).toFixed(d == null ? 1 : d) + '%' : '—'; };

  // ---------- 時刻 ----------
  U.now = function () { return Date.now(); };
  U.DAY = 86400000;
  U.fmtDT = function (ts) {
    if (!ts) return '—';
    var d = new Date(ts), p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };
  U.fmtAgo = function (ts) {
    if (!ts) return '未回答';
    var s = (Date.now() - ts) / 1000;
    if (s < 60) return '数秒前';
    if (s < 3600) return Math.floor(s / 60) + '分前';
    if (s < 86400) return Math.floor(s / 3600) + '時間前';
    return Math.floor(s / 86400) + '日前';
  };
  U.today = function () {
    var d = new Date(), p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };

  // ---------- toast ----------
  U.toast = function (msg, ms) {
    var root = document.getElementById('toastRoot');
    if (!root) return;
    var t = U.el('div', { class: 'toast', text: msg });
    root.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s'; t.style.opacity = '0';
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, ms || 1700);
  };

  // ---------- modal ----------
  U.modal = function (opts) {
    // opts: {title, body(Node|string), buttons:[{label,cls,onClick(close)}], dismissable}
    var root = document.getElementById('modalRoot');
    var mask = U.el('div', { class: 'mask' });
    var sheet = U.el('div', { class: 'sheet' });
    var close = function () {
      mask.style.opacity = '0';
      setTimeout(function () { if (mask.parentNode) mask.parentNode.removeChild(mask); }, 180);
    };
    if (opts.title) sheet.appendChild(U.el('h3', { text: opts.title }));
    if (opts.sub) sheet.appendChild(U.el('div', { class: 'small dim', text: opts.sub }));
    var body = U.el('div', { class: 'sh-body' });
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    sheet.appendChild(body);
    var btns = opts.buttons || [{ label: '閉じる' }];
    var grid = U.el('div', { class: 'btn-grid' + (btns.length === 2 ? ' c2' : '') });
    btns.forEach(function (b) {
      grid.appendChild(U.el('button', {
        class: 'btn ' + (b.cls || ''), text: b.label,
        onclick: function () { if (b.onClick) { if (b.onClick(close) === false) return; } close(); }
      }));
    });
    sheet.appendChild(grid);
    mask.appendChild(sheet);
    mask.addEventListener('click', function (e) { if (e.target === mask && opts.dismissable !== false) close(); });
    root.appendChild(mask);
    return { close: close, sheet: sheet, body: body };
  };

  U.confirm = function (title, msg, onYes, opts) {
    opts = opts || {};
    U.modal({
      title: title, body: '<div class="' + (opts.danger ? 'warn-box' : 'info-box') + '">' + U.esc(msg).replace(/\n/g, '<br>') + '</div>',
      buttons: [
        { label: opts.noLabel || 'やめる' },
        { label: opts.yesLabel || '実行する', cls: opts.danger ? 'dan' : 'pri', onClick: function () { onYes(); } }
      ]
    });
  };

  // ---------- number prompt ----------
  U.promptNum = function (title, opts, onOK) {
    opts = opts || {};
    var inp = U.el('input', { type: 'number', value: opts.value != null ? opts.value : 1, min: opts.min != null ? opts.min : 0, max: opts.max, inputmode: 'numeric' });
    var wrap = U.el('div');
    if (opts.note) wrap.appendChild(U.el('div', { class: 'small dim', text: opts.note, style: { marginBottom: '8px' } }));
    wrap.appendChild(inp);
    if (opts.quick) {
      var qr = U.el('div', { class: 'chips', style: { marginTop: '8px' } });
      opts.quick.forEach(function (q) {
        qr.appendChild(U.el('button', { class: 'chip', text: q.label, onclick: function () { inp.value = q.value; } }));
      });
      wrap.appendChild(qr);
    }
    var live = U.el('div', { class: 'small dim', style: { marginTop: '8px' } });
    wrap.appendChild(live);
    var upd = function () { if (opts.live) live.textContent = opts.live(Number(inp.value) || 0); };
    inp.addEventListener('input', upd); upd();
    U.modal({
      title: title, body: wrap,
      buttons: [{ label: 'キャンセル' }, {
        label: opts.okLabel || '決定', cls: 'pri', onClick: function () {
          var v = Math.floor(Number(inp.value) || 0);
          if (opts.min != null) v = Math.max(opts.min, v);
          if (opts.max != null) v = Math.min(opts.max, v);
          onOK(v);
        }
      }]
    });
    setTimeout(function () { inp.focus(); inp.select(); }, 120);
  };

  // ---------- 遅延実行 ----------
  U.debounce = function (fn, ms) {
    var t = null;
    return function () {
      var a = arguments, s = this;
      clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms);
    };
  };

  U.download = function (filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = U.el('a', { href: url, download: filename });
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  };

  U.readFile = function (accept, cb) {
    var inp = U.el('input', { type: 'file', accept: accept, style: { display: 'none' } });
    document.body.appendChild(inp);
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      if (f) { var r = new FileReader(); r.onload = function () { cb(r.result, f.name); }; r.readAsText(f); }
      setTimeout(function () { document.body.removeChild(inp); }, 100);
    });
    inp.click();
  };

  g.U = U;
})(window);
