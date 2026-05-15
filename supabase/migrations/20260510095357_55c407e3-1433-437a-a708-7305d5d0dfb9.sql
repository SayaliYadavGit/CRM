
-- Fix search_path on legacy function
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;

-- Revoke from anon/public, keep authenticated
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_admin(uuid) from public, anon;
revoke execute on function public.can_write_company(uuid) from public, anon;
revoke execute on function public.claim_qitt_role() from public, anon;
revoke execute on function public.expire_stale_queue() from public, anon;
revoke execute on function public.on_company_stage_change() from public, anon;
revoke execute on function public.set_updated_at() from public, anon;

-- Tighten activities insert: must be by the caller, or system (null user_id)
drop policy if exists "activities insert" on public.activities;
create policy "activities insert" on public.activities for insert to authenticated
  with check (user_id is null or user_id = auth.uid());
