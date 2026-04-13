const STORAGE_KEY = "travel-dashboard-place-metadata-v1";

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function loadMetadata() {
  if (!canUseStorage()) return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMetadata(metadata) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(metadata));
  } catch {
    // Ignore storage write failures.
  }
}

export function getPlaceMetadataMap() {
  return loadMetadata();
}

export function getPlaceMetadata(placeId) {
  return loadMetadata()[placeId] || null;
}

export function setPlaceMetadata(placeId, patch) {
  if (!placeId) return;

  const metadata = loadMetadata();
  metadata[placeId] = {
    ...(metadata[placeId] || {}),
    ...(patch || {}),
  };
  saveMetadata(metadata);
}
