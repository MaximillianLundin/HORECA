/* editor.js — orchestration: load/save state, toolbar wiring, parity base. */
(function (global) {
  'use strict';

  var EDITOR = {
    config: null, product: null, lang: null,
    KB: null, baseKB: null, baseLang: null,
    dirty: false,
    _lintTimer: null
  };
  global.EDITOR = EDITOR;

  function $(id) { return document.getElementById(id); }
  function status(msg, cls) { var s = $('statusBar'); s.textContent = msg; s.className = 'ed-status' + (cls ? ' ' + cls : ''); }

  function fileFor(product, lang) { return product.file_pattern.replace('{lang}', lang); }
  function localUrl(product, lang) { return '../data/' + fileFor(product, lang); }
  function remoteUrl(product, lang) {
    return EDITOR.config.supabase.storage_base + '/' + product.bucket + '/' + fileFor(product, lang);
  }

  function currentProduct() { return EDITOR.config.products.filter(function (p) { return p.slug === $('productSel').value; })[0]; }

  // ---- loading ----------------------------------------------------------
  async function fetchJSON(url) {
    var res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
    return res.json();
  }

  async function loadFrom(which) {
    var product = currentProduct(), lang = $('langSel').value;
    var url = which === 'remote' ? remoteUrl(product, lang) : localUrl(product, lang);
    status('Loading ' + which + ': ' + fileFor(product, lang) + ' …');
    try {
      var kb = await fetchJSON(url);
      if (!kb || !kb.schema_version) throw new Error('not a valid KB (no schema_version)');
      EDITOR.product = product; EDITOR.lang = lang;
      await loadBase(product, which);
      setKB(kb, which);
    } catch (e) {
      status('Failed to load ' + which + ': ' + e.message, 'err');
    }
  }

  // Load the parity base language (default = product.primary_language) for diffing.
  async function loadBase(product, which) {
    var baseLang = $('parityBaseSel').value || product.primary_language;
    EDITOR.baseLang = baseLang;
    if (baseLang === $('langSel').value) { EDITOR.baseKB = null; return; }
    var url = which === 'remote' ? remoteUrl(product, baseLang) : localUrl(product, baseLang);
    try { EDITOR.baseKB = await fetchJSON(url); }
    catch (e) { EDITOR.baseKB = null; }
  }

  function loadFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var kb = JSON.parse(reader.result);
        if (!kb.schema_version) throw new Error('no schema_version');
        EDITOR.product = currentProduct();
        EDITOR.lang = (kb.product && kb.product.language) || $('langSel').value;
        EDITOR.baseKB = null;
        setKB(kb, 'file:' + file.name);
      } catch (e) { status('Could not parse file: ' + e.message, 'err'); }
    };
    reader.readAsText(file);
  }

  function setKB(kb, source) {
    EDITOR.KB = kb; EDITOR.dirty = false;
    global.Graph.render(kb, function (target) { global.Panel.render(target); });
    global.Panel.clear();
    populateIssueFilter();
    global.Lint.run();
    var n = global.BWKB.listNodes(kb).length;
    status('Loaded ' + source + ' — ' + (kb.product && kb.product.name || '') + ' / ' + EDITOR.lang +
      ' · ' + n + ' nodes · content_version ' + (kb.content_version || '—'), 'ok');
    global.Graph.fit();
  }

  // ---- mutation hook ----------------------------------------------------
  EDITOR.touch = function (opts) {
    opts = opts || {};
    EDITOR.dirty = true;
    if (opts.structural) global.Graph.refresh(EDITOR.KB);
    clearTimeout(EDITOR._lintTimer);
    EDITOR._lintTimer = setTimeout(function () { global.Lint.run(); }, 250);
    markTitle();
  };

  function markTitle() { document.title = (EDITOR.dirty ? '● ' : '') + 'Bluewater Support Tool Editor'; }

  // ---- export -----------------------------------------------------------
  EDITOR.exportJSON = function () {
    if (!EDITOR.KB) { alert('Nothing to export.'); return; }
    var name = EDITOR.product ? fileFor(EDITOR.product, EDITOR.lang) : 'kb.json';
    var blob = new Blob([JSON.stringify(EDITOR.KB, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
    EDITOR.dirty = false; markTitle();
    status('Exported ' + name, 'ok');
  };

  // ---- toolbar populate -------------------------------------------------
  function populateProducts() {
    var ps = EDITOR.config.products;
    $('productSel').innerHTML = ps.map(function (p) { return '<option value="' + p.slug + '">' + p.display_name + '</option>'; }).join('');
    populateLangs();
  }
  function populateLangs() {
    var p = currentProduct();
    $('langSel').innerHTML = p.languages.map(function (l) { return '<option value="' + l + '"' + (l === p.primary_language ? '' : '') + '>' + l + '</option>'; }).join('');
    $('parityBaseSel').innerHTML = '<option value="">base: ' + p.primary_language + '</option>' +
      p.languages.map(function (l) { return '<option value="' + l + '">vs ' + l + '</option>'; }).join('');
  }
  function populateIssueFilter() {
    var sel = $('issueFilter');
    sel.innerHTML = '<option value="">All issues</option>' +
      (EDITOR.KB.issues || []).map(function (i) { return '<option value="' + i.start_step + '">' + (i.title || i.slug) + '</option>'; }).join('');
  }

  // ---- init -------------------------------------------------------------
  async function init() {
    global.Panel.init();
    global.Lint.init();
    try { EDITOR.config = await fetchJSON('products.json'); }
    catch (e) { status('Could not load products.json: ' + e.message, 'err'); return; }
    populateProducts();

    $('productSel').addEventListener('change', populateLangs);
    $('loadLocal').addEventListener('click', function () { loadFrom('local'); });
    $('loadRemote').addEventListener('click', function () { loadFrom('remote'); });
    $('filePicker').addEventListener('change', function (e) { if (e.target.files[0]) loadFile(e.target.files[0]); });
    $('exportBtn').addEventListener('click', EDITOR.exportJSON);
    $('deployBtn').addEventListener('click', function () { global.Deploy.open(); });
    $('runLint').addEventListener('click', function () { global.Lint.run(); });

    $('searchBox').addEventListener('input', function (e) { global.Graph.search(e.target.value); });
    $('issueFilter').addEventListener('change', function (e) { global.Graph.filterIssue(EDITOR.KB, e.target.value); });
    $('relayout').addEventListener('click', function () { global.Graph.layout(); });
    $('fitBtn').addEventListener('click', function () { global.Graph.fit(); });
    $('showUnreachable').addEventListener('change', function (e) { global.Graph.dimUnreachable(e.target.checked); });
    $('parityBaseSel').addEventListener('change', function () {
      if (EDITOR.KB && EDITOR.product) { loadBase(EDITOR.product, 'local').then(function () { global.Lint.run(); }); }
    });

    global.addEventListener('beforeunload', function (e) { if (EDITOR.dirty) { e.preventDefault(); e.returnValue = ''; } });

    status('Ready. Pick a product + language, then Load local / Load remote / Open file.');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
