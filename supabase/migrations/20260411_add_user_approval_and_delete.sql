alter table public.user_profiles
add column if not exists approved boolean not null default false;

alter table public.user_profiles
add column if not exists approved_at timestamptz;

alter table public.user_profiles
add column if not exists approved_by uuid references auth.users (id) on delete set null;

update public.user_profiles
set approved = true,
    approved_at = coalesce(approved_at, created_at)
where approved = false;

create or replace function public.delete_user_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admin can delete accounts.';
  end if;

  if target_user_id is null then
    raise exception 'Missing user id.';
  end if;

  delete from auth.users
  where id = target_user_id;
end;
$$;

revoke all on function public.delete_user_account(uuid) from public;
grant execute on function public.delete_user_account(uuid) to authenticated;
