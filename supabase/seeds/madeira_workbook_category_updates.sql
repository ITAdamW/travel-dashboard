-- Updates category assignments for Madeira workbook places.
-- Run after importing workbook places if older categories are still present.

update public.places as p
set category = v.category
from (
  values
    ('madeira-workbook-levada-dos-balc-es', 'forest-trail'),
    ('madeira-workbook-cabo-girao-skywalk', 'cliff'),
    ('madeira-workbook-levada-do-moinho', 'forest-trail'),
    ('madeira-workbook-wodospadem-aniolow', 'waterfall'),
    ('madeira-workbook-farol-da-ponta-do-pargo', 'viewpoint'),
    ('madeira-workbook-vereda-do-pesqueiro', 'viewpoint-trail'),
    ('madeira-workbook-miradouro-do-fio', 'viewpoint'),
    ('madeira-workbook-teleferico-das-achadas-da-cruz', 'mountains'),
    ('madeira-workbook-piscinas-naturais-do-aquario', 'water'),
    ('madeira-workbook-miradouro-do-porto-de-abrigo', 'viewpoint'),
    ('madeira-workbook-cascata-da-ribeira-da-pedra-branca', 'waterfall'),
    ('madeira-workbook-miradouro-da-ribeira-da-laje', 'viewpoint'),
    ('madeira-workbook-seixal-beach', 'beach'),
    ('madeira-workbook-cascata-do-praia-do-porto-do-seixal', 'waterfall'),
    ('madeira-workbook-miradouro-do-veu-da-noiva', 'viewpoint'),
    ('madeira-workbook-fanal', 'forest-park'),
    ('madeira-workbook-baia-d-abra', 'viewpoint'),
    ('madeira-workbook-sao-vicente-caves', 'cave'),
    ('madeira-workbook-curral-das-freiras', 'city'),
    ('madeira-workbook-pico-do-arieiro', 'mountains'),
    ('madeira-workbook-pico-ruivo', 'mountains'),
    ('madeira-workbook-pr6-levada-das-25-fontes', 'forest-trail'),
    ('madeira-workbook-praia-da-calheta', 'beach'),
    ('madeira-workbook-porto-camara-de-lobos', 'city-water'),
    ('madeira-workbook-largo-do-poco', 'heritage'),
    ('madeira-workbook-sealion-wall-sculpture', 'heritage'),
    ('madeira-workbook-mercado-dos-lavradores', 'food-drink'),
    ('madeira-workbook-ogrod-tropikalny-monte-palace', 'forest-park')
) as v(id, category)
where p.id = v.id;
