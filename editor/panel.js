/* panel.js — node editor. Auto-renders from BWKB field specs and mutates the
   live KB. Target pickers are populated from listValidTargets → links can't break. */
(function (global) {
  'use strict';
  var elPanel;
  var current = null; // current target string

  function KB() { return global.EDITOR.KB; }
  function BW() { return global.BWKB; }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function clear() {
    current = null;
    elPanel.innerHTML = '<div class="ed-panel-empty">Select a node to edit it.</div>';
  }

  function targetOptionsHtml(selected) {
    var opts = '<option value="">— choose —</option>';
    var groups = { step: [], solution: [], end: [] };
    BW().listNodes(KB()).forEach(function (n) { groups[n.type].push(n); });
    [['step', 'Steps'], ['solution', 'Solutions'], ['end', 'Ends']].forEach(function (g) {
      opts += '<optgroup label="' + g[1] + '">';
      groups[g[0]].forEach(function (n) {
        var lbl = n.id + (n.node && (n.node.title || n.node.question) ? ' — ' + (n.node.title || n.node.question).slice(0, 30) : '');
        opts += '<option value="' + esc(n.target) + '"' + (n.target === selected ? ' selected' : '') + '>' + esc(lbl) + '</option>';
      });
      opts += '</optgroup>';
    });
    opts += '<optgroup label="Create"><option value="__new_step">＋ New step…</option><option value="__new_solution">＋ New solution…</option></optgroup>';
    // selected target that no longer exists → show as broken
    if (selected && !BW().nodeExists(KB(), selected))
      opts = '<option value="' + esc(selected) + '" selected>⚠ ' + esc(selected) + ' (missing)</option>' + opts;
    return opts;
  }

  // Resolve a target <select> value, handling the "create new" sentinels.
  function resolveTargetValue(val, onResolved) {
    if (val === '__new_step' || val === '__new_solution') {
      var type = val === '__new_step' ? 'step' : 'solution';
      var id = (global.prompt('New ' + type + ' id (letters, numbers, _):') || '').trim();
      if (!id) return onResolved(null);
      if (BW().getNode(KB(), type, id)) { alert('A ' + type + ' with that id already exists.'); return onResolved('step' === type ? 'step:' + id : 'solution:' + id); }
      createNode(type, id);
      return onResolved(type + ':' + id);
    }
    onResolved(val || null);
  }

  function createNode(type, id) {
    if (type === 'step') KB().diagnostic_steps[id] = { question: 'New question', help_text: null, image: null, image_alt: null, options: [] };
    else KB().solutions[id] = { title: 'New solution', intro: null, steps: [], note: null, videos: [], documents: [], photo_gallery: [], follow_up: { solved_label: 'It worked', solved_next: 'end:resolved', not_solved_label: 'Still not working', not_solved_next: 'end:notResolved' } };
    global.EDITOR.touch({ structural: true });
  }

  // ---- field widgets ----------------------------------------------------
  function fieldHtml(spec, node) {
    var v = node[spec.key];
    var id = 'f_' + spec.key;
    var h = '<div class="ed-field" data-key="' + spec.key + '">';
    h += '<label for="' + id + '">' + esc(spec.label) + (spec.required ? ' *' : '') + '</label>';
    switch (spec.widget) {
      case 'text': h += '<input type="text" id="' + id + '" value="' + esc(v) + '">'; break;
      case 'textarea': case 'richtext': h += '<textarea id="' + id + '">' + esc(v) + '</textarea>'; break;
      case 'number': h += '<input type="number" id="' + id + '" value="' + (v == null ? '' : esc(v)) + '">'; break;
      case 'bool': h += '<label class="ed-check"><input type="checkbox" id="' + id + '"' + (v ? ' checked' : '') + '> ' + esc(spec.label) + '</label>'; break;
      case 'select':
        h += '<select id="' + id + '">';
        (spec.choices || []).forEach(function (c) { h += '<option' + (c === v ? ' selected' : '') + '>' + esc(c) + '</option>'; });
        h += '</select>'; break;
      case 'string-list': h += stringListHtml(spec.key, v || []); break;
      case 'media': h += mediaHtml(spec.key, v || []); break;
      case 'options': h += optionsHtml(v || []); break;
      case 'follow_up': h += followUpHtml(v || {}); break;
      case 'target': h += '<select id="' + id + '" class="ed-target">' + targetOptionsHtml(v) + '</select>'; break;
      default: h += '<input type="text" id="' + id + '" value="' + esc(v) + '">';
    }
    h += '</div>';
    return h;
  }

  function stringListHtml(key, arr) {
    var h = '<div class="ed-list" data-list="' + key + '">';
    arr.forEach(function (s, i) {
      h += '<div class="ed-listrow"><input type="text" data-i="' + i + '" value="' + esc(s) + '"><button class="ed-iconbtn" data-del="' + i + '" title="Remove">×</button></div>';
    });
    h += '<button class="ed-addbtn" data-add>＋ Add</button></div>';
    return h;
  }

  function mediaHtml(key, arr) {
    var h = '<div class="ed-list ed-media" data-media="' + key + '">';
    arr.forEach(function (m, i) {
      h += '<div class="ed-opt"><div class="ed-opt-row"><input class="grow" type="text" data-i="' + i + '" data-f="url" placeholder="url" value="' + esc(m.url) + '"><button class="ed-iconbtn" data-del="' + i + '">×</button></div>' +
           '<input type="text" data-i="' + i + '" data-f="label" placeholder="label" value="' + esc(m.label) + '"></div>';
    });
    h += '<button class="ed-addbtn" data-add>＋ Add</button></div>';
    return h;
  }

  function optionsHtml(arr) {
    var h = '<div class="ed-options">';
    arr.forEach(function (o, i) {
      var broken = o.next && !BW().nodeExists(KB(), o.next);
      h += '<div class="ed-opt" data-oi="' + i + '">' +
        '<div class="ed-opt-row"><input class="grow" type="text" data-f="label" placeholder="Button label" value="' + esc(o.label) + '">' +
          '<button class="ed-iconbtn" data-delopt title="Remove option">×</button></div>' +
        '<div class="ed-opt-row">' +
          '<select data-f="type">' + BW().OPTION_TYPES.map(function (t) { return '<option' + (t === o.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>' +
          '<select class="grow ed-target' + (broken ? ' ed-target-bad' : '') + '" data-f="next">' + targetOptionsHtml(o.next) + '</select>' +
        '</div></div>';
    });
    h += '<button class="ed-addbtn" data-addopt>＋ Add option</button></div>';
    return h;
  }

  function followUpHtml(fu) {
    return '<div class="ed-opt ed-followup">' +
      '<div class="ed-opt-row"><input class="grow" type="text" data-fu="solved_label" placeholder="Solved label" value="' + esc(fu.solved_label) + '">' +
        '<select class="ed-target" data-fu="solved_next">' + targetOptionsHtml(fu.solved_next) + '</select></div>' +
      '<div class="ed-opt-row"><input class="grow" type="text" data-fu="not_solved_label" placeholder="Not-solved label" value="' + esc(fu.not_solved_label) + '">' +
        '<select class="ed-target" data-fu="not_solved_next">' + targetOptionsHtml(fu.not_solved_next) + '</select></div>' +
      '<div class="ed-hint">Leave blank to fall back to end:resolved / end:notResolved.</div></div>';
  }

  // ---- render -----------------------------------------------------------
  function render(target) {
    current = target;
    var p = BW().parseTarget(target);
    if (p.kind === 'end' || p.kind === 'internal' || !p.kind) {
      elPanel.innerHTML = '<div class="ed-panel-head"><div class="ed-panel-kind">' + esc(p.kind) +
        '</div><div class="ed-panel-id">' + esc(target) + '</div></div>' +
        '<div class="ed-panel-body"><p class="ed-mini">This is a terminal/system screen — its text lives in <code>ui_strings</code> / <code>escalation</code>, not as an editable node.</p></div>';
      return;
    }
    var node = BW().getNode(KB(), p.kind, p.id);
    if (!node) { clear(); return; }
    var fields = p.kind === 'step' ? BW().STEP_FIELDS : BW().SOLUTION_FIELDS;

    var h = '<div class="ed-panel-head">' +
      '<div class="ed-panel-kind">' + esc(p.kind) + '</div>' +
      '<div class="ed-panel-id">' + esc(p.id) + '</div>' +
      '<div class="ed-panel-actions">' +
        '<button class="ed-btn ed-btn-sm" id="pnRename">Rename id</button>' +
        '<button class="ed-btn ed-btn-sm ed-danger" id="pnDelete">Delete node</button>' +
      '</div></div><div class="ed-panel-body">';
    fields.forEach(function (f) { h += fieldHtml(f, node); });
    h += '</div>';
    elPanel.innerHTML = h;
    wire(node, p);
  }

  // ---- wiring (mutations) ----------------------------------------------
  function wire(node, p) {
    var body = elPanel;

    // simple scalar fields
    body.querySelectorAll('.ed-field').forEach(function (fieldEl) {
      var key = fieldEl.getAttribute('data-key');
      var spec = (p.kind === 'step' ? BW().STEP_FIELDS : BW().SOLUTION_FIELDS).filter(function (s) { return s.key === key; })[0];
      if (!spec) return;
      var input = fieldEl.querySelector('#f_' + key);
      if (!input) return;
      if (spec.widget === 'bool') {
        input.addEventListener('change', function () { node[key] = input.checked; global.EDITOR.touch({}); });
      } else if (spec.widget === 'number') {
        input.addEventListener('change', function () { node[key] = input.value === '' ? null : Number(input.value); global.EDITOR.touch({}); });
      } else if (spec.widget === 'text' || spec.widget === 'textarea' || spec.widget === 'select') {
        input.addEventListener('input', function () { node[key] = input.value; });
        input.addEventListener('change', function () { node[key] = input.value; global.EDITOR.touch({ structural: key === 'title' || key === 'question' }); });
      }
    });

    // string-lists
    body.querySelectorAll('[data-list]').forEach(function (wrap) {
      var key = wrap.getAttribute('data-list');
      if (!Array.isArray(node[key])) node[key] = node[key] ? [node[key]] : [];
      wrap.querySelectorAll('input[data-i]').forEach(function (inp) {
        inp.addEventListener('input', function () { node[key][+inp.getAttribute('data-i')] = inp.value; });
      });
      wrap.querySelectorAll('[data-del]').forEach(function (b) {
        b.addEventListener('click', function () { node[key].splice(+b.getAttribute('data-del'), 1); rerender(); });
      });
      var add = wrap.querySelector('[data-add]');
      if (add) add.addEventListener('click', function () { node[key].push(''); rerender(); });
    });

    // media lists
    body.querySelectorAll('[data-media]').forEach(function (wrap) {
      var key = wrap.getAttribute('data-media');
      if (!Array.isArray(node[key])) node[key] = [];
      wrap.querySelectorAll('input[data-i]').forEach(function (inp) {
        inp.addEventListener('input', function () { node[key][+inp.getAttribute('data-i')][inp.getAttribute('data-f')] = inp.value; });
      });
      wrap.querySelectorAll('[data-del]').forEach(function (b) {
        b.addEventListener('click', function () { node[key].splice(+b.getAttribute('data-del'), 1); rerender(); });
      });
      var add = wrap.querySelector('[data-add]');
      if (add) add.addEventListener('click', function () { node[key].push({ url: '', label: '' }); rerender(); });
    });

    // options
    var optsWrap = body.querySelector('.ed-options');
    if (optsWrap) {
      if (!Array.isArray(node.options)) node.options = [];
      optsWrap.querySelectorAll('.ed-opt[data-oi]').forEach(function (row) {
        var oi = +row.getAttribute('data-oi');
        row.querySelector('[data-f="label"]').addEventListener('input', function (e) { node.options[oi].label = e.target.value; });
        row.querySelector('[data-f="label"]').addEventListener('change', function () { global.EDITOR.touch({ structural: true }); });
        row.querySelector('[data-f="type"]').addEventListener('change', function (e) { node.options[oi].type = e.target.value; global.EDITOR.touch({}); });
        var tsel = row.querySelector('[data-f="next"]');
        tsel.addEventListener('change', function () {
          resolveTargetValue(tsel.value, function (val) { node.options[oi].next = val; global.EDITOR.touch({ structural: true }); });
        });
        var del = row.querySelector('[data-delopt]');
        if (del) del.addEventListener('click', function () { node.options.splice(oi, 1); global.EDITOR.touch({ structural: true }); rerender(); });
      });
      var addOpt = optsWrap.querySelector('[data-addopt]');
      if (addOpt) addOpt.addEventListener('click', function () {
        node.options.push({ label: 'New option', next: '', type: 'primary' }); global.EDITOR.touch({ structural: true }); rerender();
      });
    }

    // follow_up
    var fuWrap = body.querySelector('.ed-followup');
    if (fuWrap) {
      if (!node.follow_up) node.follow_up = {};
      fuWrap.querySelectorAll('[data-fu]').forEach(function (inp) {
        var k = inp.getAttribute('data-fu');
        if (inp.tagName === 'SELECT') {
          inp.addEventListener('change', function () { resolveTargetValue(inp.value, function (val) { node.follow_up[k] = val; global.EDITOR.touch({ structural: true }); }); });
        } else {
          inp.addEventListener('input', function () { node.follow_up[k] = inp.value; });
          inp.addEventListener('change', function () { global.EDITOR.touch({}); });
        }
      });
    }

    // node actions
    var del = body.querySelector('#pnDelete');
    if (del) del.addEventListener('click', function () { deleteNode(p); });
    var ren = body.querySelector('#pnRename');
    if (ren) ren.addEventListener('click', function () { renameNode(p); });
  }

  function rerender() { if (current) render(current); }

  function inboundEdges(target) {
    var hits = [];
    BW().listNodes(KB()).forEach(function (n) {
      if (n.type === 'end') return;
      BW().outgoingTargets(KB(), n.type, n.id).forEach(function (e) {
        if (e.target === target) hits.push({ from: n.target, via: e.via, label: e.label });
      });
    });
    return hits;
  }

  function deleteNode(p) {
    var target = p.kind + ':' + p.id;
    var inbound = inboundEdges(target);
    var msg = 'Delete ' + target + '?';
    if (inbound.length) msg += '\n\n' + inbound.length + ' link(s) point here and will become dangling:\n' +
      inbound.slice(0, 8).map(function (e) { return ' • ' + e.from + ' ("' + e.label + '")'; }).join('\n');
    if (!global.confirm(msg)) return;
    if (p.kind === 'step') delete KB().diagnostic_steps[p.id];
    else delete KB().solutions[p.id];
    clear();
    global.EDITOR.touch({ structural: true });
  }

  function renameNode(p) {
    var nid = (global.prompt('Rename "' + p.id + '" to:', p.id) || '').trim();
    if (!nid || nid === p.id) return;
    var coll = p.kind === 'step' ? KB().diagnostic_steps : KB().solutions;
    if (coll[nid]) { alert('That id already exists.'); return; }
    var oldT = p.kind + ':' + p.id, newT = p.kind + ':' + nid;
    coll[nid] = coll[p.id]; delete coll[p.id];
    // repoint all inbound links + issue.start_step
    BW().listNodes(KB()).forEach(function (n) {
      if (n.type === 'end') return;
      var node = n.node;
      (node.options || []).forEach(function (o) { if (o.next === oldT) o.next = newT; });
      if (node.follow_up) ['solved_next', 'not_solved_next'].forEach(function (k) { if (node.follow_up[k] === oldT) node.follow_up[k] = newT; });
    });
    if (p.kind === 'step') (KB().issues || []).forEach(function (i) { if (i.start_step === p.id) i.start_step = nid; });
    current = newT;
    global.EDITOR.touch({ structural: true });
    render(newT);
    global.Graph.focus(newT);
  }

  global.Panel = {
    init: function () { elPanel = document.getElementById('panel'); clear(); },
    render: render, clear: clear
  };
})(window);
