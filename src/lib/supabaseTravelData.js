import { supabase } from "./supabase";
import { getPlaceMetadataMap, setPlaceMetadata } from "./placeMetadataStore";
import { filterSupabaseMediaUrls, normalizeSupabaseMediaUrl } from "./mediaUrls";

function sortByOrder(items) {
  return [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function normalizeMediaArray(value, fallback = []) {
  return filterSupabaseMediaUrls(ensureArray(value, fallback));
}

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || "");
  const details = String(error?.details || "");
  const hint = String(error?.hint || "");
  const combined = `${message} ${details} ${hint}`.toLowerCase();

  return combined.includes(String(columnName).toLowerCase());
}

function isMissingTableError(error, tableName) {
  return error?.code === "42P01" || isMissingColumnError(error, tableName);
}

export function toCountryRow(country, index = 0) {
  return {
    id: country.id,
    country_name: country.countryName,
    status: country.status,
    year: country.year,
    region: country.region,
    summary: country.summary,
    image: normalizeSupabaseMediaUrl(country.image || ""),
    gallery: normalizeMediaArray(country.gallery, []),
    video: country.video || "",
    videos: ensureArray(country.videos, []),
    sort_order: index,
  };
}

export function toDestinationRow(countryId, destination, index = 0) {
  return {
    id: destination.id,
    country_id: countryId,
    name: destination.name,
    area: destination.area,
    video: destination.video || "",
    summary: destination.summary || "",
    image: normalizeSupabaseMediaUrl(destination.image || ""),
    gallery: normalizeMediaArray(destination.gallery, []),
    itinerary: ensureArray(destination.itinerary, []),
    videos: ensureArray(destination.videos, destination.video ? [destination.video] : []),
    sort_order: index,
  };
}

export function toPlaceRow(destinationId, place, index = 0) {
  return {
    id: place.id,
    destination_id: destinationId,
    name: place.name,
    category: place.category,
    latitude: Number(place.coordinates?.[0] ?? 0),
    longitude: Number(place.coordinates?.[1] ?? 0),
    note: place.note || "",
    status: place.status || "planned",
    subtitle: place.subtitle || "",
    description: place.description || "",
    image: normalizeSupabaseMediaUrl(place.image || ""),
    gallery: normalizeMediaArray(place.gallery, []),
    video: place.video || "",
    videos: ensureArray(place.videos, []),
    rating: Number(place.rating ?? 0),
    info: place.info || "",
    ticket: place.ticket || "",
    reservation: place.reservation || "",
    paid: place.paid || "",
    distance_km: Number(place.distanceKm ?? place.distance_km ?? 0),
    duration_hours: Number(place.durationHours ?? place.duration_hours ?? 0),
    route_path: ensureArray(place.routePath ?? place.route_path, []),
    start_latitude: Number(
      place.startCoordinates?.[0] ?? place.start_latitude ?? 0
    ),
    start_longitude: Number(
      place.startCoordinates?.[1] ?? place.start_longitude ?? 0
    ),
    end_latitude: Number(place.endCoordinates?.[0] ?? place.end_latitude ?? 0),
    end_longitude: Number(place.endCoordinates?.[1] ?? place.end_longitude ?? 0),
    sort_order: index,
  };
}

export function mapDbToCountries(countryRows, destinationRows, placeRows) {
  const placeMetadataMap = getPlaceMetadataMap();
  const placesByDestination = new Map();
  for (const destination of destinationRows) {
    placesByDestination.set(
      destination.id,
      sortByOrder(placeRows.filter((place) => place.destination_id === destination.id)).map(
        (place) => ({
          id: place.id,
          name: place.name,
          category: place.category,
          coordinates: [place.latitude, place.longitude],
          note: place.note,
          status: place.status,
          subtitle: place.subtitle,
          description: place.description,
          image: normalizeSupabaseMediaUrl(place.image),
          gallery: normalizeMediaArray(
            place.gallery,
            place.image ? [normalizeSupabaseMediaUrl(place.image)] : []
          ),
          video: place.video || null,
          videos: ensureArray(place.videos, place.video ? [place.video] : []),
          rating: place.rating ?? 0,
          info: place.info,
          ticket: place.ticket,
          reservation: place.reservation,
          paid: place.paid,
          distanceKm:
            place.distance_km ??
            placeMetadataMap[place.id]?.distanceKm ??
            0,
          durationHours:
            place.duration_hours ??
            placeMetadataMap[place.id]?.durationHours ??
            0,
          routePath: ensureArray(
            place.route_path,
            ensureArray(placeMetadataMap[place.id]?.routePath, [])
          ),
          startCoordinates:
            place.start_latitude || place.start_longitude
              ? [place.start_latitude, place.start_longitude]
              : ensureArray(placeMetadataMap[place.id]?.startCoordinates, []),
          endCoordinates:
            place.end_latitude || place.end_longitude
              ? [place.end_latitude, place.end_longitude]
              : ensureArray(placeMetadataMap[place.id]?.endCoordinates, []),
        })
      )
    );
  }

  const destinationsByCountry = new Map();
  for (const country of countryRows) {
    destinationsByCountry.set(
      country.id,
      sortByOrder(
        destinationRows.filter((destination) => destination.country_id === country.id)
      ).map((destination) => ({
        id: destination.id,
        countryId: country.id,
        name: destination.name,
        area: destination.area,
        video: destination.video,
        image: normalizeSupabaseMediaUrl(destination.image),
        gallery: normalizeMediaArray(destination.gallery, []),
        videos: ensureArray(destination.videos, destination.video ? [destination.video] : []),
        summary: destination.summary,
        itinerary: ensureArray(destination.itinerary, []),
        places: (placesByDestination.get(destination.id) || []).map((place) => ({
          ...place,
          countryId: country.id,
          destinationId: destination.id,
        })),
      }))
    );
  }

  return sortByOrder(countryRows).map((country) => ({
    id: country.id,
    countryName: country.country_name,
    status: country.status,
    year: country.year,
    region: country.region,
    summary: country.summary,
    image: normalizeSupabaseMediaUrl(country.image),
    gallery: normalizeMediaArray(country.gallery, []),
    video: country.video || "",
    videos: ensureArray(country.videos, country.video ? [country.video] : []),
    destinations: destinationsByCountry.get(country.id) || [],
  }));
}

export async function fetchTravelCountriesFromDb() {
  if (!supabase) return [];

  const [{ data: countryRows, error: countryError }, { data: destinationRows, error: destinationError }, { data: placeRows, error: placeError }] =
    await Promise.all([
      supabase.from("countries").select("*").order("sort_order", { ascending: true }),
      supabase.from("destinations").select("*").order("sort_order", { ascending: true }),
      supabase.from("places").select("*").order("sort_order", { ascending: true }),
    ]);

  if (countryError) throw countryError;
  if (destinationError) throw destinationError;
  if (placeError) throw placeError;

  return mapDbToCountries(countryRows || [], destinationRows || [], placeRows || []);
}

export async function upsertCountry(country, index = 0) {
  const { error } = await supabase.from("countries").upsert(toCountryRow(country, index));
  if (error) throw error;
}

export async function upsertDestination(countryId, destination, index = 0) {
  const { error } = await supabase
    .from("destinations")
    .upsert(toDestinationRow(countryId, destination, index));
  if (error) throw error;
}

export async function upsertPlace(destinationId, place, index = 0) {
  const fullRow = toPlaceRow(destinationId, place, index);
  let { error } = await supabase.from("places").upsert(fullRow);

  if (
    error &&
    (isMissingColumnError(error, "distance_km") ||
      isMissingColumnError(error, "duration_hours") ||
      isMissingColumnError(error, "route_path") ||
      isMissingColumnError(error, "start_latitude") ||
      isMissingColumnError(error, "start_longitude") ||
      isMissingColumnError(error, "end_latitude") ||
      isMissingColumnError(error, "end_longitude"))
  ) {
    setPlaceMetadata(place.id, {
      distanceKm: fullRow.distance_km,
      durationHours: fullRow.duration_hours,
      routePath: fullRow.route_path,
      startCoordinates:
        fullRow.start_latitude || fullRow.start_longitude
          ? [fullRow.start_latitude, fullRow.start_longitude]
          : [],
      endCoordinates:
        fullRow.end_latitude || fullRow.end_longitude
          ? [fullRow.end_latitude, fullRow.end_longitude]
          : [],
    });

    const {
      distance_km,
      duration_hours,
      route_path,
      start_latitude,
      start_longitude,
      end_latitude,
      end_longitude,
      ...legacyRow
    } = fullRow;
    ({ error } = await supabase.from("places").upsert(legacyRow));
  }

  if (error) throw error;
}

export async function deleteCountryById(countryId) {
  const { error } = await supabase.from("countries").delete().eq("id", countryId);
  if (error) throw error;
}

export async function deleteDestinationById(destinationId) {
  const { error } = await supabase.from("destinations").delete().eq("id", destinationId);
  if (error) throw error;
}

export async function deletePlaceById(placeId) {
  const { error } = await supabase.from("places").delete().eq("id", placeId);
  if (error) throw error;
}

export function toPlannerPlanRow(destinationId, plan, index = 0) {
  return {
    id: plan.id,
    destination_id: destinationId,
    owner_user_id: plan.ownerUserId || plan.owner_user_id || undefined,
    name: plan.name,
    days_count: Number(plan.daysCount ?? plan.itinerary?.length ?? 1),
    is_favorite: Boolean(plan.isFavorite ?? plan.is_favorite ?? false),
    cover_image: normalizeSupabaseMediaUrl(plan.coverImage || plan.cover_image || ""),
    itinerary: ensureArray(plan.itinerary, []),
    notes: plan.notes || "",
    sort_order: index,
  };
}

function getProfileDisplayName(profile) {
  return (
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    profile?.login ||
    profile?.email ||
    "inny uzytkownik"
  );
}

function normalizePlannerShare(share) {
  return {
    id: share.id,
    planId: share.plan_id,
    shareType: share.share_type,
    targetUserId: share.target_user_id || "",
    targetGroupRole: share.target_group_role || "",
    createdBy: share.created_by || "",
    createdAt: share.created_at || null,
  };
}

async function fetchPlannerPlanShares(planIds) {
  if (!supabase || !planIds.length) return new Map();

  const { data, error } = await supabase
    .from("planner_plan_shares")
    .select("*")
    .in("plan_id", planIds);

  if (error && isMissingTableError(error, "planner_plan_shares")) {
    return new Map();
  }
  if (error) throw error;

  const sharesByPlanId = new Map();
  for (const share of data || []) {
    const normalized = normalizePlannerShare(share);
    sharesByPlanId.set(normalized.planId, [
      ...(sharesByPlanId.get(normalized.planId) || []),
      normalized,
    ]);
  }

  return sharesByPlanId;
}

async function fetchPlannerPlanOwners(ownerIds) {
  if (!supabase || !ownerIds.length) return new Map();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,email,login,first_name,last_name,role")
    .in("id", ownerIds);

  if (error) return new Map();

  return new Map(
    (data || []).map((profile) => [
      profile.id,
      {
        id: profile.id,
        email: profile.email || "",
        login: profile.login || "",
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        role: profile.role || "user",
        displayName: getProfileDisplayName(profile),
      },
    ])
  );
}

async function mapPlannerPlanRows(rows) {
  const planIds = rows.map((plan) => plan.id).filter(Boolean);
  const ownerIds = [...new Set(rows.map((plan) => plan.owner_user_id).filter(Boolean))];
  const [sharesByPlanId, ownersById] = await Promise.all([
    fetchPlannerPlanShares(planIds),
    fetchPlannerPlanOwners(ownerIds),
  ]);

  return rows.map((plan) => ({
    id: plan.id,
    destinationId: plan.destination_id,
    ownerUserId: plan.owner_user_id || "",
    ownerProfile: ownersById.get(plan.owner_user_id) || null,
    name: plan.name,
    daysCount: plan.days_count,
    isFavorite: Boolean(plan.is_favorite),
    coverImage: normalizeSupabaseMediaUrl(plan.cover_image),
    notes: plan.notes || "",
    itinerary: ensureArray(plan.itinerary, []),
    shares: sharesByPlanId.get(plan.id) || [],
    createdAt: plan.created_at || null,
    updatedAt: plan.updated_at || null,
  }));
}

export async function fetchPlannerPlans(destinationId) {
  if (!supabase || !destinationId) return [];

  const { data, error } = await supabase
    .from("planner_plans")
    .select("*")
    .eq("destination_id", destinationId)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return mapPlannerPlanRows(data || []);
}

export async function fetchFavoritePlannerPlans() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("planner_plans")
    .select("*")
    .eq("is_favorite", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return mapPlannerPlanRows(data || []);
}

export async function upsertPlannerPlan(destinationId, plan, index = 0) {
  const fullRow = toPlannerPlanRow(destinationId, plan, index);
  let { error } = await supabase
    .from("planner_plans")
    .upsert(fullRow);

  if (
    error &&
    (isMissingColumnError(error, "cover_image") ||
      isMissingColumnError(error, "owner_user_id"))
  ) {
    const legacyRow = { ...fullRow };
    delete legacyRow.cover_image;
    delete legacyRow.owner_user_id;
    ({ error } = await supabase.from("planner_plans").upsert(legacyRow));
  }

  if (error) throw error;
}

export async function deletePlannerPlan(planId) {
  const { error } = await supabase.from("planner_plans").delete().eq("id", planId);
  if (error) throw error;
}

export async function replacePlannerPlanShares(planId, shares) {
  if (!supabase || !planId) return [];

  const { error: deleteError } = await supabase
    .from("planner_plan_shares")
    .delete()
    .eq("plan_id", planId);

  if (deleteError) throw deleteError;

  const rows = ensureArray(shares, [])
    .map((share) => ({
      plan_id: planId,
      share_type: share.shareType,
      target_user_id: share.shareType === "user" ? share.targetUserId : null,
      target_group_role: share.shareType === "group" ? share.targetGroupRole : null,
    }))
    .filter((share) =>
      share.share_type === "user"
        ? Boolean(share.target_user_id)
        : Boolean(share.target_group_role)
    );

  if (!rows.length) return [];

  const { data, error } = await supabase
    .from("planner_plan_shares")
    .insert(rows)
    .select("*");

  if (error) throw error;

  return (data || []).map(normalizePlannerShare);
}

export async function updatePlaceRoutePath(placeId, routePath) {
  if (!supabase || !placeId) return;

  setPlaceMetadata(placeId, {
    routePath: ensureArray(routePath, []),
  });

  const { error } = await supabase
    .from("places")
    .update({
      route_path: ensureArray(routePath, []),
    })
    .eq("id", placeId);

  if (error && isMissingColumnError(error, "route_path")) {
    return;
  }

  if (error) throw error;
}

export async function fetchGuideLayout(destinationId) {
  if (!supabase || !destinationId) return null;

  const { data, error } = await supabase
    .from("guide_layouts")
    .select("*")
    .eq("destination_id", destinationId)
    .maybeSingle();

  if (error) throw error;

  return data
    ? {
        destinationId: data.destination_id,
        pages: ensureArray(data.pages, []),
        updatedAt: data.updated_at,
      }
    : null;
}

export async function upsertGuideLayout(destinationId, pages) {
  if (!supabase || !destinationId) return null;

  const { data, error } = await supabase
    .from("guide_layouts")
    .upsert({
      destination_id: destinationId,
      pages: ensureArray(pages, []),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;

  return {
    destinationId: data.destination_id,
    pages: ensureArray(data.pages, []),
    updatedAt: data.updated_at,
  };
}
