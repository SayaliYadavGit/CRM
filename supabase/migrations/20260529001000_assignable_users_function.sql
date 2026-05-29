-- Returns list of users who can own leads/deals.
-- Includes only users with admin or ae role (excludes viewers).
-- Runs with elevated privileges so app code can read auth.users without direct table grants.

create or replace function public.get_assignable_users()
returns table(email text, role app_role)
language sql
security definer
set search_path = public, auth
as $$
  select au.email::text, ur.role
  from public.user_roles ur
  join auth.users au on au.id = ur.user_id
  where ur.role in ('admin', 'ae')
  order by au.email;
$$;

-- Allow any authenticated user to call this function
grant execute on function public.get_assignable_users() to authenticated;
