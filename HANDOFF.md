# QITT CRM — Project Handoff

This document is for the engineer taking the QITT CRM codebase forward outside Lovable. It covers what's in the repo, what isn't, how to recreate the missing pieces, and how to run / deploy the app.

---

## 1. What this project is

A sales-research CRM for QITT Solutions. Authenticated `@qitt.ae` users submit leads, the system enriches them with an AI research dossier, AEs work them through a pipeline (`new → researching → qualified → outreach → meeting → proposal → won/lost`), and admins manage products + company profile.

**Stack**
- **Frontend**: React 19 + TanStack Start v1 (file-based routing in `src/routes/`), Vite 7, Tailwind v4, shadcn/ui
- **Backend**: Supabase (Postgres + Auth + Storage). Server-side logic lives in TanStack server functions (`createServerFn`) under `src/lib/*.functions.ts` — **not** Supabase Edge Functions
- **AI**: Lovable AI Gateway (`https://ai.gateway.lovable.dev`) using `google/gemini-2.5-flash` for company research
- **Hosting**: Currently published on Lovable (Cloudflare Workers under the hood). Portable to any Node/edge host that runs TanStack Start.

---

## 2. What's already in the repo (portable)

| Area | Location |
|---|---|
| Full DB schema, RLS, functions, enums, triggers | `supabase/migrations/*.sql` |
| Supabase clients (browser, server-auth, admin) | `src/integrations/supabase/` *(auto-generated — don't edit)* |
| Generated DB types | `src/integrations/supabase/types.ts` *(auto-generated)* |
| Auth context + `@qitt.ae` role claim | `src/lib/auth.tsx` |
| AI research server fn | `src/lib/research.functions.ts` |
| Routes (auth, pipeline, queue, company detail, profile, opportunities) | `src/routes/` |
| SSR error wrapping | `src/server.ts` |
| Build config | `vite.config.ts`, `wrangler.jsonc`, `package.json` |

**Database objects in migrations**
- Enums: `app_role` (`admin`, `ae`, `viewer`), `deal_stage`, `activity_type`
- Tables: `companies`, `contacts`, `activities`, `notifications`, `outreach`, `outreach_order`, `queue`, `products`, `profile`, `user_roles`, `company_research`
- SECURITY DEFINER functions: `has_role`, `is_admin`, `can_write_company`, `claim_qitt_role`, `on_company_stage_change`, `expire_stale_queue`, `set_updated_at`
- Storage bucket: `business-cards` (private)

---

## 3. What is NOT in the repo (must be recreated/exported)

| Item | Why it's not in code | How to obtain |
|---|---|---|
| **Postgres row data** (companies, queue, products, profile rows…) | Data lives in the running DB | Export from Lovable Cloud → Database → Tables → CSV per table, or `pg_dump` (see §5) |
| **Auth users** | Live in `auth.users` | Lovable Cloud → Users → Export CSV |
| **Storage files** (`business-cards/*`) | Live in Supabase Storage | Download via Storage UI or script with service role key |
| **Runtime secrets** | Stored in Lovable Cloud vault | Re-add in new host's env (see §4) |
| `.env` values | Never committed | Generate locally (see §4) |

### Secrets to retrieve from Lovable
Open Lovable → project → **Cloud → Secrets** and copy these values:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (anon)
- `SUPABASE_SERVICE_ROLE_KEY` ⚠️ server-only, bypasses RLS
- `LOVABLE_API_KEY` (for AI gateway — keep using this, or swap to your own provider)
- `SUPABASE_DB_URL` (direct Postgres connection string — for `pg_dump`)

Share these out-of-band (1Password / Bitwarden). **Never commit them.**

---

## 4. Local setup

### Prerequisites
- Node 20+ and `bun` (`npm i -g bun`) — or use `npm`/`pnpm`
- (Optional) Supabase CLI: `npm i -g supabase`

### Steps
```bash
git clone <repo-url> qitt-crm
cd qitt-crm
bun install
cp .env.example .env   # then fill in values below
bun run dev            # http://localhost:8080
```

### `.env` template
Create `.env` in the project root:
```ini
# Client-side (Vite exposes VITE_* to the browser bundle)
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=<project-ref>

# Server-side (TanStack server functions / SSR)
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # admin client — keep secret
LOVABLE_API_KEY=<lovable-ai-gateway-key>       # or your own AI provider key
```

> The repo currently has `.env` committed with the Lovable Cloud anon values. **Do not commit a `.env` with the service role key.** Add it to `.gitignore` once you move off Lovable.

---

## 5. Backend migration — two paths

### Path A — Keep the existing Lovable Cloud Supabase project (fastest)
Nothing to migrate. Just use the env values above pointing at `owametghzownzrfbinnm.supabase.co`. Recommended if Lovable will continue to manage the database.

### Path B — Stand up a fresh Supabase project (full self-host)

**1. Create the project** at <https://supabase.com> and note the project ref.

**2. Apply schema** (replays every migration in `supabase/migrations/`):
```bash
supabase login
supabase link --project-ref <new-ref>
supabase db push
```
This recreates every table, RLS policy, function, enum, trigger, and the `business-cards` storage bucket.

**3. Export data from the old project**
```bash
# Per-table CSV (simple)
# Use Supabase Studio → Table editor → Export

# Or full SQL dump (preserves everything except auth.users passwords)
pg_dump "$OLD_SUPABASE_DB_URL" \
  --data-only \
  --schema=public \
  --no-owner --no-privileges \
  -f data.sql
```

**4. Import data into the new project**
```bash
psql "$NEW_SUPABASE_DB_URL" -f data.sql
```
> Order matters if you split per-table: load `companies` before `contacts`/`activities`/`outreach`/`company_research` (no FK constraints in this schema, but row-references assume the parent exists).

**5. Migrate auth users**
Use Supabase's [auth migration guide](https://supabase.com/docs/guides/auth/auth-helpers/migration). Passwords are hashed — you can copy `auth.users` rows directly via SQL with the service role, or invite users via the dashboard and they reset their password.

**6. Copy storage files**
```bash
# Download from old bucket
supabase storage cp -r ss:///business-cards ./business-cards-backup

# Upload to new bucket
supabase storage cp -r ./business-cards-backup ss:///business-cards
```
(Or use the Storage UI for small datasets.)

**7. Update `.env`** with the new project's URL and keys. Restart dev server.

---

## 6. Granting yourself admin

The app restricts writes to `@qitt.ae` users; admins can edit any company, manage products, and edit the QITT profile. To grant admin:

```sql
-- Run in Supabase SQL editor as service role
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@qitt.ae'
on conflict (user_id, role) do nothing;
```

The first time any `@qitt.ae` user signs in, `claim_qitt_role()` auto-grants them the `ae` role.

---

## 7. Running, building, deploying

```bash
bun run dev      # local dev server
bun run build    # production build
bun run start    # serve the built app
```

### Deploy targets
- **Cloudflare Workers** (current Lovable setup): `wrangler deploy` after setting secrets via `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` etc. `wrangler.jsonc` already configured.
- **Vercel / Netlify / Node host**: TanStack Start has adapters; swap the build target in `vite.config.ts`. Set the same env vars in the host's dashboard.
- **Lovable**: just click Publish — frontend updates need an explicit publish, backend (DB + server fns) deploys on every save.

### Runtime constraints to remember
The current build targets Cloudflare Workers (with `nodejs_compat`). If you stay on Workers, avoid: `child_process`, `sharp`, `puppeteer`, `fs.watch`, packages that need native `.node` binaries. Safe: `fs`, `crypto`, `Buffer`, `stream`, `fetch`. Move to a Node host if you need any of the above.

---

## 8. Pending / known TODO

These were flagged but not finished before handoff:

1. **LLM wiring on the company detail page** — `researchCompany` server fn exists but isn't yet invoked from a "Run research" button on `/companies/$companyId`. The UI still calls `mock-pipeline.ts`.
2. **Research history viewer** — `company_research` table stores versioned snapshots, but no UI lists prior runs / diffs.
3. **Outreach email generation** — `outreach` table is populated by mock data; needs an LLM-backed server fn similar to `researchCompany`.
4. **Queue → company promotion flow** — `queue` rows currently get manually converted; should be a one-click action that creates `companies` row, runs research, and marks queue item processed.
5. **Notifications UI** — `notifications` table + trigger exist; no bell/inbox component in the shell.
6. **Email auth confirmation** — currently uses default Supabase email templates; wire branded templates via Lovable Email or your own SMTP.

---

## 9. Useful commands

```bash
# Regenerate Supabase types after a migration
supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts

# Inspect a query as a user (RLS applies)
psql "$SUPABASE_DB_URL"

# Tail server function logs (Cloudflare)
wrangler tail

# Lint / typecheck
bun run lint
```

---

## 10. Contact / open questions

Leave open questions for the original team in this section as they come up. Things to confirm before going live:

- Final list of `@qitt.ae` admins
- Whether to keep the Lovable AI gateway or swap to direct OpenAI/Gemini keys (cost vs. simplicity)
- Custom domain (currently `qitt-crm.lovable.app`)
- Backup strategy (Supabase paid plans include PITR; free tier needs nightly `pg_dump`)

---

_Generated for the QITT CRM handoff. Keep this file up to date as the project evolves._
