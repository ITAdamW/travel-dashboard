create table if not exists public.guide_layouts (
  destination_id text primary key references public.destinations(id) on delete cascade,
  pages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guide_layouts enable row level security;

drop policy if exists "authenticated can select guide layouts" on public.guide_layouts;
drop policy if exists "authenticated can insert guide layouts" on public.guide_layouts;
drop policy if exists "authenticated can update guide layouts" on public.guide_layouts;
drop policy if exists "authenticated can delete guide layouts" on public.guide_layouts;

create policy "authenticated can select guide layouts"
on public.guide_layouts
for select
to authenticated
using (true);

create policy "authenticated can insert guide layouts"
on public.guide_layouts
for insert
to authenticated
with check (true);

create policy "authenticated can update guide layouts"
on public.guide_layouts
for update
to authenticated
using (true)
with check (true);

create policy "authenticated can delete guide layouts"
on public.guide_layouts
for delete
to authenticated
using (true);
