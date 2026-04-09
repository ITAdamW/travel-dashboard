create table if not exists public.countries (
  id text primary key,
  country_name text not null,
  status text not null default 'planned',
  year text not null default '',
  region text not null default '',
  summary text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.destinations (
  id text primary key,
  country_id text not null references public.countries(id) on delete cascade,
  name text not null,
  area text not null default '',
  video text not null default '',
  summary text not null default '',
  itinerary jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.places (
  id text primary key,
  destination_id text not null references public.destinations(id) on delete cascade,
  name text not null,
  category text not null default 'city',
  latitude double precision not null default 0,
  longitude double precision not null default 0,
  note text not null default '',
  status text not null default 'planned',
  subtitle text not null default '',
  description text not null default '',
  image text not null default '',
  gallery jsonb not null default '[]'::jsonb,
  video text not null default '',
  videos jsonb not null default '[]'::jsonb,
  rating double precision not null default 0,
  info text not null default '',
  ticket text not null default '',
  reservation text not null default '',
  paid text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.countries enable row level security;
alter table public.destinations enable row level security;
alter table public.places enable row level security;

drop policy if exists "authenticated can select countries" on public.countries;
drop policy if exists "authenticated can insert countries" on public.countries;
drop policy if exists "authenticated can update countries" on public.countries;
drop policy if exists "authenticated can delete countries" on public.countries;

create policy "authenticated can select countries"
on public.countries
for select
to authenticated
using (true);

create policy "authenticated can insert countries"
on public.countries
for insert
to authenticated
with check (true);

create policy "authenticated can update countries"
on public.countries
for update
to authenticated
using (true)
with check (true);

create policy "authenticated can delete countries"
on public.countries
for delete
to authenticated
using (true);

drop policy if exists "authenticated can select destinations" on public.destinations;
drop policy if exists "authenticated can insert destinations" on public.destinations;
drop policy if exists "authenticated can update destinations" on public.destinations;
drop policy if exists "authenticated can delete destinations" on public.destinations;

create policy "authenticated can select destinations"
on public.destinations
for select
to authenticated
using (true);

create policy "authenticated can insert destinations"
on public.destinations
for insert
to authenticated
with check (true);

create policy "authenticated can update destinations"
on public.destinations
for update
to authenticated
using (true)
with check (true);

create policy "authenticated can delete destinations"
on public.destinations
for delete
to authenticated
using (true);

drop policy if exists "authenticated can select places" on public.places;
drop policy if exists "authenticated can insert places" on public.places;
drop policy if exists "authenticated can update places" on public.places;
drop policy if exists "authenticated can delete places" on public.places;

create policy "authenticated can select places"
on public.places
for select
to authenticated
using (true);

create policy "authenticated can insert places"
on public.places
for insert
to authenticated
with check (true);

create policy "authenticated can update places"
on public.places
for update
to authenticated
using (true)
with check (true);

create policy "authenticated can delete places"
on public.places
for delete
to authenticated
using (true);
