create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  login text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.is_admin_user(check_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = check_user_id
      and role = 'admin'
  );
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;

create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_user_profiles_updated_at();

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select_own_or_admin" on public.user_profiles;
create policy "user_profiles_select_own_or_admin"
on public.user_profiles
for select
to authenticated
using (
  auth.uid() = id
  or public.is_admin_user(auth.uid())
);

drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own"
on public.user_profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "user_profiles_update_own_or_admin" on public.user_profiles;
create policy "user_profiles_update_own_or_admin"
on public.user_profiles
for update
to authenticated
using (
  auth.uid() = id
  or public.is_admin_user(auth.uid())
)
with check (
  auth.uid() = id
  or public.is_admin_user(auth.uid())
);
