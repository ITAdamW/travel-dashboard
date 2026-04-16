-- Generated from Miejscówki.xlsx (sheet: Madera).
-- Inserts only missing Madeira places by id, name, or near-identical coordinates.

with target_destination as (
  select id
  from public.destinations
  where lower(name) like '%madeira%' or lower(name) like '%madera%'
  order by sort_order asc, name asc
  limit 1
),
max_sort as (
  select coalesce(max(p.sort_order), 0) as value
  from public.places p
  join target_destination d on d.id = p.destination_id
),
seed_rows (
  place_id,
  name,
  category,
  latitude,
  longitude,
  subtitle,
  note,
  description,
  image,
  gallery,
  order_idx
) as (
  values
    (
      'madeira-workbook-levada-dos-balc-es',
      'Levada dos Balcões',
      'trail',
      32.73524928653939,
      -16.88633623651135,
      'PR11 Levada dos Balcões
Miradouro dos Balcões',
      'Miradouro dos Balcões: 32.741578804502915, -16.890283882421336 | Google Maps: https://maps.app.goo.gl/DSxkhZsHcj4VLu1m9',
      '"Las, wąwóz, park", Szlak | PR11 Levada dos Balcões
Miradouro dos Balcões',
      'workbook-images/madeira/madeira-workbook-levada-dos-balc-es/cover.png',
      '["workbook-images/madeira/madeira-workbook-levada-dos-balc-es/cover.png"]'::jsonb,
      1
    ),
    (
      'madeira-workbook-cabo-girao-skywalk',
      'Cabo Girão Skywalk',
      'viewpoint',
      32.65673146774477,
      -17.00444208175232,
      'Cabo Girão',
      'Google Maps: https://maps.app.goo.gl/MWwu9cXgGjotJVJE8',
      'Klif | Cabo Girão',
      'workbook-images/madeira/madeira-workbook-cabo-girao-skywalk/cover.png',
      '["workbook-images/madeira/madeira-workbook-cabo-girao-skywalk/cover.png"]'::jsonb,
      2
    ),
    (
      'madeira-workbook-levada-do-moinho',
      'Levada do Moinho',
      'trail',
      32.69440341688485,
      -17.08770255687094,
      'Levada do Moinho',
      '~4h z wodospadem na końcu | Google Maps: https://maps.app.goo.gl/JCHg7AyRGeZ3JLjg7',
      '"Las, wąwóz, park", Szlak | Levada do Moinho',
      'workbook-images/madeira/madeira-workbook-levada-do-moinho/cover.png',
      '["workbook-images/madeira/madeira-workbook-levada-do-moinho/cover.png"]'::jsonb,
      3
    ),
    (
      'madeira-workbook-wodospadem-aniolow',
      'Wodospadem Aniołów',
      'viewpoint',
      32.686730103487186,
      -17.11385540554776,
      'Cascata dos Anjos',
      'wodospad spadający na drogę, może być dużo ludzi więc trzeba wybrać dobrą porę | Google Maps: https://maps.app.goo.gl/oVGcJQb86QZaZgMY7',
      'Wodospad | Cascata dos Anjos',
      'workbook-images/madeira/madeira-workbook-wodospadem-aniolow/cover.png',
      '["workbook-images/madeira/madeira-workbook-wodospadem-aniolow/cover.png"]'::jsonb,
      4
    ),
    (
      'madeira-workbook-farol-da-ponta-do-pargo',
      'Farol da Ponta do Pargo',
      'viewpoint',
      32.81457797032841,
      -17.26298656907843,
      'Miradouro Farol da Ponta do Pargo',
      'Google Maps: https://maps.app.goo.gl/fjUC8CGLo5KgGKdN8',
      'Punkt widokowy | Miradouro Farol da Ponta do Pargo',
      'workbook-images/madeira/madeira-workbook-farol-da-ponta-do-pargo/cover.png',
      '["workbook-images/madeira/madeira-workbook-farol-da-ponta-do-pargo/cover.png"]'::jsonb,
      5
    ),
    (
      'madeira-workbook-vereda-do-pesqueiro',
      'Vereda do pesqueiro',
      'trail',
      32.80561491064324,
      -17.24919641842664,
      'Vereda do pesqueiro',
      'nie ma zdjęcia na google | Google Maps: https://maps.app.goo.gl/Caz3kvaLwkuE72176',
      'Punkt widokowy, Szlak | Vereda do pesqueiro',
      '',
      '[]'::jsonb,
      6
    ),
    (
      'madeira-workbook-miradouro-do-fio',
      'Miradouro do Fio',
      'viewpoint',
      32.80966731837017,
      -17.25654288671969,
      'Miradouro do Fio',
      'Google Maps: https://maps.app.goo.gl/BfgYgE3pkPUHdHdR7',
      'Punkt widokowy | Miradouro do Fio',
      'workbook-images/madeira/madeira-workbook-miradouro-do-fio/cover.png',
      '["workbook-images/madeira/madeira-workbook-miradouro-do-fio/cover.png"]'::jsonb,
      7
    ),
    (
      'madeira-workbook-teleferico-das-achadas-da-cruz',
      'Teleférico das Achadas da Cruz',
      'viewpoint',
      32.852957766805915,
      -17.20977380833069,
      'Teleférico das Achadas da Cruz',
      'mozna wjechać stromą kolejką na samą górę | Google Maps: https://maps.app.goo.gl/oF4sq5cekbowEmBD9',
      'Góry | Teleférico das Achadas da Cruz',
      'workbook-images/madeira/madeira-workbook-teleferico-das-achadas-da-cruz/cover.png',
      '["workbook-images/madeira/madeira-workbook-teleferico-das-achadas-da-cruz/cover.png"]'::jsonb,
      8
    ),
    (
      'madeira-workbook-piscinas-naturais-do-aquario',
      'Piscinas Naturais do Aquário',
      'beach',
      32.867956352703054,
      -17.166260254583875,
      'Piscinas Naturais do Porto Moniz',
      'warto się przespacerować po miasteczku, obok też naturalne baseny bardziej na lewo | Google Maps: https://maps.app.goo.gl/eAZq2qvJoKweu6hy7',
      '"Woda, jezioro, morze" | Piscinas Naturais do Porto Moniz',
      'workbook-images/madeira/madeira-workbook-piscinas-naturais-do-aquario/cover.png',
      '["workbook-images/madeira/madeira-workbook-piscinas-naturais-do-aquario/cover.png"]'::jsonb,
      9
    ),
    (
      'madeira-workbook-miradouro-do-porto-de-abrigo',
      'Miradouro do Porto de Abrigo',
      'viewpoint',
      32.86663890080866,
      -17.165738446785323,
      'Miradouro do Porto de Abrigo',
      'Google Maps: https://maps.app.goo.gl/sFSvSjfiX1ZLA3wU6',
      'Punkt widokowy | Miradouro do Porto de Abrigo',
      'workbook-images/madeira/madeira-workbook-miradouro-do-porto-de-abrigo/cover.png',
      '["workbook-images/madeira/madeira-workbook-miradouro-do-porto-de-abrigo/cover.png"]'::jsonb,
      10
    ),
    (
      'madeira-workbook-cascata-da-ribeira-da-pedra-branca',
      'Cascata da Ribeira da Pedra Branca',
      'viewpoint',
      32.82727865330674,
      -17.124387371046073,
      'Cascata da Ribeira da Pedra Branca',
      'Google Maps: https://maps.app.goo.gl/4eQARyZ1ea9b8wLX8',
      'Wodospad | Cascata da Ribeira da Pedra Branca',
      'workbook-images/madeira/madeira-workbook-cascata-da-ribeira-da-pedra-branca/cover.png',
      '["workbook-images/madeira/madeira-workbook-cascata-da-ribeira-da-pedra-branca/cover.png"]'::jsonb,
      11
    ),
    (
      'madeira-workbook-miradouro-da-ribeira-da-laje',
      'Miradouro da Ribeira da Laje',
      'viewpoint',
      32.82613144007863,
      -17.111274498942358,
      'Miradouro da Ribeira da Laje',
      'instagramowa miejscówka gdzieś | Google Maps: https://maps.app.goo.gl/exHGs5evv1NXwREb8',
      'Punkt widokowy | Miradouro da Ribeira da Laje',
      'workbook-images/madeira/madeira-workbook-miradouro-da-ribeira-da-laje/cover.png',
      '["workbook-images/madeira/madeira-workbook-miradouro-da-ribeira-da-laje/cover.png"]'::jsonb,
      12
    ),
    (
      'madeira-workbook-seixal-beach',
      'Seixal beach',
      'beach',
      32.82234568576909,
      -17.103112218855255,
      'Praia do Porto do Seixal',
      'plaża z czarnym piaskiem i pieknymi klifami | Google Maps: https://maps.app.goo.gl/Pct7WwqixPT5o78b9',
      'Plaża | Praia do Porto do Seixal',
      'workbook-images/madeira/madeira-workbook-seixal-beach/cover.png',
      '["workbook-images/madeira/madeira-workbook-seixal-beach/cover.png"]'::jsonb,
      13
    ),
    (
      'madeira-workbook-cascata-do-praia-do-porto-do-seixal',
      'Cascata do Praia do Porto Do Seixal',
      'viewpoint',
      32.821250343163605,
      -17.103306733116426,
      'Cascata do Praia do Porto Do Seixal',
      'Google Maps: https://maps.app.goo.gl/mFnVFJGHhfEmziTM7',
      'Wodospad | Cascata do Praia do Porto Do Seixal',
      'workbook-images/madeira/madeira-workbook-cascata-do-praia-do-porto-do-seixal/cover.png',
      '["workbook-images/madeira/madeira-workbook-cascata-do-praia-do-porto-do-seixal/cover.png"]'::jsonb,
      14
    ),
    (
      'madeira-workbook-miradouro-do-veu-da-noiva',
      'Miradouro do Véu da Noiva',
      'viewpoint',
      32.81642762117267,
      -17.095228088623315,
      'Miradouro do Véu da Noiva',
      'Google Maps: https://maps.app.goo.gl/67fWadH5e7Y9ocbD9',
      'Punkt widokowy | Miradouro do Véu da Noiva',
      'workbook-images/madeira/madeira-workbook-miradouro-do-veu-da-noiva/cover.png',
      '["workbook-images/madeira/madeira-workbook-miradouro-do-veu-da-noiva/cover.png"]'::jsonb,
      15
    ),
    (
      'madeira-workbook-fanal',
      'Fanal',
      'viewpoint',
      32.80967215290068,
      -17.143886715767064,
      'Fanal Forest',
      'wchodzą nowe ograniczenia od tego roku, może być płatne i rezerwacje - sprawdzić | Google Maps: https://maps.app.goo.gl/x6xt89Rqc23YnXcL7',
      '"Las, wąwóz, park" | Fanal Forest',
      'workbook-images/madeira/madeira-workbook-fanal/cover.png',
      '["workbook-images/madeira/madeira-workbook-fanal/cover.png"]'::jsonb,
      16
    ),
    (
      'madeira-workbook-baia-d-abra',
      'Baía D''Abra',
      'viewpoint',
      32.7455152173472,
      -16.698199610958287,
      'Baía D''Abra
Miradouro da Ponta do Rosto',
      'i cały ten cypel zwiedzić, no może pół - te pierwszą część | Google Maps: https://maps.app.goo.gl/t174RUxyJT4sjxVv7',
      'Punkt widokowy | Baía D''Abra
Miradouro da Ponta do Rosto',
      'workbook-images/madeira/madeira-workbook-baia-d-abra/cover.png',
      '["workbook-images/madeira/madeira-workbook-baia-d-abra/cover.png"]'::jsonb,
      17
    ),
    (
      'madeira-workbook-sao-vicente-caves',
      'São Vicente Caves',
      'museum',
      32.7978953018761,
      -17.04155040598618,
      'São Vicente Caves',
      'Google Maps: https://maps.app.goo.gl/y89j3WgmUxCrzuXg7',
      'Jaskinia | São Vicente Caves',
      'workbook-images/madeira/madeira-workbook-sao-vicente-caves/cover.png',
      '["workbook-images/madeira/madeira-workbook-sao-vicente-caves/cover.png"]'::jsonb,
      18
    ),
    (
      'madeira-workbook-curral-das-freiras',
      'Curral das Freiras',
      'city',
      32.72287945414796,
      -16.96610563330977,
      'Curral das Freiras',
      'miasto w sercu gór | Google Maps: https://maps.app.goo.gl/sAnyhDtekmu4b11w6',
      'Miasto | Curral das Freiras',
      'workbook-images/madeira/madeira-workbook-curral-das-freiras/cover.png',
      '["workbook-images/madeira/madeira-workbook-curral-das-freiras/cover.png"]'::jsonb,
      19
    ),
    (
      'madeira-workbook-pico-do-arieiro',
      'Pico do Arieiro',
      'viewpoint',
      32.73595108178587,
      -16.928932220654442,
      'Pico do Arieiro',
      'idealny na wschód słońca | Google Maps: https://maps.app.goo.gl/WztSczyBwxVGJ59EA',
      'Góry | Pico do Arieiro',
      'workbook-images/madeira/madeira-workbook-pico-do-arieiro/cover.png',
      '["workbook-images/madeira/madeira-workbook-pico-do-arieiro/cover.png"]'::jsonb,
      20
    ),
    (
      'madeira-workbook-pico-ruivo',
      'Pico Ruivo',
      'viewpoint',
      32.75906034654425,
      -16.943116178074373,
      'Pico Ruivo',
      'Google Maps: https://maps.app.goo.gl/Cwy4eLmtZzMgGscC9',
      'Góry | Pico Ruivo',
      'workbook-images/madeira/madeira-workbook-pico-ruivo/cover.png',
      '["workbook-images/madeira/madeira-workbook-pico-ruivo/cover.png"]'::jsonb,
      21
    ),
    (
      'madeira-workbook-pr6-levada-das-25-fontes',
      'PR6 Levada das 25 Fontes',
      'trail',
      32.76243143301165,
      -17.134380033808856,
      'PR6 25 Fontes hike & Levada do Risco',
      'Google Maps: https://maps.app.goo.gl/pQtrSG7XPgNZ2Kcu5',
      '"Las, wąwóz, park", Szlak | PR6 25 Fontes hike & Levada do Risco',
      'workbook-images/madeira/madeira-workbook-pr6-levada-das-25-fontes/cover.png',
      '["workbook-images/madeira/madeira-workbook-pr6-levada-das-25-fontes/cover.png"]'::jsonb,
      22
    ),
    (
      'madeira-workbook-praia-da-calheta',
      'Praia da Calheta',
      'beach',
      32.720423225943215,
      -17.178338068080645,
      'Praia da Calheta beach',
      'plaża z żółtym piaskiem, można się kąpać | Google Maps: https://maps.app.goo.gl/eD9hC5w1VDQDeGQp9',
      'Plaża | Praia da Calheta beach',
      'workbook-images/madeira/madeira-workbook-praia-da-calheta/cover.png',
      '["workbook-images/madeira/madeira-workbook-praia-da-calheta/cover.png"]'::jsonb,
      23
    ),
    (
      'madeira-workbook-porto-camara-de-lobos',
      'Porto Câmara de Lobos',
      'beach',
      32.64779320398986,
      -16.975026038736313,
      'Porto de Câmara de Lobos',
      'Google Maps: https://maps.app.goo.gl/fGkBXWAi1FFJ2wcKA',
      'Miasto, "Woda, jezioro, morze" | Porto de Câmara de Lobos',
      'workbook-images/madeira/madeira-workbook-porto-camara-de-lobos/cover.png',
      '["workbook-images/madeira/madeira-workbook-porto-camara-de-lobos/cover.png"]'::jsonb,
      24
    ),
    (
      'madeira-workbook-largo-do-poco',
      'Largo do Poço',
      'museum',
      32.648464555776805,
      -16.975283042023445,
      'Largo do Poço',
      'Google Maps: https://maps.app.goo.gl/BqUtiHxYFx8HjCr19',
      'Zabytki | Largo do Poço',
      'workbook-images/madeira/madeira-workbook-largo-do-poco/cover.png',
      '["workbook-images/madeira/madeira-workbook-largo-do-poco/cover.png"]'::jsonb,
      25
    ),
    (
      'madeira-workbook-sealion-wall-sculpture',
      'Sealion wall sculpture',
      'museum',
      32.64726086538993,
      -16.975855352520025,
      'Sealion wall sculpture (by Bordalo II, June 2019)',
      'Google Maps: https://maps.app.goo.gl/LCZHBZS6UKGWrvm6A',
      'Zabytki | Sealion wall sculpture (by Bordalo II, June 2019)',
      'workbook-images/madeira/madeira-workbook-sealion-wall-sculpture/cover.png',
      '["workbook-images/madeira/madeira-workbook-sealion-wall-sculpture/cover.png"]'::jsonb,
      26
    ),
    (
      'madeira-workbook-mercado-dos-lavradores',
      'Mercado dos Lavradores',
      'cafe',
      32.64883874672377,
      -16.90415684731302,
      'Mercado dos Lavradores (farmers'' market)',
      'Google Maps: https://maps.app.goo.gl/CcctvFqbfmcwASSd9',
      '"Bar, restauracja" | Mercado dos Lavradores (farmers'' market)',
      'workbook-images/madeira/madeira-workbook-mercado-dos-lavradores/cover.png',
      '["workbook-images/madeira/madeira-workbook-mercado-dos-lavradores/cover.png"]'::jsonb,
      27
    ),
    (
      'madeira-workbook-ogrod-tropikalny-monte-palace',
      'ogród tropikalny Monte Palace',
      'viewpoint',
      32.677099920545025,
      -16.90077167425497,
      'Jardim Monte Palace Madeira',
      'Google Maps: https://maps.app.goo.gl/BsTEYWgxsV2BpLE9A',
      '"Las, wąwóz, park" | Jardim Monte Palace Madeira',
      'workbook-images/madeira/madeira-workbook-ogrod-tropikalny-monte-palace/cover.png',
      '["workbook-images/madeira/madeira-workbook-ogrod-tropikalny-monte-palace/cover.png"]'::jsonb,
      28
    )
),
prepared_rows as (
  select
    s.place_id as id,
    d.id as destination_id,
    s.name,
    s.category,
    s.latitude,
    s.longitude,
    s.note,
    'planned'::text as status,
    s.subtitle,
    s.description,
    s.image,
    s.gallery,
    ''::text as video,
    '[]'::jsonb as videos,
    4.5::double precision as rating,
    ''::text as info,
    ''::text as ticket,
    ''::text as reservation,
    ''::text as paid,
    0::double precision as distance_km,
    0::double precision as duration_hours,
    '[]'::jsonb as route_path,
    0::double precision as start_latitude,
    0::double precision as start_longitude,
    0::double precision as end_latitude,
    0::double precision as end_longitude,
    (select value from max_sort) + s.order_idx as sort_order
  from seed_rows s
  cross join target_destination d
)
insert into public.places (
  id,
  destination_id,
  name,
  category,
  latitude,
  longitude,
  note,
  status,
  subtitle,
  description,
  image,
  gallery,
  video,
  videos,
  rating,
  info,
  ticket,
  reservation,
  paid,
  distance_km,
  duration_hours,
  route_path,
  start_latitude,
  start_longitude,
  end_latitude,
  end_longitude,
  sort_order
)
select
  p.id,
  p.destination_id,
  p.name,
  p.category,
  p.latitude,
  p.longitude,
  p.note,
  p.status,
  p.subtitle,
  p.description,
  p.image,
  p.gallery,
  p.video,
  p.videos,
  p.rating,
  p.info,
  p.ticket,
  p.reservation,
  p.paid,
  p.distance_km,
  p.duration_hours,
  p.route_path,
  p.start_latitude,
  p.start_longitude,
  p.end_latitude,
  p.end_longitude,
  p.sort_order
from prepared_rows p
where not exists (
  select 1
  from public.places existing
  where existing.destination_id = p.destination_id
    and (
      lower(existing.id) = lower(p.id)
      or lower(existing.name) = lower(p.name)
      or (
        abs(coalesce(existing.latitude, 0) - p.latitude) < 0.0003
        and abs(coalesce(existing.longitude, 0) - p.longitude) < 0.0003
      )
    )
);
