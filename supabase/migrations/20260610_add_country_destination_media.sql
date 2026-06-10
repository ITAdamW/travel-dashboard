alter table public.countries
add column if not exists image text not null default '',
add column if not exists gallery jsonb not null default '[]'::jsonb,
add column if not exists video text not null default '',
add column if not exists videos jsonb not null default '[]'::jsonb;

alter table public.destinations
add column if not exists image text not null default '',
add column if not exists gallery jsonb not null default '[]'::jsonb,
add column if not exists videos jsonb not null default '[]'::jsonb;
