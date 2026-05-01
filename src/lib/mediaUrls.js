export function isSupabaseStorageUrl(value) {
  const url = String(value || "").trim();
  return Boolean(url) && url.includes("/storage/v1/object/public/");
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const IMAGE_BUCKET = "travel-images";
const COVER_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif"];
const PLANNER_PLAN_FOLDER = "planner-plans";

export function normalizeSupabaseMediaUrl(value) {
  const url = String(value || "").trim();
  return isSupabaseStorageUrl(url) ? url : "";
}

export function filterSupabaseMediaUrls(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizeSupabaseMediaUrl).filter(Boolean))];
}

export function buildSupabasePublicUrl(bucket, path) {
  if (!supabaseUrl || !bucket || !path) return "";
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

export function buildPlaceCoverCandidates(countryId, destinationId, placeId) {
  if (!countryId || !destinationId || !placeId) return [];

  return COVER_EXTENSIONS.map((ext) =>
    buildSupabasePublicUrl(
      IMAGE_BUCKET,
      `${countryId}/${destinationId}/${placeId}/cover.${ext}`
    )
  ).filter(Boolean);
}

export function buildPlannerPlanCoverCandidates(destinationId, planId) {
  if (!destinationId || !planId) return [];

  return COVER_EXTENSIONS.map((ext) =>
    buildSupabasePublicUrl(
      IMAGE_BUCKET,
      `${PLANNER_PLAN_FOLDER}/${destinationId}/${planId}/cover.${ext}`
    )
  ).filter(Boolean);
}
