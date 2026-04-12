const MADEIRA_TRAIL_ESTIMATES = [
  {
    match: ["25 fontes", "risco"],
    distanceKm: 11,
    durationHours: 4,
  },
  {
    match: ["caldeirao verde"],
    distanceKm: 13,
    durationHours: 4.5,
  },
  {
    match: ["caldeirao do inferno"],
    distanceKm: 11.5,
    durationHours: 5,
  },
  {
    match: ["balcoes"],
    distanceKm: 3,
    durationHours: 1.5,
  },
  {
    match: ["levada do rei"],
    distanceKm: 10,
    durationHours: 3.5,
  },
  {
    match: ["faja do rodrigues"],
    distanceKm: 7.8,
    durationHours: 3.5,
  },
  {
    match: ["moinho", "nova"],
    distanceKm: 8.5,
    durationHours: 3,
  },
  {
    match: ["alecrim"],
    distanceKm: 7,
    durationHours: 2.5,
  },
  {
    match: ["ponta de sao lourenco"],
    distanceKm: 7.4,
    durationHours: 2.5,
  },
  {
    match: ["pico do arieiro", "pico ruivo"],
    distanceKm: 11,
    durationHours: 5,
  },
];

export const MADEIRA_OFFICIAL_PR_TRAILS = [
  { ref: "PR 1", name: "Vereda do Areeiro", aliases: ["pr 1", "vereda do areeiro", "vereda do arieiro"] },
  { ref: "PR 1.1", name: "Vereda da Ilha", aliases: ["pr 1.1", "vereda da ilha"] },
  { ref: "PR 1.2", name: "Vereda do Pico Ruivo", aliases: ["pr 1.2", "vereda do pico ruivo"] },
  { ref: "PR 1.3", name: "Vereda da Encumeada", aliases: ["pr 1.3", "vereda da encumeada"] },
  { ref: "PR 2", name: "Vereda do Urzal", aliases: ["pr 2", "vereda do urzal"] },
  { ref: "PR 3", name: "Vereda do Burro", aliases: ["pr 3", "vereda do burro"] },
  { ref: "PR 3.1", name: "Caminho Real do Monte", aliases: ["pr 3.1", "caminho real do monte"] },
  { ref: "PR 4", name: "Levada do Barreiro", aliases: ["pr 4", "levada do barreiro"] },
  { ref: "PR 5", name: "Vereda das Funduras", aliases: ["pr 5", "vereda das funduras"] },
  { ref: "PR 6", name: "Levada das 25 Fontes", aliases: ["pr 6", "levada das 25 fontes", "25 fontes"] },
  { ref: "PR 6.1", name: "Levada do Risco", aliases: ["pr 6.1", "levada do risco", "risco"] },
  { ref: "PR 6.4", name: "Levada Velha do Rabaçal", aliases: ["pr 6.4", "levada velha do rabacal", "levada velha do rabaçal"] },
  { ref: "PR 6.5", name: "Vereda do Pico Fernandes", aliases: ["pr 6.5", "vereda do pico fernandes"] },
  { ref: "PR 6.6", name: "Vereda do Tunel do Cavalo", aliases: ["pr 6.6", "vereda do tunel do cavalo", "vereda do túnel do cavalo"] },
  { ref: "PR 6.8", name: "Levada do Paul II", aliases: ["pr 6.8", "levada do paul ii"] },
  { ref: "PR 7", name: "Levada do Moinho", aliases: ["pr 7", "levada do moinho"] },
  { ref: "PR 8", name: "Vereda da Ponta de S. Lourenco", aliases: ["pr 8", "vereda da ponta de sao lourenco", "vereda da ponta de são lourenço", "ponta de sao lourenco", "ponta de são lourenço"] },
  { ref: "PR 9", name: "Levada do Caldeirao Verde", aliases: ["pr 9", "levada do caldeirao verde", "levada do caldeirão verde", "caldeirao verde", "caldeirão verde"] },
  { ref: "PR 10", name: "Levada do Furado", aliases: ["pr 10", "levada do furado"] },
  { ref: "PR 11", name: "Vereda dos Balcoes", aliases: ["pr 11", "vereda dos balcoes", "vereda dos balcões", "levada dos balcoes", "levada dos balcões", "balcoes", "balcões"] },
  { ref: "PR 12", name: "Caminho Real da Encumeada", aliases: ["pr 12", "caminho real da encumeada"] },
  { ref: "PR 13", name: "Vereda do Fanal", aliases: ["pr 13", "vereda do fanal"] },
  { ref: "PR 13.1", name: "Vereda da Palha Carga", aliases: ["pr 13.1", "vereda da palha carga"] },
  { ref: "PR 14", name: "Levada dos Cedros", aliases: ["pr 14", "levada dos cedros"] },
  { ref: "PR 15", name: "Vereda da Ribeira da Janela", aliases: ["pr 15", "vereda da ribeira da janela"] },
  { ref: "PR 16", name: "Levada Faja do Rodrigues", aliases: ["pr 16", "levada faja do rodrigues", "levada fajã do rodrigues"] },
  { ref: "PR 17", name: "Caminho do Pinaculo e Folhadal", aliases: ["pr 17", "caminho do pinaculo e folhadal", "caminho do pináculo e folhadal"] },
  { ref: "PR 18", name: "Levada do Rei", aliases: ["pr 18", "levada do rei"] },
  { ref: "PR 19", name: "Caminho Real do Paul do Mar", aliases: ["pr 19", "caminho real do paul do mar"] },
  { ref: "PR 20", name: "Vereda do Jardim do Mar", aliases: ["pr 20", "vereda do jardim do mar"] },
  { ref: "PR 21", name: "Caminho do Norte", aliases: ["pr 21", "caminho do norte"] },
  { ref: "PR 22", name: "Vereda do Chao dos Louros", aliases: ["pr 22", "vereda do chao dos louros", "vereda do chão dos louros"] },
  { ref: "PR 23", name: "Levada da Azenha", aliases: ["pr 23", "levada da azenha"] },
  { ref: "PR 27", name: "Glaciar de Planalto", aliases: ["pr 27", "glaciar de planalto"] },
  { ref: "PR 28", name: "Levada da Rocha Vermelha", aliases: ["pr 28", "levada da rocha vermelha"] },
];

const MADEIRA_TRAIL_ROUTE_HINTS = [
  {
    match: ["pr 1.2"],
    startCoordinates: [32.7602883, -16.9415742],
  },
  {
    match: ["pr 1.3"],
    startCoordinates: [32.7535539, -17.0169994],
  },
  {
    match: ["25 fontes"],
    startCoordinates: [32.7616151, -17.1344219],
  },
  {
    match: ["pr 6.6"],
    startCoordinates: [32.7537172, -17.1491357],
  },
  {
    match: ["levada do moinho"],
    startCoordinates: [32.8554391, -17.1776393],
  },
  {
    match: ["caldeirao verde"],
    startCoordinates: [32.7837134, -16.9059728],
  },
  {
    match: ["levada do furado"],
    startCoordinates: [32.7349813, -16.8860708],
  },
  {
    match: ["balcoes"],
    startCoordinates: [32.7354261, -16.8863142],
    targetCoordinates: [32.741578804502915, -16.890283882421336],
    aliases: ["balcoes", "balcões", "vereda dos balcoes", "vereda dos balcões"],
    refs: ["pr 11"],
  },
];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function findMatchingEstimate(place) {
  const haystack = normalizeText(
    [place?.name, place?.subtitle, place?.note, place?.description].join(" ")
  );

  return (
    MADEIRA_TRAIL_ESTIMATES.find((entry) =>
      entry.match.every((fragment) => haystack.includes(fragment))
    ) || null
  );
}

export function isTrailPlace(place) {
  if (!place) return false;

  if (place.category === "trail") {
    return true;
  }

  const haystack = normalizeText(
    [place.name, place.subtitle, place.note, place.description].join(" ")
  );

  return (
    MADEIRA_OFFICIAL_PR_TRAILS.some((trail) =>
      trail.aliases.some((alias) => haystack.includes(normalizeText(alias)))
    ) ||
    haystack.includes("levada") ||
    haystack.includes("vereda") ||
    /\bpr\s*\d+/i.test(place.name || "")
  );
}

export function getDisplayCategory(place) {
  return isTrailPlace(place) ? "trail" : place?.category || "city";
}

export function getPlaceDistanceKm(place) {
  const explicitValue =
    toFiniteNumber(place?.distanceKm) ||
    toFiniteNumber(place?.distance_km) ||
    toFiniteNumber(place?.distance);

  if (explicitValue) {
    return explicitValue;
  }

  return findMatchingEstimate(place)?.distanceKm || 0;
}

export function getPlaceDurationHours(place) {
  const explicitValue =
    toFiniteNumber(place?.durationHours) ||
    toFiniteNumber(place?.duration_hours) ||
    toFiniteNumber(place?.duration);

  if (explicitValue) {
    return explicitValue;
  }

  return findMatchingEstimate(place)?.durationHours || 0;
}

export function getPlaceRoutePath(place) {
  const value = place?.routePath || place?.route_path;
  if (!Array.isArray(value)) return [];

  return value.filter(
    (point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(Number(point[0])) &&
      Number.isFinite(Number(point[1]))
  );
}

export function enrichPlaceForDisplay(place) {
  if (!place) return place;

  return {
    ...place,
    category: getDisplayCategory(place),
    distanceKm: getPlaceDistanceKm(place),
    durationHours: getPlaceDurationHours(place),
    routePath: getPlaceRoutePath(place),
  };
}

export function getTrailRouteHint(place) {
  const haystack = normalizeText(
    [place?.name, place?.subtitle, place?.note, place?.description].join(" ")
  );

  const officialTrail =
    MADEIRA_OFFICIAL_PR_TRAILS.find((trail) =>
      trail.aliases.some((alias) => haystack.includes(normalizeText(alias)))
    ) || null;
  const specificHint =
    MADEIRA_TRAIL_ROUTE_HINTS.find((entry) =>
      entry.match.every((fragment) => haystack.includes(fragment))
    ) || null;

  if (!officialTrail && !specificHint) {
    return null;
  }

  return {
    ref: officialTrail?.ref || "",
    officialName: officialTrail?.name || place?.name || "",
    aliases: [...new Set([...(officialTrail?.aliases || []), ...(specificHint?.aliases || [])])],
    refs: [...new Set([normalizeText(officialTrail?.ref || ""), ...(specificHint?.refs || [])].filter(Boolean))],
    startCoordinates: specificHint?.startCoordinates || null,
    targetCoordinates: specificHint?.targetCoordinates || null,
  };
}
