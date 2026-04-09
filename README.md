# Travel dashboard

[Travel dashboard](https://itadamw.github.io/travel-dashboard/)

## Supabase Auth

1. Skopiuj `.env.example` do `.env.local`.
2. Uzupełnij:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

3. Uruchom aplikację lub zbuduj ją ponownie.

## GitHub Pages

Aby logowanie działało także na deployu z GitHub Pages:

1. Wejdź w `GitHub -> Settings -> Secrets and variables -> Actions`.
2. Dodaj dwa `Repository secrets`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Wartości wklej dokładnie takie same jak lokalnie w `.env.local`.
4. Zrób push do `main` albo uruchom workflow `Deploy to GitHub Pages` ręcznie.
