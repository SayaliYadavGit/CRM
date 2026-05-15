
-- =========================================================
-- 1. Roles
-- =========================================================
do $$ begin
  create type public.app_role as enum ('admin', 'ae', 'viewer');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = 'admin');
$$;

-- Read your own roles; admins read all
drop policy if exists "user_roles self read" on public.user_roles;
create policy "user_roles self read" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "user_roles admin write" on public.user_roles;
create policy "user_roles admin write" on public.user_roles
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- =========================================================
-- 2. @qitt.ae allowlist + self-claim of AE role
-- =========================================================
create or replace function public.claim_qitt_role()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select email into _email from auth.users where id = auth.uid();
  if _email is null or lower(_email) not like '%@qitt.ae' then
    raise exception 'access restricted to @qitt.ae accounts';
  end if;
  insert into public.user_roles(user_id, role) values (auth.uid(), 'ae')
    on conflict (user_id, role) do nothing;
end $$;

-- Bootstrap: grant admin to ALL existing users (they're early team members)
insert into public.user_roles(user_id, role)
  select id, 'admin'::public.app_role from auth.users
  on conflict (user_id, role) do nothing;
insert into public.user_roles(user_id, role)
  select id, 'ae'::public.app_role from auth.users
  on conflict (user_id, role) do nothing;

-- =========================================================
-- 3. Companies: lost_reason + unique + tighter RLS
-- =========================================================
alter table public.companies add column if not exists lost_reason text;

-- best-effort dedupe before adding unique index
create unique index if not exists companies_unique_name_location
  on public.companies (lower(name), lower(coalesce(location, '')));

drop policy if exists "auth all select companies" on public.companies;
drop policy if exists "auth all insert companies" on public.companies;
drop policy if exists "auth all update companies" on public.companies;
drop policy if exists "auth all delete companies" on public.companies;

create policy "companies select" on public.companies
  for select to authenticated using (true);
create policy "companies insert" on public.companies
  for insert to authenticated with check (true);
create policy "companies update" on public.companies
  for update to authenticated
  using (assigned_email = (auth.jwt() ->> 'email') or public.is_admin(auth.uid()))
  with check (assigned_email = (auth.jwt() ->> 'email') or public.is_admin(auth.uid()));
create policy "companies delete admin" on public.companies
  for delete to authenticated using (public.is_admin(auth.uid()));

-- Re-attach stage-change trigger
drop trigger if exists trg_company_stage_change on public.companies;
create trigger trg_company_stage_change
  after update on public.companies
  for each row execute function public.on_company_stage_change();

-- =========================================================
-- 4. Activities, contacts, outreach, outreach_order, queue
-- =========================================================
-- helper: can current user write to company c?
create or replace function public.can_write_company(_company_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin(auth.uid()) or exists(
    select 1 from public.companies
    where id = _company_id and assigned_email = (auth.jwt() ->> 'email')
  );
$$;

-- contacts
drop policy if exists "auth all select contacts" on public.contacts;
drop policy if exists "auth all insert contacts" on public.contacts;
drop policy if exists "auth all update contacts" on public.contacts;
drop policy if exists "auth all delete contacts" on public.contacts;
create policy "contacts read" on public.contacts for select to authenticated using (true);
create policy "contacts write" on public.contacts for insert to authenticated with check (public.can_write_company(company_id));
create policy "contacts update" on public.contacts for update to authenticated using (public.can_write_company(company_id)) with check (public.can_write_company(company_id));
create policy "contacts delete" on public.contacts for delete to authenticated using (public.can_write_company(company_id));

-- outreach
drop policy if exists "auth all select outreach" on public.outreach;
drop policy if exists "auth all insert outreach" on public.outreach;
drop policy if exists "auth all update outreach" on public.outreach;
drop policy if exists "auth all delete outreach" on public.outreach;
create policy "outreach read" on public.outreach for select to authenticated using (true);
create policy "outreach write" on public.outreach for insert to authenticated with check (public.can_write_company(company_id));
create policy "outreach update" on public.outreach for update to authenticated using (public.can_write_company(company_id)) with check (public.can_write_company(company_id));
create policy "outreach delete" on public.outreach for delete to authenticated using (public.can_write_company(company_id));

-- outreach_order
drop policy if exists "auth all select outreach_order" on public.outreach_order;
drop policy if exists "auth all insert outreach_order" on public.outreach_order;
drop policy if exists "auth all update outreach_order" on public.outreach_order;
drop policy if exists "auth all delete outreach_order" on public.outreach_order;
create policy "outreach_order read" on public.outreach_order for select to authenticated using (true);
create policy "outreach_order write" on public.outreach_order for insert to authenticated with check (public.can_write_company(company_id));
create policy "outreach_order update" on public.outreach_order for update to authenticated using (public.can_write_company(company_id)) with check (public.can_write_company(company_id));
create policy "outreach_order delete" on public.outreach_order for delete to authenticated using (public.can_write_company(company_id));

-- activities (notes + stage_change log)
drop policy if exists "auth all select activities" on public.activities;
drop policy if exists "auth all insert activities" on public.activities;
drop policy if exists "auth all update activities" on public.activities;
drop policy if exists "auth all delete activities" on public.activities;
create policy "activities read" on public.activities for select to authenticated using (true);
create policy "activities insert" on public.activities for insert to authenticated with check (true);
-- only the author or admin can edit/delete a note
create policy "activities update own" on public.activities for update to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()))
  with check (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "activities delete own" on public.activities for delete to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- queue
drop policy if exists "auth all select queue" on public.queue;
drop policy if exists "auth all insert queue" on public.queue;
drop policy if exists "auth all update queue" on public.queue;
drop policy if exists "auth all delete queue" on public.queue;
create policy "queue read" on public.queue for select to authenticated using (true);
create policy "queue insert" on public.queue for insert to authenticated with check (true);
create policy "queue update" on public.queue for update to authenticated
  using (submitted_by = auth.uid() or public.is_admin(auth.uid()))
  with check (submitted_by = auth.uid() or public.is_admin(auth.uid()));
create policy "queue delete" on public.queue for delete to authenticated using (public.is_admin(auth.uid()));

-- notifications: only your own
drop policy if exists "auth all select notifications" on public.notifications;
drop policy if exists "auth all insert notifications" on public.notifications;
drop policy if exists "auth all update notifications" on public.notifications;
drop policy if exists "auth all delete notifications" on public.notifications;
create policy "notifications self read" on public.notifications for select to authenticated
  using (user_email = (auth.jwt() ->> 'email'));
create policy "notifications insert any" on public.notifications for insert to authenticated with check (true);
create policy "notifications self update" on public.notifications for update to authenticated
  using (user_email = (auth.jwt() ->> 'email'))
  with check (user_email = (auth.jwt() ->> 'email'));
create policy "notifications self delete" on public.notifications for delete to authenticated
  using (user_email = (auth.jwt() ->> 'email'));

-- products + profile: read all, write admin
drop policy if exists "auth all select products" on public.products;
drop policy if exists "auth all insert products" on public.products;
drop policy if exists "auth all update products" on public.products;
drop policy if exists "auth all delete products" on public.products;
create policy "products read" on public.products for select to authenticated using (true);
create policy "products write admin" on public.products for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "auth all select profile" on public.profile;
drop policy if exists "auth all insert profile" on public.profile;
drop policy if exists "auth all update profile" on public.profile;
drop policy if exists "auth all delete profile" on public.profile;
create policy "profile read" on public.profile for select to authenticated using (true);
create policy "profile write admin" on public.profile for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =========================================================
-- 5. Research snapshots (versioned)
-- =========================================================
create table if not exists public.company_research (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  created_email text,
  model text,
  industry_profile text,
  process_assessment text,
  digital_maturity text,
  digital_maturity_rating text,
  ai_readiness text,
  problem_statements text,
  product_mapping_table jsonb,
  top_fits text,
  ai_recommendation text,
  confidence integer,
  relevant_products text[]
);
create index if not exists idx_company_research_company on public.company_research(company_id, created_at desc);

alter table public.company_research enable row level security;
create policy "research read" on public.company_research for select to authenticated using (true);
create policy "research insert" on public.company_research for insert to authenticated with check (public.can_write_company(company_id));

-- =========================================================
-- 6. Stuck-queue watchdog
-- =========================================================
create or replace function public.expire_stale_queue()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  n integer;
begin
  update public.queue
    set status = 'failed'
    where status = 'processing'
      and created_at < now() - interval '5 minutes';
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function public.expire_stale_queue() to authenticated;
grant execute on function public.claim_qitt_role() to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.can_write_company(uuid) to authenticated;
