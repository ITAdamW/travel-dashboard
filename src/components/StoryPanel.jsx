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
  ExternalLink,
  Footprints,
  Landmark,
  MapPin,
  Mountain,
  Route,
  Ruler,
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
  const bgColor = isActive ? "#1F1D1A" : emphasized ? meta.color : "#FFFFFF";
  const borderColor = isActive ? meta.color : "#FFFFFF";
  const iconColor = emphasized ? "#FFFFFF" : meta.color;
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
  const [selectedCategory, setSelectedCategory] = useState("beach");
  const [showTrailLayer, setShowTrailLayer] = useState(false);
  const [trailGeometries, setTrailGeometries] = useState({});
  const [destinationDialogOpen, setDestinationDialogOpen] = useState(false);
  const [pendingCountryId, setPendingCountryId] = useState(selectedCountryId);
  const [pendingDestinationId, setPendingDestinationId] =
    useState(selectedDestinationId);

  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) || null;
  const visiblePlaceIds =
    selectedPlanId === "all-places" ? null : getPlanPlaceIds(selectedPlan);
  const filteredPlaces = useMemo(() => {
    if (!visiblePlaceIds) return safeDestination.places || [];
    return (safeDestination.places || []).filter((place) =>
      visiblePlaceIds.has(place.id)
    );
  }, [safeDestination.places, visiblePlaceIds]);
  const filteredDestination = useMemo(
    () => ({
      ...safeDestination,
      places: filteredPlaces.map((place) => enrichPlaceForDisplay(place)),
    }),
    [safeDestination, filteredPlaces]
  );
  const slides = useMemo(() => getStorySlides(filteredDestination), [filteredDestination]);
  const availableCategories = useMemo(
    () => countByCategory(filteredDestination.places || []).filter((item) => item.count > 0),
    [filteredDestination]
  );
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
    availableCategories[0]?.key ||
    "beach";

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
    if (
      nextPlace?.category &&
      !availableCategories.some((item) => item.key === selectedCategory)
    ) {
      setSelectedCategory(nextPlace.category);
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

  const syncToSlide = (index) => {
    setActiveStoryIndex(index);
    const slide = slides[index];
    if (slide?.type === "place") setActivePlaceId(slide.placeId);
  };

  const handleSelectPlace = (placeId) => {
    setActivePlaceId(placeId);
    const place = findPlaceById(filteredDestination, placeId);
    if (place?.category) setSelectedCategory(place.category);
    const idx = slides.findIndex((slide) => slide.placeId === placeId);
    if (idx >= 0) setActiveStoryIndex(idx);
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
    <section className="theme-story-shell">
      <DestinationMapSurface
        countries={countries}
        selectedCountryId={selectedCountryId}
        selectedDestinationId={selectedDestinationId}
        onOpenChangeDestination={openDestinationDialog}
        destination={filteredDestination}
        activePlaceId={activePlaceId}
        selectedCategory={effectiveSelectedCategory}
        showTrailLayer={showTrailLayer}
        trailGeometries={trailGeometries}
        onSelectPlace={handleSelectPlace}
        storyOverlay={
          <DestinationTabs
            destination={filteredDestination}
            activeIndex={activeStoryIndex}
            onPrev={() =>
              syncToSlide((activeStoryIndex - 1 + slides.length) % slides.length)
            }
            onNext={() => syncToSlide((activeStoryIndex + 1) % slides.length)}
            onGoTo={syncToSlide}
          />
        }
        detailsOverlay={
          <div className="space-y-3">
            <FloatingActivePlace
              destination={filteredDestination}
              activePlaceId={activePlaceId}
            />
            <FloatingPlanPicker
              planOptions={planOptions}
              selectedPlanId={selectedPlanId}
              onSelectPlan={setSelectedPlanId}
              loadingPlans={loadingPlans}
            />
            <FloatingCategoryPicker
              availableCategories={availableCategories}
              selectedCategory={effectiveSelectedCategory}
              onSelectCategory={setSelectedCategory}
            />
            <FloatingTrailLayerToggle
              trailCount={trailPlaces.length}
              showTrailLayer={showTrailLayer}
              onToggle={() => setShowTrailLayer((current) => !current)}
            />
            <FloatingCategoryPlaces
              destination={filteredDestination}
              activePlaceId={activePlaceId}
              selectedCategory={effectiveSelectedCategory}
              onSelectPlace={handleSelectPlace}
            />
          </div>
        }
      />
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

