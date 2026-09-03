/* lint.js — runs BWKB.lintKB + lintParity and renders the findings drawer. */
(function (global) {
  'use strict';
  var listEl, summaryEl, drawerEl;
  var findings = [];

  function severityRank(s) { return s === 'error' ? 0 : s === 'warn' ? 1 : 2; }

  function run() {
    var KB = global.EDITOR.KB;
    if (!KB) { findings = []; return render(); }
    var f = global.BWKB.lintKB(KB);
    var base = global.EDITOR.baseKB;
    if (base && base !== KB) {
      f = f.concat(global.BWKB.lintParity(base, KB, global.EDITOR.baseLang, global.EDITOR.lang));
    }
    f.sort(function (a, b) { return severityRank(a.severity) - severityRank(b.severity); });
    findings = f;
    render();
    return f;
  }

  function counts() {
    var c = { error: 0, warn: 0, info: 0 };
    findings.forEach(function (f) { c[f.severity] = (c[f.severity] || 0) + 1; });
    return c;
  }

  function render() {
    var show = {
      error: document.getElementById('fError').checked,
      warn: document.getElementById('fWarn').checked,
      info: document.getElementById('fInfo').checked
    };
    var c = counts();
    var parity = findings.filter(function (f) { return f.scope === 'parity'; }).length;
    summaryEl.textContent = c.error + ' errors · ' + c.warn + ' warnings · ' + c.info + ' info' +
      (parity ? ' · ' + parity + ' parity' : '') + (global.EDITOR.KB ? '' : ' — no KB');

    var visible = findings.filter(function (f) { return show[f.severity]; });
    if (!visible.length) { listEl.innerHTML = '<div class="ed-finding"><span class="ed-finding-msg">No findings for the selected filters.</span></div>'; return; }
    listEl.innerHTML = visible.map(function (f, i) {
      var badge = f.scope === 'parity' ? 'parity' : f.severity;
      return '<div class="ed-finding" data-tgt="' + (f.target || '') + '">' +
        '<span class="ed-badge ' + badge + '">' + (f.scope === 'parity' ? 'parity' : f.severity) + '</span>' +
        '<span class="ed-finding-tgt">' + (f.target || '') + '</span>' +
        '<span class="ed-finding-msg">' + escapeHtml(f.message) + '</span></div>';
    }).join('');
    listEl.querySelectorAll('.ed-finding[data-tgt]').forEach(function (row) {
      var tgt = row.getAttribute('data-tgt');
      if (!tgt) return;
      row.addEventListener('click', function () {
        global.Graph.focus(tgt);
        if (global.BWKB.nodeExists(global.EDITOR.KB, tgt)) global.Panel.render(tgt);
      });
    });
  }

  function escapeHtml(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  function toggle() { drawerEl.classList.toggle('collapsed'); }

  global.Lint = {
    init: function () {
      listEl = document.getElementById('lintList');
      summaryEl = document.getElementById('lintSummary');
      drawerEl = document.getElementById('lintDrawer');
      document.getElementById('lintToggle').addEventListener('click', toggle);
      ['fError', 'fWarn', 'fInfo'].forEach(function (id) {
        document.getElementById(id).addEventListener('change', render);
      });
    },
    run: run, render: render
  };
})(window);
