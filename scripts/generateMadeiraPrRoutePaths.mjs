import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMadeiraPrSeedDetails } from "../src/lib/madeiraPrCatalog.js";
import { buildFallbackTrailGeometry } from "../src/lib/trailGeometry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.resolve(
  __dirname,
  "../supabase/seeds/madeira_pr_route_paths.sql"
);
const OFFICIAL_TRAILS_ENDPOINT =
  "https://madeiraoceantrails.com/wordpress/wp-json/nossa-api/data/trilho";
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const OVERPASS_TIMEOUT_MS = 30000;
const OFFICIAL_FETCH_TIMEOUT_MS = 30000;
const FETCH_RETRY_COUNT = 3;

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineDistance(a, b) {
  const earthRadiusKm = 6371;
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinLng * sinLng;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function buildPlaceFromTrail(trail) {
  const coordinates = trail.startCoordinates || trail.targetCoordinates || [];

  return {
    id: `madeira-${slugify(trail.ref)}`,
    name: trail.name,
    category: "trail",
    subtitle: `${trail.ref} - ${trail.startLabel || "start"} - ${
      trail.targetLabel || "meta"
    }`,
    description:
      "Szablon oficjalnego szlaku PR dla Madery przygotowany na podstawie katalogu PR.",
    note: "Automatycznie dodany oficjalny szlak PR Madery.",
    coordinates,
    startCoordinates: trail.startCoordinates || [],
    endCoordinates: trail.targetCoordinates || [],
  };
}

function buildRouteHintFromTrail(trail) {
  return {
    ref: trail.ref || "",
    officialName: trail.name || "",
    aliases: Array.isArray(trail.aliases) ? trail.aliases : [],
    refs: trail.ref ? [String(trail.ref).toLowerCase()] : [],
    startCoordinates: trail.startCoordinates || null,
    targetCoordinates: trail.targetCoordinates || null,
  };
}

function roundPoint(point) {
  return [Number(point[0].toFixed(6)), Number(point[1].toFixed(6))];
}

function normalizeGeometry(geometry) {
  if (!Array.isArray(geometry)) return [];

  const result = [];
  for (const point of geometry) {
    if (
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(Number(point[0])) &&
      Number.isFinite(Number(point[1]))
    ) {
      const rounded = roundPoint([Number(point[0]), Number(point[1])]);
      const prev = result[result.length - 1];
      if (!prev || prev[0] !== rounded[0] || prev[1] !== rounded[1]) {
        result.push(rounded);
      }
    }
  }

  return result;
}

function geometryLengthKm(geometry) {
  let total = 0;

  for (let index = 1; index < geometry.length; index += 1) {
    total += haversineDistance(geometry[index - 1], geometry[index]);
  }

  return total;
}

function getOfficialCoordinatePoint(officialTrail) {
  const lat = Number(officialTrail?.coordenadas?.latitude);
  const lon = Number(officialTrail?.coordenadas?.longitude);

  return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
}

function toSqlJson(value) {
  return JSON.stringify(value).replace(/'/g, "''");
}

function escapeOverpassString(value) {
  return String(value || "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/"/g, '\\"');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchJson(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= FETCH_RETRY_COUNT; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          headers: {
            Accept: "application/json,text/plain,*/*",
          },
        },
        OFFICIAL_FETCH_TIMEOUT_MS
      );

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_RETRY_COUNT) {
        await sleep(1000 * attempt);
      }
    }
  }

  throw lastError;
}

async function fetchText(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= FETCH_RETRY_COUNT; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          headers: {
            Accept: "application/xml,text/xml,application/gpx+xml,*/*",
          },
        },
        OFFICIAL_FETCH_TIMEOUT_MS
      );

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_RETRY_COUNT) {
        await sleep(1000 * attempt);
      }
    }
  }

  throw lastError;
}

async function fetchFromOverpass(query) {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
        },
        body: query,
        signal: controller.signal,
      });

      if (!response.ok) {
        continue;
      }

      return await response.json();
    } catch {
      // Try the next endpoint.
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error("Overpass request failed.");
}

function parseGpxPoints(xmlText) {
  const points = [];
  const trackRegex = /<(?:trkpt|rtept)\b[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>/gi;
  let match = trackRegex.exec(xmlText);

  while (match) {
    const lat = Number(match[1]);
    const lon = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      points.push([lat, lon]);
    }
    match = trackRegex.exec(xmlText);
  }

  return normalizeGeometry(points);
}

function buildOfficialLookup(officialTrails) {
  const byRef = new Map();
  const bySlug = new Map();
  const byName = new Map();

  for (const item of officialTrails) {
    const ref = normalizeText(item?.codigo || "");
    const slug = normalizeText(item?.route || "");
    const title = normalizeText(item?.title || item?.name || "");

    if (ref) byRef.set(ref, item);
    if (slug) bySlug.set(slug, item);
    if (title) byName.set(title, item);
  }

  return { byRef, bySlug, byName };
}

const OFFICIAL_ROUTE_OVERRIDES = {
  "PR 1": "pico-areeiro-pico-ruivo",
  "PR 1.1": "veredadailha",
  "PR 1.2": "veredadopicoruivo",
  "PR 1.3": "vereda-da-encumeada",
  "PR 5": "veredadasfunduras",
  "PR 6": "vereda-das-25-fontes-e-levada-do-risco",
  "PR 6.1": "vereda-das-25-fontes-e-levada-do-risco",
  "PR 8": "pontadesaolourenco",
  "PR 9": "levadadocaldeiraoverde",
  "PR 10": "levadadofurado",
  "PR 11": "vereda-dos-balcoes",
  "PR 12": "caminho-real-da-encumeada",
  "PR 13": "veredadafanal",
  "PR 14": "levada-dos-cedros",
  "PR 15": "veredadaribeiradajanela",
  "PR 16": "levadadafajadorodriguesribeiradoinferno",
  "PR 17": "pinaculo",
  "PR 18": "levada-do-rei",
  "PR 19": "caminho-real-do-paul-do-mar",
  "PR 20": "veredadojardimdomar",
  "PR 22": "chao-dos-louros",
  "PR 28": "levadadarochavermelha",
};

function matchOfficialTrail(trail, lookup) {
  const ref = normalizeText(trail.ref);
  const overrideSlug = normalizeText(OFFICIAL_ROUTE_OVERRIDES[trail.ref] || "");
  const slug = normalizeText(
    String(trail.name || "")
      .replace(/\./g, "")
      .replace(/\s+/g, "-")
  );
  const names = [trail.name, ...(trail.aliases || [])].map(normalizeText).filter(Boolean);

  return (
    lookup.bySlug.get(overrideSlug) ||
    lookup.byRef.get(ref) ||
    lookup.bySlug.get(slug) ||
    names.map((name) => lookup.byName.get(name)).find(Boolean) ||
    null
  );
}

function distanceToPoint(point, target) {
  const [lat1, lng1] = point;
  const [lat2, lng2] = target;
  const latDiff = lat1 - lat2;
  const lngDiff = lng1 - lng2;

  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
}

function createNodeKey(point) {
  return `${Number(point[0]).toFixed(6)},${Number(point[1]).toFixed(6)}`;
}

function addGraphEdge(graph, pointsByKey, from, to) {
  const fromKey = createNodeKey(from);
  const toKey = createNodeKey(to);
  const weight = haversineDistance(from, to);

  if (!graph.has(fromKey)) graph.set(fromKey, []);
  if (!graph.has(toKey)) graph.set(toKey, []);

  graph.get(fromKey).push({ key: toKey, weight });
  graph.get(toKey).push({ key: fromKey, weight });
  pointsByKey.set(fromKey, from);
  pointsByKey.set(toKey, to);
}

function buildPathGraph(elements) {
  const graph = new Map();
  const pointsByKey = new Map();

  for (const element of elements) {
    const geometry = Array.isArray(element?.geometry)
      ? element.geometry.map((entry) => [entry.lat, entry.lon])
      : [];

    for (let index = 1; index < geometry.length; index += 1) {
      addGraphEdge(graph, pointsByKey, geometry[index - 1], geometry[index]);
    }
  }

  return { graph, pointsByKey };
}

function getNodeDegree(graph, key) {
  return Array.isArray(graph.get(key)) ? graph.get(key).length : 0;
}

function findNearestNode(point, pointsByKey) {
  let bestKey = "";
  let bestDistance = Infinity;

  for (const [key, candidatePoint] of pointsByKey.entries()) {
    const distance = haversineDistance(point, candidatePoint);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestKey = key;
    }
  }

  return { key: bestKey, distanceKm: bestDistance };
}

function dijkstraPath(graph, startKey, endKey) {
  const distances = new Map([[startKey, 0]]);
  const previous = new Map();
  const visited = new Set();

  while (true) {
    let currentKey = "";
    let currentDistance = Infinity;

    for (const [key, distance] of distances.entries()) {
      if (!visited.has(key) && distance < currentDistance) {
        currentKey = key;
        currentDistance = distance;
      }
    }

    if (!currentKey || currentKey === endKey) {
      break;
    }

    visited.add(currentKey);
    for (const edge of graph.get(currentKey) || []) {
      const nextDistance = currentDistance + edge.weight;
      if (nextDistance < (distances.get(edge.key) ?? Infinity)) {
        distances.set(edge.key, nextDistance);
        previous.set(edge.key, currentKey);
      }
    }
  }

  if (!distances.has(endKey)) {
    return [];
  }

  const path = [endKey];
  let cursor = endKey;
  while (previous.has(cursor)) {
    cursor = previous.get(cursor);
    path.unshift(cursor);
  }

  return path;
}

function dijkstraDistances(graph, startKey) {
  const distances = new Map([[startKey, 0]]);
  const previous = new Map();
  const visited = new Set();

  while (true) {
    let currentKey = "";
    let currentDistance = Infinity;

    for (const [key, distance] of distances.entries()) {
      if (!visited.has(key) && distance < currentDistance) {
        currentKey = key;
        currentDistance = distance;
      }
    }

    if (!currentKey) {
      break;
    }

    visited.add(currentKey);
    for (const edge of graph.get(currentKey) || []) {
      const nextDistance = currentDistance + edge.weight;
      if (nextDistance < (distances.get(edge.key) ?? Infinity)) {
        distances.set(edge.key, nextDistance);
        previous.set(edge.key, currentKey);
      }
    }
  }

  return { distances, previous };
}

function rebuildPath(previous, endKey) {
  const path = [endKey];
  let cursor = endKey;

  while (previous.has(cursor)) {
    cursor = previous.get(cursor);
    path.unshift(cursor);
  }

  return path;
}

function isUsableEndpoint(startPoint, endPoint, expectedDistanceKm) {
  if (!startPoint || !endPoint) {
    return false;
  }

  const directDistanceKm = haversineDistance(startPoint, endPoint);
  if (directDistanceKm < 0.03) {
    return false;
  }

  if (
    expectedDistanceKm > 0 &&
    directDistanceKm > Math.max(expectedDistanceKm * 1.2, expectedDistanceKm + 1.2)
  ) {
    return false;
  }

  return true;
}

function scoreCandidateNode({
  key,
  distanceKm,
  graph,
  startKey,
  targetDistanceKm,
  targetPoint,
  pointsByKey,
}) {
  if (key === startKey || distanceKm < 0.15) {
    return -Infinity;
  }

  let score = distanceKm * 12;
  if (targetDistanceKm > 0) {
    score -= Math.abs(distanceKm - targetDistanceKm) * 20;
  }

  const degree = getNodeDegree(graph, key);
  if (degree <= 1) score += 14;
  else if (degree === 2) score += 6;
  else score -= degree * 2;

  if (targetPoint) {
    score -= haversineDistance(pointsByKey.get(key), targetPoint) * 8;
  }

  return score;
}

function getOfficialLabelValue(valuesInfo, key) {
  return String(valuesInfo?.[key]?.[`${key}Valor`] || "").trim();
}

function isLoopLikeTrail(trail, officialTrail, usableEndPoint, startPoint) {
  if (
    usableEndPoint &&
    startPoint &&
    haversineDistance(startPoint, usableEndPoint) < 0.15
  ) {
    return true;
  }

  const trailStart = normalizeText(trail?.startLabel || "");
  const trailEnd = normalizeText(trail?.targetLabel || "");
  if (trailStart && trailEnd && trailStart === trailEnd) {
    return true;
  }

  const officialStart = normalizeText(
    getOfficialLabelValue(officialTrail?.valuesInfo, "value5")
  );
  const officialEnd = normalizeText(
    getOfficialLabelValue(officialTrail?.valuesInfo, "value6")
  );

  return Boolean(officialStart && officialEnd && officialStart === officialEnd);
}

function resolveGraphGeometry({
  graph,
  pointsByKey,
  startPoint,
  endPoint,
  expectedDistanceKm = 0,
  trail = null,
  officialTrail = null,
}) {
  if (!graph.size || !startPoint) {
    return [];
  }

  const nearestStart = findNearestNode(startPoint, pointsByKey);
  if (!nearestStart.key || nearestStart.distanceKm > 1.5) {
    return [];
  }

  const usableEndPoint = isUsableEndpoint(startPoint, endPoint, expectedDistanceKm)
    ? endPoint
    : null;
  const nearestEnd = usableEndPoint ? findNearestNode(usableEndPoint, pointsByKey) : null;

  const shortestPathGeometry =
    nearestEnd?.key && nearestEnd.distanceKm <= 1.5
      ? normalizeGeometry([
          startPoint,
          ...dijkstraPath(graph, nearestStart.key, nearestEnd.key)
            .map((key) => pointsByKey.get(key))
            .filter(Boolean),
          usableEndPoint,
        ])
      : [];

  const shortestPathDistanceKm = geometryLengthKm(shortestPathGeometry);
  if (
    shortestPathGeometry.length > 1 &&
    (!expectedDistanceKm ||
      Math.abs(shortestPathDistanceKm - expectedDistanceKm) <=
        Math.max(expectedDistanceKm * 0.75, 2.5))
  ) {
    return shortestPathGeometry;
  }

  const loopLike = isLoopLikeTrail(trail, officialTrail, usableEndPoint, startPoint);
  const targetDistanceKm =
    expectedDistanceKm > 0 ? (loopLike ? expectedDistanceKm / 2 : expectedDistanceKm) : 0;
  const { distances, previous } = dijkstraDistances(graph, nearestStart.key);

  let bestKey = "";
  let bestScore = -Infinity;

  for (const [key, distanceKm] of distances.entries()) {
    const score = scoreCandidateNode({
      key,
      distanceKm,
      graph,
      startKey: nearestStart.key,
      targetDistanceKm,
      targetPoint: usableEndPoint,
      pointsByKey,
    });

    if (score > bestScore) {
      bestKey = key;
      bestScore = score;
    }
  }

  if (!bestKey) {
    return shortestPathGeometry;
  }

  const keyPath = rebuildPath(previous, bestKey);
  const candidateGeometry = normalizeGeometry([
    startPoint,
    ...keyPath.map((key) => pointsByKey.get(key)).filter(Boolean),
    ...(usableEndPoint ? [usableEndPoint] : []),
  ]);

  return candidateGeometry.length > 1 ? candidateGeometry : shortestPathGeometry;
}

async function fetchPathBetweenPoints(startPoint, endPoint) {
  const margin = Math.max(
    0.01,
    Math.min(
      0.08,
      Math.max(
        Math.abs(startPoint[0] - endPoint[0]),
        Math.abs(startPoint[1] - endPoint[1])
      ) * 0.35
    )
  );
  const south = Math.min(startPoint[0], endPoint[0]) - margin;
  const north = Math.max(startPoint[0], endPoint[0]) + margin;
  const west = Math.min(startPoint[1], endPoint[1]) - margin;
  const east = Math.max(startPoint[1], endPoint[1]) + margin;

  const query = `
[out:json][timeout:90];
(
  way["highway"~"path|footway|track|steps|service|living_street|residential|unclassified|pedestrian"](${south},${west},${north},${east});
  way["route"="hiking"](${south},${west},${north},${east});
);
out geom;
`;

  const data = await fetchFromOverpass(query);
  const elements = Array.isArray(data?.elements) ? data.elements : [];
  const { graph, pointsByKey } = buildPathGraph(elements);

  if (!graph.size) {
    return [];
  }

  const nearestStart = findNearestNode(startPoint, pointsByKey);
  const nearestEnd = findNearestNode(endPoint, pointsByKey);

  if (
    !nearestStart.key ||
    !nearestEnd.key ||
    nearestStart.distanceKm > 1.2 ||
    nearestEnd.distanceKm > 1.2
  ) {
    return [];
  }

  const keyPath = dijkstraPath(graph, nearestStart.key, nearestEnd.key);
  if (!keyPath.length) {
    return [];
  }

  return normalizeGeometry([
    startPoint,
    ...keyPath.map((key) => pointsByKey.get(key)).filter(Boolean),
    endPoint,
  ]);
}

async function fetchOpenGraphAroundStart(trail, officialTrail) {
  const startPoint =
    getOfficialCoordinatePoint(officialTrail) ||
    toCoordinatePair(trail.startCoordinates);
  const endPoint = toCoordinatePair(trail.targetCoordinates);
  const expectedDistanceKm = Number(trail.distanceKm) || 0;

  if (!startPoint) {
    return [];
  }

  const radiusMeters = Math.max(
    3500,
    Math.min(18000, Math.round((expectedDistanceKm || 4) * 1800))
  );

  const query = `
[out:json][timeout:90];
(
  relation["route"="hiking"](around:${radiusMeters},${startPoint[0]},${startPoint[1]});
)->.rels;
(
  way(r.rels);
  way["highway"~"path|footway|track|steps|service|living_street|residential|unclassified|pedestrian"](around:${radiusMeters},${startPoint[0]},${startPoint[1]});
  way["route"="hiking"](around:${radiusMeters},${startPoint[0]},${startPoint[1]});
);
out geom;
`;

  const data = await fetchFromOverpass(query);
  const elements = Array.isArray(data?.elements) ? data.elements : [];
  const wayElements = elements.filter(
    (element) => element?.type === "way" && Array.isArray(element?.geometry)
  );
  const { graph, pointsByKey } = buildPathGraph(wayElements);

  return resolveGraphGeometry({
    graph,
    pointsByKey,
    startPoint,
    endPoint,
    expectedDistanceKm,
    trail,
    officialTrail,
  });
}

async function fetchNamedPathBetweenPoints(trail, officialTrail, startPoint, endPoint) {
  const margin = Math.max(
    0.01,
    Math.min(
      0.08,
      Math.max(
        Math.abs(startPoint[0] - endPoint[0]),
        Math.abs(startPoint[1] - endPoint[1])
      ) * 0.35
    )
  );
  const south = Math.min(startPoint[0], endPoint[0]) - margin;
  const north = Math.max(startPoint[0], endPoint[0]) + margin;
  const west = Math.min(startPoint[1], endPoint[1]) - margin;
  const east = Math.max(startPoint[1], endPoint[1]) + margin;
  const aliases = [
    trail.ref,
    trail.name,
    officialTrail?.title,
    ...(trail.aliases || []),
  ]
    .map((alias) => escapeOverpassString(alias))
    .filter(Boolean)
    .join("|");

  if (!aliases) {
    return [];
  }

  const query = `
[out:json][timeout:90];
(
  way["highway"~"path|footway|track|steps|service|living_street|residential|unclassified|pedestrian"]["name"~"${aliases}",i](${south},${west},${north},${east});
  way["highway"~"path|footway|track|steps|service|living_street|residential|unclassified|pedestrian"]["ref"~"${escapeOverpassString(trail.ref)}",i](${south},${west},${north},${east});
);
out geom;
`;

  const data = await fetchFromOverpass(query);
  const elements = Array.isArray(data?.elements) ? data.elements : [];
  const { graph, pointsByKey } = buildPathGraph(elements);

  if (!graph.size) {
    return [];
  }

  const nearestStart = findNearestNode(startPoint, pointsByKey);
  const nearestEnd = findNearestNode(endPoint, pointsByKey);

  if (
    !nearestStart.key ||
    !nearestEnd.key ||
    nearestStart.distanceKm > 0.8 ||
    nearestEnd.distanceKm > 0.8
  ) {
    return [];
  }

  const keyPath = dijkstraPath(graph, nearestStart.key, nearestEnd.key);
  if (!keyPath.length) {
    return [];
  }

  return normalizeGeometry([
    startPoint,
    ...keyPath.map((key) => pointsByKey.get(key)).filter(Boolean),
    endPoint,
  ]);
}

async function fetchExactRelationGeometryForTrail(trail, officialTrail) {
  const startPoint =
    getOfficialCoordinatePoint(officialTrail) ||
    toCoordinatePair(trail.startCoordinates);
  const endPoint = toCoordinatePair(trail.targetCoordinates);
  const expectedDistanceKm = Number(trail.distanceKm) || 0;
  const point = startPoint || endPoint || [0, 0];
  const around =
    Array.isArray(point) && point.length >= 2 && point.every(Number.isFinite)
      ? `(around:12000,${point[0]},${point[1]})`
      : "(32.45,-17.35,32.95,-16.55)";
  const queries = [
    trail.ref
      ? `
[out:json][timeout:90];
relation["route"="hiking"]["ref"~"^${escapeOverpassString(trail.ref)}$",i]${around};
way(r);
out geom;
`
      : "",
    officialTrail?.title || trail.name
      ? `
[out:json][timeout:90];
relation["route"="hiking"]["name"~"^${escapeOverpassString(
          officialTrail?.title || trail.name
        )}$",i]${around};
way(r);
out geom;
`
      : "",
  ].filter(Boolean);

  for (const query of queries) {
    const data = await fetchFromOverpass(query);
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    const wayElements = elements.filter(
      (element) => element?.type === "way" && Array.isArray(element?.geometry)
    );
    const { graph, pointsByKey } = buildPathGraph(wayElements);
    const geometry = resolveGraphGeometry({
      graph,
      pointsByKey,
      startPoint,
      endPoint,
      expectedDistanceKm,
      trail,
      officialTrail,
    });

    if (geometry.length > 1) {
      return geometry;
    }
  }

  return [];
}

async function fetchRelationGeometryForTrail(trail, officialTrail) {
  const refPattern = escapeOverpassString(String(trail.ref || "").trim());
  const titlePattern = escapeOverpassString(
    String(officialTrail?.title || trail.name || "").trim()
  );
  const aliasPattern = [...new Set([...(trail.aliases || []), officialTrail?.route || ""])]
    .map((alias) => escapeOverpassString(alias))
    .filter(Boolean)
    .join("|");
  const point =
    getOfficialCoordinatePoint(officialTrail) ||
    trail.startCoordinates ||
    trail.targetCoordinates ||
    [0, 0];
  const around =
    Array.isArray(point) && point.length >= 2 && point.every(Number.isFinite)
      ? `(around:18000,${point[0]},${point[1]})`
      : "(32.45,-17.35,32.95,-16.55)";
  const aliasQuery = aliasPattern
    ? `relation["route"="hiking"]["name"~"${aliasPattern}",i]${around};`
    : "";
  const query = `
[out:json][timeout:90];
(
  relation["route"="hiking"]["ref"~"^${refPattern}$",i]${around};
  relation["route"="hiking"]["name"~"^${titlePattern}$",i]${around};
  ${aliasQuery}
);
way(r);
out geom;
`;

  const data = await fetchFromOverpass(query);
  const elements = Array.isArray(data?.elements) ? data.elements : [];
  const startPoint =
    getOfficialCoordinatePoint(officialTrail) ||
    toCoordinatePair(trail.startCoordinates);
  const endPoint = toCoordinatePair(trail.targetCoordinates);
  const expectedDistanceKm = Number(trail.distanceKm) || 0;
  const wayElements = elements.filter(
    (element) => element?.type === "way" && Array.isArray(element?.geometry)
  );
  const { graph, pointsByKey } = buildPathGraph(wayElements);

  return resolveGraphGeometry({
    graph,
    pointsByKey,
    startPoint,
    endPoint,
    expectedDistanceKm,
    trail,
    officialTrail,
  });
}

function scoreNamedGeometry(element, trail, officialTrail, startPoint, endPoint) {
  const tags = element?.tags || {};
  const candidateName = normalizeText(tags.name || tags["name:en"] || "");
  const candidateRef = normalizeText(tags.ref || "");
  const aliases = [
    trail.ref,
    trail.name,
    officialTrail?.title,
    officialTrail?.route,
    ...(trail.aliases || []),
  ]
    .map(normalizeText)
    .filter(Boolean);
  const geometry = Array.isArray(element?.geometry)
    ? element.geometry.map((entry) => [entry.lat, entry.lon])
    : [];

  if (geometry.length < 2) {
    return -Infinity;
  }

  let score = geometry.length;
  for (const alias of aliases) {
    if (!alias) continue;
    if (candidateRef === alias) score += 80;
    else if (candidateRef.includes(alias) || alias.includes(candidateRef)) score += 40;

    if (candidateName === alias) score += 65;
    else if (candidateName.includes(alias) || alias.includes(candidateName)) score += 35;
  }

  if (startPoint) {
    const nearestStart = Math.min(
      ...geometry.map((entry) => distanceToPoint(entry, startPoint))
    );
    score -= nearestStart * 140;
  }

  if (endPoint) {
    const nearestEnd = Math.min(
      ...geometry.map((entry) => distanceToPoint(entry, endPoint))
    );
    score -= nearestEnd * 140;
  }

  return score;
}

async function fetchNamedGeometryForTrail(trail, officialTrail) {
  const startPoint =
    getOfficialCoordinatePoint(officialTrail) ||
    toCoordinatePair(trail.startCoordinates);
  const endPoint = toCoordinatePair(trail.targetCoordinates);
  const aliases = [
    trail.ref,
    trail.name,
    officialTrail?.title,
    officialTrail?.route,
    ...(trail.aliases || []),
  ]
    .map((alias) => escapeOverpassString(alias))
    .filter(Boolean)
    .join("|");

  if (!aliases || !startPoint) {
    return [];
  }

  const query = `
[out:json][timeout:90];
(
  relation["route"="hiking"]["name"~"${aliases}",i](around:16000,${startPoint[0]},${startPoint[1]});
  relation["route"="hiking"]["ref"~"${escapeOverpassString(trail.ref)}",i](around:16000,${startPoint[0]},${startPoint[1]});
  way["highway"~"path|footway|track|steps"]["name"~"${aliases}",i](around:6000,${startPoint[0]},${startPoint[1]});
  way["highway"~"path|footway|track|steps"]["ref"~"${escapeOverpassString(trail.ref)}",i](around:6000,${startPoint[0]},${startPoint[1]});
);
out geom;
`;

  const data = await fetchFromOverpass(query);
  const elements = Array.isArray(data?.elements) ? data.elements : [];
  const best = [...elements]
    .filter((element) => Array.isArray(element?.geometry) && element.geometry.length > 1)
    .sort(
      (left, right) =>
        scoreNamedGeometry(right, trail, officialTrail, startPoint, endPoint) -
        scoreNamedGeometry(left, trail, officialTrail, startPoint, endPoint)
    )[0];

  if (!best?.geometry?.length) {
    return [];
  }

  return normalizeGeometry(best.geometry.map((point) => [point.lat, point.lon]));
}

async function fetchExactNameGeometryForTrail(trail, officialTrail) {
  const startPoint =
    getOfficialCoordinatePoint(officialTrail) ||
    toCoordinatePair(trail.startCoordinates);
  const endPoint = toCoordinatePair(trail.targetCoordinates);
  const names = [...new Set([trail.name, officialTrail?.title].filter(Boolean))];

  if (!startPoint || !names.length) {
    return [];
  }

  let bestGeometry = [];
  let bestScore = -Infinity;

  for (const name of names) {
    const escapedName = escapeOverpassString(name);
    const query = `
[out:json][timeout:90];
(
  relation["route"="hiking"]["name"~"^${escapedName}$",i](around:12000,${startPoint[0]},${startPoint[1]});
  way["highway"~"path|footway|track|steps"]["name"~"^${escapedName}$",i](around:8000,${startPoint[0]},${startPoint[1]});
);
out geom;
`;
    const data = await fetchFromOverpass(query);
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    const best = [...elements]
      .filter((element) => Array.isArray(element?.geometry) && element.geometry.length > 1)
      .sort(
        (left, right) =>
          scoreNamedGeometry(right, trail, officialTrail, startPoint, endPoint) -
          scoreNamedGeometry(left, trail, officialTrail, startPoint, endPoint)
      )[0];

    if (best?.geometry?.length) {
      const geometry = normalizeGeometry(
        best.geometry.map((point) => [point.lat, point.lon])
      );
      const score = scoreNamedGeometry(
        best,
        trail,
        officialTrail,
        startPoint,
        endPoint
      );
      if (geometry.length > 1 && score > bestScore) {
        bestGeometry = geometry;
        bestScore = score;
      }
    }
  }

  return bestGeometry;
}

function toCoordinatePair(value) {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lat = Number(value[0]);
  const lon = Number(value[1]);
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
}

async function main() {
  const trails = getMadeiraPrSeedDetails();
  let officialTrails = [];
  try {
    officialTrails = await fetchJson(OFFICIAL_TRAILS_ENDPOINT);
  } catch (error) {
    console.warn(
      `Warning: failed to fetch official Madeira trails catalog, continuing with local seed data only. ${error?.message || error}`
    );
  }
  const officialLookup = buildOfficialLookup(officialTrails);
  const results = [];

  for (const trail of trails) {
    const officialTrail = matchOfficialTrail(trail, officialLookup);
    const place = buildPlaceFromTrail(trail);
    const routeHint = buildRouteHintFromTrail(trail);
    const fallbackGeometry = buildFallbackTrailGeometry(place, routeHint);

    let geometry = [];
    let source = "missing";

    if (officialTrail?.ficheiroGpx) {
      try {
        const gpxXml = await fetchText(officialTrail.ficheiroGpx);
        geometry = parseGpxPoints(gpxXml);
        source = geometry.length > 1 ? "official-gpx" : "official-gpx-empty";
      } catch {
        geometry = [];
      }
    }

    if (geometry.length < 2) {
      try {
        geometry = await fetchExactRelationGeometryForTrail(trail, officialTrail);
        source = geometry.length > 1 ? "osm-relation-exact" : source;
      } catch {
        // Continue to broader relation query.
      }
    }

    if (geometry.length < 2) {
      try {
        geometry = await fetchRelationGeometryForTrail(trail, officialTrail);
        source = geometry.length > 1 ? "osm-relation" : source;
      } catch {
        // Continue to next source.
      }
    }

    if (geometry.length < 2) {
      try {
        geometry = await fetchNamedGeometryForTrail(trail, officialTrail);
        source = geometry.length > 1 ? "osm-named" : source;
      } catch {
        // Continue to next source.
      }
    }

    if (geometry.length < 2) {
      try {
        geometry = await fetchExactNameGeometryForTrail(trail, officialTrail);
        source = geometry.length > 1 ? "osm-exact-name" : source;
      } catch {
        // Continue to next source.
      }
    }

    if (geometry.length < 2) {
      try {
        geometry = await fetchOpenGraphAroundStart(trail, officialTrail);
        source = geometry.length > 1 ? "osm-open-graph" : source;
      } catch {
        // Continue to point-to-point queries.
      }
    }

    if (geometry.length < 2) {
      const startPoint =
        getOfficialCoordinatePoint(officialTrail) ||
        toCoordinatePair(trail.startCoordinates);
      const endPoint = toCoordinatePair(trail.targetCoordinates);

      if (startPoint && endPoint) {
        try {
          geometry = await fetchNamedPathBetweenPoints(
            trail,
            officialTrail,
            startPoint,
            endPoint
          );
          source = geometry.length > 1 ? "osm-named-path" : source;
        } catch {
          // Continue to generic path.
        }
      }

      if (geometry.length < 2 && startPoint && endPoint) {
        try {
          geometry = await fetchPathBetweenPoints(startPoint, endPoint);
          source = geometry.length > 1 ? "osm-path" : source;
        } catch {
          // Continue to fallback.
        }
      }
    }

    if (geometry.length < 2 && fallbackGeometry.length > 1) {
      geometry = normalizeGeometry(fallbackGeometry);
      source = "fallback-line";
    }

    results.push({
      trail,
      officialTrail,
      placeId: `madeira-${slugify(trail.ref)}`,
      geometry,
      source,
    });

    console.log(
      `${trail.ref.padEnd(6)} ${trail.name.padEnd(42)} -> ${source} (${geometry.length} pts)`
    );
  }

  const sql = [
    "-- Generated route_path patch for Madeira PR trails.",
    "-- Sources: official Madeira Ocean Trails catalog / GPX when available; OSM relation/path inference otherwise.",
    "-- Safe to run multiple times.",
    "",
    ...results.map(({ placeId, geometry, source, trail, officialTrail }) => {
      const officialRef = officialTrail?.wp ? `; wp ${officialTrail.wp}` : "";
      const comment = `-- ${trail.ref} ${trail.name} (${source}${officialRef})`;
      const update = `update public.places\nset route_path = '${toSqlJson(
        geometry
      )}'::jsonb\nwhere id = '${placeId}';`;
      return `${comment}\n${update}`;
    }),
    "",
  ].join("\n");

  await fs.writeFile(OUTPUT_PATH, sql, "utf8");

  const withGeometryCount = results.filter((entry) => entry.geometry.length > 1).length;
  const officialCount = results.filter((entry) => entry.source === "official-gpx").length;
  const inferredCount = results.filter((entry) =>
    [
      "osm-relation",
      "osm-relation-exact",
      "osm-named",
      "osm-exact-name",
      "osm-named-path",
      "osm-path",
    ].includes(entry.source)
  ).length;
  const fallbackCount = results.filter((entry) => entry.source === "fallback-line").length;
  const missingCount = results.filter((entry) => entry.geometry.length < 2).length;

  console.log("");
  console.log(`Saved SQL patch to ${OUTPUT_PATH}`);
  console.log(
    `Trails with route_path: ${withGeometryCount}/${results.length} (official GPX: ${officialCount}, OSM inferred: ${inferredCount}, fallback lines: ${fallbackCount}, missing: ${missingCount})`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
