/* deploy.js — preview → approve → deploy gate.
   IMPORTANT: actual upload is intentionally NOT wired. Uploading to the
   Supabase bucket needs a service_role key, which must never live in the
   browser. Phase 4 adds a serverless endpoint (/api/deploy-kb) that holds the
   key server-side, re-validates, and uploads — and every deploy needs explicit
   human approval. Until then this previews the payload and explains the gate. */
(function (global) {
  'use strict';

  function open() {
    var KB = global.EDITOR.KB;
    if (!KB) { alert('Load a knowledge base first.'); return; }
    var findings = global.Lint.run();
    var errors = findings.filter(function (f) { return f.severity === 'error'; });

    var product = global.EDITOR.product, lang = global.EDITOR.lang;
    var file = (product ? product.file_pattern.replace('{lang}', lang) : 'kb.json');
    var bucket = product ? product.bucket : '(unknown)';
    var nextVersion = bumpVersion(KB.content_version);

    var modal = document.createElement('div');
    modal.className = 'ed-modal-bg';
    modal.innerHTML =
      '<div class="ed-modal">' +
        '<h3>Deploy ' + file + '</h3>' +
        (errors.length
          ? '<p class="ed-modal-block">⛔ ' + errors.length + ' validation error(s) must be fixed before deploy. Deploy is blocked.</p>'
          : '<p class="ed-modal-ok">✓ No validation errors.</p>') +
        '<ul class="ed-modal-meta">' +
          '<li><b>Bucket:</b> ' + bucket + '</li>' +
          '<li><b>File:</b> ' + file + '</li>' +
          '<li><b>content_version:</b> ' + (KB.content_version || '—') + ' → <b>' + nextVersion + '</b></li>' +
        '</ul>' +
        '<p class="ed-modal-note">Upload is not enabled in this build. It requires the <code>/api/deploy-kb</code> serverless endpoint (holds the <code>service_role</code> key server-side) plus explicit approval. For now, use <b>Export JSON</b> and upload through the approved channel.</p>' +
        '<div class="ed-modal-actions">' +
          '<button class="ed-btn" id="dmClose">Close</button>' +
          '<button class="ed-btn ed-btn-primary" id="dmExport">Export JSON instead</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelector('#dmClose').onclick = function () { modal.remove(); };
    modal.querySelector('#dmExport').onclick = function () { modal.remove(); global.EDITOR.exportJSON(); };
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
  }

  // YYYY-MM-DD-N convention seen in the KBs. We only increment the -N suffix
  // (date is set on the real deploy server-side to avoid clock assumptions).
  function bumpVersion(v) {
    if (!v) return '(set on deploy)';
    var m = /^(.*?)-(\d+)$/.exec(v);
    if (m) return m[1] + '-' + (parseInt(m[2], 10) + 1);
    return v + '-2';
  }

  global.Deploy = { open: open, bumpVersion: bumpVersion };
})(window);
