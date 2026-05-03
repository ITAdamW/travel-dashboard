import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup as LeafletPopup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { divIcon } from "leaflet";
import { createPortal } from "react-dom";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BadgeAlert,
  CalendarCheck2,
  Clock3,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coffee,
  CreditCard,
  Download,
  ExternalLink,
  Filter,
  Footprints,
  Globe2,
  Info,
  Landmark,
  MapPin,
  Mountain,
  Route,
  Ruler,
  Search,
  Star,
  Ticket,
  Waves,
  X,
} from "lucide-react";
import {
  fetchPlannerPlans,
  updatePlaceRoutePath,
} from "../lib/supabaseTravelData";
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
import {
  buildPlaceCoverCandidates,
  filterSupabaseMediaUrls,
  normalizeSupabaseMediaUrl,
} from "../lib/mediaUrls";
import { listPlaceMedia } from "../lib/storageMedia";
import RichText from "./RichText";

const fallbackImage =
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1400&q=80";

function uniqueImageUrls(urls = []) {
  return [...new Set(urls.filter(Boolean))];
}

function getPlaceImageCandidates(place, storageMedia = null) {
  if (!place) return [];

  return uniqueImageUrls([
    normalizeSupabaseMediaUrl(place.image),
    ...filterSupabaseMediaUrls(place.gallery),
    storageMedia?.cover?.url,
    ...(Array.isArray(storageMedia?.gallery)
      ? storageMedia.gallery.map((item) => item?.url)
      : []),
    ...buildPlaceCoverCandidates(place.countryId, place.destinationId, place.id),
  ]);
}

function getPlaceGalleryCandidates(place, storageMedia = null) {
  if (!place) return [];

  return uniqueImageUrls([
    ...filterSupabaseMediaUrls(place.gallery),
    ...(Array.isArray(storageMedia?.gallery)
      ? storageMedia.gallery.map((item) => item?.url)
      : []),
  ]);
}

function getPlacePrimaryImage(place, storageMedia = null) {
  return getPlaceImageCandidates(place, storageMedia)[0] || "";
}

function SmartImage({ urls, alt, className, fallback = fallbackImage }) {
  const candidates = uniqueImageUrls(urls);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const candidatesKey = candidates.join("|");

  useEffect(() => {
    setCurrentIndex(0);
    setFailed(false);
  }, [candidatesKey]);

  if (!candidates.length || failed || !candidates[currentIndex]) {
    return <img src={fallback} alt={alt} className={className} />;
  }

  return (
    <img
      src={candidates[currentIndex]}
      alt={alt}
      className={className}
      onError={() => {
        setCurrentIndex((prev) => {
          if (prev + 1 < candidates.length) {
            return prev + 1;
          }

          setFailed(true);
          return prev;
        });
      }}
    />
  );
}

const categoryMeta = {
  "forest-park": { label: "Las, wawoz, park", icon: MapPin, color: "#5F7D55" },
  trail: { label: "Szlaki", icon: Footprints, color: "#7A8F61" },
  cliff: { label: "Klif", icon: Mountain, color: "#7A6250" },
  "forest-trail": { label: "Las, wawoz, park / Szlak", icon: Footprints, color: "#6A865A" },
  waterfall: { label: "Wodospady", icon: Waves, color: "#4A7A8C" },
  viewpoint: { label: "Punkty widokowe", icon: Mountain, color: "#6B7A52" },
  "viewpoint-trail": { label: "Punkt widokowy / Szlak", icon: Footprints, color: "#718B4E" },
  mountains: { label: "Gory", icon: Mountain, color: "#7F6A58" },
  water: { label: "Woda, jezioro, morze", icon: Waves, color: "#3E7E96" },
  beach: { label: "Plaze", icon: Waves, color: "#4A7A8C" },
  cave: { label: "Jaskinie", icon: Landmark, color: "#6A6056" },
  city: { label: "Miasto", icon: Route, color: "#5D6274" },
  "city-water": { label: "Miasto / Woda", icon: Route, color: "#4B7388" },
  heritage: { label: "Zabytki", icon: Landmark, color: "#8C6A50" },
  "food-drink": { label: "Bar, restauracja", icon: Coffee, color: "#9A6945" },

  // Legacy aliases kept for older records before category sync.
  cafe: { label: "Bar, restauracja", icon: Coffee, color: "#9A6945" },
  museum: { label: "Zabytki", icon: Landmark, color: "#8C6A50" },
};

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

function findPlaceById(destination, id) {
  return (
    destination.places.find((place) => place.id === id) || destination.places[0]
  );
}

function hasValidCoordinates(place) {
  return (
    Array.isArray(place?.coordinates) &&
    place.coordinates.length >= 2 &&
    Number.isFinite(Number(place.coordinates[0])) &&
    Number.isFinite(Number(place.coordinates[1]))
  );
}

function normalizePlaceCoordinates(place) {
  if (!hasValidCoordinates(place)) return null;

  return {
    ...place,
    coordinates: [Number(place.coordinates[0]), Number(place.coordinates[1])],
  };
}

function getStorySlides(destination) {
  const places = destination?.places || [];
  return [
    ...places.map((place) => ({
      id: `${place.id}-slide`,
      type: "place",
      placeId: place.id,
      title: place.name,
      subtitle: place.subtitle || place.note,
      description:
        place.description ||
        "To miejsce mozesz pozniej uzupelnic wlasnym opisem, wspomnieniem albo praktyczna notatka do planowania wyjazdu.",
      image: getPlacePrimaryImage(place) || fallbackImage,
    })),
  ];
}

function countByCategory(places) {
  return Object.keys(categoryMeta).map((key) => ({
    key,
    label: categoryMeta[key].label,
    count: places.filter((place) => place.category === key).length,
    places: places.filter((place) => place.category === key),
  }));
}

function createEmptyDay(index) {
  return {
    day: `Day ${index + 1}`,
    items: [],
  };
}

function normalizePlanItem(item) {
  if (typeof item === "string") {
    return { placeId: item, note: "" };
  }

  return {
    placeId: item?.placeId || item?.id || "",
    note: item?.note || "",
  };
}

function normalizePlanItinerary(itinerary) {
  if (!Array.isArray(itinerary) || !itinerary.length) {
    return [createEmptyDay(0)];
  }

  return itinerary.map((day, index) => ({
    day: day?.day || `Day ${index + 1}`,
    items: Array.isArray(day?.items)
      ? day.items.map(normalizePlanItem).filter((item) => item.placeId)
      : [],
  }));
}

function getPlanPlaceIds(plan) {
  return new Set(
    normalizePlanItinerary(plan?.itinerary || []).flatMap((day) =>
      day.items.map((item) => normalizePlanItem(item).placeId)
    )
  );
}

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(points.map((point) => point.coordinates), {
      padding: [55, 55],
      maxZoom: 12,
    });
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

function createPlaceMarkerIcon(place, isActive, isCategorySelected) {
  const meta = categoryMeta[place.category] || categoryMeta.city;
  const Icon = meta.icon;
  const emphasized = isActive || isCategorySelected;
  const bgColor = isActive ? "#008EA1" : emphasized ? meta.color : "#FFFFFF";
  const borderColor = isActive ? "#BDECF1" : "#FFFFFF";
  const iconColor = emphasized ? "#FFFFFF" : "#008EA1";
  const iconMarkup = renderToStaticMarkup(
    <Icon
      size={18}
      strokeWidth={2.4}
      color={iconColor}
    />
  );

  return divIcon({
    className: "story-map-marker-shell",
    html: `<div style="width:${isActive ? 48 : emphasized ? 40 : 38}px;height:${
      isActive ? 48 : emphasized ? 40 : 38
    }px;border-radius:9999px;display:flex;align-items:center;justify-content:center;border:${
      isActive ? 4 : 3
    }px solid ${borderColor};background:${bgColor};box-shadow:0 14px 32px rgba(34,31,25,0.18);">${
      iconMarkup
    }</div>`,
    iconSize: [
      isActive ? 48 : emphasized ? 40 : 38,
      isActive ? 48 : emphasized ? 40 : 38,
    ],
    iconAnchor: [
      isActive ? 24 : emphasized ? 20 : 19,
      isActive ? 24 : emphasized ? 20 : 19,
    ],
    popupAnchor: [0, -(isActive ? 22 : 16)],
  });
}

function RatingStars({ rating }) {
  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${
            n <= Math.round(rating)
              ? "fill-[#6B7A52] text-[#6B7A52]"
              : "text-[#CFC7B7]"
          }`}
        />
      ))}
      <span className="ml-1 text-sm text-[#6B6255]">{rating.toFixed(1)}</span>
    </div>
  );
}

function formatDistance(distanceKm) {
  if (!distanceKm) return "";
  const rounded = distanceKm % 1 === 0 ? distanceKm.toFixed(0) : distanceKm.toFixed(1);
  return `${rounded} km`;
}

function formatDuration(durationHours) {
  if (!durationHours) return "";
  const rounded =
    durationHours % 1 === 0 ? durationHours.toFixed(0) : durationHours.toFixed(1);
  return `${rounded} h`;
}

function getPlaceMetaBadges(place) {
  const badges = [];
  const ticketText = (place?.ticket || "").trim();
  const reservationText = (place?.reservation || "").trim();
  const infoText = (place?.info || "").trim();

  if (ticketText) {
    badges.push({
      key: "ticket",
      icon: Ticket,
      label: "Bilet",
      tooltip: ticketText,
    });

    const normalizedTicket = ticketText.toLowerCase();
    if (
      !normalizedTicket.includes("brak") &&
      !normalizedTicket.includes("free") &&
      !normalizedTicket.includes("darmo") &&
      !normalizedTicket.includes("bezplat")
    ) {
      badges.push({
        key: "payment",
        icon: CreditCard,
        label: "Platnosc",
        tooltip: `Wymagana platnosc: ${ticketText}`,
      });
    }
  }

  if (reservationText) {
    badges.push({
      key: "reservation",
      icon: CalendarCheck2,
      label: "Rezerwacja",
      tooltip: reservationText,
    });
  }

  if (infoText) {
    badges.push({
      key: "info",
      icon: BadgeAlert,
      label: "Wazne",
      tooltip: infoText,
    });
  }

  return badges;
}

function PlaceMetaBadge({ icon, label, tooltip, expanded = false }) {
  const IconComponent = icon;
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const canUsePortal = typeof document !== "undefined";

  const updateTooltipPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setTooltipPosition({
      top: rect.top + window.scrollY + rect.height / 2,
      left: rect.right + window.scrollX + 12,
    });
  };

  if (expanded) {
    return (
      <div className="flex min-w-[220px] flex-1 items-start gap-3 rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-3 py-3 text-left text-[#3A352E]">
        <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5DCCF] bg-white text-[#3A352E]">
          <IconComponent className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B6255]">
            {label}
          </p>
          <p className="mt-1 text-sm leading-6 text-[#4D463D]">{tooltip}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => {
          updateTooltipPosition();
          setTooltipOpen(true);
        }}
        onMouseLeave={() => setTooltipOpen(false)}
        onFocus={() => {
          updateTooltipPosition();
          setTooltipOpen(true);
        }}
        onBlur={() => setTooltipOpen(false)}
        tabIndex={0}
        className="inline-flex cursor-help outline-none"
      >
        <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5DCCF] bg-[#FBF8F2] text-[#3A352E]">
          <IconComponent className="h-4 w-4" />
        </div>
      </div>

      {tooltipOpen &&
        canUsePortal &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[1650] w-[min(280px,calc(100vw-2rem))] -translate-y-1/2 rounded-xl border border-[#E5DCCF] bg-white px-3 py-2 text-xs leading-5 text-[#3A352E] shadow-[0_12px_28px_rgba(34,31,25,0.12)]"
            style={{
              top: `${tooltipPosition.top}px`,
              left: `${Math.min(
                tooltipPosition.left,
                window.scrollX + window.innerWidth - 300
              )}px`,
            }}
          >
            <p className="font-medium">{label}</p>
            <p className="mt-1 whitespace-normal">{tooltip}</p>
          </div>,
          document.body
        )}
    </>
  );
}

function StoryDescription({ text, expanded = false, onExpand }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const canUsePortal = typeof document !== "undefined";

  const updateTooltipPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setTooltipPosition({
      top: rect.top + window.scrollY + rect.height / 2,
      left: rect.right + window.scrollX + 12,
    });
  };

  if (expanded) {
    return (
      <div className="mt-3 rounded-[1rem] border border-[#E8DFD2] bg-[#FBF8F2] px-4 py-4 text-sm leading-7 text-[#4D463D]">
        <RichText text={text} paragraphClassName="leading-7 text-[#4D463D]" />
      </div>
    );
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => {
          updateTooltipPosition();
          setTooltipOpen(true);
        }}
        onMouseLeave={() => setTooltipOpen(false)}
        onFocus={() => {
          updateTooltipPosition();
          setTooltipOpen(true);
        }}
        onBlur={() => setTooltipOpen(false)}
        tabIndex={0}
        className="group mt-3 cursor-help outline-none"
      >
        <div className="theme-story-description relative rounded-[1rem] border border-[#E8DFD2] bg-[#FBF8F2] px-3 py-3 text-sm leading-7 text-[#4D463D]">
          <div className="max-h-[84px] overflow-hidden">
            <RichText text={text} paragraphClassName="leading-7 text-[#4D463D]" />
          </div>
          <div className="theme-story-description-fade pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#FBF8F2] via-[#FBF8F2]/90 to-transparent" />
          {onExpand && (
            <div className="relative z-[1] mt-3 flex justify-center pt-2">
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onExpand();
                }}
                className="inline-flex items-center gap-2 rounded-full border border-[#E4DBCD] bg-white px-4 py-2 text-sm font-medium text-[#3A352E] transition hover:bg-[#F2ECE2]"
                aria-label="Otworz pelny widok historii miejsca"
              >
                Rozwin opis
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {tooltipOpen &&
        canUsePortal &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[1650] w-[min(360px,calc(100vw-2rem))] -translate-y-1/2 rounded-xl border border-[#E5DCCF] bg-white px-4 py-3 text-sm leading-7 text-[#3A352E] shadow-[0_16px_34px_rgba(34,31,25,0.16)]"
            style={{
              top: `${tooltipPosition.top}px`,
              left: `${Math.min(
                tooltipPosition.left,
                window.scrollX + window.innerWidth - 380
              )}px`,
            }}
          >
            <RichText text={text} paragraphClassName="leading-7 text-[#3A352E]" />
          </div>,
          document.body
        )}
    </>
  );
}

function TrailSummary({ place, expanded = false }) {
  const items = [
    place?.distanceKm
      ? {
          key: "distance",
          icon: Ruler,
          value: formatDistance(place.distanceKm),
        }
      : null,
    place?.durationHours
      ? {
          key: "duration",
          icon: Clock3,
          value: formatDuration(place.durationHours),
        }
      : null,
  ].filter(Boolean);

  if (!items.length) return null;

  return (
    <div className={expanded ? "mt-3" : "mt-3"}>
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#8A7F6C]">
        <Footprints className="h-3.5 w-3.5" />
        Szacowany czas i dystans w 2 strony
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.key}
              className="inline-flex items-center gap-2 rounded-full border border-[#E5DCCF] bg-[#FBF8F2] px-3 py-2 text-sm font-medium text-[#3A352E]"
            >
              <Icon className="h-4 w-4 text-[#6B7A52]" />
              {item.value}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FloatingPlanPicker({
  planOptions,
  selectedPlanId,
  onSelectPlan,
  loadingPlans,
}) {
  return (
    <div className="rounded-[1.35rem] border border-[#EEE6DA] bg-[rgba(251,248,242,0.92)] p-3 shadow-[0_14px_30px_rgba(34,31,25,0.10)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">
            Widok miejsc
          </p>
          <p className="mt-2 text-sm text-[#4D463D]">
            Wszystkie miejscowki albo wybrany plan podrozy.
          </p>
        </div>
        <span className="inline-flex min-h-[2.5rem] min-w-[2.5rem] items-center justify-center rounded-full border border-[#E1D7C8] bg-white px-2.5 py-1 text-center text-xs font-medium leading-tight text-[#4D463D]">
          {loadingPlans ? "Ladowanie" : `${planOptions.length} opcji`}
        </span>
      </div>
      <select
        value={selectedPlanId}
        onChange={(event) => onSelectPlan(event.target.value)}
        className="mt-3 w-full rounded-xl border border-[#E5DCCF] bg-white px-3 py-2 text-sm text-[#4D463D]"
      >
        {planOptions.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FloatingToolbar({
  countries,
  selectedCountryId,
  selectedDestinationId,
  onOpenChangeDestination,
}) {
  const selectedCountry =
    countries.find((country) => country.id === selectedCountryId) || countries[0];
  const selectedDestination =
    selectedCountry?.destinations?.find(
      (destination) => destination.id === selectedDestinationId
    ) || selectedCountry?.destinations?.[0];

  return (
    <div className="rounded-[1.3rem] border border-[#E6DED1] bg-[rgba(255,255,255,0.92)] p-3 shadow-[0_16px_36px_rgba(34,31,25,0.10)] backdrop-blur">
      <div className="flex items-center gap-3">
        <MapPin className="h-4 w-4 shrink-0 text-[#6B7A52]" />
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#8A7F6C]">
              Now exploring
            </p>
            <p className="mt-2 text-lg font-semibold leading-tight text-[#1F1D1A]">
              {selectedCountry.countryName}, {selectedDestination?.name}
            </p>
          </div>
          <button
            onClick={onOpenChangeDestination}
            className="shrink-0 self-center inline-flex items-center justify-center rounded-full border border-[#D8CCBB] bg-white px-3 py-1.5 text-xs font-medium text-[#1F1D1A] transition hover:bg-[#F8F2E9]"
          >
            Zmien destination
          </button>
        </div>
      </div>
    </div>
  );
}

function DestinationChangeModal({
  countries,
  pendingCountryId,
  pendingDestinationId,
  onChangeCountry,
  onChangeDestination,
  onConfirm,
  onCancel,
}) {
  const pendingCountry =
    countries.find((country) => country.id === pendingCountryId) || countries[0];

  return (
    <div
      className="fixed inset-0 z-[1550] flex items-center justify-center bg-black/35 p-6"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-[460px] rounded-[1.6rem] border border-[#E6DED1] bg-white p-5 shadow-[0_28px_80px_rgba(34,31,25,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5DCCF] bg-[#FBF8F2] text-[#3A352E] transition hover:bg-white"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#8A7F6C]">
          Change destination
        </p>
        <div className="mt-4 grid gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">
              Country
            </p>
            <select
              value={pendingCountryId}
              onChange={(e) => onChangeCountry(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#E5DCCF] bg-[#FBF8F2] px-3 py-2 text-sm text-[#4D463D]"
            >
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.countryName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">
              Destination
            </p>
            <select
              value={pendingDestinationId}
              onChange={(e) => onChangeDestination(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#E5DCCF] bg-[#FBF8F2] px-3 py-2 text-sm text-[#4D463D]"
            >
              {pendingCountry.destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-full border border-[#D8CCBB] bg-white px-4 py-2 text-sm font-medium text-[#1F1D1A] transition hover:bg-[#F8F2E9]"
          >
            Przerwij
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center justify-center rounded-full border border-[#6B7A52] bg-[#6B7A52] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Zatwierdz
          </button>
        </div>
      </div>
    </div>
  );
}

function FloatingActivePlace({ destination, activePlaceId }) {
  const activePlace = findPlaceById(destination, activePlaceId);

  return (
    <div className="rounded-[1.35rem] border border-[#EEE6DA] bg-[rgba(251,248,242,0.92)] p-4 shadow-[0_14px_30px_rgba(34,31,25,0.10)] backdrop-blur">
      <p className="text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">
        Active place
      </p>
      <p className="mt-2 text-lg font-semibold text-[#1F1D1A]">
        {activePlace?.name}
      </p>
      <div className="mt-3">
        <RatingStars rating={activePlace?.rating || 4.5} />
      </div>
    </div>
  );
}

function FloatingCategoryPicker({
  availableCategories,
  selectedCategory,
  onSelectCategory,
}) {
  return (
    <div className="rounded-[1.35rem] border border-[#EEE6DA] bg-[rgba(251,248,242,0.92)] p-4 shadow-[0_14px_30px_rgba(34,31,25,0.10)] backdrop-blur">
      <p className="text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">
        Typ atrakcji
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {availableCategories.map((item) => {
          const Icon = categoryMeta[item.key].icon;
          return (
            <button
              key={item.key}
              onClick={() => onSelectCategory(item.key)}
              className={`flex min-h-[52px] w-full items-center gap-3 rounded-[1rem] border px-3 py-2.5 text-left text-sm transition ${
                item.key === selectedCategory
                  ? "border-[#D8CCBB] bg-white text-[#1F1D1A] shadow-[0_10px_24px_rgba(34,31,25,0.05)]"
                  : "border-[#E1D7C8] bg-white text-[#4D463D] hover:bg-[#F8F2E9]"
              }`}
            >
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: categoryMeta[item.key].color }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 leading-5">{item.label}</span>
              <span className="shrink-0 rounded-full border border-[#E6DED1] bg-[#FBF8F2] px-2 py-0.5 text-xs font-semibold text-[#6B6255]">
                {item.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FloatingTrailLayerToggle({
  trailCount,
  showTrailLayer,
  onToggle,
}) {
  if (!trailCount) return null;

  return (
    <div className="rounded-[1.35rem] border border-[#EEE6DA] bg-[rgba(251,248,242,0.92)] p-4 shadow-[0_14px_30px_rgba(34,31,25,0.10)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">
            Warstwa szlakow
          </p>
          <p className="mt-1 text-sm leading-5 text-[#4D463D]">
            Pokaz lub ukryj wszystkie trasy jednym kliknieciem.
          </p>
        </div>
        <span className="rounded-full border border-[#E1D7C8] bg-white px-2.5 py-1 text-sm font-semibold text-[#4D463D]">
          {trailCount}
        </span>
      </div>
      <button
        onClick={onToggle}
        className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
          showTrailLayer
            ? "border-[#6B7A52] bg-[#6B7A52] text-white hover:opacity-90"
            : "border-[#D8CCBB] bg-white text-[#1F1D1A] hover:bg-[#F8F2E9]"
        }`}
      >
        <Footprints className="h-4 w-4" />
        {showTrailLayer ? "Ukryj wszystkie szlaki" : "Pokaz wszystkie szlaki"}
      </button>
    </div>
  );
}

function FloatingCategoryPlaces({
  destination,
  activePlaceId,
  selectedCategory,
  onSelectPlace,
}) {
  const stats = countByCategory(destination.places).filter((item) => item.count > 0);
  const selectedGroup =
    stats.find((item) => item.key === selectedCategory) || stats[0] || null;

  if (!selectedGroup) return null;

  return (
    <div className="rounded-[1.35rem] border border-[#EEE6DA] bg-[rgba(251,248,242,0.92)] p-4 shadow-[0_14px_30px_rgba(34,31,25,0.10)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">
            Pozostale atrakcje
          </p>
          <p className="mt-2 text-sm font-semibold text-[#1F1D1A]">
            {selectedGroup.label}
          </p>
        </div>
        <span className="rounded-full border border-[#E1D7C8] bg-white px-2.5 py-1 text-sm font-semibold text-[#4D463D]">
          {selectedGroup.count}
        </span>
      </div>
      <div className="mt-4 max-h-[24rem] space-y-2 overflow-y-auto pr-1">
        {selectedGroup.places.map((place) => (
          <button
            key={place.id}
            onClick={() => onSelectPlace(place.id)}
            className={`flex w-full items-center justify-between gap-3 rounded-[1rem] border px-3 py-3 text-left text-sm transition ${
              place.id === activePlaceId
                ? "border-[#D8CCBB] bg-white text-[#1F1D1A] shadow-[0_10px_24px_rgba(34,31,25,0.05)]"
                : "border-[#E1D7C8] bg-white text-[#4D463D] hover:bg-[#F8F2E9]"
            }`}
          >
            <span className="min-w-0 flex-1 break-words leading-5">{place.name}</span>
            <span
              className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor:
                  categoryMeta[place.category]?.color || categoryMeta.city.color,
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function StoryPanelBody({
  slides,
  activeIndex,
  currentSlide,
  galleryImages,
  activePlaceMedia,
  galleryStart,
  setGalleryStart,
  setLightboxIndex,
  setLightboxOpen,
  metaBadges,
  placeVideos,
  onGoTo,
  expanded = false,
  onExpand,
  onClose,
}) {
  const [placePickerOpen, setPlacePickerOpen] = useState(false);
  const [placeSearchTerm, setPlaceSearchTerm] = useState("");
  const visibleThumbs = galleryImages.slice(galleryStart, galleryStart + 4);
  const filteredSlides = useMemo(() => {
    const query = placeSearchTerm.trim().toLowerCase();
    if (!query) {
      return slides.map((slide, index) => ({ ...slide, originalIndex: index }));
    }

    return slides
      .map((slide, index) => ({ ...slide, originalIndex: index }))
      .filter((slide) =>
        [slide.title, slide.subtitle, slide.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      );
  }, [placeSearchTerm, slides]);
  const hasActiveSlideInResults = filteredSlides.some(
    (slide) => slide.originalIndex === activeIndex
  );
  const activeSlideLabel = slides[activeIndex]?.title || "Wybierz miejscowke";

  useEffect(() => {
    if (!placePickerOpen) {
      setPlaceSearchTerm("");
    }
  }, [placePickerOpen]);

  return (
    <>
      <div className="mb-3 space-y-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setPlacePickerOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#E5DCCF] bg-[#FBF8F2] px-3 py-2 text-left text-sm text-[#4D463D] transition hover:bg-white"
          >
            <span className="min-w-0 flex-1 truncate">{activeSlideLabel}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-[#8A7F6C]" />
          </button>

          {placePickerOpen ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-[1.1rem] border border-[#E5DCCF] bg-white p-3 shadow-[0_18px_40px_rgba(34,31,25,0.12)]">
              <input
                type="text"
                value={placeSearchTerm}
                onChange={(e) => setPlaceSearchTerm(e.target.value)}
                placeholder="Wpisz nazwe miejscowki..."
                autoFocus
                className="w-full rounded-xl border border-[#E5DCCF] bg-[#FBF8F2] px-3 py-2 text-sm text-[#4D463D] outline-none transition focus:border-[#B9AE9A]"
              />
              <div className="mt-3 max-h-64 overflow-y-auto pr-1">
                {filteredSlides.length ? (
                  <div className="space-y-2">
                    {filteredSlides.map((slide) => (
                      <button
                        key={slide.id}
                        type="button"
                        onClick={() => {
                          onGoTo(slide.originalIndex);
                          setPlacePickerOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-[0.9rem] border px-3 py-2.5 text-left text-sm transition ${
                          slide.originalIndex === activeIndex
                            ? "border-[#D8CCBB] bg-[#FBF8F2] text-[#1F1D1A]"
                            : "border-[#EEE6DA] bg-white text-[#4D463D] hover:bg-[#F8F2E9]"
                        }`}
                      >
                        <span className="min-w-0 flex-1 break-words">{slide.title}</span>
                        {slide.originalIndex === activeIndex ? (
                          <span className="text-xs font-medium text-[#8A7F6C]">Aktywna</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[0.9rem] border border-[#EEE6DA] bg-[#FBF8F2] px-3 py-3 text-sm text-[#6B6255]">
                    Brak pasujacych miejscowek.
                  </div>
                )}
              </div>
              {!hasActiveSlideInResults && placeSearchTerm.trim() ? (
                <p className="mt-3 text-xs text-[#8A7F6C]">
                  Aktualnie wybrana miejscowka nie pasuje do filtra.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#8A7F6C]">
            Selected place story
          </p>
          <h3 className="mt-2 text-xl font-semibold text-[#1F1D1A]">
            {currentSlide.title}
          </h3>
          {currentSlide.subtitle ? (
            <RichText
              text={currentSlide.subtitle}
              className="mt-2 space-y-1 text-sm font-medium text-[#6B7A52]"
              paragraphClassName="text-sm font-medium leading-6 text-[#6B7A52]"
              listClassName="text-sm font-medium text-[#6B7A52]"
            />
          ) : null}
        </div>
        {expanded ? (
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E5DCCF] bg-[#FBF8F2] text-[#3A352E] transition hover:bg-white"
            aria-label="Zamknij panel historii miejsca"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <div className="shrink-0 whitespace-nowrap text-sm font-medium text-[#6B6255]">
            {activeIndex + 1} / {slides.length}
          </div>
        )}
      </div>

      <div className={expanded ? "flex-1 overflow-y-auto pr-1" : "flex-1 overflow-y-auto pr-1"}>
        {metaBadges.length > 0 && (
          <div className={expanded ? "mb-3 grid gap-2" : "mb-3 flex flex-wrap gap-2"}>
            {metaBadges.map((badge) => (
              <PlaceMetaBadge
                key={badge.key}
                icon={badge.icon}
                label={badge.label}
                tooltip={badge.tooltip}
                expanded={expanded}
              />
            ))}
          </div>
        )}

        <div className="overflow-hidden rounded-[1.1rem] border border-[#E8DFD2]">
          <button
            onClick={() => {
              const coverIndex = Math.max(
                galleryImages.findIndex(
                  (image) => image === (currentSlide.image || fallbackImage)
                ),
                0
              );
              setLightboxIndex(coverIndex);
              setLightboxOpen(true);
            }}
            className="block w-full"
          >
            <SmartImage
              urls={
                currentSlide.place
                  ? getPlaceImageCandidates(currentSlide.place, activePlaceMedia)
                  : [currentSlide.image]
              }
              alt={currentSlide.title}
              className={expanded ? "h-[320px] w-full object-cover" : "h-44 w-full object-cover"}
            />
          </button>
        </div>

        <StoryDescription
          text={currentSlide.description}
          expanded={expanded}
          onExpand={!expanded ? onExpand : undefined}
        />
        <TrailSummary place={currentSlide.place} expanded={expanded} />
        {galleryImages.length > 0 && expanded && (
          <div className="mt-3 rounded-[1rem] border border-[#E8DFD2] bg-white p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#8A7F6C]">
              Gallery
            </p>
            <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <button
                onClick={() =>
                  setGalleryStart((prev) => Math.max(prev - 1, 0))
                }
                className="p-1 text-[#3A352E] transition hover:text-[#1F1D1A] disabled:opacity-30"
                disabled={galleryStart === 0}
                aria-label="Poprzednie zdjecia"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="grid grid-cols-4 gap-2">
                {visibleThumbs.map((img, idx) => {
                  const absoluteIndex = galleryStart + idx;
                  return (
                    <button
                      key={`${img}-${absoluteIndex}`}
                      onClick={() => {
                        setLightboxIndex(absoluteIndex);
                        setLightboxOpen(true);
                      }}
                      className="overflow-hidden rounded-xl border border-[#E8DFD2]"
                    >
                      <SmartImage
                        urls={[img]}
                        alt={`${currentSlide.title} ${absoluteIndex + 1}`}
                        className={expanded ? "h-24 w-full object-cover" : "h-14 w-full object-cover"}
                      />
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() =>
                  setGalleryStart((prev) =>
                    Math.min(prev + 1, Math.max(galleryImages.length - 4, 0))
                  )
                }
                className="p-1 text-[#3A352E] transition hover:text-[#1F1D1A] disabled:opacity-30"
                disabled={galleryStart >= Math.max(galleryImages.length - 4, 0)}
                aria-label="Nastepne zdjecia"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        {galleryImages.length > 0 && !expanded && (
          <div className="mt-3">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <button
                onClick={() =>
                  setGalleryStart((prev) => Math.max(prev - 1, 0))
                }
                className="p-1 text-[#3A352E] transition hover:text-[#1F1D1A] disabled:opacity-30"
                disabled={galleryStart === 0}
                aria-label="Poprzednie zdjecia"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="grid grid-cols-4 gap-2">
                {visibleThumbs.map((img, idx) => {
                  const absoluteIndex = galleryStart + idx;
                  return (
                    <button
                      key={`${img}-${absoluteIndex}`}
                      onClick={() => {
                        setLightboxIndex(absoluteIndex);
                        setLightboxOpen(true);
                      }}
                      className="overflow-hidden rounded-xl border border-[#E8DFD2] bg-white"
                    >
                      <SmartImage
                        urls={[img]}
                        alt={`${currentSlide.title} ${absoluteIndex + 1}`}
                        className="h-20 w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() =>
                  setGalleryStart((prev) =>
                    Math.min(prev + 1, Math.max(galleryImages.length - 4, 0))
                  )
                }
                className="p-1 text-[#3A352E] transition hover:text-[#1F1D1A] disabled:opacity-30"
                disabled={galleryStart >= Math.max(galleryImages.length - 4, 0)}
                aria-label="Nastepne zdjecia"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        {placeVideos.length > 0 && (
          <div className="mt-3 rounded-[1rem] border border-[#E8DFD2] bg-white p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#8A7F6C]">
              Video
            </p>
            <div className="mt-3 space-y-3">
              {placeVideos.map((videoUrl, index) => (
                <video
                  key={`${videoUrl}-${index}`}
                  src={videoUrl}
                  controls
                  className="aspect-video w-full rounded-xl bg-black"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function DestinationTabs({ destination, activeIndex, onPrev, onNext, onGoTo }) {
  const slides = useMemo(() => getStorySlides(destination), [destination]);
  const [galleryStart, setGalleryStart] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [mapDetailsOpen, setMapDetailsOpen] = useState(false);
  const [storyPanelOpen, setStoryPanelOpen] = useState(false);
  const [activePlaceMedia, setActivePlaceMedia] = useState({
    cover: null,
    gallery: [],
    videos: [],
  });
  const canUsePortal = typeof document !== "undefined";

  if (!slides.length) {
    return (
      <div className="flex h-full min-h-[calc(100%-2rem)] flex-col rounded-[1.5rem] border border-[#E6DED1] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_18px_38px_rgba(34,31,25,0.12)] backdrop-blur">
        <p className="text-[10px] uppercase tracking-[0.24em] text-[#8A7F6C]">
          Selected place story
        </p>
        <div className="mt-4 rounded-[1.1rem] border border-[#E8DFD2] bg-[#FBF8F2] px-4 py-5 text-sm text-[#4D463D]">
          Brak historii do wyswietlenia dla tej destynacji.
        </div>
      </div>
    );
  }

  const safeActiveIndex = Math.min(Math.max(activeIndex, 0), slides.length - 1);
  const currentSlide = slides[safeActiveIndex];
  const activePlace = findPlaceById(destination, currentSlide.placeId);
  const metaBadges = getPlaceMetaBadges(activePlace);
  const galleryImages = activePlace
    ? uniqueImageUrls([
        getPlacePrimaryImage(activePlace, activePlaceMedia),
        ...getPlaceGalleryCandidates(activePlace, activePlaceMedia),
      ])
    : [];
  const placeVideos = activePlace?.videos?.length
    ? activePlace.videos
    : activePlace?.video
      ? [activePlace.video]
      : [];

  useEffect(() => {
    let cancelled = false;

    async function loadActivePlaceMedia() {
      if (!activePlace?.countryId || !activePlace?.destinationId || !activePlace?.id) {
        setActivePlaceMedia({ cover: null, gallery: [], videos: [] });
        return;
      }

      try {
        const nextMedia = await listPlaceMedia(
          activePlace.countryId,
          activePlace.destinationId,
          activePlace.id
        );

        if (!cancelled) {
          setActivePlaceMedia(nextMedia);
        }
      } catch {
        if (!cancelled) {
          setActivePlaceMedia({ cover: null, gallery: [], videos: [] });
        }
      }
    }

    loadActivePlaceMedia();

    return () => {
      cancelled = true;
    };
  }, [activePlace?.countryId, activePlace?.destinationId, activePlace?.id]);

  useEffect(() => {
    setGalleryStart(0);
    setLightboxIndex(0);
  }, [activePlace?.id]);

  useEffect(() => {
    setGalleryStart((prev) => Math.min(prev, Math.max(galleryImages.length - 4, 0)));
    setLightboxIndex((prev) => Math.min(prev, Math.max(galleryImages.length - 1, 0)));
  }, [galleryImages.length]);

  return (
    <>
      <div className="flex h-full min-h-[calc(100%-2rem)] flex-col rounded-[1.5rem] border border-[#E6DED1] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_18px_38px_rgba(34,31,25,0.12)] backdrop-blur">
        <StoryPanelBody
          slides={slides}
          activeIndex={safeActiveIndex}
          currentSlide={{ ...currentSlide, place: activePlace }}
          galleryImages={galleryImages}
          activePlaceMedia={activePlaceMedia}
          galleryStart={galleryStart}
          setGalleryStart={setGalleryStart}
          setLightboxIndex={setLightboxIndex}
          setLightboxOpen={setLightboxOpen}
          metaBadges={metaBadges}
          placeVideos={placeVideos}
          onGoTo={onGoTo}
          onExpand={() => setStoryPanelOpen(true)}
        />

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-[#E8DFD2] pt-4 text-sm text-[#6B6255]">
            <button
              onClick={onPrev}
              className="rounded-full border border-[#E4DBCD] bg-[#FBF8F2] p-2 text-[#3A352E] transition hover:bg-[#F2ECE2]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={onNext}
              className="rounded-full border border-[#E4DBCD] bg-[#FBF8F2] p-2 text-[#3A352E] transition hover:bg-[#F2ECE2]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
        </div>
      </div>

      {lightboxOpen &&
        galleryImages.length > 0 &&
        canUsePortal &&
        createPortal(
        <div className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/80 p-6">
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute right-6 top-6 rounded-full border border-white/20 bg-white/10 p-2 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            onClick={() =>
              setLightboxIndex(
                (prev) => (prev - 1 + galleryImages.length) % galleryImages.length
              )
            }
            className="absolute left-6 rounded-full border border-white/20 bg-white/10 p-2 text-white"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <SmartImage
            urls={[galleryImages[lightboxIndex]]}
            alt={`${currentSlide.title} full`}
            className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain"
          />
          <button
            onClick={() =>
              setLightboxIndex((prev) => (prev + 1) % galleryImages.length)
            }
            className="absolute right-6 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-2 text-white"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>,
        document.body
      )}

      {storyPanelOpen &&
        canUsePortal &&
        createPortal(
          <div className="fixed inset-0 z-[1550] flex items-center justify-center bg-[rgba(24,21,18,0.58)] p-4 md:p-6">
            <div className="flex h-[min(88vh,980px)] w-full max-w-[920px] justify-center">
              <div className="flex w-full max-w-[820px] flex-col overflow-hidden rounded-[2rem] border border-[#E6DED1] bg-white p-5 shadow-[0_30px_90px_rgba(0,0,0,0.24)] md:p-6">
                <StoryPanelBody
                  slides={slides}
                  activeIndex={activeIndex}
                  currentSlide={{ ...currentSlide, place: activePlace }}
                  galleryImages={galleryImages}
                  activePlaceMedia={activePlaceMedia}
                  galleryStart={galleryStart}
                  setGalleryStart={setGalleryStart}
                  setLightboxIndex={setLightboxIndex}
                  setLightboxOpen={setLightboxOpen}
                  metaBadges={metaBadges}
                  placeVideos={placeVideos}
                  onGoTo={onGoTo}
                  expanded
                  onClose={() => setStoryPanelOpen(false)}
                />
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#E8DFD2] pt-4 text-sm text-[#6B6255]">
                  <div className="whitespace-nowrap text-sm font-medium text-[#6B6255]">
                    {safeActiveIndex + 1} / {slides.length}
                  </div>
                  <div className="flex items-center gap-2">
                  <button
                    onClick={onPrev}
                    className="rounded-full border border-[#E4DBCD] bg-[#FBF8F2] p-2 text-[#3A352E] transition hover:bg-[#F2ECE2]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={onNext}
                    className="rounded-full border border-[#E4DBCD] bg-[#FBF8F2] p-2 text-[#3A352E] transition hover:bg-[#F2ECE2]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function DestinationMapSurface({
  countries,
  selectedCountryId,
  selectedDestinationId,
  onOpenChangeDestination,
  destination,
  activePlaceId,
  selectedCategory,
  showTrailLayer,
  trailGeometries,
  onSelectPlace,
  storyOverlay,
  detailsOverlay,
}) {
  if (!destination?.places?.length) {
    return (
      <div className="theme-story-card overflow-hidden rounded-[2rem] border border-[#E6DED1] bg-white p-6 shadow-[0_18px_60px_rgba(34,31,25,0.06)]">
        <div className="rounded-[1.6rem] border border-[#E8E0D3] bg-[linear-gradient(180deg,#F7F3EC_0%,#F2ECE2_100%)] px-6 py-10 text-center text-[#4D463D]">
          Ta destynacja nie ma jeszcze zapisanych miejsc na mapie.
        </div>
      </div>
    );
  }
  const activePlace = findPlaceById(destination, activePlaceId);

  return (
    <div className="theme-story-card overflow-hidden rounded-[2rem] border border-[#E6DED1] bg-white p-4 shadow-[0_18px_60px_rgba(34,31,25,0.06)]">
      <div className="relative h-[calc(100dvh-7.5rem)] min-h-[720px] rounded-[1.6rem] border border-[#E8E0D3] bg-[radial-gradient(circle_at_top_left,rgba(107,122,82,0.08),transparent_35%),linear-gradient(180deg,#F3EEE5_0%,#ECE5D8_100%)]">
        <div className="pointer-events-none absolute bottom-4 right-4 z-[700] w-[360px] max-w-[calc(100%-2rem)]">
          <div className="pointer-events-auto">
            <FloatingToolbar
              countries={countries}
              selectedCountryId={selectedCountryId}
              selectedDestinationId={selectedDestinationId}
              onOpenChangeDestination={onOpenChangeDestination}
            />
          </div>
        </div>

        <div className="pointer-events-none absolute left-4 top-1/2 z-[700] hidden w-[370px] -translate-y-1/2 xl:block">
          <div className="pointer-events-auto">{storyOverlay}</div>
        </div>

        <div className="pointer-events-none absolute right-4 top-4 z-[700] hidden w-[310px] xl:block [bottom:8.5rem]">
          <div className="pointer-events-auto h-full overflow-hidden rounded-[1.35rem]">
            <div className="story-details-scroll h-full overflow-y-auto pr-1">
              {detailsOverlay}
            </div>
          </div>
        </div>

        <div className="absolute inset-0 z-0 overflow-hidden rounded-[1.6rem] [filter:saturate(0.35)_sepia(0.15)_contrast(0.95)]">
          <MapContainer
            center={destination.places[0].coordinates}
            zoom={10}
            zoomControl={true}
            attributionControl={false}
            className="h-full w-full"
            scrollWheelZoom={true}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <SyncMapSize />
            <FitBounds points={destination.places} />
            {showTrailLayer &&
              destination.places
                .filter((place) => isTrailPlace(place))
                .map((place) => {
                  const { geometry, kind } = resolveDisplayedTrailGeometry(
                    place,
                    destination.places.filter((entry) => isTrailPlace(entry)),
                    trailGeometries
                  );

                  if (geometry.length < 2) return null;

                  return (
                    <Polyline
                      key={`story-trail-${place.id}`}
                      positions={geometry}
                      pathOptions={{
                        color: kind === "exact" ? "#6B7A52" : "#98A27A",
                        weight: kind === "exact" ? 5 : 3,
                        opacity: kind === "exact" ? 0.82 : 0.58,
                        dashArray: kind === "exact" ? undefined : "8 10",
                      }}
                    />
                  );
                })}
            {destination.places.map((place) => {
              const isActive = place.id === activePlaceId;
              const isCategorySelected = place.category === selectedCategory;
              return (
                <Marker
                  key={place.id}
                  position={place.coordinates}
                  icon={createPlaceMarkerIcon(
                    place,
                    isActive,
                    isCategorySelected
                  )}
                  eventHandlers={{ click: () => onSelectPlace(place.id) }}
                >
                  <LeafletPopup>
                    <div className="min-w-[180px] max-w-[220px]">
                      <p className="font-semibold text-[#1F1D1A]">{place.name}</p>
                      <div className="mt-2">
                        <RatingStars rating={place.rating || 4.5} />
                      </div>
                      <button
                        onClick={() =>
                          window.open(
                            mapsUrl(place),
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                        className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#DCD1C0] bg-[#F8F4ED] px-3 py-1.5 text-xs text-[#3E382F]"
                      >
                        Nawiguj <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </LeafletPopup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        <div className="absolute bottom-4 left-4 z-[680] rounded-[1.2rem] border border-[#EEE6DA] bg-[rgba(251,248,242,0.9)] px-4 py-3 shadow-[0_14px_30px_rgba(34,31,25,0.10)] backdrop-blur xl:hidden">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#8A7F6C]">
            Active place
          </p>
          <p className="mt-1 text-sm font-semibold text-[#1F1D1A]">
            {activePlace?.name}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:hidden">
        {storyOverlay}
        {detailsOverlay}
      </div>
    </div>
  );
}

function getPlaceDescription(place) {
  return (
    place?.description ||
    place?.note ||
    place?.info ||
    "To miejsce mozesz pozniej uzupelnic opisem, praktyczna notatka albo wspomnieniem z podrozy."
  );
}

function PracticalInfo({ icon: Icon, label, value }) {
  const [open, setOpen] = useState(false);
  if (!value) return null;

  return (
    <div className="relative flex justify-center">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="theme-story-info-icon inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#E6FAFC] text-[#008EA1] transition hover:bg-[#D7F5F8] hover:text-[#006E7D]"
        aria-label={`${label}: ${value}`}
        title={value}
      >
        <Icon className="h-5 w-5" />
      </button>
      {open ? (
        <div className="absolute left-1/2 top-[calc(100%+0.5rem)] z-[1200] w-72 -translate-x-1/2 rounded-xl border border-[#DCECF0] bg-white px-3 py-3 text-sm leading-6 text-[#132334] shadow-[0_18px_42px_rgba(15,58,66,0.16)]">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold text-[#008EA1]">{label}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#647782] transition hover:bg-[#E6FAFC] hover:text-[#008EA1]"
              aria-label="Zamknij informacje"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 select-text whitespace-pre-wrap">{value}</p>
        </div>
      ) : null}
    </div>
  );
}

function FullPlaceInfoModal({
  place,
  description,
  coverUrls = [],
  galleryImages = [],
  activePlaceMedia = null,
  onClose,
}) {
  if (!place) return null;
  const category = categoryMeta[place.category] || categoryMeta.city;
  const CategoryIcon = category.icon;
  const subtitle = place.subtitle || place.note || category.label;

  return createPortal(
    <div className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/55 p-4 md:p-6">
      <div className="theme-story-modal max-h-[88vh] w-full max-w-[780px] overflow-hidden rounded-[1.6rem] border border-[#DCECF0] bg-white shadow-[0_30px_90px_rgba(0,0,0,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#DCECF0] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-[#008EA1]">Pelny opis</p>
            <h2 className="mt-1 text-2xl font-semibold text-[#132334]">
              {place.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#DCECF0] bg-white text-[#132334] transition hover:border-[#008EA1] hover:text-[#008EA1]"
            aria-label="Zamknij opis"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="story-details-scroll max-h-[calc(88vh-96px)] overflow-y-auto px-5 py-5">
          <div className="relative overflow-hidden rounded-xl border border-[#DCECF0] bg-[#EAF4F7]">
            <SmartImage
              urls={coverUrls.length ? coverUrls : getPlaceImageCandidates(place, activePlaceMedia)}
              alt={place.name}
              className="h-[320px] w-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.16)_48%,rgba(0,0,0,0.70)_100%)]" />
            <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1 text-xs backdrop-blur">
                <CategoryIcon className="h-3.5 w-3.5" />
                {category.label}
              </div>
              <h3 className="text-3xl font-semibold leading-tight">{place.name}</h3>
            </div>
          </div>
          {subtitle ? (
            <div className="mt-5 text-sm font-semibold leading-6 text-[#647782]">
              <RichText
                text={subtitle}
                paragraphClassName="leading-6 text-[#647782]"
                listClassName="text-[#647782]"
              />
            </div>
          ) : null}
          <RichText
            text={description}
            className="mt-5"
            paragraphClassName="leading-7 text-[#647782]"
            listClassName="text-[#647782]"
          />
          <div className="mt-6 flex items-center gap-4">
            <PracticalInfo icon={Ticket} label="Bilety" value={place.ticket} />
            <PracticalInfo
              icon={CalendarCheck2}
              label="Rezerwacja"
              value={place.reservation}
            />
            <PracticalInfo icon={Info} label="Informacje" value={place.info} />
            <PracticalInfo
              icon={Clock3}
              label="Czas"
              value={formatDuration(place.durationHours)}
            />
            <PracticalInfo
              icon={Ruler}
              label="Dystans"
              value={formatDistance(place.distanceKm)}
            />
          </div>
          {galleryImages.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-base font-semibold text-[#132334]">
                Galeria zdjec
              </h3>
              <div className="mt-3 grid grid-cols-4 gap-3">
                {galleryImages.slice(0, 8).map((img, index) => (
                  <SmartImage
                    key={`${img}-${index}`}
                    urls={[img]}
                    alt={`${place.name} ${index + 1}`}
                    className="h-24 w-full rounded-lg border border-[#DCECF0] object-cover"
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

function MapPlacePopup({ place, onSelectPlace, onOpenDetails }) {
  const image = getPlacePrimaryImage(place);
  const meta = categoryMeta[place.category] || categoryMeta.city;

  return (
    <div className="w-[310px] rounded-[1.1rem] bg-white p-3 text-[#132334]">
      <div className="flex items-start gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#EAF4F7]">
          <SmartImage
            urls={[image]}
            alt={place.name}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 pt-0.5">
          <p className="truncate text-lg font-semibold leading-tight">{place.name}</p>
          <p className="mt-1 text-sm leading-tight text-[#647782]">{meta.label}</p>
          <div className="mt-2 inline-flex items-center gap-2 text-sm font-semibold leading-tight text-[#008EA1]">
            <Star className="h-4 w-4 fill-[#008EA1]" />
            {(place.rating || 4.5).toFixed(1)}
          </div>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#647782]">
        {getPlaceDescription(place)}
      </p>
      <button
        type="button"
        onClick={() => {
          onSelectPlace(place.id);
          onOpenDetails(place.id);
        }}
        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg border border-[#DCECF0] bg-white px-4 text-sm font-semibold text-[#008EA1] transition hover:border-[#008EA1] hover:bg-[#E6FAFC]"
      >
        Zobacz szczegoly
      </button>
      <button
        type="button"
        onClick={() => window.open(mapsUrl(place), "_blank", "noopener,noreferrer")}
        className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#008EA1] px-4 text-sm font-semibold text-white transition hover:bg-[#007786]"
      >
        <MapPin className="h-4 w-4" />
        Nawiguj w Google Maps
      </button>
    </div>
  );
}

function OldPracticalInfo({ icon: Icon, label, value }) {
  if (!value) return null;

  return (
    <div className="theme-story-info flex min-h-[68px] items-start gap-3 rounded-xl border border-[#DCECF0] bg-white px-3 py-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E6FAFC] text-[#008EA1]">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-[#647782]">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-[#132334]">
          {value}
        </p>
      </div>
    </div>
  );
}

function PlaceDetailsPanel({
  place,
  galleryImages,
  activePlaceMedia,
  placeVideos,
  galleryStart,
  setGalleryStart,
  setLightboxIndex,
  setLightboxOpen,
  currentIndex,
  total,
  onPrev,
  onNext,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const coverUrls = place
    ? getPlaceImageCandidates(place, activePlaceMedia)
    : [fallbackImage];
  const visibleThumbs = galleryImages.slice(galleryStart, galleryStart + 4);
  const description = getPlaceDescription(place);
  const category = categoryMeta[place?.category] || categoryMeta.city;
  const CategoryIcon = category.icon;
  const subtitle = place?.subtitle || place?.note || category.label;

  useEffect(() => {
    setDetailsOpen(false);
  }, [place?.id]);

  if (!place) {
    return (
      <aside className="theme-story-side flex min-h-0 flex-col rounded-[1.4rem] border border-[#DCECF0] bg-white p-5">
        <p className="text-sm text-[#647782]">Brak wybranej miejscowki.</p>
      </aside>
    );
  }

  return (
    <aside className="theme-story-side flex min-h-0 flex-col rounded-[1.4rem] border border-[#DCECF0] bg-white p-4 shadow-[0_22px_70px_rgba(15,58,66,0.08)]">
      <div className="relative overflow-hidden rounded-xl border border-[#DCECF0] bg-[#EAF4F7]">
        <button
          type="button"
          onClick={() => {
            setLightboxIndex(0);
            setLightboxOpen(true);
          }}
          className="block w-full"
        >
          <SmartImage
            urls={coverUrls}
            alt={place.name}
            className="h-[310px] w-full object-cover"
          />
        </button>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.18)_50%,rgba(0,0,0,0.72)_100%)]" />
        <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1 text-xs backdrop-blur">
            <CategoryIcon className="h-3.5 w-3.5" />
            {category.label}
          </div>
          <h2 className="text-3xl font-semibold leading-tight">{place.name}</h2>
          <div className="mt-2 inline-flex items-center gap-2 text-sm text-white/90">
            <Star className="h-4 w-4 fill-[#25D9E8] text-[#25D9E8]" />
            {(place.rating || 4.5).toFixed(1)}
            <span className="text-white/60">({currentIndex + 1}/{total})</span>
          </div>
        </div>
      </div>

      <div className="story-details-scroll mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        {subtitle ? (
          <section className="text-sm font-semibold leading-6 text-[#647782]">
            <RichText
              text={subtitle}
              paragraphClassName="leading-6 text-[#647782]"
              listClassName="text-[#647782]"
            />
          </section>
        ) : null}

        <section className="mt-5">
          <h3 className="text-base font-semibold text-[#132334]">
            Wazne informacje
          </h3>
          <div className="mt-3 flex items-center gap-4">
            <PracticalInfo icon={Ticket} label="Bilety" value={place.ticket} />
            <PracticalInfo
              icon={CalendarCheck2}
              label="Rezerwacja"
              value={place.reservation}
            />
            <PracticalInfo icon={Info} label="Informacje" value={place.info} />
            <PracticalInfo
              icon={Clock3}
              label="Czas"
              value={formatDuration(place.durationHours)}
            />
            <PracticalInfo
              icon={Ruler}
              label="Dystans"
              value={formatDistance(place.distanceKm)}
            />
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-base font-semibold text-[#132334]">Opis</h3>
          <div className="mt-3 line-clamp-3 text-sm leading-6 text-[#647782]">
            <RichText
              text={description}
              paragraphClassName="leading-6 text-[#647782]"
              listClassName="text-[#647782]"
            />
          </div>
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#008EA1] px-4 text-sm font-semibold text-white transition hover:bg-[#007786]"
          >
            Czytaj wiecej
          </button>
        </section>

        {galleryImages.length > 0 ? (
          <section className="mt-6">
            <h3 className="text-base font-semibold text-[#132334]">
              Galeria zdjec
            </h3>
            <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <button
                type="button"
                onClick={() => setGalleryStart((prev) => Math.max(prev - 1, 0))}
                className="theme-story-nav-button p-1 text-[#132334] transition hover:text-[#008EA1] disabled:opacity-30"
                disabled={galleryStart === 0}
                aria-label="Poprzednie zdjecia"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="grid grid-cols-4 gap-2">
                {visibleThumbs.map((img, idx) => {
                  const absoluteIndex = galleryStart + idx;
                  return (
                    <button
                      key={`${img}-${absoluteIndex}`}
                      type="button"
                      onClick={() => {
                        setLightboxIndex(absoluteIndex);
                        setLightboxOpen(true);
                      }}
                      className="overflow-hidden rounded-lg border border-[#DCECF0] bg-white"
                    >
                      <SmartImage
                        urls={[img]}
                        alt={`${place.name} ${absoluteIndex + 1}`}
                        className="h-20 w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() =>
                  setGalleryStart((prev) =>
                    Math.min(prev + 1, Math.max(galleryImages.length - 4, 0))
                  )
                }
                className="theme-story-nav-button p-1 text-[#132334] transition hover:text-[#008EA1] disabled:opacity-30"
                disabled={galleryStart >= Math.max(galleryImages.length - 4, 0)}
                aria-label="Nastepne zdjecia"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        ) : null}

        {placeVideos.length > 0 ? (
          <section className="mt-6">
            <h3 className="text-base font-semibold text-[#132334]">Video</h3>
            <div className="mt-3 space-y-3">
              {placeVideos.map((videoUrl, index) => (
                <video
                  key={`${videoUrl}-${index}`}
                  src={videoUrl}
                  controls
                  className="aspect-video w-full rounded-xl bg-black"
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#DCECF0] pt-4">
        <button
          type="button"
          onClick={onPrev}
          className="theme-story-nav-button inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#DCECF0] bg-white text-[#132334] transition hover:border-[#008EA1] hover:text-[#008EA1]"
          aria-label="Poprzednia miejscowka"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-sm font-medium text-[#647782]">
          {currentIndex + 1} / {total}
        </p>
        <button
          type="button"
          onClick={onNext}
          className="theme-story-nav-button inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#DCECF0] bg-white text-[#132334] transition hover:border-[#008EA1] hover:text-[#008EA1]"
          aria-label="Nastepna miejscowka"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      {detailsOpen ? (
        <FullPlaceInfoModal
          place={place}
          description={description}
          coverUrls={coverUrls}
          galleryImages={galleryImages}
          activePlaceMedia={activePlaceMedia}
          onClose={() => setDetailsOpen(false)}
        />
      ) : null}
    </aside>
  );
}

function StoryMapCanvas({
  destination,
  activePlaceId,
  selectedCategory,
  showTrailLayer,
  trailGeometries,
  onSelectPlace,
  onOpenDetails,
  topOverlay,
}) {
  const safePlaces = (destination.places || [])
    .map((place) => normalizePlaceCoordinates(place))
    .filter(Boolean);
  const trailPlaces = safePlaces.filter((place) => isTrailPlace(place));

  return (
    <div
      id="story-map-print-area"
      className="theme-story-map relative h-full min-h-0 flex-1 overflow-hidden rounded-[1.4rem] border border-[#DCECF0] bg-[#EAF4F7]"
    >
      {topOverlay ? (
        <div className="absolute left-4 right-4 top-4 z-[700]">{topOverlay}</div>
      ) : null}
      <div className="absolute inset-0 [filter:saturate(0.42)_contrast(0.98)_brightness(1.05)]">
        <MapContainer
          center={safePlaces[0]?.coordinates || [0, 0]}
          zoom={10}
          zoomControl={true}
          attributionControl={false}
          className="h-full w-full"
          scrollWheelZoom={true}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <SyncMapSize />
          <FitBounds points={safePlaces} />
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
                  key={`story-trail-${place.id}`}
                  positions={geometry}
                  pathOptions={{
                    color: kind === "exact" ? "#008EA1" : "#65C9D4",
                    weight: kind === "exact" ? 5 : 3,
                    opacity: kind === "exact" ? 0.82 : 0.58,
                    dashArray: kind === "exact" ? undefined : "8 10",
                  }}
                />
              );
            })}
          {safePlaces.map((place) => {
            const isActive = place.id === activePlaceId;
            const isCategorySelected = place.category === selectedCategory;
            return (
              <Marker
                key={place.id}
                position={place.coordinates}
                icon={createPlaceMarkerIcon(place, isActive, isCategorySelected)}
                eventHandlers={{ click: () => onSelectPlace(place.id) }}
              >
                <LeafletPopup>
                  <MapPlacePopup
                    place={place}
                    onSelectPlace={onSelectPlace}
                    onOpenDetails={onOpenDetails}
                  />
                </LeafletPopup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

function StoryFilterDrawer({
  open,
  onClose,
  availableCategories,
  selectedCategory,
  onSelectCategory,
  places,
  activePlaceId,
  onSelectPlace,
  planOptions,
  selectedPlanId,
  onSelectPlan,
  loadingPlans,
}) {
  const [query, setQuery] = useState("");
  const filteredPlaces = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return places;
    return places.filter((place) =>
      [place.name, place.subtitle, place.note, place.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }, [places, query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <>
      <div
        className={[
          "theme-story-filter fixed bottom-4 left-[136px] top-4 z-[1420] w-[360px] max-w-[calc(100vw-2rem)] rounded-[1.4rem] border border-[#DCECF0] bg-white p-5 shadow-[0_28px_80px_rgba(15,58,66,0.18)] transition duration-200",
          open ? "translate-x-0 opacity-100" : "-translate-x-[calc(100%+2rem)] opacity-0 pointer-events-none",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[#132334]">
              Filtry miejscowek
            </h3>
            <p className="mt-1 text-sm text-[#647782]">
              Zawez widok mapy i liste miejsc.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#DCECF0] bg-white text-[#132334]"
            aria-label="Zamknij filtry"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold text-[#647782]">Rodzaj miejscowki</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {availableCategories.map((item) => {
              const meta =
                item.key === "all"
                  ? { label: "Wszystkie", icon: Globe2, color: "#008EA1" }
                  : categoryMeta[item.key] || categoryMeta.city;
              const Icon = meta.icon;
              const active = item.key === selectedCategory;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelectCategory(item.key)}
                  className={[
                    "relative flex min-h-[78px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center text-[11px] font-semibold transition",
                    active
                      ? "border-[#008EA1] bg-[#E6FAFC] text-[#008EA1]"
                      : "border-[#DCECF0] bg-white text-[#132334] hover:border-[#8DDAE4]",
                  ].join(" ")}
                >
                  <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#E6FAFC] text-[#008EA1]">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#132334] px-1 text-[9px] font-bold text-white">
                      {item.count}
                    </span>
                  </span>
                  <span className="line-clamp-2 min-w-0">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold text-[#647782]">Plan podrozy</p>
          <select
            value={selectedPlanId}
            onChange={(event) => onSelectPlan(event.target.value)}
            className="theme-story-field mt-2 h-11 w-full rounded-xl border border-[#DCECF0] bg-white px-3 text-sm text-[#132334] outline-none focus:border-[#008EA1]"
          >
            {planOptions.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {loadingPlans ? "Ladowanie planow..." : plan.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold text-[#647782]">Wyszukaj miejscowke</p>
          <div className="theme-story-field mt-2 flex h-11 items-center gap-2 rounded-xl border border-[#DCECF0] bg-white px-3">
            <Search className="h-4 w-4 text-[#647782]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Szukaj miejscowki..."
              className="min-w-0 flex-1 bg-transparent text-sm text-[#132334] outline-none placeholder:text-[#647782]"
            />
          </div>
          <div className="atlas-scroll mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {filteredPlaces.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => {
                  onSelectPlace(place.id);
                  onClose();
                }}
                className={[
                  "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left text-sm transition",
                  place.id === activePlaceId
                    ? "border-[#008EA1] bg-[#E6FAFC] text-[#008EA1]"
                    : "border-[#DCECF0] bg-white text-[#132334] hover:border-[#8DDAE4]",
                ].join(" ")}
              >
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {place.name}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
      {open ? (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-[1410] bg-black/10 xl:hidden"
          aria-label="Zamknij filtry"
        />
      ) : null}
    </>
  );
}

export default function StoryPanel({
  countries,
  selectedCountryId,
  selectedDestinationId,
  onSelectCountry,
  onSelectDestination,
  destination,
}) {
  const safeDestination = useMemo(
    () => destination || { places: [], video: "", id: "empty" },
    [destination]
  );
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("all-places");
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [activePlaceId, setActivePlaceId] = useState(safeDestination.places?.[0]?.id || "");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showTrailLayer, setShowTrailLayer] = useState(false);
  const [trailGeometries, setTrailGeometries] = useState({});
  const [destinationDialogOpen, setDestinationDialogOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [galleryStart, setGalleryStart] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [mapDetailsOpen, setMapDetailsOpen] = useState(false);
  const [activePlaceMedia, setActivePlaceMedia] = useState({
    cover: null,
    gallery: [],
    videos: [],
  });
  const [pendingCountryId, setPendingCountryId] = useState(selectedCountryId);
  const [pendingDestinationId, setPendingDestinationId] =
    useState(selectedDestinationId);

  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) || null;
  const visiblePlaceIds =
    selectedPlanId === "all-places" ? null : getPlanPlaceIds(selectedPlan);
  const planFilteredPlaces = useMemo(() => {
    if (!visiblePlaceIds) return safeDestination.places || [];
    return (safeDestination.places || []).filter((place) =>
      visiblePlaceIds.has(place.id)
    );
  }, [safeDestination.places, visiblePlaceIds]);
  const availableCategories = useMemo(() => {
    const categoryItems = countByCategory(planFilteredPlaces).filter(
      (item) => item.count > 0
    );
    return [
      {
        key: "all",
        label: "Wszystkie",
        count: planFilteredPlaces.length,
        places: planFilteredPlaces,
      },
      ...categoryItems,
    ];
  }, [planFilteredPlaces]);
  const filteredPlaces = useMemo(() => {
    if (selectedCategory === "all") return planFilteredPlaces;
    return planFilteredPlaces.filter((place) => place.category === selectedCategory);
  }, [planFilteredPlaces, selectedCategory]);
  const filteredDestination = useMemo(
    () => ({
      ...safeDestination,
      places: filteredPlaces
        .map((place) => normalizePlaceCoordinates(enrichPlaceForDisplay(place)))
        .filter(Boolean),
    }),
    [safeDestination, filteredPlaces]
  );
  const slides = useMemo(() => getStorySlides(filteredDestination), [filteredDestination]);
  const trailPlaces = useMemo(
    () => (filteredDestination.places || []).filter((place) => isTrailPlace(place)),
    [filteredDestination.places]
  );
  const planOptions = useMemo(() => {
    const sortedPlans = [...plans].sort((a, b) => {
      if (a.isFavorite === b.isFavorite) return 0;
      return a.isFavorite ? -1 : 1;
    });

    return [
      { id: "all-places", label: "Wszystkie miejscowki" },
      ...sortedPlans.map((plan) => ({
        id: plan.id,
        label: `${plan.isFavorite ? "★ " : ""}${plan.name} · ${normalizePlanItinerary(plan.itinerary).length} dni`,
      })),
    ];
  }, [plans]);
  const effectiveSelectedCategory =
    availableCategories.find((item) => item.key === selectedCategory)?.key ||
    "all";
  const activePlace = filteredDestination.places.find(
    (place) => place.id === activePlaceId
  ) || filteredDestination.places[0];
  const activePlaceIndex = Math.max(
    filteredDestination.places.findIndex((place) => place.id === activePlace?.id),
    0
  );
  const galleryImages = activePlace
    ? uniqueImageUrls([
        getPlacePrimaryImage(activePlace, activePlaceMedia),
        ...getPlaceGalleryCandidates(activePlace, activePlaceMedia),
      ])
    : [];
  const placeVideos = activePlace?.videos?.length
    ? activePlace.videos
    : activePlace?.video
      ? [activePlace.video]
      : [];

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
              [trailPlace.id]:
                current[trailPlace.id]?.length > 1
                  ? current[trailPlace.id]
                  : fallbackGeometry,
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
            // Keep fallback geometry when lookup fails.
          }
        })
      );
    }

    preloadTrailGeometries();

    return () => {
      cancelled = true;
    };
  }, [showTrailLayer, trailPlaces]);

  useEffect(() => {
    let cancelled = false;

    async function loadPlans() {
      if (!safeDestination.id || safeDestination.id === "empty") {
        setPlans([]);
        setSelectedPlanId("all-places");
        return;
      }

      setLoadingPlans(true);
      try {
        const nextPlans = await fetchPlannerPlans(safeDestination.id);
        if (cancelled) return;
        setPlans(nextPlans);
        setSelectedPlanId((current) =>
          current !== "all-places" && nextPlans.some((plan) => plan.id === current)
            ? current
            : "all-places"
        );
      } catch {
        if (cancelled) return;
        setPlans([]);
        setSelectedPlanId("all-places");
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
  }, [safeDestination.id]);

  useEffect(() => {
    if (!filteredDestination.places.length) {
      setActivePlaceId("");
      setActiveStoryIndex(0);
      return;
    }

    const hasActivePlace = filteredDestination.places.some(
      (place) => place.id === activePlaceId
    );
    const nextPlaceId = hasActivePlace
      ? activePlaceId
      : filteredDestination.places[0]?.id || "";

    if (nextPlaceId !== activePlaceId) {
      setActivePlaceId(nextPlaceId);
    }

    const nextPlace = filteredDestination.places.find(
      (place) => place.id === nextPlaceId
    );
    if (!availableCategories.some((item) => item.key === selectedCategory)) {
      setSelectedCategory("all");
    }

    const nextSlideIndex = slides.findIndex((slide) => slide.placeId === nextPlaceId);
    if (nextSlideIndex >= 0 && nextSlideIndex !== activeStoryIndex) {
      setActiveStoryIndex(nextSlideIndex);
    }
  }, [
    activePlaceId,
    activeStoryIndex,
    availableCategories,
    filteredDestination.places,
    selectedCategory,
    slides,
  ]);

  useEffect(() => {
    if (!slides.length) {
      if (activeStoryIndex !== 0) {
        setActiveStoryIndex(0);
      }
      return;
    }

    const maxIndex = slides.length - 1;
    if (activeStoryIndex > maxIndex) {
      setActiveStoryIndex(maxIndex);
    }
  }, [activeStoryIndex, slides.length]);

  useEffect(() => {
    let cancelled = false;

    async function loadActivePlaceMedia() {
      if (!activePlace?.countryId || !activePlace?.destinationId || !activePlace?.id) {
        setActivePlaceMedia({ cover: null, gallery: [], videos: [] });
        return;
      }

      try {
        const nextMedia = await listPlaceMedia(
          activePlace.countryId,
          activePlace.destinationId,
          activePlace.id
        );

        if (!cancelled) {
          setActivePlaceMedia(nextMedia);
        }
      } catch {
        if (!cancelled) {
          setActivePlaceMedia({ cover: null, gallery: [], videos: [] });
        }
      }
    }

    loadActivePlaceMedia();

    return () => {
      cancelled = true;
    };
  }, [activePlace?.countryId, activePlace?.destinationId, activePlace?.id]);

  useEffect(() => {
    setGalleryStart(0);
    setLightboxIndex(0);
  }, [activePlace?.id]);

  useEffect(() => {
    setGalleryStart((prev) => Math.min(prev, Math.max(galleryImages.length - 4, 0)));
    setLightboxIndex((prev) => Math.min(prev, Math.max(galleryImages.length - 1, 0)));
  }, [galleryImages.length]);

  const syncToSlide = (index) => {
    setActiveStoryIndex(index);
    const slide = slides[index];
    if (slide?.type === "place") setActivePlaceId(slide.placeId);
  };

  const selectPlaceByOffset = (offset) => {
    if (!filteredDestination.places.length) return;
    const nextIndex =
      (activePlaceIndex + offset + filteredDestination.places.length) %
      filteredDestination.places.length;
    handleSelectPlace(filteredDestination.places[nextIndex].id);
  };

  const exportMapToPdf = () => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    document.body.classList.add("print-story-map");
    window.requestAnimationFrame(() => {
      window.print();
      window.setTimeout(() => {
        document.body.classList.remove("print-story-map");
      }, 500);
    });
  };

  const handleSelectPlace = (placeId) => {
    setActivePlaceId(placeId);
    const idx = slides.findIndex((slide) => slide.placeId === placeId);
    if (idx >= 0) setActiveStoryIndex(idx);
  };

  const handleOpenPlaceDetails = (placeId) => {
    handleSelectPlace(placeId);
    setMapDetailsOpen(true);
  };

  const openDestinationDialog = () => {
    setPendingCountryId(selectedCountryId);
    setPendingDestinationId(selectedDestinationId);
    setDestinationDialogOpen(true);
  };

  const handlePendingCountryChange = (countryId) => {
    setPendingCountryId(countryId);
    const nextCountry =
      countries.find((country) => country.id === countryId) || countries[0];
    setPendingDestinationId(nextCountry.destinations[0]?.id || "");
  };

  const confirmDestinationChange = () => {
    onSelectCountry(pendingCountryId);
    onSelectDestination(pendingDestinationId);
    setDestinationDialogOpen(false);
  };

  if (!destination) {
    return (
      <section className="theme-story-shell">
        <div className="rounded-[2rem] border border-[#E6DED1] bg-white px-6 py-10 text-center text-[#4D463D] shadow-[0_16px_60px_rgba(34,31,25,0.05)]">
          Brak danych destynacji do wyswietlenia.
        </div>
      </section>
    );
  }

  return (
    <section className="theme-story-shell theme-story-v2 flex h-[calc(100dvh-2rem)] min-h-[720px] flex-col overflow-hidden rounded-[1.6rem] border border-[#DCECF0] bg-white p-4 shadow-[0_26px_90px_rgba(15,58,66,0.08)]">
      <div className="mb-4 flex shrink-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#E6FAFC] text-[#008EA1]">
            <MapPin className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-[#132334]">
              Mapa destynacji
            </h1>
            <p className="mt-1 text-sm text-[#647782]">
              Odkrywaj wyjatkowe miejsca
            </p>
          </div>
        </div>
      </div>

      {filteredDestination.places.length ? (
        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_430px] 2xl:grid-cols-[minmax(0,1fr)_470px]">
          <StoryMapCanvas
            destination={filteredDestination}
            activePlaceId={activePlace?.id || ""}
            selectedCategory={effectiveSelectedCategory}
            showTrailLayer={showTrailLayer}
            trailGeometries={trailGeometries}
            onSelectPlace={handleSelectPlace}
            onOpenDetails={handleOpenPlaceDetails}
            topOverlay={
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex flex-wrap items-end gap-3">
                  <label className="theme-story-floating-control min-w-[210px] rounded-xl border border-[#DCECF0] bg-white/95 px-3 py-2 shadow-[0_14px_34px_rgba(15,58,66,0.10)] backdrop-blur">
                    <span className="text-[11px] font-semibold text-[#647782]">Kraj</span>
                    <select
                      value={selectedCountryId}
                      onChange={(event) => {
                        const nextCountryId = event.target.value;
                        const nextCountry =
                          countries.find((country) => country.id === nextCountryId) ||
                          countries[0];
                        onSelectCountry(nextCountryId);
                        onSelectDestination(nextCountry.destinations[0]?.id || "");
                      }}
                      className="mt-1 w-full bg-transparent text-sm font-semibold text-[#132334] outline-none"
                    >
                      {countries.map((country) => (
                        <option key={country.id} value={country.id}>
                          {country.countryName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="theme-story-floating-control min-w-[230px] rounded-xl border border-[#DCECF0] bg-white/95 px-3 py-2 shadow-[0_14px_34px_rgba(15,58,66,0.10)] backdrop-blur">
                    <span className="text-[11px] font-semibold text-[#647782]">Destynacja</span>
                    <select
                      value={selectedDestinationId}
                      onChange={(event) => onSelectDestination(event.target.value)}
                      className="mt-1 w-full bg-transparent text-sm font-semibold text-[#132334] outline-none"
                    >
                      {(countries.find((country) => country.id === selectedCountryId)?.destinations || []).map(
                        (item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                  </div>
                  <div className="ml-auto flex flex-wrap items-end justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setFilterOpen(true)}
                    className="theme-story-toolbar-button inline-flex h-[54px] items-center gap-2 rounded-xl border border-[#DCECF0] bg-white/95 px-4 text-sm font-semibold text-[#132334] shadow-[0_14px_34px_rgba(15,58,66,0.10)] backdrop-blur transition hover:border-[#008EA1] hover:text-[#008EA1]"
                  >
                    <Filter className="h-4 w-4" />
                    Filtry
                  </button>
                  <button
                    type="button"
                    onClick={exportMapToPdf}
                    className="theme-story-toolbar-button inline-flex h-[54px] items-center gap-2 rounded-xl border border-[#DCECF0] bg-white/95 px-4 text-sm font-semibold text-[#132334] shadow-[0_14px_34px_rgba(15,58,66,0.10)] backdrop-blur transition hover:border-[#008EA1] hover:text-[#008EA1]"
                  >
                    <Download className="h-4 w-4" />
                    Eksportuj mape
                  </button>
                  <span className="inline-flex h-[54px] items-center rounded-xl border border-[#DCECF0] bg-[#F5FCFD]/95 px-4 text-sm font-semibold text-[#008EA1] shadow-[0_14px_34px_rgba(15,58,66,0.10)] backdrop-blur">
                    {filteredDestination.places.length} miejsc na mapie
                  </span>
                  </div>
                </div>
              </div>
            }
          />
          <PlaceDetailsPanel
            place={activePlace}
            galleryImages={galleryImages}
            activePlaceMedia={activePlaceMedia}
            placeVideos={placeVideos}
            galleryStart={galleryStart}
            setGalleryStart={setGalleryStart}
            setLightboxIndex={setLightboxIndex}
            setLightboxOpen={setLightboxOpen}
            currentIndex={activePlaceIndex}
            total={filteredDestination.places.length}
            onPrev={() => selectPlaceByOffset(-1)}
            onNext={() => selectPlaceByOffset(1)}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-[1.4rem] border border-[#DCECF0] bg-[#F5FCFD] px-6 py-12 text-center text-[#647782]">
          <div>
            <p className="text-lg font-semibold text-[#132334]">
              Brak miejscowek do wyswietlenia na mapie.
            </p>
            <p className="mt-2 text-sm leading-6">
              Sprawdz filtry albo uzupelnij wspolrzedne miejscowek w tej destynacji.
            </p>
          </div>
        </div>
      )}

      <StoryFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        availableCategories={availableCategories}
        selectedCategory={effectiveSelectedCategory}
        onSelectCategory={setSelectedCategory}
        places={planFilteredPlaces
          .map((place) => normalizePlaceCoordinates(enrichPlaceForDisplay(place)))
          .filter(Boolean)}
        activePlaceId={activePlace?.id || ""}
        onSelectPlace={handleSelectPlace}
        planOptions={planOptions}
        selectedPlanId={selectedPlanId}
        onSelectPlan={setSelectedPlanId}
        loadingPlans={loadingPlans}
      />

      {lightboxOpen && galleryImages.length > 0 &&
        createPortal(
          <div className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/80 p-6">
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute right-6 top-6 rounded-full border border-white/20 bg-white/10 p-2 text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              onClick={() =>
                setLightboxIndex(
                  (prev) => (prev - 1 + galleryImages.length) % galleryImages.length
                )
              }
              className="absolute left-6 rounded-full border border-white/20 bg-white/10 p-2 text-white"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <SmartImage
              urls={[galleryImages[lightboxIndex]]}
              alt={`${activePlace?.name || "Zdjecie"} full`}
              className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain"
            />
            <button
              onClick={() =>
                setLightboxIndex((prev) => (prev + 1) % galleryImages.length)
              }
              className="absolute right-6 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-2 text-white"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>,
          document.body
        )}
      {mapDetailsOpen && activePlace ? (
        <FullPlaceInfoModal
          place={activePlace}
          description={getPlaceDescription(activePlace)}
          coverUrls={getPlaceImageCandidates(activePlace, activePlaceMedia)}
          galleryImages={galleryImages}
          activePlaceMedia={activePlaceMedia}
          onClose={() => setMapDetailsOpen(false)}
        />
      ) : null}
      {destinationDialogOpen && (
        <DestinationChangeModal
          countries={countries}
          pendingCountryId={pendingCountryId}
          pendingDestinationId={pendingDestinationId}
          onChangeCountry={handlePendingCountryChange}
          onChangeDestination={setPendingDestinationId}
          onConfirm={confirmDestinationChange}
          onCancel={() => setDestinationDialogOpen(false)}
        />
      )}
    </section>
  );
}

