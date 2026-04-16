-- Copy exact route geometry from official Madeira PR places
-- into workbook trail duplicates that should keep their own media and copy.

update public.places target
set
  route_path = source.route_path,
  distance_km = case
    when coalesce(target.distance_km, 0) > 0 then target.distance_km
    else source.distance_km
  end,
  duration_hours = case
    when coalesce(target.duration_hours, 0) > 0 then target.duration_hours
    else source.duration_hours
  end,
  start_latitude = case
    when coalesce(target.start_latitude, 0) <> 0 then target.start_latitude
    else source.start_latitude
  end,
  start_longitude = case
    when coalesce(target.start_longitude, 0) <> 0 then target.start_longitude
    else source.start_longitude
  end,
  end_latitude = case
    when coalesce(target.end_latitude, 0) <> 0 then target.end_latitude
    else source.end_latitude
  end,
  end_longitude = case
    when coalesce(target.end_longitude, 0) <> 0 then target.end_longitude
    else source.end_longitude
  end
from public.places source
where target.id = 'madeira-workbook-levada-dos-balc-es'
  and source.id = 'madeira-pr-11'
  and jsonb_array_length(coalesce(source.route_path, '[]'::jsonb)) > 1;

update public.places target
set
  route_path = source.route_path,
  distance_km = case
    when coalesce(target.distance_km, 0) > 0 then target.distance_km
    else source.distance_km
  end,
  duration_hours = case
    when coalesce(target.duration_hours, 0) > 0 then target.duration_hours
    else source.duration_hours
  end
from public.places source
where target.id = 'madeira-workbook-pr6-levada-das-25-fontes'
  and source.id = 'madeira-pr-6'
  and jsonb_array_length(coalesce(source.route_path, '[]'::jsonb)) > 1;
