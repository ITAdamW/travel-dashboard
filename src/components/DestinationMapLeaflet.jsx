import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { ExternalLink, Footprints, Star } from "lucide-react";
import { updatePlaceRoutePath } from "../lib/supabaseTravelData";
import {
  enrichPlaceForDisplay,
  isSameTrailFamily,
  getPlaceRoutePath,
  getTrailRouteHint,
  isTrailPlace,
} from "../lib/placePresentation";
import {
  buildFallbackTrailGeometry,
  resolveTrailGeometryForPlace,
} from "../lib/trailGeometry";
import { getCachedTrailPath, setCachedTrailPath } from "../lib/trailCache";
import RichText from "./RichText";

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = points.map((p) => p.coordinates);
    map.fitBounds(bounds, { padding: [45, 45], maxZoom: 12 });
  }, [map, points]);
  return null;
}

function SyncMapSize() {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => {
      window.requestAnimationFrame(() => {
        map.invalidateSize();
      });
    };

    invalidate();

    const container = map.getContainer();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => invalidate())
        : null;

    observer?.observe(container);
    window.addEventListener("resize", invalidate);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", invalidate);
    };
  }, [map]);

  return null;
}

function MiniWorldLocator({ destination }) {
  const lat = destination.places.reduce((sum, p) => sum + p.coordinates[0], 0) / destination.places.length;
  const lng = destination.places.reduce((sum, p) => sum + p.coordinates[1], 0) / destination.places.length;
  const left = Math.min(Math.max(((lng + 180) / 360) * 100, 8), 92);
  const top = Math.min(Math.max(((90 - lat) / 180) * 100, 8), 92);

  return (
    <div className="absolute bottom-4 right-4 z-[600] w-36 overflow-hidden rounded-2xl border border-[#D9CFBF] bg-white/90 p-3 shadow-[0_8px_20px_rgba(34,31,25,0.08)] backdrop-blur">
      <p className="text-[10px] uppercase tracking-[0.24em] text-[#8A7F6C]">World position</p>
      <div className="mt-2 relative h-20 rounded-xl bg-[linear-gradient(180deg,#EDE7DB_0%,#E5DED1_100%)]">
        <div className="absolute left-[8%] top-[20%] h-5 w-8 rounded-full bg-[#D3CAB9] opacity-80" />
        <div className="absolute left-[42%] top-[18%] h-6 w-10 rounded-full bg-[#D3CAB9] opacity-80" />
        <div className="absolute left-[67%] top-[38%] h-5 w-8 rounded-full bg-[#D3CAB9] opacity-80" />
        <div className="absolute left-[30%] top-[56%] h-6 w-14 rounded-full bg-[#D3CAB9] opacity-80" />
        <span className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#6B7A52] shadow" style={{ left: `${left}%`, top: `${top}%` }} />
      </div>
    </div>
  );
}

function mapsUrl(place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.coordinates[0]},${place.coordinates[1]}`;
}

function withTrailResolutionCoordinates(place, routeHint) {
  if (
    Array.isArray(routeHint?.startCoordinates) &&
    routeHint.startCoordinates.length >= 2
  ) {
    return {
      ...place,
      coordinates: routeHint.startCoordinates,
    };
  }

  return place;
}

function findRelatedExactTrailGeometry(place, trailPlaces, trailGeometries) {
  for (const candidate of trailPlaces) {
    if (!candidate || candidate.id === place.id) continue;
    if (!isSameTrailFamily(place, candidate)) continue;

    const stored = getPlaceRoutePath(candidate);
    if (stored.length >= 3) return stored;

    const runtime = Array.isArray(trailGeometries[candidate.id])
      ? trailGeometries[candidate.id]
      : [];
    if (runtime.length >= 3) return runtime;
  }

  return [];
}

function resolveDisplayedTrailGeometry(place, trailPlaces, trailGeometries) {
  const stored = getPlaceRoutePath(place);
  const runtime = Array.isArray(trailGeometries[place.id])
    ? trailGeometries[place.id]
    : [];
  const direct = stored.length > runtime.length ? stored : runtime;

  if (direct.length >= 3) {
    return { geometry: direct, kind: "exact" };
  }

  const relatedExact = findRelatedExactTrailGeometry(
    place,
    trailPlaces,
    trailGeometries
  );
  if (relatedExact.length >= 3) {
    return { geometry: relatedExact, kind: "exact" };
  }

  if (direct.length >= 2) {
    return { geometry: direct, kind: "approx" };
  }

  return { geometry: [], kind: "missing" };
}

export default function DestinationMapLeaflet({ destination, activePlaceId, onSelectPlace }) {
  const [showTrailLayer, setShowTrailLayer] = useState(false);
  const [trailGeometries, setTrailGeometries] = useState({});
  const displayPlaces = useMemo(
    () => (destination.places || []).map((place) => enrichPlaceForDisplay(place)),
    [destination.places]
  );
  const trailPlaces = useMemo(
    () => displayPlaces.filter((place) => isTrailPlace(place)),
    [displayPlaces]
  );
  const activePlace =
    displayPlaces.find((place) => place.id === activePlaceId) || displayPlaces[0];

  useEffect(() => {
    if (!showTrailLayer || !trailPlaces.length) return;

    let cancelled = false;

    async function preloadTrailGeometries() {
      await Promise.all(
        trailPlaces.map(async (trailPlace) => {
          const storedGeometry = getPlaceRoutePath(trailPlace);
          if (storedGeometry.length > 1) {
            if (!cancelled) {
              setTrailGeometries((current) => ({
                ...current,
                [trailPlace.id]: storedGeometry,
              }));
            }
            return;
          }

          const cachedGeometry = getCachedTrailPath(trailPlace.id);
          if (cachedGeometry.length > 1) {
            if (!cancelled) {
              setTrailGeometries((current) => ({
                ...current,
                [trailPlace.id]: cachedGeometry,
              }));
            }
            return;
          }

          const routeHint = getTrailRouteHint(trailPlace);
          const resolutionPlace = withTrailResolutionCoordinates(
            trailPlace,
            routeHint
          );
          const fallbackGeometry = buildFallbackTrailGeometry(trailPlace, routeHint);

          if (fallbackGeometry.length > 1 && !cancelled) {
            setTrailGeometries((current) => ({
              ...current,
              [trailPlace.id]: current[trailPlace.id]?.length > 1 ? current[trailPlace.id] : fallbackGeometry,
            }));
          }

          try {
            const resolvedGeometry = await resolveTrailGeometryForPlace(
              resolutionPlace,
              routeHint
            );

            if (!cancelled && resolvedGeometry.length > 1) {
              setTrailGeometries((current) => ({
                ...current,
                [trailPlace.id]: resolvedGeometry,
              }));
              setCachedTrailPath(trailPlace.id, resolvedGeometry);
              updatePlaceRoutePath(trailPlace.id, resolvedGeometry).catch(() => {});
            }
          } catch {
            // Keep the fallback geometry when network lookup fails.
          }
        })
      );
    }

    preloadTrailGeometries();

    return () => {
      cancelled = true;
    };
  }, [showTrailLayer, trailPlaces]);

  return (
    <div className="rounded-[2rem] border border-[#E6DED1] bg-white p-5 shadow-[0_16px_60px_rgba(34,31,25,0.05)]">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-[#8A7F6C]">Places map</p>
        <h3 className="mt-2 text-2xl font-semibold">Interactive destination map</h3>
      </div>

      <div className="relative aspect-[16/9] overflow-hidden rounded-[1.5rem] border border-[#E8E0D3] bg-[radial-gradient(circle_at_top_left,rgba(107,122,82,0.08),transparent_35%),linear-gradient(180deg,#F3EEE5_0%,#ECE5D8_100%)]">
        <div className="absolute inset-0 z-0 [filter:saturate(0.35)_sepia(0.15)_contrast(0.95)]">
          <MapContainer
            center={displayPlaces[0].coordinates}
            zoom={10}
            zoomControl={true}
            attributionControl={false}
            className="h-full w-full"
            scrollWheelZoom={true}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <SyncMapSize />
            <FitBounds points={displayPlaces} />
            {showTrailLayer &&
              trailPlaces.map((place) => {
                const { geometry, kind } = resolveDisplayedTrailGeometry(
                  place,
                  trailPlaces,
                  trailGeometries
                );

                if (geometry.length < 2) return null;

                return (
                  <Polyline
                    key={`trail-${place.id}`}
                    positions={geometry}
                    pathOptions={{
                      color: kind === "exact" ? "#6B7A52" : "#98A27A",
                      weight: kind === "exact" ? 5 : 3,
                      opacity: kind === "exact" ? 0.78 : 0.55,
                      dashArray: kind === "exact" ? undefined : "8 10",
                    }}
                  />
                );
              })}
            {displayPlaces.map((place) => {
              const isActive = place.id === activePlaceId;
              return (
                <CircleMarker
                  key={place.id}
                  center={place.coordinates}
                  radius={isActive ? 9 : 7}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 2,
                    fillColor: isActive ? "#2B2A27" : "#6B7A52",
                    fillOpacity: 1,
                  }}
                  eventHandlers={{ click: () => onSelectPlace(place.id) }}
                >
                  <Popup>
                    <div className="min-w-[180px]">
                      <p className="font-semibold text-[#1F1D1A]">{place.name}</p>
                      <div className="mt-2 flex items-center gap-2 text-sm text-[#6B6255]"><Star className="h-4 w-4 fill-current text-[#6B7A52]" /><span>{place.rating.toFixed(1)}</span></div>
                      <RichText
                        text={place.info}
                        className="mt-2 space-y-1 text-sm text-[#5B544A]"
                        paragraphClassName="leading-6 text-[#5B544A]"
                        listClassName="text-[#5B544A]"
                      />
                      <button onClick={() => window.open(mapsUrl(place), "_blank", "noopener,noreferrer")} className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#DCD1C0] bg-[#F8F4ED] px-3 py-1.5 text-xs text-[#3E382F]">
                        Nawiguj <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        <MiniWorldLocator destination={destination} />

        {trailPlaces.length > 0 && (
          <div className="absolute left-6 top-6 z-[600] max-w-[calc(100%-1.5rem)] rounded-[1.35rem] border border-[#DCD3C4] bg-white/96 px-4 py-3 shadow-[0_10px_24px_rgba(34,31,25,0.10)] backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#8A7F6C]">
              Warstwa szlakow
            </p>
            <button
              onClick={() => setShowTrailLayer((current) => !current)}
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#DCD1C0] bg-[#F8F4ED] px-3 py-2 text-xs font-medium text-[#3E382F] transition hover:bg-[#F2ECE2]"
            >
              <Footprints className="h-3.5 w-3.5" />
              {showTrailLayer ? "Ukryj wszystkie trasy" : "Pokaz wszystkie trasy"}
            </button>
            <p className="mt-2 text-xs text-[#6B6255]">
              {trailPlaces.length} {trailPlaces.length === 1 ? "szlak" : "szlaki"} pokazuje sie i znika jednym kliknieciem.
            </p>
          </div>
        )}

        <div className="absolute left-1/2 top-6 z-[600] w-[330px] max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-[1.5rem] border border-[#E4DACA] bg-white/97 p-4 shadow-[0_10px_24px_rgba(34,31,25,0.10)] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-[#1F1D1A]">{activePlace.name}</p>
              <div className="mt-2 flex items-center gap-3 text-sm text-[#6B6255]">
                <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-current text-[#6B7A52]" /> {activePlace.rating.toFixed(1)}</span>
              </div>
              <RichText
                text={activePlace.info}
                className="mt-2 space-y-1 text-sm text-[#6B6255]"
                paragraphClassName="leading-6 text-[#6B6255]"
                listClassName="text-[#6B6255]"
              />
            </div>
          </div>
          <button onClick={() => window.open(mapsUrl(activePlace), "_blank", "noopener,noreferrer")} className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#DCD1C0] bg-[#F8F4ED] px-3 py-1.5 text-xs text-[#3E382F] transition hover:bg-[#F2ECE2]">
            Nawiguj <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
