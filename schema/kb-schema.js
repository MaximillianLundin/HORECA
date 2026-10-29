/* =========================================================================
   Bluewater Support Tool — Knowledge Base SCHEMA (single source of truth)
   -------------------------------------------------------------------------
   Classic script. Defines the global `window.BWKB`.
   Loaded by BOTH the renderer (app.js) and the editor so the two can never
   drift. Pure logic, no DOM, no network. Product- and language-agnostic.
   ========================================================================= */
(function (global) {
  'use strict';

  // ---- Grammar constants ------------------------------------------------
  var NODE_KINDS  = ['step', 'solution', 'end'];
  var OPTION_TYPES = ['primary', 'secondary', 'dont_know'];
  var END_IDS = ['resolved', 'notResolved'];
  var END_TARGETS = ['end:resolved', 'end:notResolved'];
  // Internal renderer screens that are valid `next` values but are NOT nodes
  // in the editable knowledge graph (handled by app.js directly).
  var INTERNAL_TARGETS = ['mode', 'product', 'install', 'purifier', 'start', 'describe'];

  // ---- Target grammar:  step:<id> | solution:<id> | end:resolved|notResolved
  function parseTarget(target) {
    if (typeof target !== 'string' || !target) return { kind: null, id: null, raw: target };
    if (INTERNAL_TARGETS.indexOf(target) !== -1) return { kind: 'internal', id: target, raw: target };
    var i = target.indexOf(':');
    if (i === -1) return { kind: null, id: null, raw: target };
    return { kind: target.slice(0, i), id: target.slice(i + 1), raw: target };
  }
  function formatTarget(kind, id) { return kind + ':' + id; }
  function isValidTargetFormat(target) {
    var p = parseTarget(target);
    if (p.kind === 'internal') return true;
    if (p.kind === 'step' || p.kind === 'solution') return !!p.id;
    if (p.kind === 'end') return END_IDS.indexOf(p.id) !== -1;
    return false;
  }

  // ---- Node enumeration -------------------------------------------------
  // Returns every editable node as {type, id, target, node} where node is the
  // underlying object (null for the two synthetic end nodes).
  function listNodes(KB) {
    var out = [];
    var steps = (KB && KB.diagnostic_steps) || {};
    var sols  = (KB && KB.solutions) || {};
    Object.keys(steps).forEach(function (id) {
      out.push({ type: 'step', id: id, target: 'step:' + id, node: steps[id] });
    });
    Object.keys(sols).forEach(function (id) {
      out.push({ type: 'solution', id: id, target: 'solution:' + id, node: sols[id] });
    });
    END_IDS.forEach(function (id) {
      out.push({ type: 'end', id: id, target: 'end:' + id, node: null });
    });
    return out;
  }

  // All legal `next` values for a given KB (used to populate rewire dropdowns
  // so a link can never be pointed at a non-existent node).
  function listValidTargets(KB) {
    return listNodes(KB).map(function (n) { return n.target; });
  }

  function nodeExists(KB, target) {
    var p = parseTarget(target);
    if (p.kind === 'end') return END_IDS.indexOf(p.id) !== -1;
    if (p.kind === 'internal') return true;
    if (p.kind === 'step') return !!(KB.diagnostic_steps && KB.diagnostic_steps[p.id]);
    if (p.kind === 'solution') return !!(KB.solutions && KB.solutions[p.id]);
    return false;
  }

  function getNode(KB, type, id) {
    if (type === 'step') return (KB.diagnostic_steps || {})[id] || null;
    if (type === 'solution') return (KB.solutions || {})[id] || null;
    return null;
  }

  // Entry points into the graph: the welcome step + every issue.start_step.
  function getStartTargets(KB) {
    var starts = [];
    if (KB.diagnostic_steps && KB.diagnostic_steps.welcome) starts.push('step:welcome');
    (KB.issues || []).forEach(function (iss) {
      if (iss.start_step) {
        var t = 'step:' + iss.start_step;
        if (starts.indexOf(t) === -1) starts.push(t);
      }
    });
    return starts;
  }

  // Outgoing edges from a node: from option arrays (steps & solutions) or from
  // a solution's follow_up. Returns [{target, label, via}].
  function outgoingTargets(KB, type, id) {
    var node = getNode(KB, type, id);
    var edges = [];
    if (!node) return edges;
    (node.options || []).forEach(function (opt, i) {
      if (opt && opt.next) edges.push({ target: opt.next, label: opt.label || '', via: 'option', index: i });
    });
    if (node.follow_up) {
      if (node.follow_up.solved_next)
        edges.push({ target: node.follow_up.solved_next, label: node.follow_up.solved_label || 'Solved', via: 'follow_up.solved' });
      if (node.follow_up.not_solved_next)
        edges.push({ target: node.follow_up.not_solved_next, label: node.follow_up.not_solved_label || 'Not solved', via: 'follow_up.not_solved' });
    }
    return edges;
  }

  // All edges in the KB, for graph rendering.
  function allEdges(KB) {
    var edges = [];
    listNodes(KB).forEach(function (n) {
      if (n.type === 'end') return;
      outgoingTargets(KB, n.type, n.id).forEach(function (e) {
        edges.push({ from: n.target, to: e.target, label: e.label, via: e.via });
      });
    });
    return edges;
  }

  // ---- Reachability (BFS from all start targets) ------------------------
  function reachability(KB) {
    var reachable = {};
    var queue = getStartTargets(KB).slice();
    queue.forEach(function (t) { reachable[t] = true; });
    while (queue.length) {
      var cur = queue.shift();
      var p = parseTarget(cur);
      if (p.kind !== 'step' && p.kind !== 'solution') continue;
      outgoingTargets(KB, p.kind, p.id).forEach(function (e) {
        if (!reachable[e.target] && nodeExists(KB, e.target)) {
          reachable[e.target] = true;
          queue.push(e.target);
        }
      });
    }
    return reachable;
  }

  // =======================================================================
  //  FIELD SPECS — the editor form auto-renders from these, so adding a
  //  schema field never means hand-editing form code.
  //  widget: text | textarea | richtext | bool | number | select | list |
  //          options | follow_up | media | string-list
  // =======================================================================
  var STEP_FIELDS = [
    { key: 'question',       label: 'Question',        widget: 'textarea', required: true },
    { key: 'help_text',      label: 'Help text',       widget: 'textarea' },
    { key: 'safety_warning', label: 'Safety warning',  widget: 'textarea' },
    { key: 'image',          label: 'Image URL',       widget: 'text' },
    { key: 'image_alt',      label: 'Image alt text',  widget: 'text' },
    { key: 'options',        label: 'Options',         widget: 'options', required: true }
  ];

  var SOLUTION_FIELDS = [
    { key: 'title',                 label: 'Title',            widget: 'text', required: true },
    { key: 'intro',                 label: 'Intro',            widget: 'textarea' },
    { key: 'steps',                 label: 'Steps',            widget: 'string-list' },
    { key: 'note',                  label: 'Note',             widget: 'textarea' },
    { key: 'after_text',            label: 'After text',       widget: 'textarea' },
    { key: 'mid_step_help',         label: 'Mid-step help',    widget: 'textarea' },
    { key: 'safety_warning',        label: 'Safety warning',   widget: 'textarea' },
    { key: 'severity',              label: 'Severity',         widget: 'text' },
    { key: 'fix_type',              label: 'Fix type',         widget: 'text' },
    { key: 'estimated_time_minutes',label: 'Est. time (min)',  widget: 'number' },
    { key: 'tools_needed',          label: 'Tools needed',     widget: 'string-list' },
    { key: 'bypass',                label: 'Bypass',           widget: 'bool' },
    { key: 'about_page_required',   label: 'About page req.',  widget: 'bool' },
    { key: '_placeholder',          label: 'Placeholder',      widget: 'bool' },
    { key: 'videos',                label: 'Videos',           widget: 'media' },
    { key: 'documents',             label: 'Documents',        widget: 'media' },
    { key: 'photo_gallery',         label: 'Photo gallery',    widget: 'media' },
    { key: 'follow_up',             label: 'Follow-up',        widget: 'follow_up' },
    { key: 'options',               label: 'Options',          widget: 'options' }
  ];

  var OPTION_FIELDS = [
    { key: 'label', label: 'Label', widget: 'text', required: true },
    { key: 'next',  label: 'Goes to', widget: 'target', required: true },
    { key: 'type',  label: 'Style', widget: 'select', choices: OPTION_TYPES }
  ];

  // Keys the renderer recognises on a solution. Anything else → lint warning.
  var KNOWN_SOLUTION_KEYS = SOLUTION_FIELDS.map(function (f) { return f.key; });
  var KNOWN_STEP_KEYS = STEP_FIELDS.map(function (f) { return f.key; }).concat(['image_alt']);

  // =======================================================================
  //  LINT RULES — shared by the editor's lint panel and (later) the deploy
  //  guard. Each finding: {rule, severity, scope, target, message}.
  //  severity: 'error' | 'warn' | 'info'
  // =======================================================================
  function lintKB(KB) {
    var findings = [];
    function add(rule, severity, target, message) {
      findings.push({ rule: rule, severity: severity, scope: 'structure', target: target, message: message });
    }
    if (!KB || !KB.schema_version) {
      add('schema.version', 'error', null, 'Missing schema_version — file may not be a valid KB.');
      return findings;
    }

    var reach = reachability(KB);

    // 1. Dangling links
    listNodes(KB).forEach(function (n) {
      if (n.type === 'end') return;
      outgoingTargets(KB, n.type, n.id).forEach(function (e) {
        if (!isValidTargetFormat(e.target))
          add('link.badformat', 'error', n.target, 'Option "' + e.label + '" → invalid target "' + e.target + '".');
        else if (!nodeExists(KB, e.target))
          add('link.dangling', 'error', n.target, 'Option "' + e.label + '" → "' + e.target + '" does not exist.');
      });
    });

    // 2. Unreachable nodes (orphans)
    listNodes(KB).forEach(function (n) {
      if (n.type === 'end') return;
      if (!reach[n.target]) add('node.unreachable', 'warn', n.target, n.type + ' "' + n.id + '" is not reachable from any start point.');
    });

    // 3. Dead-ends: a step/solution with no outgoing navigation at all
    listNodes(KB).forEach(function (n) {
      if (n.type === 'end') return;
      var out = outgoingTargets(KB, n.type, n.id);
      if (out.length === 0)
        add('node.deadend', 'error', n.target, n.type + ' "' + n.id + '" has no options or follow-up — user gets stuck.');
    });

    // 4. follow_up AND options both present (ambiguous), or solution with neither
    listNodes(KB).forEach(function (n) {
      if (n.type !== 'solution') return;
      var s = n.node;
      var hasOpts = s.options && s.options.length;
      var hasFu = s.follow_up && (s.follow_up.solved_next || s.follow_up.not_solved_next);
      if (hasOpts && hasFu)
        add('solution.both_nav', 'warn', n.target, 'Solution "' + n.id + '" has BOTH options and follow_up — renderer uses options first.');
    });

    // 5. Reachable placeholders
    listNodes(KB).forEach(function (n) {
      if (n.type === 'solution' && n.node._placeholder && reach[n.target])
        add('solution.placeholder', 'warn', n.target, 'Solution "' + n.id + '" is a reachable placeholder (_placeholder: true).');
    });

    // 6. Unknown keys (schema drift)
    Object.keys(KB.solutions || {}).forEach(function (id) {
      Object.keys(KB.solutions[id]).forEach(function (k) {
        if (KNOWN_SOLUTION_KEYS.indexOf(k) === -1)
          add('solution.unknown_key', 'info', 'solution:' + id, 'Solution "' + id + '" has unknown key "' + k + '".');
      });
    });

    // 7. Issues: start_step exists, unique sort_order, valid keyword regex
    var sortSeen = {};
    (KB.issues || []).forEach(function (iss) {
      if (!iss.start_step || !(KB.diagnostic_steps && KB.diagnostic_steps[iss.start_step]))
        add('issue.start_missing', 'error', 'issue:' + iss.slug, 'Issue "' + iss.slug + '" start_step "' + iss.start_step + '" does not exist.');
      if (iss.sort_order != null) {
        if (sortSeen[iss.sort_order]) add('issue.sort_dup', 'warn', 'issue:' + iss.slug, 'Duplicate sort_order ' + iss.sort_order + '.');
        sortSeen[iss.sort_order] = true;
      }
      (iss.routing_keywords || []).forEach(function (kw) {
        try { new RegExp(kw, 'i'); } catch (e) {
          add('issue.bad_regex', 'error', 'issue:' + iss.slug, 'Invalid routing_keyword regex: "' + kw + '".');
        }
      });
    });

    // 8. Required step fields
    Object.keys(KB.diagnostic_steps || {}).forEach(function (id) {
      var st = KB.diagnostic_steps[id];
      if (!st.question) add('step.no_question', 'warn', 'step:' + id, 'Step "' + id + '" has no question text.');
      (st.options || []).forEach(function (opt, i) {
        if (opt.type && OPTION_TYPES.indexOf(opt.type) === -1)
          add('option.bad_type', 'warn', 'step:' + id, 'Step "' + id + '" option #' + (i + 1) + ' has unknown type "' + opt.type + '".');
      });
    });

    return findings;
  }

  // ---- LANGUAGE PARITY — structural diff of target vs base language ------
  // Returns findings with scope 'parity'. Flags missing nodes, branch-count
  // mismatches, divergent next-targets, and untranslated (identical) strings.
  function lintParity(baseKB, targetKB, baseLang, targetLang) {
    var findings = [];
    baseLang = baseLang || 'base'; targetLang = targetLang || 'target';
    function add(rule, severity, target, message) {
      findings.push({ rule: rule, severity: severity, scope: 'parity', target: target, message: message });
    }
    if (!baseKB || !targetKB) return findings;

    function ids(KB, coll) { return Object.keys((KB && KB[coll]) || {}); }

    ['diagnostic_steps', 'solutions'].forEach(function (coll) {
      var baseIds = ids(baseKB, coll), tgtIds = ids(targetKB, coll);
      var kind = coll === 'diagnostic_steps' ? 'step' : 'solution';
      baseIds.forEach(function (id) {
        if (tgtIds.indexOf(id) === -1)
          add('parity.missing_node', 'error', kind + ':' + id, kind + ' "' + id + '" exists in ' + baseLang + ' but is MISSING in ' + targetLang + '.');
      });
      tgtIds.forEach(function (id) {
        if (baseIds.indexOf(id) === -1)
          add('parity.extra_node', 'warn', kind + ':' + id, kind + ' "' + id + '" exists in ' + targetLang + ' but not in ' + baseLang + '.');
      });
      // Branch-shape + next-target divergence on shared nodes
      baseIds.forEach(function (id) {
        if (tgtIds.indexOf(id) === -1) return;
        var b = baseKB[coll][id], t = targetKB[coll][id];
        var bo = (b.options || []), to = (t.options || []);
        if (bo.length !== to.length)
          add('parity.option_count', 'warn', kind + ':' + id, kind + ' "' + id + '" has ' + bo.length + ' options in ' + baseLang + ' but ' + to.length + ' in ' + targetLang + '.');
        var n = Math.min(bo.length, to.length);
        for (var i = 0; i < n; i++) {
          if (bo[i].next !== to[i].next)
            add('parity.next_divergence', 'error', kind + ':' + id, kind + ' "' + id + '" option #' + (i + 1) + ' points to "' + bo[i].next + '" in ' + baseLang + ' but "' + to[i].next + '" in ' + targetLang + '.');
          if (to[i].label && bo[i].label && to[i].label === bo[i].label)
            add('parity.untranslated', 'info', kind + ':' + id, kind + ' "' + id + '" option #' + (i + 1) + ' label is identical in both languages (untranslated?).');
        }
        // follow_up next divergence
        var bf = b.follow_up || {}, tf = t.follow_up || {};
        ['solved_next', 'not_solved_next'].forEach(function (k) {
          if ((bf[k] || tf[k]) && bf[k] !== tf[k])
            add('parity.next_divergence', 'error', kind + ':' + id, kind + ' "' + id + '" follow_up.' + k + ' differs: "' + bf[k] + '" vs "' + tf[k] + '".');
        });
      });
    });

    // Issue parity
    var bIss = (baseKB.issues || []).map(function (x) { return x.slug; });
    var tIss = (targetKB.issues || []).map(function (x) { return x.slug; });
    bIss.forEach(function (s) { if (tIss.indexOf(s) === -1) add('parity.missing_issue', 'error', 'issue:' + s, 'Issue "' + s + '" missing in ' + targetLang + '.'); });

    return findings;
  }

  // Parity score 0–100 for a language vs base (100 = fully in parity).
  function parityScore(baseKB, targetKB) {
    var f = lintParity(baseKB, targetKB);
    var errors = f.filter(function (x) { return x.severity === 'error'; }).length;
    var warns  = f.filter(function (x) { return x.severity === 'warn'; }).length;
    var penalty = errors * 5 + warns * 2;
    return Math.max(0, 100 - penalty);
  }

  global.BWKB = {
    NODE_KINDS: NODE_KINDS, OPTION_TYPES: OPTION_TYPES, END_IDS: END_IDS,
    END_TARGETS: END_TARGETS, INTERNAL_TARGETS: INTERNAL_TARGETS,
    parseTarget: parseTarget, formatTarget: formatTarget, isValidTargetFormat: isValidTargetFormat,
    listNodes: listNodes, listValidTargets: listValidTargets, nodeExists: nodeExists, getNode: getNode,
    getStartTargets: getStartTargets, outgoingTargets: outgoingTargets, allEdges: allEdges,
    reachability: reachability,
    STEP_FIELDS: STEP_FIELDS, SOLUTION_FIELDS: SOLUTION_FIELDS, OPTION_FIELDS: OPTION_FIELDS,
    KNOWN_SOLUTION_KEYS: KNOWN_SOLUTION_KEYS, KNOWN_STEP_KEYS: KNOWN_STEP_KEYS,
    lintKB: lintKB, lintParity: lintParity, parityScore: parityScore,
    SCHEMA_VERSION: '1.0'
  };

})(typeof window !== 'undefined' ? window : this);
