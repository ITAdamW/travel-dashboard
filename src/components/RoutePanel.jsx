import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MapPinned,
  Route as RouteIcon,
} from "lucide-react";
import { divIcon } from "leaflet";
import { fetchPlannerPlans } from "../lib/supabaseTravelData";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizeItem(item) {
  if (typeof item === "string") {
    return { placeId: item, note: "" };
  }

  return {
    placeId: item?.placeId || item?.id || "",
    note: item?.note || "",
  };
}

function normalizeItinerary(itinerary) {
  if (!Array.isArray(itinerary) || !itinerary.length) {
    return [];
  }

  return itinerary.map((day, index) => ({
    day: day?.day || `Day ${index + 1}`,
    items: Array.isArray(day?.items)
      ? day.items.map(normalizeItem).filter((item) => item.placeId)
      : [],
  }));
}

function findPlaceById(destination, placeId) {
  return destination?.places?.find((place) => place.id === placeId) || null;
}

function mapsUrl(place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.coordinates[0]},${place.coordinates[1]}`;
}

const dayPalette = [
  "#6B7A52",
  "#A25F4B",
  "#4A7A8C",
  "#8D6A9F",
  "#C58A3D",
  "#5D6274",
  "#9A6945",
];

function FitRouteBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(points, { padding: [50, 50], maxZoom: 12 });
  }, [map, points]);

  return null;
}

function createStopIcon(color, label, isActive) {
  return divIcon({
    className: "route-stop-marker",
    html: `<div style="width:${isActive ? 34 : 30}px;height:${isActive ? 34 : 30}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:${color};border:3px solid #ffffff;box-shadow:0 10px 22px rgba(34,31,25,0.20);color:#ffffff;font-size:${isActive ? 13 : 12}px;font-weight:700;">${label}</div>`,
    iconSize: [isActive ? 34 : 30, isActive ? 34 : 30],
    iconAnchor: [isActive ? 17 : 15, isActive ? 17 : 15],
    popupAnchor: [0, -(isActive ? 16 : 14)],
  });
}

export default function RoutePanel({
  countries,
  initialCountryId,
  initialDestinationId,
  initialPlanId,
}) {
  const [selectedCountryId, setSelectedCountryId] = useState(
    initialCountryId || countries[0]?.id || ""
  );
  const [selectedDestinationId, setSelectedDestinationId] = useState(
    initialDestinationId || countries[0]?.destinations?.[0]?.id || ""
  );
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(initialPlanId || "");
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [activeStopKey, setActiveStopKey] = useState("");
  const [routeGeometries, setRouteGeometries] = useState({});
  const [collapsedDays, setCollapsedDays] = useState({});
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);

  const selectedCountry = useMemo(
    () => countries.find((country) => country.id === selectedCountryId) || countries[0],
    [countries, selectedCountryId]
  );

  const selectedDestination =
    selectedCountry?.destinations?.find(
      (destination) => destination.id === selectedDestinationId
    ) || selectedCountry?.destinations?.[0];

  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) || plans[0] || null;

  useEffect(() => {
    setSelectedCountryId(initialCountryId || countries[0]?.id || "");
  }, [initialCountryId, countries]);

  useEffect(() => {
    if (!selectedCountry) return;
    if (
      !selectedCountry.destinations.some(
        (destination) => destination.id === selectedDestinationId
      )
    ) {
      setSelectedDestinationId(selectedCountry.destinations[0]?.id || "");
    }
  }, [selectedCountry, selectedDestinationId]);

  useEffect(() => {
    setSelectedDestinationId(
      initialDestinationId || selectedCountry?.destinations?.[0]?.id || ""
    );
  }, [initialDestinationId, selectedCountry?.id]);

  useEffect(() => {
    if (!initialPlanId) return;
    setSelectedPlanId(initialPlanId);
  }, [initialPlanId]);

  useEffect(() => {
    let cancelled = false;

    async function loadPlans() {
      if (!selectedDestination?.id) {
        setPlans([]);
        setSelectedPlanId("");
        return;
      }

      setLoadingPlans(true);
      try {
        const nextPlans = await fetchPlannerPlans(selectedDestination.id);
        if (cancelled) return;
        const normalizedPlans = nextPlans.map((plan) => ({
          ...plan,
          itinerary: normalizeItinerary(plan.itinerary),
          daysCount: normalizeItinerary(plan.itinerary).length,
        }));
        setPlans(normalizedPlans);
        setSelectedPlanId((current) => {
          if (initialPlanId && normalizedPlans.some((plan) => plan.id === initialPlanId)) {
            return initialPlanId;
          }
          if (current && normalizedPlans.some((plan) => plan.id === current)) {
            return current;
          }
          return normalizedPlans[0]?.id || "";
        });
      } catch {
        if (!cancelled) {
          setPlans([]);
          setSelectedPlanId("");
        }
      } finally {
        if (!cancelled) {
          setLoadingPlans(false);
        }
      }
    }

    loadPlans();

    return () => {
      cancelled = true;
    };
  }, [selectedDestination?.id, initialPlanId]);

  const planDays = useMemo(() => {
    if (!selectedPlan || !selectedDestination) return [];

    return normalizeItinerary(selectedPlan.itinerary).map((day, dayIndex) => ({
      ...day,
      color: dayPalette[dayIndex % dayPalette.length],
      places: day.items
        .map((item, itemIndex) => {
          const place = findPlaceById(selectedDestination, item.placeId);
          if (!place) return null;
          return {
            key: `${dayIndex}-${itemIndex}-${place.id}`,
            itemIndex,
            dayIndex,
            place,
            note: item.note,
          };
        })
        .filter(Boolean),
    }));
  }, [selectedDestination, selectedPlan]);

  const routePoints = useMemo(
    () => planDays.flatMap((day) => day.places.map((entry) => entry.place.coordinates)),
    [planDays]
  );

  useEffect(() => {
    setCollapsedDays({});
    setSelectedDayIndex(null);
  }, [selectedPlanId, selectedDestinationId]);

  const visibleDays = useMemo(() => {
    if (selectedDayIndex == null) return planDays;
    return planDays.filter((_, index) => index === selectedDayIndex);
  }, [planDays, selectedDayIndex]);

  const visibleRoutePoints = useMemo(
    () =>
      visibleDays.flatMap((day) =>
        day.places.map((entry) => entry.place.coordinates)
      ),
    [visibleDays]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRouteGeometries() {
      const nextRoutes = {};

      await Promise.all(
        planDays.map(async (day) => {
          const points = day.places.map((entry) => entry.place.coordinates);
          if (points.length < 2) {
            nextRoutes[day.day] = points;
            return;
          }

          try {
            const coordinates = points
              .map(([lat, lng]) => `${lng},${lat}`)
              .join(";");
            const response = await fetch(
              `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`
            );
            const data = await response.json();
            const geometry = data?.routes?.[0]?.geometry?.coordinates?.map(
              ([lng, lat]) => [lat, lng]
            );
            nextRoutes[day.day] = geometry?.length ? geometry : points;
          } catch {
            nextRoutes[day.day] = points;
          }
        })
      );

      if (!cancelled) {
        setRouteGeometries(nextRoutes);
      }
    }

    if (planDays.length) {
      loadRouteGeometries();
    } else {
      setRouteGeometries({});
    }

    return () => {
      cancelled = true;
    };
  }, [planDays]);

  useEffect(() => {
    setActiveStopKey(visibleDays[0]?.places[0]?.key || "");
  }, [visibleDays]);

  const activeStop =
    visibleDays.flatMap((day) => day.places).find((entry) => entry.key === activeStopKey) ||
    visibleDays[0]?.places[0] ||
    null;

  return (
    <section className="rounded-[2rem] border border-[#E6DED1] bg-white p-6 shadow-[0_16px_60px_rgba(34,31,25,0.05)]">
      <div className="mb-6 flex flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#8A7F6C]">Route</p>
          <h3 className="mt-2 text-3xl font-semibold text-[#1F1D1A]">
            Mapa trasy dla wybranego planu
          </h3>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#4D463D]">Kraj</span>
            <select
              value={selectedCountryId}
              onChange={(e) => setSelectedCountryId(e.target.value)}
              className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none"
            >
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.countryName}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#4D463D]">Destination</span>
            <select
              value={selectedDestinationId}
              onChange={(e) => setSelectedDestinationId(e.target.value)}
              className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none"
            >
              {(selectedCountry?.destinations || []).map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#4D463D]">Plan</span>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none"
            >
              {plans.length ? (
                plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · {plan.daysCount} dni
                  </option>
                ))
              ) : (
                <option value="">
                  {loadingPlans ? "Ladowanie planow..." : "Brak planow"}
                </option>
              )}
            </select>
          </label>
        </div>
      </div>

      {selectedPlan && planDays.length ? (
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="min-h-0 rounded-[1.75rem] border border-[#E8DFD2] bg-[#FBF8F2] p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[#8A7F6C]">
                  Selected route
                </p>
                <h4 className="mt-2 text-2xl font-semibold text-[#1F1D1A]">
                  {selectedPlan.name}
                </h4>
                <p className="mt-2 text-sm text-[#6B6255]">
                  {selectedCountry?.countryName} · {selectedDestination?.name} · {selectedPlan.daysCount} dni
                </p>
              </div>
              <span className="rounded-full border border-[#E1D7C8] bg-white px-3 py-1 text-xs text-[#6B6255]">
                {planDays.length} dni
              </span>
            </div>

            <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
              {planDays.map((day, dayIndex) => {
                const isCollapsed = collapsedDays[dayIndex];
                const isSelectedDay = selectedDayIndex === dayIndex;

                return (
                <button
                  key={day.day}
                  type="button"
                  onClick={() =>
                    setSelectedDayIndex((current) =>
                      current === dayIndex ? null : dayIndex
                    )
                  }
                  className={cn(
                    "w-full rounded-[1.35rem] border bg-white p-4 text-left transition",
                    isSelectedDay
                      ? "border-[#BFAE97] shadow-[0_8px_18px_rgba(34,31,25,0.06)]"
                      : "border-[#E5DCCF]"
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-4 w-4 rounded-full border border-white shadow-sm"
                        style={{ backgroundColor: day.color }}
                      />
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">Day</p>
                        <p className="text-base font-semibold text-[#1F1D1A]">{day.day}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setCollapsedDays((current) => ({
                            ...current,
                            [dayIndex]: !current[dayIndex],
                          }));
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E1D7C8] bg-[#FBF8F2] text-[#6B6255] transition hover:bg-white"
                        aria-label={isCollapsed ? "Rozwin dzien" : "Zwin dzien"}
                      >
                        {isCollapsed ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronUp className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <span className="rounded-full border border-[#E1D7C8] bg-[#FBF8F2] px-2.5 py-1 text-xs text-[#6B6255]">
                      {day.places.length} stop
                    </span>
                  </div>

                  {!isCollapsed && (
                  <div className="space-y-2">
                    {day.places.map((entry, index) => (
                      <button
                        key={entry.key}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveStopKey(entry.key);
                        }}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-[1rem] border px-3 py-3 text-left transition",
                          activeStopKey === entry.key
                            ? "border-[#D8CCBB] bg-[#FBF8F2]"
                            : "border-[#EEE6DA] bg-white hover:border-[#D8CCBB] hover:bg-[#FBF8F2]"
                        )}
                      >
                        <span
                          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: day.color }}
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-[#1F1D1A]">{entry.place.name}</p>
                          <p className="mt-1 text-sm text-[#6B6255]">{entry.place.note || entry.place.subtitle}</p>
                          {entry.note ? (
                            <p className="mt-2 text-sm leading-6 text-[#4F493F]">{entry.note}</p>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                  )}
                </button>
                );
              })}
            </div>
          </aside>

          <div className="rounded-[1.75rem] border border-[#E8DFD2] bg-white p-4 shadow-[0_18px_60px_rgba(34,31,25,0.06)]">
            <div className="relative min-h-[860px] overflow-hidden rounded-[1.6rem] border border-[#E8E0D3] bg-[radial-gradient(circle_at_top_left,rgba(107,122,82,0.08),transparent_35%),linear-gradient(180deg,#F3EEE5_0%,#ECE5D8_100%)]">
              <div className="absolute inset-0 z-0 [filter:saturate(0.35)_sepia(0.15)_contrast(0.95)]">
                <MapContainer
                  center={visibleRoutePoints[0]}
                  zoom={11}
                  zoomControl={true}
                  attributionControl={false}
                  className="h-full w-full"
                  scrollWheelZoom={true}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <FitRouteBounds points={visibleRoutePoints} />

                  {visibleDays.map((day) => (
                    <Polyline
                      key={`route-${day.day}`}
                      positions={routeGeometries[day.day] || day.places.map((entry) => entry.place.coordinates)}
                      pathOptions={{
                        color: day.color,
                        weight: 5,
                        opacity: 0.85,
                      }}
                    />
                  ))}

                  {visibleDays.flatMap((day) =>
                    day.places.map((entry, index) => {
                      const isActive = activeStopKey === entry.key;
                      return (
                        <Marker
                          key={entry.key}
                          position={entry.place.coordinates}
                          icon={createStopIcon(day.color, String(index + 1), isActive)}
                          eventHandlers={{ click: () => setActiveStopKey(entry.key) }}
                        >
                          <Popup>
                            <div className="min-w-[190px]">
                              <p className="text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">
                                {day.day} · stop {index + 1}
                              </p>
                              <p className="mt-2 font-semibold text-[#1F1D1A]">{entry.place.name}</p>
                              <p className="mt-2 text-sm text-[#5B544A]">
                                {entry.place.note || entry.place.subtitle || entry.place.info}
                              </p>
                              <button
                                onClick={() =>
                                  window.open(mapsUrl(entry.place), "_blank", "noopener,noreferrer")
                                }
                                className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#DCD1C0] bg-[#F8F4ED] px-3 py-1.5 text-xs text-[#3E382F]"
                              >
                                Nawiguj <ExternalLink className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })
                  )}
                </MapContainer>
              </div>

              <div className="pointer-events-none absolute bottom-4 left-4 z-[650] w-[360px] max-w-[calc(100%-2rem)]">
                <div className="pointer-events-auto rounded-[1.35rem] border border-[#E6DED1] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_16px_36px_rgba(34,31,25,0.10)] backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-[#8A7F6C]">
                        Active stop
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[#1F1D1A]">
                        {activeStop?.place?.name || "Brak punktu"}
                      </p>
                      <p className="mt-2 text-sm text-[#6B6255]">
                        {activeStop
                          ? `${planDays[activeStop.dayIndex]?.day} · punkt ${activeStop.itemIndex + 1}`
                          : "Wybierz punkt z planu po lewej stronie"}
                      </p>
                    </div>
                    <MapPinned className="h-5 w-5 text-[#6B7A52]" />
                  </div>
                  {activeStop?.note ? (
                    <p className="mt-3 text-sm leading-6 text-[#4D463D]">{activeStop.note}</p>
                  ) : null}
                </div>
              </div>

              <div className="pointer-events-none absolute bottom-4 right-4 z-[650] w-[360px] max-w-[calc(100%-2rem)]">
                <div className="pointer-events-auto rounded-[1.35rem] border border-[#E6DED1] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_16px_36px_rgba(34,31,25,0.10)] backdrop-blur">
                  <div className="flex items-center gap-2">
                    <RouteIcon className="h-4 w-4 text-[#6B7A52]" />
                    <p className="text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">
                      Day colors
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {planDays.map((day, index) => (
                      <span
                        key={`legend-${day.day}`}
                        className="inline-flex items-center gap-2 rounded-full border border-[#E1D7C8] bg-white px-3 py-1.5 text-xs text-[#4D463D]"
                      >
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: day.color }}
                        />
                        {day.day || `Day ${index + 1}`}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-dashed border-[#DDD2C3] bg-[#FBF8F2] px-5 py-10 text-center text-sm text-[#7C7263]">
          {loadingPlans
            ? "Ladowanie planow i tras..."
            : "Dla tej destynacji nie ma jeszcze planu, ktory mozna pokazac jako trase."}
        </div>
      )}
    </section>
  );
}
