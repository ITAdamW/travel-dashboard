import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
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
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coffee,
  CreditCard,
  ExternalLink,
  Landmark,
  MapPin,
  Mountain,
  Route,
  Star,
  Ticket,
  Waves,
  X,
} from "lucide-react";
import { fetchPlannerPlans } from "../lib/supabaseTravelData";

const fallbackImage =
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1400&q=80";

const categoryMeta = {
  beach: { label: "Plaze", icon: Waves, color: "#4A7A8C" },
  viewpoint: { label: "Punkty widokowe", icon: Mountain, color: "#6B7A52" },
  cafe: { label: "Kawiarnie / relax", icon: Coffee, color: "#9A6945" },
  museum: { label: "Muzea / architektura", icon: Landmark, color: "#7A6250" },
  city: { label: "Miasto / spacer", icon: Route, color: "#5D6274" },
};

function mapsUrl(place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.coordinates[0]},${place.coordinates[1]}`;
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
      image: place.image || fallbackImage,
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
        <p className="whitespace-pre-line break-words">{text}</p>
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
          <p className="max-h-[84px] overflow-hidden">{text}</p>
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
            {text}
          </div>,
          document.body
        )}
    </>
  );
}

function FloatingPlanPicker({
  planOptions,
  selectedPlanId,
  onSelectPlan,
  loadingPlans,
}) {
  return (
    <div className="rounded-[1.35rem] border border-[#EEE6DA] bg-[rgba(251,248,242,0.92)] p-4 shadow-[0_14px_30px_rgba(34,31,25,0.10)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">
            Widok miejsc
          </p>
          <p className="mt-2 text-sm text-[#4D463D]">
            Wszystkie miejscowki albo wybrany plan podrozy.
          </p>
        </div>
        <span className="rounded-full border border-[#E1D7C8] bg-white px-2.5 py-1 text-xs font-medium text-[#4D463D]">
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
      <div className="mt-3 flex flex-wrap gap-2">
        {availableCategories.map((item) => {
          const Icon = categoryMeta[item.key].icon;
          return (
            <button
              key={item.key}
              onClick={() => onSelectCategory(item.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${
                item.key === selectedCategory
                  ? "border-[#D8CCBB] bg-white text-[#1F1D1A]"
                  : "border-[#E1D7C8] bg-white text-[#4D463D]"
              }`}
            >
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: categoryMeta[item.key].color }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
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
      <div className="mt-3 flex flex-wrap gap-2">
        {selectedGroup.places.map((place) => (
          <button
            key={place.id}
            onClick={() => onSelectPlace(place.id)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              place.id === activePlaceId
                ? "border-[#D8CCBB] bg-white text-[#1F1D1A]"
                : "border-[#E1D7C8] bg-white text-[#4D463D]"
            }`}
          >
            {place.name}
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
  const visibleThumbs = galleryImages.slice(galleryStart, galleryStart + 4);

  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#8A7F6C]">
            Selected place story
          </p>
          <h3 className="mt-2 text-xl font-semibold text-[#1F1D1A]">
            {currentSlide.title}
          </h3>
          <p className="mt-2 text-sm font-medium text-[#6B7A52]">
            {currentSlide.subtitle}
          </p>
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

      <div className="mb-3">
        <select
          value={activeIndex}
          onChange={(e) => onGoTo(Number(e.target.value))}
          className="w-full rounded-xl border border-[#E5DCCF] bg-[#FBF8F2] px-3 py-2 text-sm text-[#4D463D]"
        >
          {slides.map((slide, index) => (
            <option key={slide.id} value={index}>
              {slide.title}
            </option>
          ))}
        </select>
      </div>

      <div className={expanded ? "flex-1 overflow-y-auto pr-1" : "flex-1 overflow-y-auto pr-1"}>
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
            <img
              src={currentSlide.image || fallbackImage}
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
        {metaBadges.length > 0 && (
          <div className={expanded ? "mt-3 grid gap-2" : "mt-3 flex flex-wrap gap-2"}>
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
        {galleryImages.length > 0 && (
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
                      <img
                        src={img}
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

  const currentSlide = slides[activeIndex];
  const activePlace = findPlaceById(destination, currentSlide.placeId);
  const metaBadges = getPlaceMetaBadges(activePlace);
  const galleryImages = activePlace?.gallery?.length
    ? activePlace.gallery
    : activePlace
      ? [activePlace.image || fallbackImage]
      : [];
  const placeVideos = activePlace?.videos?.length
    ? activePlace.videos
    : activePlace?.video
      ? [activePlace.video]
      : [];

  return (
    <>
      <div className="flex h-full min-h-[calc(100%-2rem)] flex-col rounded-[1.5rem] border border-[#E6DED1] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_18px_38px_rgba(34,31,25,0.12)] backdrop-blur">
        <StoryPanelBody
          slides={slides}
          activeIndex={activeIndex}
          currentSlide={currentSlide}
          galleryImages={galleryImages}
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
          <img
            src={galleryImages[lightboxIndex]}
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
                  currentSlide={currentSlide}
                  galleryImages={galleryImages}
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
                    {activeIndex + 1} / {slides.length}
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
      <div className="relative rounded-[1.6rem] border border-[#E8E0D3] bg-[radial-gradient(circle_at_top_left,rgba(107,122,82,0.08),transparent_35%),linear-gradient(180deg,#F3EEE5_0%,#ECE5D8_100%)] min-h-[860px]">
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

        <div className="pointer-events-none absolute right-4 top-4 z-[700] hidden w-[310px] xl:block">
          <div className="pointer-events-auto">{detailsOverlay}</div>
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
            <FitBounds points={destination.places} />
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
      places: filteredPlaces,
    }),
    [safeDestination, filteredPlaces]
  );
  const slides = useMemo(() => getStorySlides(filteredDestination), [filteredDestination]);
  const availableCategories = useMemo(
    () => countByCategory(filteredDestination.places || []).filter((item) => item.count > 0),
    [filteredDestination]
  );
  const planOptions = useMemo(
    () => [
      { id: "all-places", label: "Wszystkie miejscowki" },
      ...plans.map((plan) => ({
        id: plan.id,
        label: `${plan.name} · ${normalizePlanItinerary(plan.itinerary).length} dni`,
      })),
    ],
    [plans]
  );
  const effectiveSelectedCategory =
    availableCategories.find((item) => item.key === selectedCategory)?.key ||
    availableCategories[0]?.key ||
    "beach";

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
            <FloatingPlanPicker
              planOptions={planOptions}
              selectedPlanId={selectedPlanId}
              onSelectPlan={setSelectedPlanId}
              loadingPlans={loadingPlans}
            />
            <FloatingActivePlace
              destination={filteredDestination}
              activePlaceId={activePlaceId}
            />
            <FloatingCategoryPicker
              availableCategories={availableCategories}
              selectedCategory={effectiveSelectedCategory}
              onSelectCategory={setSelectedCategory}
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
