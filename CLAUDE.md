# HORECA

## Om projektet
- Maximillian är produktägare för produkter som används av personal inom commercial hospitality (HORECA-branschen)
- Företaget är Bluewater
- Projektet byggs med HTML, CSS och JavaScript (ingen React, inget byggsteg)
- Koden sparas på GitHub, publiceras med Vercel, och data sparas i Supabase

## Första appen: Support-app för Café Station 1™
- Personal på caféer som har problem med Café Station ska kunna klicka sig fram till en lösning själva
- Steg-för-steg felsökning: börjar brett (vatten? ljus?) och smalnar av till specifika delar
- Varje steg har en "Vet ej"-knapp
- Lösningar kan innehålla Vimeo-videolänkar
- All användning loggas i Supabase
- Rapport skickas via mail när session avslutas (svar fått eller 30 min inaktivitet)
- Café Station 1 är första produkten, fler ska kunna läggas till senare

## Design
- Ren, modern stil med mycket vit yta
- Huvudfärg: Bluewater-blå
- Accentfärg: brun/koppar (som i "Café")
- Knappar: mörk marinblå
- Typografi: stilren, professionell

<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->
