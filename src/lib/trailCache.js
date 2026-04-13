const STORAGE_KEY = "travel-dashboard-trail-cache-v1";

function loadCache() {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore localStorage write failures.
  }
}

export function getCachedTrailPath(placeId) {
  const cache = loadCache();
  const value = cache[placeId];
  return Array.isArray(value) ? value : [];
}

export function setCachedTrailPath(placeId, routePath) {
  if (!placeId || !Array.isArray(routePath) || routePath.length < 2) return;

  const cache = loadCache();
  cache[placeId] = routePath;
  saveCache(cache);
}
