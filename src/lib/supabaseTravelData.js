import { supabase } from "./supabase";

function sortByOrder(items) {
  return [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

export function toCountryRow(country, index = 0) {
  return {
    id: country.id,
    country_name: country.countryName,
    status: country.status,
    year: country.year,
    region: country.region,
    summary: country.summary,
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
    itinerary: ensureArray(destination.itinerary, []),
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
    image: place.image || "",
    gallery: ensureArray(place.gallery, []),
    video: place.video || "",
    videos: ensureArray(place.videos, []),
    rating: Number(place.rating ?? 0),
    info: place.info || "",
    ticket: place.ticket || "",
    reservation: place.reservation || "",
    paid: place.paid || "",
    sort_order: index,
  };
}

export function mapDbToCountries(countryRows, destinationRows, placeRows) {
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
          image: place.image,
          gallery: ensureArray(place.gallery, place.image ? [place.image] : []),
          video: place.video || null,
          videos: ensureArray(place.videos, place.video ? [place.video] : []),
          rating: place.rating ?? 0,
          info: place.info,
          ticket: place.ticket,
          reservation: place.reservation,
          paid: place.paid,
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
        name: destination.name,
        area: destination.area,
        video: destination.video,
        summary: destination.summary,
        itinerary: ensureArray(destination.itinerary, []),
        places: placesByDestination.get(destination.id) || [],
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
  const { error } = await supabase.from("places").upsert(toPlaceRow(destinationId, place, index));
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

export async function seedTravelData(seedCountries, { reset = false } = {}) {
  if (!supabase) return;

  if (reset) {
    const { error: placesError } = await supabase.from("places").delete().not("id", "is", null);
    if (placesError) throw placesError;
    const { error: destinationsError } = await supabase
      .from("destinations")
      .delete()
      .not("id", "is", null);
    if (destinationsError) throw destinationsError;
    const { error: countriesError } = await supabase
      .from("countries")
      .delete()
      .not("id", "is", null);
    if (countriesError) throw countriesError;
  }

  const countryRows = seedCountries.map((country, index) => toCountryRow(country, index));
  const destinationRows = seedCountries.flatMap((country) =>
    country.destinations.map((destination, index) =>
      toDestinationRow(country.id, destination, index)
    )
  );
  const placeRows = seedCountries.flatMap((country) =>
    country.destinations.flatMap((destination) =>
      destination.places.map((place, index) => toPlaceRow(destination.id, place, index))
    )
  );

  const { error: countryError } = await supabase.from("countries").upsert(countryRows);
  if (countryError) throw countryError;

  const { error: destinationError } = await supabase
    .from("destinations")
    .upsert(destinationRows);
  if (destinationError) throw destinationError;

  const { error: placeError } = await supabase.from("places").upsert(placeRows);
  if (placeError) throw placeError;
}

export function toPlannerPlanRow(destinationId, plan, index = 0) {
  return {
    id: plan.id,
    destination_id: destinationId,
    name: plan.name,
    days_count: Number(plan.daysCount ?? plan.itinerary?.length ?? 1),
    itinerary: ensureArray(plan.itinerary, []),
    notes: plan.notes || "",
    sort_order: index,
  };
}

export async function fetchPlannerPlans(destinationId) {
  if (!supabase || !destinationId) return [];

  const { data, error } = await supabase
    .from("planner_plans")
    .select("*")
    .eq("destination_id", destinationId)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data || []).map((plan) => ({
    id: plan.id,
    destinationId: plan.destination_id,
    name: plan.name,
    daysCount: plan.days_count,
    notes: plan.notes || "",
    itinerary: ensureArray(plan.itinerary, []),
  }));
}

export async function upsertPlannerPlan(destinationId, plan, index = 0) {
  const { error } = await supabase
    .from("planner_plans")
    .upsert(toPlannerPlanRow(destinationId, plan, index));
  if (error) throw error;
}

export async function deletePlannerPlan(planId) {
  const { error } = await supabase.from("planner_plans").delete().eq("id", planId);
  if (error) throw error;
}
