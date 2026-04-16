function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const OVERPASS_TIMEOUT_MS = 8000;

const KNOWN_TRAIL_ALIASES = [
  {
    match: ["balcoes"],
    aliases: ["balcoes", "balcões", "vereda dos balcoes", "vereda dos balcões"],
    refs: ["pr 11"],
  },
  {
    match: ["25 fontes"],
    aliases: ["25 fontes", "lagoa das 25 fontes", "levada das 25 fontes"],
    refs: ["pr 6"],
  },
  {
    match: ["risco"],
    aliases: ["risco", "levada do risco"],
    refs: ["pr 6"],
  },
  {
    match: ["caldeirao verde"],
    aliases: ["caldeirao verde", "caldeirão verde", "levada do caldeirao verde"],
    refs: ["pr 9"],
  },
  {
    match: ["caldeirao do inferno"],
    aliases: ["caldeirao do inferno", "caldeirão do inferno"],
    refs: ["pr 9"],
  },
  {
    match: ["levada do rei"],
    aliases: ["levada do rei"],
    refs: ["pr 18"],
  },
  {
    match: ["faja do rodrigues"],
    aliases: ["faja do rodrigues", "fajã do rodrigues"],
    refs: ["pr 16"],
  },
  {
    match: ["alecrim"],
    aliases: ["levada do alecrim", "alecrim"],
    refs: ["pr 6.2"],
  },
  {
    match: ["levada do moinho"],
    aliases: ["levada do moinho", "pr 7"],
    refs: ["pr 7"],
  },
  {
    match: ["pesqueiro"],
    aliases: ["vereda do pesqueiro", "pesqueiro"],
    refs: [],
  },
  {
    match: ["ponta de sao lourenco"],
    aliases: [
      "ponta de sao lourenco",
      "ponta de são lourenço",
      "vereda da ponta de sao lourenco",
      "vereda da ponta de são lourenço",
    ],
    refs: ["pr 8"],
  },
  {
    match: ["pico do arieiro", "pico ruivo"],
    aliases: [
      "pico do arieiro",
      "pico ruivo",
      "vereda do arieiro",
      "vereda do arieiro ao pico ruivo",
    ],
    refs: ["pr 1"],
  },
];

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

function escapeOverpassString(value) {
  return String(value || "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/"/g, '\\"');
}

function distanceToPoint(point, target) {
  const [lat1, lng1] = point;
  const [lat2, lng2] = target;
  const latDiff = lat1 - lat2;
  const lngDiff = lng1 - lng2;

  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
}

function getTrailSearchProfile(place) {
  const name = normalizeText(place?.name || "");
  const description = normalizeText(
    [place?.subtitle, place?.note, place?.description].join(" ")
  );
  const haystack = `${name} ${description}`.trim();
  const aliasEntry =
    KNOWN_TRAIL_ALIASES.find((entry) =>
      entry.match.every((fragment) => haystack.includes(fragment))
    ) || null;

  const aliases = [
    place?.name || "",
    ...(aliasEntry?.aliases || []),
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  const refs = (aliasEntry?.refs || []).map((value) => normalizeText(value));

  return {
    name,
    aliases: [...new Set(aliases)],
    refs: [...new Set(refs)],
  };
}

function scoreGeometry(element, searchProfile, point) {
  const geometry = Array.isArray(element?.geometry)
    ? element.geometry.map((entry) => [entry.lat, entry.lon])
    : [];

  if (geometry.length < 2) {
    return -Infinity;
  }

  const candidateName = normalizeText(
    element?.tags?.name || element?.tags?.["name:en"] || ""
  );
  const candidateRef = normalizeText(element?.tags?.ref || "");
  const aliasHits = searchProfile.aliases.reduce(
    (total, alias) =>
      total +
      (candidateName === alias
        ? 30
        : candidateName.includes(alias) || alias.includes(candidateName)
          ? 18
          : 0),
    0
  );
  const refHits = searchProfile.refs.reduce(
    (total, ref) =>
      total +
      (candidateRef === ref
        ? 35
        : candidateRef.includes(ref) || ref.includes(candidateRef)
          ? 22
          : 0),
    0
  );
  const exactBoost =
    candidateName === searchProfile.name
      ? 50
      : candidateName.includes(searchProfile.name) ||
          searchProfile.name.includes(candidateName)
        ? 25
        : 0;

  const proximityPenalty = Math.min(
    ...geometry.map((entry) => distanceToPoint(entry, point))
  );

  return exactBoost + aliasHits + refHits + geometry.length - proximityPenalty * 120;
}

async function fetchFromOverpass(query) {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  for (const endpoint of endpoints) {
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

  throw new Error("Nie udalo sie pobrac geometrii szlaku z Overpass.");
}

function isValidCoordinatePair(value) {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
  );
}

export function buildFallbackTrailGeometry(place, routeHint) {
  const startPoint = isValidCoordinatePair(routeHint?.startCoordinates)
    ? routeHint.startCoordinates
    : isValidCoordinatePair(place?.startCoordinates)
      ? place.startCoordinates
      : isValidCoordinatePair(place?.coordinates)
        ? place.coordinates
        : null;
  const endPoint = isValidCoordinatePair(routeHint?.targetCoordinates)
    ? routeHint.targetCoordinates
    : isValidCoordinatePair(place?.endCoordinates)
      ? place.endCoordinates
      : null;

  if (!startPoint || !endPoint) {
    return [];
  }

  const start = [Number(startPoint[0]), Number(startPoint[1])];
  const end = [Number(endPoint[0]), Number(endPoint[1])];

  if (haversineDistance(start, end) < 0.02) {
    return [];
  }

  return [start, end];
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

function geometryLengthKm(geometry) {
  let total = 0;

  for (let index = 1; index < geometry.length; index += 1) {
    total += haversineDistance(geometry[index - 1], geometry[index]);
  }

  return total;
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

function getExpectedDistanceKm(place) {
  const candidates = [
    place?.distanceKm,
    place?.distance_km,
    place?.distance,
  ].map(Number);

  return candidates.find((value) => Number.isFinite(value) && value > 0) || 0;
}

function resolveGraphGeometry(graph, pointsByKey, startPoint, endPoint, expectedDistanceKm) {
  if (!graph.size || !startPoint) {
    return [];
  }

  const nearestStart = findNearestNode(startPoint, pointsByKey);
  if (!nearestStart.key || nearestStart.distanceKm > 1.5) {
    return [];
  }

  const nearestEnd = endPoint ? findNearestNode(endPoint, pointsByKey) : null;
  const directPath =
    nearestEnd?.key && nearestEnd.distanceKm <= 1.5
      ? [
          startPoint,
          ...dijkstraPath(graph, nearestStart.key, nearestEnd.key)
            .map((key) => pointsByKey.get(key))
            .filter(Boolean),
          endPoint,
        ]
      : [];

  if (directPath.length > 1) {
    const directDistanceKm = geometryLengthKm(directPath);
    if (
      !expectedDistanceKm ||
      Math.abs(directDistanceKm - expectedDistanceKm) <=
        Math.max(expectedDistanceKm * 0.75, 2.5)
    ) {
      return directPath;
    }
  }

  const targetDistanceKm =
    expectedDistanceKm > 0
      ? endPoint
        ? expectedDistanceKm
        : expectedDistanceKm / 2
      : 0;
  const { distances, previous } = dijkstraDistances(graph, nearestStart.key);
  let bestKey = "";
  let bestScore = -Infinity;

  for (const [key, distanceKm] of distances.entries()) {
    if (key === nearestStart.key || distanceKm < 0.15) {
      continue;
    }

    let score = distanceKm * 10;
    if (targetDistanceKm > 0) {
      score -= Math.abs(distanceKm - targetDistanceKm) * 18;
    }

    const degree = getNodeDegree(graph, key);
    if (degree <= 1) score += 10;
    else if (degree > 2) score -= degree * 2;

    if (score > bestScore) {
      bestKey = key;
      bestScore = score;
    }
  }

  if (!bestKey) {
    return directPath;
  }

  const keyPath = rebuildPath(previous, bestKey);
  return [
    startPoint,
    ...keyPath.map((key) => pointsByKey.get(key)).filter(Boolean),
    ...(endPoint ? [endPoint] : []),
  ];
}

async function fetchTrailRelationGeometryForPlace(place, routeHint) {
  const startPoint = isValidCoordinatePair(routeHint?.startCoordinates)
    ? [Number(routeHint.startCoordinates[0]), Number(routeHint.startCoordinates[1])]
    : isValidCoordinatePair(place?.startCoordinates)
      ? [Number(place.startCoordinates[0]), Number(place.startCoordinates[1])]
      : isValidCoordinatePair(place?.coordinates)
        ? [Number(place.coordinates[0]), Number(place.coordinates[1])]
        : null;
  const endPoint = isValidCoordinatePair(routeHint?.targetCoordinates)
    ? [Number(routeHint.targetCoordinates[0]), Number(routeHint.targetCoordinates[1])]
    : isValidCoordinatePair(place?.endCoordinates)
      ? [Number(place.endCoordinates[0]), Number(place.endCoordinates[1])]
      : null;
  const expectedDistanceKm = getExpectedDistanceKm(place);
  const refs = [...new Set([routeHint?.ref, ...(routeHint?.refs || [])]
    .map((value) => normalizeText(value))
    .filter(Boolean))];
  const names = [...new Set([routeHint?.officialName, place?.name]
    .map((value) => String(value || "").trim())
    .filter(Boolean))];
  const point = startPoint || endPoint;

  if (!point || (!refs.length && !names.length)) {
    return [];
  }

  const queries = [
    ...refs.map(
      (ref) => `
[out:json][timeout:25];
relation["route"="hiking"]["ref"~"^${escapeOverpassString(ref)}$",i](around:12000,${point[0]},${point[1]});
way(r);
out geom;
`
    ),
    ...names.map(
      (name) => `
[out:json][timeout:25];
relation["route"="hiking"]["name"~"^${escapeOverpassString(name)}$",i](around:12000,${point[0]},${point[1]});
way(r);
out geom;
`
    ),
  ];

  for (const query of queries) {
    const data = await fetchFromOverpass(query);
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    const ways = elements.filter(
      (element) => element?.type === "way" && Array.isArray(element?.geometry)
    );
    const { graph, pointsByKey } = buildPathGraph(ways);
    const geometry = resolveGraphGeometry(
      graph,
      pointsByKey,
      startPoint,
      endPoint,
      expectedDistanceKm
    );

    if (geometry.length > 1) {
      return geometry;
    }
  }

  return [];
}

async function fetchTrailPathBetweenPoints(startPoint, endPoint) {
  const south = Math.min(startPoint[0], endPoint[0]) - 0.02;
  const north = Math.max(startPoint[0], endPoint[0]) + 0.02;
  const west = Math.min(startPoint[1], endPoint[1]) - 0.02;
  const east = Math.max(startPoint[1], endPoint[1]) + 0.02;

  const query = `
[out:json][timeout:25];
(
  way["highway"~"path|footway|track|steps"](${south},${west},${north},${east});
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
    nearestStart.distanceKm > 0.5 ||
    nearestEnd.distanceKm > 0.5
  ) {
    return [];
  }

  const keyPath = dijkstraPath(graph, nearestStart.key, nearestEnd.key);
  if (!keyPath.length) {
    return [];
  }

  return [
    startPoint,
    ...keyPath.map((key) => pointsByKey.get(key)).filter(Boolean),
    endPoint,
  ];
}

export async function fetchTrailGeometryForPlace(place, routeHint = null) {
  const name = String(place?.name || "").trim();
  const point = place?.coordinates;

  if (!name || !Array.isArray(point) || point.length < 2) {
    return [];
  }

  const relationGeometry = await fetchTrailRelationGeometryForPlace(place, routeHint);
  if (relationGeometry.length > 1) {
    return relationGeometry;
  }

  const [lat, lng] = point;
  const searchProfile = getTrailSearchProfile(place);
  const nameRegex = searchProfile.aliases.length
    ? searchProfile.aliases.map(escapeOverpassString).join("|")
    : escapeOverpassString(name);
  const refRegex = searchProfile.refs.length
    ? searchProfile.refs.map(escapeOverpassString).join("|")
    : "";
  const query = `
[out:json][timeout:25];
(
  relation["route"="hiking"]["name"~"${nameRegex}",i](around:12000,${lat},${lng});
  relation["route"="hiking"]["ref"~"${refRegex || nameRegex}",i](around:12000,${lat},${lng});
  way["highway"~"path|footway|track"]["name"~"${nameRegex}",i](around:6000,${lat},${lng});
  relation["route"="hiking"](around:6000,${lat},${lng});
  way["highway"~"path|footway|track"](around:3500,${lat},${lng});
);
out geom;
`;

  const data = await fetchFromOverpass(query);
  const elements = Array.isArray(data?.elements) ? data.elements : [];
  const bestElement = [...elements]
    .filter((element) => Array.isArray(element?.geometry) && element.geometry.length > 1)
    .sort(
      (left, right) =>
        scoreGeometry(right, searchProfile, point) -
        scoreGeometry(left, searchProfile, point)
    )[0];

  if (!bestElement?.geometry?.length) {
    return [];
  }

  return bestElement.geometry.map((entry) => [entry.lat, entry.lon]);
}

export async function resolveTrailGeometryForPlace(place, routeHint) {
  const fallbackGeometry = buildFallbackTrailGeometry(place, routeHint);
  const storedTarget = routeHint?.targetCoordinates;

  if (
    Array.isArray(storedTarget) &&
    storedTarget.length >= 2 &&
    Array.isArray(place?.coordinates) &&
    place.coordinates.length >= 2
  ) {
    const routedPath = await fetchTrailPathBetweenPoints(
      place.coordinates,
      storedTarget
    );

    if (routedPath.length > 1) {
      return routedPath;
    }
  }

  const fetchedGeometry = await fetchTrailGeometryForPlace(place, routeHint);
  if (fetchedGeometry.length > 1) {
    return fetchedGeometry;
  }

  return fallbackGeometry;
}
