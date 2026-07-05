alter table public.planner_plans
add column if not exists owner_user_id uuid references auth.users (id) on delete set null;

create table if not exists public.planner_plan_shares (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.planner_plans(id) on delete cascade,
  share_type text not null check (share_type in ('user', 'group')),
  target_user_id uuid references auth.users (id) on delete cascade,
  target_group_role text check (target_group_role in ('user', 'admin')),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint planner_plan_shares_target_check check (
    (share_type = 'user' and target_user_id is not null and target_group_role is null)
    or
    (share_type = 'group' and target_group_role is not null and target_user_id is null)
  ),
  constraint planner_plan_shares_unique_user unique (plan_id, target_user_id),
  constraint planner_plan_shares_unique_group unique (plan_id, target_group_role)
);

alter table public.planner_plan_shares enable row level security;

create or replace function public.can_read_planner_plan(
  check_plan_id text,
  check_owner_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_admin_user(auth.uid())
    or check_owner_user_id is null
    or check_owner_user_id = auth.uid()
    or exists (
      select 1
      from public.planner_plan_shares shares
      where shares.plan_id = check_plan_id
        and (
          shares.target_user_id = auth.uid()
          or exists (
            select 1
            from public.user_profiles profiles
            where profiles.id = auth.uid()
              and profiles.role = shares.target_group_role
          )
        )
    );
$$;

create or replace function public.can_manage_planner_plan(check_plan_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_admin_user(auth.uid())
    or exists (
      select 1
      from public.planner_plans plans
      where plans.id = check_plan_id
        and (plans.owner_user_id is null or plans.owner_user_id = auth.uid())
    );
$$;

drop policy if exists "authenticated can select planner_plans" on public.planner_plans;
drop policy if exists "authenticated can insert planner_plans" on public.planner_plans;
drop policy if exists "authenticated can update planner_plans" on public.planner_plans;
drop policy if exists "authenticated can delete planner_plans" on public.planner_plans;

create policy "planner_plans_select_owner_admin_shared"
on public.planner_plans
for select
to authenticated
using (
  public.can_read_planner_plan(id, owner_user_id)
);

create policy "planner_plans_insert_owner_or_admin"
on public.planner_plans
for insert
to authenticated
with check (
  public.is_admin_user(auth.uid())
  or owner_user_id = auth.uid()
);

create policy "planner_plans_update_owner_or_admin"
on public.planner_plans
for update
to authenticated
using (
  public.is_admin_user(auth.uid())
  or owner_user_id is null
  or owner_user_id = auth.uid()
)
with check (
  public.is_admin_user(auth.uid())
  or owner_user_id is null
  or owner_user_id = auth.uid()
);

create policy "planner_plans_delete_owner_or_admin"
on public.planner_plans
for delete
to authenticated
using (
  public.is_admin_user(auth.uid())
  or owner_user_id is null
  or owner_user_id = auth.uid()
);

revoke all on function public.can_read_planner_plan(text, uuid) from public;
revoke all on function public.can_manage_planner_plan(text) from public;
grant execute on function public.can_read_planner_plan(text, uuid) to authenticated;
grant execute on function public.can_manage_planner_plan(text) to authenticated;

drop policy if exists "planner_plan_shares_select_related" on public.planner_plan_shares;
drop policy if exists "planner_plan_shares_insert_owner_or_admin" on public.planner_plan_shares;
drop policy if exists "planner_plan_shares_delete_owner_or_admin" on public.planner_plan_shares;

create policy "planner_plan_shares_select_related"
on public.planner_plan_shares
for select
to authenticated
using (
  public.is_admin_user(auth.uid())
  or target_user_id = auth.uid()
  or public.can_manage_planner_plan(plan_id)
  or exists (
    select 1
    from public.user_profiles profiles
    where profiles.id = auth.uid()
      and profiles.role = planner_plan_shares.target_group_role
  )
);

create policy "planner_plan_shares_insert_owner_or_admin"
on public.planner_plan_shares
for insert
to authenticated
with check (
  public.can_manage_planner_plan(plan_id)
);

create policy "planner_plan_shares_delete_owner_or_admin"
on public.planner_plan_shares
for delete
to authenticated
using (
  public.can_manage_planner_plan(plan_id)
);

drop policy if exists "user_profiles_select_shareable" on public.user_profiles;
create policy "user_profiles_select_shareable"
on public.user_profiles
for select
to authenticated
using (
  approved = true
);
