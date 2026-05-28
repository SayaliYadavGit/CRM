-- Add priority_tier (text) to companies for High/Medium/Low display.
-- Numeric priority (int) preserved for manual ranking where present.
alter table public.companies
  add column if not exists priority_tier text;
