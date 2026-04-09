const STORAGE_KEY = "travel-dashboard-data-v1";

export function loadTravelCountries(defaultCountries) {
  if (typeof window === "undefined") return defaultCountries;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultCountries;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : defaultCountries;
  } catch {
    return defaultCountries;
  }
}

export function saveTravelCountries(countries) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(countries));
}

export function clearTravelCountries() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
