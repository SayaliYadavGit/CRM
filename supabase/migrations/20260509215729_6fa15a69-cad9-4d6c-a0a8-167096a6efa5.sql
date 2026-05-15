
-- Enums
create type public.deal_stage as enum (
  'new','researched','contact_identified','contacted',
  'meeting_booked','proposal_sent','contract_signed','won','lost'
);

create type public.activity_type as enum ('note','stage_change','system');

-- updated_at trigger fn
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- companies
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  industry text,
  stage public.deal_stage not null default 'new',
  confidence integer default 0,
  priority integer default 0,
  assigned_email text,
  deal_value numeric,
  relevant_products text[] default '{}',
  industry_profile text,
  process_assessment text,
  digital_maturity_rating text,
  digital_maturity text,
  ai_readiness text,
  problem_statements text,
  product_mapping_table text,
  top_fits text,
  ai_recommendation text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_companies_updated before update on public.companies
  for each row execute function public.set_updated_at();

-- contacts
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  title text,
  department text,
  linkedin text,
  twitter text,
  found_on text,
  profile text,
  recent_activity text,
  why text,
  outreach_angle text,
  source text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

-- outreach
create table public.outreach (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_name text,
  department text,
  linkedin_connect text,
  linkedin_followup text,
  email_subject text,
  email_body text,
  created_at timestamptz not null default now()
);

-- outreach_order
create table public.outreach_order (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  rank integer not null,
  contact_name text,
  reason text
);

-- activities
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid,
  user_email text,
  type public.activity_type not null default 'note',
  content text,
  old_stage public.deal_stage,
  new_stage public.deal_stage,
  created_at timestamptz not null default now()
);

-- queue
create table public.queue (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  location text,
  contact_name text,
  contact_title text,
  contact_email text,
  contact_phone text,
  notes text,
  status text not null default 'pending',
  submitted_by uuid,
  submitted_email text,
  has_card boolean default false,
  card_name text,
  card_data text,
  company_id uuid references public.companies(id) on delete set null,
  created_at timestamptz not null default now()
);

-- profile (single row)
create table public.profile (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  tagline text,
  about text,
  founded text,
  presence text,
  model text,
  team_size text,
  sectors text,
  certifications text,
  website text,
  metrics jsonb default '[]'::jsonb,
  value_props text[] default '{}',
  updated_at timestamptz not null default now()
);
create trigger trg_profile_updated before update on public.profile
  for each row execute function public.set_updated_at();

-- products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subtitle text,
  what text,
  who text,
  capabilities text[] default '{}',
  problems text[] default '{}',
  differentiators text[] default '{}',
  notes text[] default '{}',
  archived boolean not null default false,
  archived_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();

-- notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_email text,
  company_id uuid references public.companies(id) on delete cascade,
  type text,
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Stage change auto-log
create or replace function public.on_company_stage_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    insert into public.activities(company_id, type, old_stage, new_stage, content, user_email)
    values (new.id, 'stage_change', old.stage, new.stage,
            'Stage changed from ' || old.stage::text || ' to ' || new.stage::text,
            new.assigned_email);
    if new.assigned_email is not null then
      insert into public.notifications(user_email, company_id, type, message)
      values (new.assigned_email, new.id, 'stage_change',
              new.name || ' moved to ' || new.stage::text);
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_company_stage_change after update on public.companies
  for each row execute function public.on_company_stage_change();

-- RLS
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.outreach enable row level security;
alter table public.outreach_order enable row level security;
alter table public.activities enable row level security;
alter table public.queue enable row level security;
alter table public.profile enable row level security;
alter table public.products enable row level security;
alter table public.notifications enable row level security;

-- Authenticated users full access (team app)
do $$
declare t text;
begin
  for t in select unnest(array['companies','contacts','outreach','outreach_order','activities','queue','profile','products','notifications'])
  loop
    execute format('create policy "auth all select %1$s" on public.%1$s for select to authenticated using (true);', t);
    execute format('create policy "auth all insert %1$s" on public.%1$s for insert to authenticated with check (true);', t);
    execute format('create policy "auth all update %1$s" on public.%1$s for update to authenticated using (true) with check (true);', t);
    execute format('create policy "auth all delete %1$s" on public.%1$s for delete to authenticated using (true);', t);
  end loop;
end $$;

-- Realtime
alter publication supabase_realtime add table public.companies;
alter publication supabase_realtime add table public.queue;
alter publication supabase_realtime add table public.activities;
alter publication supabase_realtime add table public.notifications;
alter table public.companies replica identity full;
alter table public.queue replica identity full;
alter table public.activities replica identity full;
alter table public.notifications replica identity full;

-- Storage bucket
insert into storage.buckets (id, name, public) values ('business-cards','business-cards', false)
on conflict (id) do nothing;

create policy "auth read cards" on storage.objects for select to authenticated
  using (bucket_id = 'business-cards');
create policy "auth upload cards" on storage.objects for insert to authenticated
  with check (bucket_id = 'business-cards');
create policy "auth delete cards" on storage.objects for delete to authenticated
  using (bucket_id = 'business-cards');
