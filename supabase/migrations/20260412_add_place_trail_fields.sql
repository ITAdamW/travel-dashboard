alter table public.places
  add column if not exists distance_km double precision not null default 0,
  add column if not exists duration_hours double precision not null default 0,
  add column if not exists route_path jsonb not null default '[]'::jsonb;

update public.places
set category = 'trail'
where category <> 'trail'
  and (
    lower(name) like '%levada%'
    or lower(name) like '%vereda%'
    or name ~* '\mPR\s*[0-9]+'
  );
