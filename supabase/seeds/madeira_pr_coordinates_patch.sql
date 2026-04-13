-- Patch coordinates and metrics for existing Madeira PR places.
-- Safe to run multiple times.

update public.places
set
  latitude = 32.74337635200951,
  longitude = -16.700940231938628,
  start_latitude = 32.74337635200951,
  start_longitude = -16.700940231938628,
  end_latitude = 32.74213,
  end_longitude = -16.68565,
  distance_km = 7.4,
  duration_hours = 2.5
where id = 'madeira-pr-8';

update public.places
set
  latitude = 32.76711059606755,
  longitude = -17.107713654977086,
  start_latitude = 32.76711059606755,
  start_longitude = -17.107713654977086,
  end_latitude = 32.7539914,
  end_longitude = -17.0191483
where id = 'madeira-pr-13';

update public.places
set
  latitude = 32.80610297336484,
  longitude = -17.14084752263464,
  start_latitude = 32.80610297336484,
  start_longitude = -17.14084752263464,
  end_latitude = 32.803022083447,
  end_longitude = -16.888601857872,
  distance_km = 7.2,
  duration_hours = 3
where id = 'madeira-pr-14';

update public.places
set
  latitude = 32.84409253483396,
  longitude = -17.1550570898547,
  start_latitude = 32.84409253483396,
  start_longitude = -17.1550570898547,
  end_latitude = 32.8171279,
  end_longitude = -17.1554657,
  distance_km = 2.7,
  duration_hours = 1.5
where id = 'madeira-pr-15';

update public.places
set
  latitude = 32.7428037746597,
  longitude = -17.150513538606898,
  start_latitude = 32.7428037746597,
  start_longitude = -17.150513538606898,
  end_latitude = 32.732076792288,
  end_longitude = -17.155369716073
where id = 'madeira-pr-28';
