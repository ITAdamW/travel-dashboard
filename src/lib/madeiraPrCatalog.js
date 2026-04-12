import { MADEIRA_OFFICIAL_PR_TRAILS, getTrailRouteHint } from "./placePresentation";

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const OFFICIAL_TIME_AND_DISTANCE = {
  "PR 1": { distanceKm: 10, durationHours: 5 },
  "PR 6": { distanceKm: 11, durationHours: 4 },
  "PR 6.1": { distanceKm: 1.5, durationHours: 0.75 },
  "PR 7": { distanceKm: 7, durationHours: 2.5 },
  "PR 8": { distanceKm: 7.4, durationHours: 2.5 },
  "PR 9": { distanceKm: 13, durationHours: 4.5 },
  "PR 10": { distanceKm: 11, durationHours: 5 },
  "PR 11": { distanceKm: 3, durationHours: 1.5 },
  "PR 14": { distanceKm: 7.2, durationHours: 3 },
  "PR 15": { distanceKm: 2.7, durationHours: 1.5 },
  "PR 16": { distanceKm: 7.8, durationHours: 3.5 },
  "PR 18": { distanceKm: 10, durationHours: 3.5 },
};

export function buildMadeiraPrPlaceTemplates(anchorCoordinates = [32.75, -16.95]) {
  return MADEIRA_OFFICIAL_PR_TRAILS.map((trail) => {
    const routeHint = getTrailRouteHint({
      name: trail.name,
      subtitle: trail.ref,
      note: trail.aliases.join(" "),
      description: "",
    });
    const metrics = OFFICIAL_TIME_AND_DISTANCE[trail.ref] || {
      distanceKm: 0,
      durationHours: 0,
    };

    return {
      id: `madeira-${slugify(trail.ref)}`,
      name: trail.name,
      category: "trail",
      coordinates:
        routeHint?.startCoordinates ||
        routeHint?.targetCoordinates ||
        anchorCoordinates,
      note:
        "Szablon oficjalnego szlaku PR Madery. Dodaj dokladny punkt startowy albo route_path, jesli chcesz pokazac trase precyzyjnie na mapie.",
      status: "planned",
      subtitle: `${trail.ref} · Oficjalny szlak pieszy Madery`,
      description:
        "Automatycznie dodany szablon szlaku PR dla Madery. Nazwa i ref pochodza z oficjalnej listy Visit Madeira, a szczegolowa geometria moze zostac dopisana pozniej.",
      image: "",
      gallery: [],
      video: "",
      videos: [],
      rating: 4.8,
      info:
        "Zweryfikuj aktualny status otwarcia i warunki dostepu przed wyjsciem na szlak.",
      ticket: "Sprawdz oplaty w aktualnym komunikacie Visit Madeira / SIMplifica",
      reservation: "Zalezy od aktualnych zasad dostepu",
      paid: "",
      distanceKm: metrics.distanceKm,
      durationHours: metrics.durationHours,
      routePath: [],
    };
  });
}
