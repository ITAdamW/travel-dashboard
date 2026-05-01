alter table public.planner_plans
add column if not exists is_favorite boolean not null default false;
