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

## Supabase Storage

W aplikacji używane są buckety:

- `travel-images`
- `travel-videos`

Konwencja ścieżek:

```txt
travel-images/countryId/destinationId/placeId/cover.jpg
travel-images/countryId/destinationId/placeId/gallery-1.jpg
travel-images/countryId/destinationId/placeId/gallery-2.jpg
travel-videos/countryId/destinationId/placeId/video-1.mp4
```

Żeby panel `Media` mógł uploadować, listować i usuwać pliki, konto użytkownika musi
mieć odpowiednie polityki Storage dla obu bucketów. Najprostsza opcja na start:

- `SELECT`
- `INSERT`
- `UPDATE`
- `DELETE`

dla zalogowanych użytkowników (`authenticated`).

## Data Admin

Panel `Data admin` pozwala z poziomu aplikacji:

- dodawać kraje
- dodawać destynacje / miasta
- dodawać konkretne miejscówki
- edytować pola tych rekordów
- usuwać rekordy

Zmiany zapisują się do `Supabase Database`, więc są współdzielone między
urządzeniami po zalogowaniu.

## Supabase Database

1. Otwórz `SQL Editor` w Supabase.
2. Wklej zawartość pliku:

- [supabase-travel-schema.sql](/home/adam/Travel_dashboard/travel-dashboard/supabase-travel-schema.sql)

3. Uruchom skrypt.
4. Po wejściu do panelu `Data admin` możesz:

- wgrać dane startowe do bazy
- dodawać i edytować kraje
- dodawać i edytować miasta / destynacje
- dodawać i edytować miejscówki

Skrypt tworzy tabele:

- `countries`
- `destinations`
- `places`

oraz polityki RLS dla zalogowanych użytkowników (`authenticated`).
