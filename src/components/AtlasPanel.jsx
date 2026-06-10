import { createElement, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Church,
  Castle,
  Globe2,
  Heart,
  Landmark,
  MapPin,
  Mountain,
  Plane,
  Search,
  Trees,
  Waves,
  X,
} from "lucide-react";
import { fetchPlannerPlans } from "../lib/supabaseTravelData";

const FAVORITE_DESTINATIONS_STORAGE_KEY = "travel-dashboard-favorite-destinations";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const statusStyles = {
  visited:
    "theme-atlas-status theme-atlas-status-visited bg-[#008EA1] text-white border-[#008EA1]",
  planned:
    "theme-atlas-status theme-atlas-status-planned bg-[#E8FAFC] text-[#075E6A] border-[#B9EEF4]",
};

const countryCodeMap = {
  Portugal: "pt",
  Spain: "es",
  France: "fr",
  Italy: "it",
  Czechia: "cz",
  "Czech Republic": "cz",
  Austria: "at",
  Poland: "pl",
  Hungary: "hu",
  Greece: "gr",
  Malta: "mt",
};

const testFavoriteNames = [
  "madera",
  "madeira",
  "praga",
  "prague",
  "wieden",
  "wiedeń",
  "vienna",
  "budapeszt",
  "budapest",
  "czestochowa",
  "częstochowa",
];

const countryIconMap = {
  Portugal: Waves,
  Włochy: Landmark,
  Wlochy: Landmark,
  Italy: Landmark,
  Czechia: Castle,
  "Czech Republic": Castle,
  Austria: Mountain,
  Poland: Church,
  Hungary: Landmark,
  Greece: Landmark,
  Spain: Waves,
  France: Landmark,
  Malta: Waves,
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isTestFavoriteDestination(destination, country) {
  const haystack = normalizeText(
    `${destination.name} ${destination.area} ${country?.countryName || ""}`
  );

  return testFavoriteNames.some((name) => haystack.includes(normalizeText(name)));
}

function flattenDestinations(countries) {
  return countries.flatMap((country) =>
    country.destinations.map((destination) => ({ ...destination, country }))
  );
}

function getInitialFavoriteDestinationIds(countries) {
  const allDestinations = flattenDestinations(countries);
  if (typeof window === "undefined") {
    return allDestinations
      .filter((destination) => isTestFavoriteDestination(destination, destination.country))
      .map((destination) => destination.id);
  }

  const storedValue = window.localStorage.getItem(FAVORITE_DESTINATIONS_STORAGE_KEY);
  if (storedValue !== null) {
    try {
      const storedIds = JSON.parse(storedValue);
      if (Array.isArray(storedIds)) return storedIds;
    } catch {
      // Fall back to the initial showcase favorites when stored data is invalid.
    }
  }

  return allDestinations
    .filter((destination) => isTestFavoriteDestination(destination, destination.country))
    .map((destination) => destination.id);
}

function getCountryIcon(countryName) {
  return countryIconMap[countryName] || countryIconMap[normalizeText(countryName)] || Trees;
}

function EuropeViewport() {
  const map = useMap();

  useEffect(() => {
    map.setView([49.2, 14.5], 4);
    setTimeout(() => map.invalidateSize(), 300);
  }, [map]);

  return null;
}

function AtlasLeafletMap({ countries, selectedCountryId, onSelectCountry }) {
  const [geojsonData, setGeojsonData] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/europe.geojson`)
      .then((res) => res.json())
      .then((data) => setGeojsonData(data))
      .catch((err) => console.error("GeoJSON fetch error:", err));
  }, []);

  const countryById = useMemo(
    () => Object.fromEntries(countries.map((country) => [country.id, country])),
    [countries]
  );

  const getFill = (country, isSelected) => {
    if (!country) return "#E3E9EC";
    if (isSelected) return "#008EA1";
    return country.status === "visited" ? "#62C8D3" : "#BDECF1";
  };

  const styleFeature = (feature) => {
    const name = feature?.properties?.NAME || feature?.properties?.name;
    const mappedId = countryCodeMap[name];
    const country = mappedId ? countryById[mappedId] : null;
    const isSelected = country?.id === selectedCountryId;

    return {
      fillColor: getFill(country, isSelected),
      weight: isSelected ? 2.4 : 1.1,
      opacity: 1,
      color: "#FFFFFF",
      fillOpacity: 1,
    };
  };

  const onEachFeature = (feature, layer) => {
    const name = feature?.properties?.NAME || feature?.properties?.name;
    const mappedId = countryCodeMap[name];
    const country = mappedId ? countryById[mappedId] : null;
    if (!country) return;

    layer.on({
      click: () => onSelectCountry(country.id),
      mouseover: () =>
        layer.setStyle({ weight: 2.1, color: "#FFFFFF", fillOpacity: 0.92 }),
      mouseout: () => {
        const isSelected = country.id === selectedCountryId;

        layer.setStyle({
          fillColor: getFill(country, isSelected),
          weight: isSelected ? 2.4 : 1.1,
          opacity: 1,
          color: "#FFFFFF",
          fillOpacity: 1,
        });
      },
    });

    layer.bindTooltip(country.countryName, { sticky: true, direction: "top" });
  };

  return (
    <div
      className="theme-atlas-map"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: "22px",
        border: "1px solid rgba(203, 227, 232, 0.95)",
        background:
          "radial-gradient(circle at top left, rgba(0,142,161,0.10), transparent 30%), rgba(255,255,255,0.96)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.9), 0 18px 40px rgba(15,58,66,0.06)",
      }}
    >
      <MapContainer
        center={[49.2, 14.5]}
        zoom={4}
        minZoom={3}
        maxZoom={7}
        scrollWheelZoom={true}
        zoomControl={true}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <EuropeViewport />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {geojsonData && (
          <GeoJSON
            data={geojsonData}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  );
}

function getDestinationCover(destination) {
  return (
    destination?.image ||
    destination?.gallery?.[0] ||
    destination?.places?.find((place) => place.image)?.image ||
    destination?.places?.find((place) => place.gallery?.length)?.gallery?.[0] ||
    ""
  );
}

function getDestinationDescription(destination) {
  return (
    destination?.description ||
    destination?.summary ||
    destination?.places?.find((place) => place.description)?.description ||
    destination?.places?.find((place) => place.note)?.note ||
    `${destination?.name || "Ta destynacja"} ma zapisane miejsca, zdjęcia i informacje pomocne przy planowaniu podróży.`
  );
}

function AtlasStat({ icon: Icon, label, value }) {
  return (
    <div className="theme-atlas-stat flex min-h-[72px] items-center gap-3 border-r border-[#DCECF0] px-3 last:border-r-0">
      <span className="theme-atlas-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E6FAFC] text-[#008EA1]">
        {createElement(Icon, { className: "h-5 w-5" })}
      </span>
      <div className="min-w-0">
        <p className="text-xs leading-tight text-[#647782]">{label}</p>
        <p className="mt-1 text-lg font-semibold text-[#132334]">{value}</p>
      </div>
    </div>
  );
}

function DestinationTile({ destination, status, onOpen }) {
  const coverImage = getDestinationCover(destination);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="theme-atlas-tile group relative min-h-[260px] overflow-hidden rounded-lg border border-[#DCECF0] bg-[#EAF4F7] text-left shadow-[0_16px_34px_rgba(15,58,66,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(15,58,66,0.12)]"
    >
      {coverImage ? (
        <img
          src={coverImage}
          alt={destination.name}
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#CDEFF4_0%,#F7FCFD_100%)]" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.18)_42%,rgba(0,0,0,0.82)_100%)]" />
      <span className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-black/20 text-white backdrop-blur">
        <Heart className="h-5 w-5" />
      </span>
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <h3 className="text-2xl font-semibold leading-tight">{destination.name}</h3>
        <p className="mt-1 text-sm text-white/82">{destination.area}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/88">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {destination.places.length} miejsc
          </span>
          <span className="h-1 w-1 rounded-full bg-[#29C5D5]" />
          <span>{status === "visited" ? "Odwiedzona" : "Planowana"}</span>
        </div>
      </div>
    </button>
  );
}

function MiniDestination({ destination, onOpen, onOpenStory }) {
  const coverImage = getDestinationCover(destination);

  return (
    <div className="theme-atlas-mini relative overflow-hidden rounded-lg border border-[#DCECF0] bg-white text-left transition hover:border-[#8DDAE4]">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left"
      >
        <div className="h-24 bg-[#EAF4F7]">
          {coverImage ? (
            <img
              src={coverImage}
              alt={destination.name}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="p-3 pr-9">
          <p className="truncate text-sm font-semibold text-[#132334]">
            {destination.name}
          </p>
          <p className="mt-1 text-xs text-[#647782]">
            {destination.places.length} miejsc
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={onOpenStory}
        className="theme-atlas-mini-cta absolute bottom-4 right-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-[#008EA1] transition hover:bg-[#E6FAFC] hover:text-[#006E7D]"
        aria-label={`Otworz miejscowki dla ${destination.name}`}
        title={`Otworz miejscowki dla ${destination.name}`}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

function DestinationListModal({
  title,
  destinations,
  plansByDestination,
  favoriteDestinationIds,
  onToggleFavorite,
  onOpenMap,
  onOpenPlans,
  onClose,
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const totalPlaces = destinations.reduce(
    (sum, destination) => sum + destination.places.length,
    0
  );
  const totalPlans = destinations.reduce(
    (sum, destination) => sum + (plansByDestination[destination.id]?.length || 0),
    0
  );
  const mostDetailedDestination = [...destinations].sort(
    (a, b) => b.places.length - a.places.length
  )[0];

  return createPortal(
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-[#0B252C]/65 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-[1.5rem] border border-white/60 bg-[#F7FCFD] shadow-[0_30px_100px_rgba(4,35,42,0.35)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#DCECF0] bg-white px-5 py-5 md:px-7">
          <div>
            <h2 className="text-2xl font-semibold text-[#132334]">{title}</h2>
            <p className="mt-1 text-sm text-[#647782]">
              {destinations.length} destynacji, {totalPlaces} miejsc i {totalPlans} planów podróży
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#DCECF0] bg-white text-[#132334] transition hover:border-[#008EA1] hover:text-[#008EA1]"
            aria-label="Zamknij listę destynacji"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 md:p-7">
          {destinations.length ? (
            <>
              <div className="mb-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#DCECF0] bg-white p-4">
                  <p className="text-xs text-[#647782]">Najwięcej zapisanych miejsc</p>
                  <p className="mt-1 truncate text-xl font-semibold text-[#132334]">
                    {mostDetailedDestination?.name || "Brak"}
                  </p>
                </div>
                <div className="rounded-xl border border-[#DCECF0] bg-white p-4">
                  <p className="text-xs text-[#647782]">Gotowe plany podróży</p>
                  <p className="mt-1 text-xl font-semibold text-[#132334]">{totalPlans}</p>
                </div>
              </div>

              <div className="grid gap-4">
                {destinations.map((destination) => {
                  const coverImage = getDestinationCover(destination);
                  const isFavorite = favoriteDestinationIds.includes(destination.id);

                  return (
                    <article
                      key={destination.id}
                      className="grid h-[470px] overflow-hidden rounded-xl border border-[#DCECF0] bg-white shadow-[0_14px_34px_rgba(15,58,66,0.06)] sm:h-[440px] md:h-[280px] md:grid-cols-[minmax(280px,38%)_minmax(0,1fr)]"
                    >
                      <div className="relative h-52 bg-[#EAF4F7] sm:h-56 md:h-full">
                        {coverImage ? (
                          <img
                            src={coverImage}
                            alt={destination.name}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <button
                          type="button"
                          onClick={() => onToggleFavorite(destination.id)}
                          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-black/20 text-white backdrop-blur transition hover:bg-black/35"
                          aria-label={isFavorite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
                        >
                          <Heart className="h-5 w-5" />
                        </button>
                        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                          <h3 className="text-xl font-semibold">{destination.name}</h3>
                          <p className="mt-1 text-sm text-white/85">
                            {[destination.area, destination.country.countryName]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-col p-5 md:p-6">
                        <div className="mb-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-[#E6FAFC] px-3 py-1 text-[#007786]">
                            {destination.places.length} miejsc
                          </span>
                          <span className="rounded-full bg-[#F0F5F6] px-3 py-1 text-[#52616D]">
                            {plansByDestination[destination.id]?.length || 0} planów
                          </span>
                          <span className="rounded-full bg-[#F0F5F6] px-3 py-1 text-[#52616D]">
                            {destination.country.status === "visited" ? "Odwiedzona" : "Planowana"}
                          </span>
                        </div>
                        <p className="line-clamp-3 text-sm leading-6 text-[#647782]">
                          {getDestinationDescription(destination)}
                        </p>
                        <div className="mt-auto grid gap-3 pt-5 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => onOpenMap(destination)}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#008EA1] px-4 text-sm font-semibold text-white transition hover:bg-[#007786]"
                          >
                            <MapPin className="h-4 w-4" />
                            Zobacz miejsca na mapie
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenPlans(destination)}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#9FC5CC] bg-white px-4 text-sm font-semibold text-[#007786] transition hover:border-[#008EA1] hover:bg-[#F3FCFD]"
                          >
                            <CalendarDays className="h-4 w-4" />
                            Zobacz plany podróży
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-[#B8D9DE] bg-white px-6 py-14 text-center">
              <Heart className="mx-auto h-8 w-8 text-[#8CBCC3]" />
              <p className="mt-3 font-semibold text-[#132334]">Brak ulubionych destynacji</p>
              <p className="mt-1 text-sm text-[#647782]">
                Dodaj je sercem przy wybranej destynacji.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function AtlasPanel({
  countries,
  selectedCountry,
  selectedDestinationId,
  onSelectCountry,
  onSelectDestination,
  onOpenPlace,
  onOpenPlan,
}) {
  const [searchValue, setSearchValue] = useState("");
  const [favoriteOffset, setFavoriteOffset] = useState(0);
  const [countryOffset, setCountryOffset] = useState(0);
  const [plansByDestination, setPlansByDestination] = useState({});
  const [destinationModalMode, setDestinationModalMode] = useState("");
  const [favoriteDestinationIds, setFavoriteDestinationIds] = useState(() =>
    getInitialFavoriteDestinationIds(countries)
  );
  const selectedDestination =
    selectedCountry.destinations.find(
      (destination) => destination.id === selectedDestinationId
    ) || selectedCountry.destinations[0];
  const featuredCover = getDestinationCover(selectedDestination);
  const visitedCountries = countries.filter(
    (country) => country.status === "visited"
  ).length;
  const plannedCountries = countries.length - visitedCountries;
  const destinationsCount = countries.reduce(
    (sum, country) => sum + country.destinations.length,
    0
  );
  const placesCount = selectedCountry.destinations.reduce(
    (sum, destination) => sum + destination.places.length,
    0
  );
  const allDestinations = useMemo(() => flattenDestinations(countries), [countries]);
  const favoriteDestinations = useMemo(
    () => allDestinations.filter((destination) => favoriteDestinationIds.includes(destination.id)),
    [allDestinations, favoriteDestinationIds]
  );
  const visibleFavoriteDestinations =
    favoriteDestinations.length > 0
      ? Array.from({ length: Math.min(4, favoriteDestinations.length) }, (_, index) => {
          const itemIndex = (favoriteOffset + index) % favoriteDestinations.length;
          return favoriteDestinations[itemIndex];
        })
      : [];
  const visibleCountryDestinations =
    selectedCountry.destinations.length > 0
      ? Array.from(
          { length: Math.min(4, selectedCountry.destinations.length) },
          (_, index) => {
            const itemIndex = (countryOffset + index) % selectedCountry.destinations.length;
            return selectedCountry.destinations[itemIndex];
          }
        )
      : [];
  const totalPlansCount = Object.values(plansByDestination).reduce(
    (sum, plans) => sum + plans.length,
    0
  );
  const countryPlansCount = selectedCountry.destinations.reduce(
    (sum, destination) => sum + (plansByDestination[destination.id]?.length || 0),
    0
  );
  const countryFavoriteCount = selectedCountry.destinations.filter((destination) =>
    favoriteDestinationIds.includes(destination.id)
  ).length;
  const countryIcon = getCountryIcon(selectedCountry.countryName);
  const searchOptions = [
    ...countries.map((country) => ({
      type: "country",
      id: country.id,
      label: country.countryName,
      countryId: country.id,
    })),
    ...allDestinations.map((destination) => ({
      type: "destination",
      id: destination.id,
      label: `${destination.name} - ${destination.country.countryName}`,
      countryId: destination.country.id,
      destinationId: destination.id,
    })),
  ];

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      FAVORITE_DESTINATIONS_STORAGE_KEY,
      JSON.stringify(favoriteDestinationIds)
    );
  }, [favoriteDestinationIds]);

  useEffect(() => {
    let cancelled = false;

    async function loadPlanCounts() {
      try {
        const entries = await Promise.all(
          allDestinations.map(async (destination) => {
            const plans = await fetchPlannerPlans(destination.id);
            return [destination.id, plans];
          })
        );

        if (!cancelled) {
          setPlansByDestination(Object.fromEntries(entries));
        }
      } catch {
        if (!cancelled) {
          setPlansByDestination({});
        }
      }
    }

    loadPlanCounts();

    return () => {
      cancelled = true;
    };
  }, [allDestinations]);

  function selectDestination(destination) {
    selectCountry(destination.country.id);
    onSelectDestination?.(destination.id);
  }

  function selectCountry(countryId) {
    setCountryOffset(0);
    onSelectCountry(countryId);
  }

  function toggleFavoriteDestination(destinationId) {
    setFavoriteDestinationIds((current) =>
      current.includes(destinationId)
        ? current.filter((id) => id !== destinationId)
        : [...current, destinationId]
    );
  }

  function handleSearchChange(value) {
    setSearchValue(value);
  }

  function handleSearchSubmit(value = searchValue) {
    const normalizedValue = normalizeText(value).trim();
    if (!normalizedValue) return;

    const exactMatch =
      searchOptions.find((option) => normalizeText(option.label) === normalizedValue) ||
      searchOptions.find((option) => normalizeText(option.label).includes(normalizedValue));

    if (!exactMatch) return;

    selectCountry(exactMatch.countryId);
    if (exactMatch.type === "destination") {
      onSelectDestination?.(exactMatch.destinationId);
    }
  }

  return (
    <section className="theme-panel-shell theme-atlas-v2 min-h-[calc(100dvh-7rem)] overflow-hidden rounded-[1.6rem] border border-[#DCECF0] bg-white shadow-[0_26px_90px_rgba(15,58,66,0.08)]">
      <div className="grid min-h-[calc(100dvh-7rem)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_640px] 2xl:grid-cols-[minmax(0,1fr)_720px]">
        <main className="theme-panel-main flex min-h-0 flex-col border-r border-[#DCECF0] bg-white px-4 py-5 md:px-6 xl:px-7">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <span className="theme-atlas-logo inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#E6FAFC] text-[#008EA1]">
                <Globe2 className="h-7 w-7" />
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-normal text-[#132334]">
                  Mapa swiata
                </h1>
                <p className="mt-1 text-sm text-[#647782]">
                  Odkrywaj swiat, planuj podroze, wspominaj przygody
                </p>
              </div>
            </div>
          </div>

          <div className="theme-atlas-map-card flex min-h-0 flex-1 flex-col rounded-xl border border-[#DCECF0] bg-white p-4 shadow-[0_16px_44px_rgba(15,58,66,0.05)]">
            <div className="mb-4 grid gap-3 lg:grid-cols-[230px_minmax(0,260px)_1fr] lg:items-end">
              <label className="block">
                <span className="text-xs font-medium text-[#647782]">
                  Wybierz kraj
                </span>
                <select
                  value={selectedCountry.id}
                  onChange={(e) => selectCountry(e.target.value)}
                  className="theme-atlas-field mt-1 h-12 w-full rounded-lg border border-[#DCECF0] bg-white px-4 text-sm font-medium text-[#132334] outline-none transition focus:border-[#008EA1] focus:ring-4 focus:ring-[#008EA1]/10"
                >
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.countryName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="theme-atlas-search flex h-12 items-center gap-3 rounded-lg border border-[#DCECF0] bg-white px-4 text-sm text-[#647782]">
                <input
                  value={searchValue}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  onBlur={() => handleSearchSubmit()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSearchSubmit();
                  }}
                  list="atlas-search-options"
                  placeholder="Szukaj kraju lub destynacji..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#132334] outline-none placeholder:text-[#647782]"
                />
                <datalist id="atlas-search-options">
                  {searchOptions.map((option) => (
                    <option key={`${option.type}-${option.id}`} value={option.label} />
                  ))}
                </datalist>
                <Search className="ml-auto h-5 w-5 text-[#132334]" />
              </div>
              <div className="flex flex-wrap items-center justify-start gap-4 text-sm text-[#647782] lg:justify-end">
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#008EA1]" />
                  Odwiedzone
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#7ED6DF]" />
                  Planowane
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#C9D2D8]" />
                  Marzenia
                </span>
              </div>
            </div>

            <div className="min-h-[360px] flex-1">
              <AtlasLeafletMap
                countries={countries}
                selectedCountryId={selectedCountry.id}
                onSelectCountry={selectCountry}
              />
            </div>

            <div className="theme-atlas-stats mt-4 grid rounded-xl border border-[#DCECF0] bg-white shadow-[0_14px_34px_rgba(15,58,66,0.04)] sm:grid-cols-2 xl:grid-cols-4">
              <AtlasStat
                icon={CheckCircle2}
                label="Odwiedzone kraje"
                value={visitedCountries}
              />
              <AtlasStat
                icon={Plane}
                label="Planowane kraje"
                value={plannedCountries}
              />
              <AtlasStat
                icon={MapPin}
                label="Destynacje"
                value={destinationsCount}
              />
              <AtlasStat
                icon={CalendarDays}
                label="Plany podrozy"
                value={totalPlansCount}
              />
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-[#132334]">
                Ulubione destynacje
              </h2>
              <button
                type="button"
                onClick={() => setDestinationModalMode("favorites")}
                className="text-sm font-medium text-[#008EA1] transition hover:text-[#006E7D]"
              >
                Zobacz wszystkie ulubione
              </button>
            </div>
            <div className="relative">
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {visibleFavoriteDestinations.map((destination) => (
                  <DestinationTile
                    key={destination.id}
                    destination={destination}
                    status={destination.country.status}
                    onOpen={() => selectDestination(destination)}
                  />
                ))}
              </div>
              {favoriteDestinations.length > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setFavoriteOffset((prev) => (prev + 1) % favoriteDestinations.length)
                  }
                  className="theme-atlas-carousel-arrow absolute right-[-18px] top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#DCECF0] bg-white text-[#132334] shadow-[0_16px_38px_rgba(15,58,66,0.16)] transition hover:text-[#008EA1]"
                  aria-label="Pokaz kolejne ulubione destynacje"
                  title="Pokaz kolejne ulubione destynacje"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              ) : null}
            </div>
          </div>
        </main>

        <aside className="theme-panel-side flex min-h-0 w-full flex-col items-stretch bg-white px-4 py-5 md:px-6 xl:pl-8 xl:pr-4 2xl:pl-10 2xl:pr-5">
          <div className="mb-7 flex w-full items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="theme-country-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E6FAFC] text-[#008EA1]">
                {createElement(countryIcon, { className: "h-6 w-6" })}
              </span>
              <h2 className="truncate text-2xl font-semibold text-[#132334]">
                {selectedCountry.countryName}
              </h2>
            </div>
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium capitalize",
                selectedCountry.status === "visited"
                  ? statusStyles.visited
                  : statusStyles.planned
              )}
            >
              {selectedCountry.status === "visited" ? "Odwiedzone" : "Planowane"}
            </span>
          </div>

          <div className="mb-6 w-full">
            <p className="mt-3 text-sm leading-6 text-[#647782]">
              {selectedCountry.summary}
            </p>
          </div>

          <div className="theme-atlas-side-stats mb-8 grid w-full grid-cols-2 rounded-xl border border-[#DCECF0] bg-white shadow-[0_14px_34px_rgba(15,58,66,0.04)] 2xl:grid-cols-4">
            <AtlasStat
              icon={CheckCircle2}
              label="Odwiedzone destynacje"
              value={selectedCountry.destinations.length}
            />
            <AtlasStat icon={Plane} label="Zobaczone miejsca" value={placesCount} />
            <AtlasStat
              icon={CalendarDays}
              label="Plany podrozy"
              value={countryPlansCount}
            />
            <AtlasStat
              icon={Heart}
              label="Ulubione miejsca"
              value={countryFavoriteCount}
            />
          </div>

          {selectedDestination ? (
            <>
              <div className="mb-8 w-full">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold text-[#132334]">
                    {selectedDestination.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => toggleFavoriteDestination(selectedDestination.id)}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
                      favoriteDestinationIds.includes(selectedDestination.id)
                        ? "border-[#008EA1] bg-[#E6FAFC] text-[#007786]"
                        : "border-[#DCECF0] bg-white text-[#52616D] hover:border-[#008EA1] hover:text-[#008EA1]"
                    )}
                  >
                    <Heart
                      className={cn(
                        "h-4 w-4",
                        favoriteDestinationIds.includes(selectedDestination.id) && "fill-current"
                      )}
                    />
                    {favoriteDestinationIds.includes(selectedDestination.id)
                      ? "Ulubiona"
                      : "Dodaj do ulubionych"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenPlace(selectedDestination.id)}
                  className="theme-atlas-feature group relative block min-h-[300px] w-full overflow-hidden rounded-lg border border-[#DCECF0] bg-[#EAF4F7] text-left shadow-[0_18px_42px_rgba(15,58,66,0.10)] 2xl:min-h-[340px]"
                >
                  {featuredCover ? (
                    <img
                      src={featuredCover}
                      alt={selectedDestination.name}
                      className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,#CDEFF4_0%,#F7FCFD_100%)]" />
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.03)_0%,rgba(0,0,0,0.18)_44%,rgba(0,0,0,0.86)_100%)]" />
                  <span className="absolute left-4 top-4 rounded-md bg-black/45 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                    VIDEO
                  </span>
                  <span className="absolute inset-0 m-auto inline-flex h-16 w-16 items-center justify-center rounded-full border border-white/75 bg-white/18 text-white backdrop-blur">
                    <Plane className="h-7 w-7" />
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <h4 className="text-xl font-semibold">
                      {selectedDestination.name} - podroz marzen
                    </h4>
                    <p className="mt-1 text-sm text-white/84">
                      Zobacz piekno miejsca i zaplanuj trase
                    </p>
                  </div>
                </button>
              </div>

              <div className="mb-8 w-full">
                <h3 className="mb-3 text-base font-semibold text-[#132334]">
                  Opis destynacji
                </h3>
                <p className="text-sm leading-6 text-[#647782]">
                  {getDestinationDescription(selectedDestination)}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => onOpenPlace(selectedDestination.id)}
                    className="theme-atlas-primary inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#008EA1] px-4 text-sm font-semibold text-white transition hover:bg-[#007786]"
                  >
                    <MapPin className="h-4 w-4" />
                    Zobacz miejsca na mapie
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenPlan(selectedDestination.id, null)}
                    className="theme-atlas-secondary inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[#B8CED5] bg-white px-4 text-sm font-semibold text-[#008EA1] transition hover:border-[#008EA1]"
                  >
                    <CalendarDays className="h-4 w-4" />
                    Zobacz plany podrozy
                  </button>
                </div>
              </div>
            </>
          ) : null}

          <div className="mt-auto w-full">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-[#132334]">
                Inne destynacje w {selectedCountry.countryName}
              </h3>
              <button
                type="button"
                onClick={() => setDestinationModalMode("country")}
                className="text-xs font-medium text-[#008EA1]"
              >
                Zobacz wszystkie
              </button>
            </div>
            <div className="relative">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {visibleCountryDestinations.map((destination) => (
                  <MiniDestination
                    key={destination.id}
                    destination={destination}
                    onOpen={() => onSelectDestination?.(destination.id)}
                    onOpenStory={() => onOpenPlace(destination.id)}
                  />
                ))}
              </div>
              {selectedCountry.destinations.length > 4 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCountryOffset(
                      (prev) => (prev + 1) % selectedCountry.destinations.length
                    )
                  }
                  className="theme-atlas-carousel-arrow absolute right-[-18px] top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#DCECF0] bg-white text-[#132334] shadow-[0_16px_38px_rgba(15,58,66,0.16)] transition hover:text-[#008EA1]"
                  aria-label="Pokaz kolejne destynacje w panstwie"
                  title="Pokaz kolejne destynacje w panstwie"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
      {destinationModalMode ? (
        <DestinationListModal
          title={
            destinationModalMode === "favorites"
              ? "Wszystkie ulubione destynacje"
              : `Wszystkie destynacje: ${selectedCountry.countryName}`
          }
          destinations={
            destinationModalMode === "favorites"
              ? favoriteDestinations
              : selectedCountry.destinations.map((destination) => ({
                  ...destination,
                  country: selectedCountry,
                }))
          }
          plansByDestination={plansByDestination}
          favoriteDestinationIds={favoriteDestinationIds}
          onToggleFavorite={toggleFavoriteDestination}
          onOpenMap={(destination) => {
            selectDestination(destination);
            setDestinationModalMode("");
            onOpenPlace(destination.id);
          }}
          onOpenPlans={(destination) => {
            selectDestination(destination);
            setDestinationModalMode("");
            onOpenPlan(destination.id, null);
          }}
          onClose={() => setDestinationModalMode("")}
        />
      ) : null}
    </section>
  );
}
