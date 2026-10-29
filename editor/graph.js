/* graph.js — Cytoscape decision-graph view. Reads a KB via window.BWKB. */
(function (global) {
  'use strict';
  var cy = null;
  var onSelectCb = null;

  if (global.cytoscape && global.cytoscapeDagre) {
    try { global.cytoscape.use(global.cytoscapeDagre); } catch (e) {}
  }

  function shortLabel(n, KB) {
    if (n.type === 'end') return n.id === 'resolved' ? '✓ resolved' : '✗ not resolved';
    var title = '';
    if (n.node) title = n.node.title || n.node.question || '';
    if (title.length > 42) title = title.slice(0, 40) + '…';
    return n.id + (title ? '\n' + title : '');
  }

  function buildElements(KB) {
    var BW = global.BWKB;
    var starts = {}; BW.getStartTargets(KB).forEach(function (t) { starts[t] = true; });
    var reach = BW.reachability(KB);
    var els = [];
    BW.listNodes(KB).forEach(function (n) {
      var cls = n.type;
      if (n.type === 'end') cls = n.id === 'resolved' ? 'end ok' : 'end bad';
      else if (starts[n.target]) cls += ' start';
      if (!reach[n.target] && n.type !== 'end') cls += ' unreachable';
      els.push({ data: { id: n.target, label: shortLabel(n, KB), type: n.type }, classes: cls });
    });
    BW.allEdges(KB).forEach(function (e, i) {
      // Only draw edges to nodes that exist (dangling ones are flagged in lint).
      if (!BW.nodeExists(KB, e.to)) return;
      var lbl = e.label || '';
      if (lbl.length > 24) lbl = lbl.slice(0, 22) + '…';
      els.push({ data: { id: 'e' + i + '_' + e.from + '__' + e.to, source: e.from, target: e.to, label: lbl, via: e.via } });
    });
    return els;
  }

  var STYLE = [
    { selector: 'node', style: {
        'label': 'data(label)', 'text-wrap': 'wrap', 'text-max-width': '150px',
        'font-size': '11px', 'text-valign': 'center', 'text-halign': 'center',
        'color': '#fff', 'background-color': '#52525b', 'shape': 'round-rectangle',
        'width': 'label', 'height': 'label', 'padding': '12px',
        'text-justification': 'center', 'line-height': 1.25,
        'border-width': 2, 'border-color': 'rgba(0,0,0,0)' } },
    { selector: 'node.solution', style: { 'background-color': '#2563eb' } },
    { selector: 'node.start', style: { 'background-color': '#0a2fb6', 'border-color': '#0a2fb6' } },
    { selector: 'node.end.ok', style: { 'background-color': '#21c45e', 'shape': 'round-pentagon' } },
    { selector: 'node.end.bad', style: { 'background-color': '#f43f5e', 'shape': 'round-pentagon' } },
    { selector: 'node.unreachable', style: { 'opacity': 0.35, 'border-style': 'dashed', 'border-color': '#f43f5e' } },
    { selector: 'node:selected', style: { 'border-width': 4, 'border-color': '#f59e0b' } },
    { selector: 'node.dim', style: { 'opacity': 0.12 } },
    { selector: 'node.hit', style: { 'border-width': 4, 'border-color': '#f59e0b' } },
    { selector: 'edge', style: {
        'label': 'data(label)', 'font-size': '9px', 'color': '#52525b',
        'text-background-color': '#f5f5f7', 'text-background-opacity': 1, 'text-background-padding': '2px',
        'curve-style': 'bezier', 'width': 1.5, 'line-color': '#a1a1aa',
        'target-arrow-color': '#a1a1aa', 'target-arrow-shape': 'triangle', 'arrow-scale': 0.9 } },
    { selector: 'edge[via *= "not_solved"]', style: { 'line-color': '#f43f5e', 'target-arrow-color': '#f43f5e' } },
    { selector: 'edge[via *= "solved"]', style: { 'line-color': '#21c45e', 'target-arrow-color': '#21c45e' } },
    { selector: 'edge.dim', style: { 'opacity': 0.08 } }
  ];

  function render(KB, onSelect) {
    onSelectCb = onSelect || onSelectCb;
    if (cy) { cy.destroy(); cy = null; }
    cy = global.cytoscape({
      container: document.getElementById('cy'),
      elements: buildElements(KB),
      style: STYLE,
      wheelSensitivity: 0.2,
      minZoom: 0.15, maxZoom: 2.5
    });
    cy.on('tap', 'node', function (evt) { if (onSelectCb) onSelectCb(evt.target.id()); });
    layout();
  }

  function layout() {
    if (!cy) return;
    cy.layout({ name: 'dagre', rankDir: 'TB', nodeSep: 30, rankSep: 60, edgeSep: 12, padding: 30 }).run();
  }
  function fit() { if (cy) cy.fit(null, 40); }

  function focus(target) {
    if (!cy) return;
    var n = cy.getElementById(target);
    if (!n || n.empty()) return;
    cy.nodes().unselect();
    n.select();
    cy.animate({ center: { eles: n }, zoom: Math.max(cy.zoom(), 0.9) }, { duration: 250 });
  }

  // Rebuild a single node's label/classes after an edit without full relayout.
  function refresh(KB) {
    if (!cy) return render(KB, onSelectCb);
    var sel = cy.$(':selected').map(function (n) { return n.id(); });
    var pos = {};
    cy.nodes().forEach(function (n) { pos[n.id()] = Object.assign({}, n.position()); });
    cy.json({ elements: buildElements(KB) });
    cy.nodes().forEach(function (n) { if (pos[n.id()]) n.position(pos[n.id()]); });
    // new nodes (no saved position) need a layout pass
    var needsLayout = cy.nodes().some(function (n) { return !pos[n.id()]; });
    if (needsLayout) layout();
    sel.forEach(function (id) { var e = cy.getElementById(id); if (e) e.select(); });
  }

  function search(term) {
    if (!cy) return;
    term = (term || '').toLowerCase();
    cy.batch(function () {
      cy.nodes().removeClass('hit dim');
      if (!term) return;
      cy.nodes().forEach(function (n) {
        var hit = n.id().toLowerCase().indexOf(term) !== -1 ||
                  (n.data('label') || '').toLowerCase().indexOf(term) !== -1;
        n.addClass(hit ? 'hit' : 'dim');
      });
    });
  }

  // Dim everything not in the subtree reachable from an issue's start_step.
  function filterIssue(KB, startStepId) {
    if (!cy) return;
    cy.batch(function () {
      cy.elements().removeClass('dim');
      if (!startStepId) return;
      var keep = {}; var queue = ['step:' + startStepId]; keep['step:' + startStepId] = true;
      var BW = global.BWKB;
      while (queue.length) {
        var cur = queue.shift(); var p = BW.parseTarget(cur);
        if (p.kind !== 'step' && p.kind !== 'solution') continue;
        BW.outgoingTargets(KB, p.kind, p.id).forEach(function (e) {
          if (!keep[e.target] && BW.nodeExists(KB, e.target)) { keep[e.target] = true; queue.push(e.target); }
        });
      }
      cy.nodes().forEach(function (n) { if (!keep[n.id()]) n.addClass('dim'); });
      cy.edges().forEach(function (e) { if (!keep[e.source().id()] || !keep[e.target().id()]) e.addClass('dim'); });
    });
  }

  function dimUnreachable(on) {
    if (!cy) return;
    cy.nodes('.unreachable').forEach(function (n) { n.style('display', on ? 'element' : 'element'); });
    // toggle is purely visual emphasis; unreachable already styled. No-op kept for API.
  }

  global.Graph = { render: render, layout: layout, fit: fit, focus: focus,
    refresh: refresh, search: search, filterIssue: filterIssue, dimUnreachable: dimUnreachable };
})(window);
