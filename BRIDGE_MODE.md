# Bridge Mode — Cowork Research (May 2026 — ~3 weeks)

## Why this exists

QITT is cost-conscious during its early stage. The OpenAI research engine
(see `src/lib/research.functions.ts`) costs roughly $1-2 per company. For the
first 50 prospects, Minakshi opted to do the research through Cowork on her
Mac instead, which consumes her Claude Max plan tokens (no per-analysis cost).

This bridge runs for approximately 3 weeks. After that, the OpenAI engine is
re-enabled and Cowork's role ends.

## What changes in bridge mode

| Behaviour | OpenAI mode (default / future) | Cowork mode (current bridge) |
|---|---|---|
| Submit lead via form | Auto-triggers OpenAI research immediately | Queues only; status stays "pending" |
| Where AI runs | Server-side, Cloudflare → OpenAI API | Minakshi's Mac, Cowork → Claude API (via her Max plan) |
| Who triggers AI | Automatic on form submit | Minakshi manually runs Cowork task |
| Cost per company | ~$1-2 OpenAI | $0 (covered by Max plan) |
| Re-run research on existing company | Works (re-calls OpenAI) | Blocked with friendly error |

## How the switch is implemented

A single environment variable `RESEARCH_MODE` controls everything:

- `RESEARCH_MODE=openai` — yesterday's flow (default, used pre-bridge and post-bridge)
- `RESEARCH_MODE=cowork` — current bridge flow

The check happens in two places only:
- `src/lib/research.functions.ts` — refuses to call OpenAI in cowork mode
- `src/lib/mock-pipeline.ts` — queue submissions don't auto-trigger research in cowork mode

Yesterday's OpenAI engine code is **preserved untouched**. We're not deleting
anything, just gating it behind the flag.

## How Cowork writes research back into the CRM

A separate file `src/lib/cowork-bridge.functions.ts` exposes two endpoints
that Cowork calls during bridge mode:

- `listPendingLeadsForCowork` — Cowork polls this to get the list of leads
  awaiting research (queue rows with `status='pending'`)
- `submitDossierFromCowork` — Cowork POSTs the full research dossier here
  when it's done with a lead

Both endpoints are protected by a shared-secret token (`COWORK_BRIDGE_TOKEN`).
This token must be set in both:
1. The deployment environment (Cloudflare Workers env var)
2. Minakshi's Cowork task configuration (see `COWORK_TASK.md`)

Both endpoints use the same translation/formatter logic as `mock-pipeline.ts`,
so the database rows they write are **identical in shape** to what the OpenAI
path produces. No data migration is needed when we switch back.

## How to switch back to OpenAI (3 weeks from now, ~5 min)

1. In Cloudflare Workers env vars, change:
   - `RESEARCH_MODE=openai` (was `cowork`)
   - Add `OPENAI_API_KEY` if not already set
2. Redeploy.
3. Verify by submitting one test lead through the form — it should auto-trigger
   OpenAI research within 2-4 minutes.
4. Optional cleanup (not required, but tidy):
   - Delete `src/lib/cowork-bridge.functions.ts` — no longer used
   - Delete this file (`BRIDGE_MODE.md`)
   - Delete `COWORK_TASK.md`
   - Remove `COWORK_BRIDGE_TOKEN` env var from Cloudflare

## Environment variables required

### During bridge (cowork mode)
## Migration to new Supabase (current session)

Project migrated from Lovable Cloud Supabase (owametghzownzrfbinnm) to a
fresh Supabase project (vyumjlvwohnwrbwffmzo) under personal account.
Old project preserved but no longer in use.

Reason: Lovable Cloud project's service-role key was hard to retrieve
cleanly, blocking Cowork bridge setup. Fresh project gave clean control
over auth, keys, and ownership.

Schema reapplied via supabase db push. Data NOT migrated — fresh start
with new companies + future leads.

Auth: email confirmation disabled (internal tool, @qitt.ae restricted).
Users created manually via Supabase Studio with Auto Confirm.

Service-role key rotation schedule still applies (Day 7, 14, 21).
Ownership transfer to QITT org account TBD before bridge ends.
