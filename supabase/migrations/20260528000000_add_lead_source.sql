-- Add lead_source to companies (matches NIZARA reference UI field)
alter table public.companies
  add column if not exists lead_source text;
