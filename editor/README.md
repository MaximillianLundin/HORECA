# Bluewater Support Tool Editor

A product-agnostic, browser-based visual editor for the support/troubleshooting
knowledge bases (KBs) rendered by `../app.js`. No build step — plain HTML/CSS/JS,
matching the renderer.

## Run

Serve the repo root over HTTP (the editor `fetch`es `../data/*.json` and the
Supabase bucket, so `file://` won't work):

```
python3 -m http.server 8778
# open http://localhost:8778/editor/
```

## Single source of truth

`../schema/kb-schema.js` defines `window.BWKB` — the grammar (`step:` / `solution:`
/ `end:`), node enumeration, valid-target lists, field specs, and all lint rules.
Both this editor and (eventually) `../app.js` read it, so the two can never drift.
`../schema/kb.schema.json` is the machine-checkable JSON Schema contract.

## Files

| File | Role |
|---|---|
| `index.html` | shell: load bar, graph canvas, node panel, lint drawer |
| `editor.js` | orchestration: load (local/remote/file), parity base, export, wiring |
| `graph.js` | Cytoscape + dagre decision-graph view |
| `panel.js` | node editor — auto-renders from `BWKB` field specs; safe target pickers |
| `lint.js` | runs `BWKB.lintKB` + `lintParity`, renders findings (click → focus node) |
| `deploy.js` | preview→approve gate (upload intentionally NOT wired — see below) |
| `products.json` | product + language registry, Supabase read config |

## What it does

- **Load** any product/language KB from `../data/`, the public Supabase bucket, or a
  picked file.
- **Graph** of the whole decision tree (steps/solutions/ends), colored by type,
  reordered with dagre. Search, per-issue subtree filter, unreachable highlighting.
- **Edit** every field of a node. Rewire `next` via dropdowns built from the live
  node list → links can't be pointed at something that doesn't exist. Add/delete/
  rename nodes (rename repoints all inbound links + `issue.start_step`).
- **Validate**: dangling links, unreachable nodes, dead-ends, both-nav solutions,
  reachable placeholders, unknown keys, issue integrity, and **language parity**
  (missing nodes, branch-count mismatch, divergent `next` targets, untranslated
  labels) against a chosen base language.
- **Export** schema-conformant JSON (round-trip safe).

## Deploy is gated (Phase 4, not yet wired)

Uploading to the Supabase bucket needs a `service_role` key, which must never live
in the browser. The `Deploy…` button only previews the payload and version bump.
Real deploy requires the `/api/deploy-kb` serverless endpoint (holds the key
server-side, re-validates, uploads) **plus explicit human approval per deploy**.

## Known limitation

Parity compares options **positionally**, so reordered (but otherwise equivalent)
options show as `next_divergence`. Useful signal, some noise — refine later.
