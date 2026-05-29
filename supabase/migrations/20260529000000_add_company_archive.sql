-- Archive support for companies (mirrors products.archived pattern)
alter table public.companies
  add column if not exists archived boolean not null default false,
  add column if not exists archived_date timestamptz;

-- Index for the common "active companies" filter
create index if not exists companies_archived_idx on public.companies(archived) where archived = false;
