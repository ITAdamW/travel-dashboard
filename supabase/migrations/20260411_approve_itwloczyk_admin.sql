update public.user_profiles
set role = 'admin',
    approved = true,
    approved_at = coalesce(approved_at, timezone('utc', now()))
where lower(email) = 'itwloczyk@gmail.com';
