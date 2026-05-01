import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { divIcon } from "leaflet";
import {
  ArrowDown,
  ArrowUp,
  Coffee,
  Eye,
  ExternalLink,
  FileDown,
  Landmark,
  MapPin,
  Mountain,
  PencilLine,
  Plus,
  Route,
  Save,
  Share2,
  Trash2,
  Waves,
  X,
} from "lucide-react";
import {
  deletePlannerPlan,
  fetchPlannerPlans,
  upsertPlannerPlan,
} from "../lib/supabaseTravelData";
import RichText from "./RichText";

const categoryMeta = {
  "forest-park": { label: "Las, wawoz, park", icon: MapPin },
  trail: { label: "Szlak", icon: Route },
  cliff: { label: "Klif", icon: Mountain },
  "forest-trail": { label: "Las, wawoz, park / Szlak", icon: Route },
  waterfall: { label: "Wodospad", icon: Waves },
  viewpoint: { label: "Punkt widokowy", icon: Mountain },
  "viewpoint-trail": { label: "Punkt widokowy / Szlak", icon: Route },
  mountains: { label: "Gory", icon: Mountain },
  water: { label: "Woda, jezioro, morze", icon: Waves },
  beach: { label: "Plaza", icon: Waves },
  cave: { label: "Jaskinia", icon: Landmark },
  city: { label: "Miasto", icon: Route },
  "city-water": { label: "Miasto / Woda", icon: Waves },
  heritage: { label: "Zabytki", icon: Landmark },
  "food-drink": { label: "Bar, restauracja", icon: Coffee },

  // Legacy aliases kept for older records before category sync.
  cafe: { label: "Bar, restauracja", icon: Coffee },
  museum: { label: "Zabytki", icon: Landmark },
};

const plannerDayPalette = [
  "#6B7A52",
  "#A25F4B",
  "#4A7A8C",
  "#8D6A9F",
  "#C58A3D",
  "#5D6274",
  "#9A6945",
];

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function findPlaceById(destination, id) {
  return destination?.places.find((place) => place.id === id) || null;
}

function createEmptyDay(index) {
  return {
    day: `Day ${index + 1}`,
    date: "",
    items: [],
  };
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
    return [createEmptyDay(0)];
  }

  return itinerary.map((day, index) => ({
    day: day?.day || `Day ${index + 1}`,
    date: day?.date || "",
    items: Array.isArray(day?.items)
      ? day.items.map(normalizeItem).filter((item) => item.placeId)
      : [],
  }));
}

function formatPlannerDate(value) {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function createEmptyPlan(destinationId, index = 0) {
  return {
    id: `plan-${destinationId}-${Date.now()}-${index}`,
    destinationId,
    name: `Plan ${index + 1}`,
    daysCount: 1,
    notes: "",
    itinerary: [createEmptyDay(0)],
  };
}

function getPlanCover(plan, destination) {
  const firstPlannedPlaceId = normalizeItinerary(plan?.itinerary || [])
    .flatMap((day) => day.items.map((item) => normalizeItem(item).placeId))
    .find(Boolean);

  return (
    findPlaceById(destination, firstPlannedPlaceId)?.image ||
    destination?.places?.find((place) => place.image)?.image ||
    destination?.places?.find((place) => place.gallery?.length)?.gallery?.[0] ||
    ""
  );
}

function mapsUrl(place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.coordinates[0]},${place.coordinates[1]}`;
}

function FitPlannerRouteBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(points, { padding: [40, 40], maxZoom: 12 });
  }, [map, points]);

  return null;
}

function createPlannerStopIcon(color, label, isActive) {
  return divIcon({
    className: "planner-route-stop-marker",
    html: `<div style="width:${isActive ? 32 : 28}px;height:${isActive ? 32 : 28}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:${color};border:3px solid #ffffff;box-shadow:0 10px 22px rgba(34,31,25,0.18);color:#ffffff;font-size:${isActive ? 13 : 12}px;font-weight:700;">${label}</div>`,
    iconSize: [isActive ? 32 : 28, isActive ? 32 : 28],
    iconAnchor: [isActive ? 16 : 14, isActive ? 16 : 14],
    popupAnchor: [0, -(isActive ? 15 : 13)],
  });
}

function PlannerEditRouteMap({ destination, plan }) {
  const [activeStopKey, setActiveStopKey] = useState("");
  const [routeGeometries, setRouteGeometries] = useState({});

  const planDays = useMemo(() => {
    if (!destination || !plan) return [];

    return normalizeItinerary(plan.itinerary).map((day, dayIndex) => ({
      ...day,
      color: plannerDayPalette[dayIndex % plannerDayPalette.length],
      places: day.items
        .map((item, itemIndex) => {
          const place = findPlaceById(destination, item.placeId);
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
  }, [destination, plan]);

  const routePoints = useMemo(
    () => planDays.flatMap((day) => day.places.map((entry) => entry.place.coordinates)),
    [planDays]
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
            const coordinates = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
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
    setActiveStopKey(planDays[0]?.places[0]?.key || "");
  }, [planDays]);

  const activeStop =
    planDays.flatMap((day) => day.places).find((entry) => entry.key === activeStopKey) ||
    planDays[0]?.places[0] ||
    null;

  if (!routePoints.length) {
    return (
      <div className="mb-4 rounded-[1.3rem] border border-dashed border-[#DDD2C3] bg-white px-5 py-8 text-center text-sm text-[#7C7263]">
        Dodaj atrakcje do dni planu, aby zobaczyc trase na mapie.
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-[1.4rem] border border-[#E8DFD2] bg-white p-3 shadow-[0_8px_22px_rgba(34,31,25,0.04)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#8A7F6C]">Live route map</p>
          <p className="mt-2 text-lg font-semibold text-[#1F1D1A]">Trasa aktualizuje sie na biezaco</p>
        </div>
        <span className="rounded-full border border-[#E1D7C8] bg-[#FBF8F2] px-3 py-1 text-xs text-[#6B6255]">
          {planDays.length} dni
        </span>
      </div>

      <div className="relative h-[360px] overflow-hidden rounded-[1.25rem] border border-[#E8E0D3] bg-[radial-gradient(circle_at_top_left,rgba(107,122,82,0.08),transparent_35%),linear-gradient(180deg,#F3EEE5_0%,#ECE5D8_100%)]">
        <div className="absolute inset-0 z-0 [filter:saturate(0.35)_sepia(0.15)_contrast(0.95)]">
          <MapContainer
            center={routePoints[0]}
            zoom={11}
            zoomControl={true}
            attributionControl={false}
            className="h-[360px] w-full"
            scrollWheelZoom={true}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitPlannerRouteBounds points={routePoints} />

            {planDays.map((day) => (
              <Polyline
                key={`planner-route-${day.day}`}
                positions={routeGeometries[day.day] || day.places.map((entry) => entry.place.coordinates)}
                pathOptions={{ color: day.color, weight: 5, opacity: 0.85 }}
              />
            ))}

            {planDays.flatMap((day) =>
              day.places.map((entry, index) => {
                const isActive = activeStopKey === entry.key;
                return (
                  <Marker
                    key={entry.key}
                    position={entry.place.coordinates}
                    icon={createPlannerStopIcon(day.color, String(index + 1), isActive)}
                    eventHandlers={{ click: () => setActiveStopKey(entry.key) }}
                  >
                    <Popup>
                      <div className="min-w-[190px]">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">
                          {day.day} · stop {index + 1}
                        </p>
                        <p className="mt-2 font-semibold text-[#1F1D1A]">{entry.place.name}</p>
                        <RichText
                          text={entry.place.note || entry.place.subtitle || entry.place.info}
                          className="mt-2 space-y-1 text-sm text-[#5B544A]"
                          paragraphClassName="leading-6 text-[#5B544A]"
                          listClassName="text-[#5B544A]"
                        />
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

        <div className="pointer-events-none absolute bottom-3 left-3 z-[650] w-[250px] max-w-[calc(100%-1.5rem)]">
          <div className="pointer-events-auto rounded-[1rem] border border-[#E6DED1] bg-[rgba(255,255,255,0.9)] p-2.5 shadow-[0_12px_28px_rgba(34,31,25,0.10)] backdrop-blur">
            <p className="text-[9px] uppercase tracking-[0.22em] text-[#8A7F6C]">Day colors</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {planDays.map((day, index) => (
                <span
                  key={`planner-legend-${day.day}`}
                  className="inline-flex items-center gap-2 rounded-full border border-[#E1D7C8] bg-white px-2.5 py-1 text-[11px] text-[#4D463D]"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: day.color }} />
                  {day.day || `Day ${index + 1}`}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#4D463D]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B9AE9A]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PlannerPlaceCard({ place, draggable = false, onDragStart, onRemove, compact = false }) {
  const Icon = categoryMeta[place.category]?.icon || MapPin;

  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      className={cn(
        "theme-planner-card flex items-center justify-between gap-3 rounded-2xl border border-[#E8DFD2] bg-white shadow-[0_4px_14px_rgba(34,31,25,0.025)]",
        compact ? "p-3" : "px-4 py-3",
        draggable && "cursor-grab active:cursor-grabbing"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {place.image ? (
          <img
            src={place.image}
            alt={place.name}
            className="h-14 w-14 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EDE7DB] text-[#6B7A52]">
            <Icon className="h-4 w-4" />
          </span>
        )}

        <div className="min-w-0">
          <p className="truncate font-medium text-[#1F1D1A]">{place.name}</p>
          <p className="truncate text-sm text-[#7A7164]">
            {categoryMeta[place.category]?.label || place.category}
          </p>
          {!compact && (
            <RichText
              text={place.note}
              className="mt-1 space-y-1 text-sm text-[#5B544A]"
              paragraphClassName="leading-6 text-[#5B544A]"
              listClassName="text-[#5B544A]"
            />
          )}
        </div>
      </div>

      {onRemove && (
        <button
          onClick={onRemove}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#E3D9CA] bg-[#FBF8F2] px-3 py-2 text-xs text-[#5E564B] transition hover:bg-[#F2ECE2]"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Usun
        </button>
      )}
    </div>
  );
}

function PlannerDayItem({
  place,
  item,
  onRemove,
  onNoteChange,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDragLeaveCard,
  onDropOnCard,
  isDragging = false,
}) {
  const Icon = categoryMeta[place.category]?.icon || MapPin;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOverCard}
      onDragLeave={onDragLeaveCard}
      onDrop={onDropOnCard}
      className={cn(
        "theme-planner-card rounded-[1.1rem] border border-[#E8DFD2] bg-white p-3 transition",
        isDragging && "scale-[0.985] opacity-60 shadow-[0_12px_28px_rgba(34,31,25,0.08)]"
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row">
        {place.image ? (
          <img
            src={place.image}
            alt={place.name}
            className="h-[76px] w-[76px] shrink-0 rounded-[1rem] object-cover"
          />
        ) : (
          <span className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[1rem] bg-[#EDE7DB] text-[#6B7A52]">
            <Icon className="h-5 w-5" />
          </span>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-[#1F1D1A]">{place.name}</p>
              <p className="mt-1 text-sm text-[#7A7164]">
                {categoryMeta[place.category]?.label || place.category}
              </p>
              {place.note ? (
                <RichText
                  text={place.note}
                  className="mt-2 space-y-1 text-sm text-[#5B544A]"
                  paragraphClassName="leading-6 text-[#5B544A]"
                  listClassName="text-[#5B544A]"
                />
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-[#E3D9CA] bg-[#FBF8F2] px-3 py-2 text-xs text-[#5E564B]">
              Przeciagnij, aby zmienic kolejnosc
            </span>
            <button
              onClick={onRemove}
              className="theme-planner-button inline-flex items-center gap-2 rounded-full border border-[#E3D9CA] bg-[#FBF8F2] px-3 py-2 text-xs text-[#5E564B] transition hover:bg-[#F2ECE2]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Usun
            </button>
          </div>
        </div>

        <label className="block md:w-[320px] md:min-w-[320px]">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">
            Notatka do punktu
          </span>
          <textarea
            rows={4}
            value={item.note || ""}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Np. rezerwacja na 10:00, zachod slonca, parking po lewej stronie..."
            className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-3 py-2.5 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B9AE9A]"
          />
        </label>
      </div>
    </div>
  );
}

function PlannerPreviewItem({ place, note }) {
  return (
    <div className="theme-planner-card rounded-[1.25rem] border border-[#E8DFD2] bg-[#FBF8F2] p-3">
      <div className="flex flex-col gap-3 md:flex-row">
        {place.image ? (
          <img
            src={place.image}
            alt={place.name}
            className="h-[84px] w-[84px] shrink-0 rounded-[1rem] object-cover"
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-[#1F1D1A]">{place.name}</p>
          <p className="mt-1 text-sm text-[#6B6255]">
            {categoryMeta[place.category]?.label || place.category}
          </p>
          {place.note ? (
            <RichText
              text={place.note}
              className="mt-2 space-y-1 text-sm text-[#5B544A]"
              paragraphClassName="leading-6 text-[#5B544A]"
              listClassName="text-[#5B544A]"
            />
          ) : null}
        </div>
        {note ? (
          <div className="rounded-[1rem] border border-[#E5DCCF] bg-white px-3 py-3 text-sm text-[#4F493F] md:w-[280px] md:min-w-[280px]">
            <RichText
              text={note}
              paragraphClassName="leading-6 text-[#4F493F]"
              listClassName="text-[#4F493F]"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DayColumn({
  dayIndex,
  day,
  destination,
  onDropPlace,
  onMovePlannedItem,
  onRemovePlace,
  onDeleteDay,
  onRenameDay,
  onDateChange,
  onMoveDayUp,
  onMoveDayDown,
  onItemNoteChange,
  isFirstDay,
  isLastDay,
}) {
  const [dropIndex, setDropIndex] = useState(null);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const places = day.items
    .map((item, index) => {
      const normalized = normalizeItem(item);
      const place = findPlaceById(destination, normalized.placeId);
      return place ? { place, item: normalized, index } : null;
    })
    .filter(Boolean);

  const readDraggedPlannerItem = (event) => {
    const payload = event.dataTransfer.getData("application/planner-item");
    if (!payload) return null;

    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  };

  const handleDropAtIndex = (event, insertIndex) => {
    event.preventDefault();
    event.stopPropagation();

    const draggedPlannerItem = readDraggedPlannerItem(event);
    if (draggedPlannerItem) {
      onMovePlannedItem(
        draggedPlannerItem.dayIndex,
        draggedPlannerItem.itemIndex,
        dayIndex,
        insertIndex
      );
      setDropIndex(null);
      setDraggingIndex(null);
      return;
    }

    const placeId = event.dataTransfer.getData("text/place-id");
    if (placeId) {
      onDropPlace(placeId, insertIndex);
    }

    setDropIndex(null);
  };

  const renderDropSlot = (slotIndex) => {
    const isActive = dropIndex === slotIndex;

    return (
      <div
        key={`drop-slot-${slotIndex}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDropIndex(slotIndex);
        }}
        onDragLeave={() => {
          if (dropIndex === slotIndex) {
            setDropIndex(null);
          }
        }}
        onDrop={(event) => handleDropAtIndex(event, slotIndex)}
        className={cn(
          "rounded-[1rem] border border-dashed border-transparent transition-all duration-150",
          isActive
            ? "my-2 min-h-[68px] border-[#BFAE97] bg-[#F6EFE5]"
            : "my-0 min-h-[8px] bg-transparent"
        )}
      />
    );
  };

  const handleCardDragOver = (event, index) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const targetIndex = offsetY < rect.height / 2 ? index : index + 1;
    setDropIndex(targetIndex);
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        handleDropAtIndex(e, places.length);
      }}
      className="theme-planner-card rounded-[1.4rem] border border-[#E8DFD2] bg-white p-4"
    >
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#8A7F6C]">Day</p>
          <div className="mt-1 grid gap-2 md:grid-cols-[minmax(0,1fr)_190px]">
            <input
              value={day.day}
              onChange={(e) => onRenameDay(e.target.value)}
              className="w-full rounded-xl border border-[#E5DCCF] bg-[#FBF8F2] px-3 py-2 text-base font-medium text-[#1F1D1A] outline-none"
            />
            <input
              type="date"
              value={day.date || ""}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full rounded-xl border border-[#E5DCCF] bg-[#FBF8F2] px-3 py-2 text-sm text-[#1F1D1A] outline-none"
              aria-label={`Data dla ${day.day || `Day ${dayIndex + 1}`}`}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onMoveDayUp}
            disabled={isFirstDay}
            className="theme-planner-button inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E3D9CA] bg-[#FBF8F2] text-[#5E564B] transition hover:bg-[#F2ECE2] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Przesun dzien w gore"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            onClick={onMoveDayDown}
            disabled={isLastDay}
            className="theme-planner-button inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E3D9CA] bg-[#FBF8F2] text-[#5E564B] transition hover:bg-[#F2ECE2] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Przesun dzien w dol"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            onClick={onDeleteDay}
            className="theme-planner-button inline-flex items-center gap-2 rounded-full border border-[#E3D9CA] bg-[#FBF8F2] px-3 py-2 text-xs text-[#5E564B] transition hover:bg-[#F2ECE2]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Usun dzien
          </button>
        </div>
      </div>

      <div className="theme-planner-empty min-h-[140px] space-y-3 rounded-[1.1rem] border border-dashed border-[#DED4C7] bg-[#FBF8F2] p-3">
        {places.length ? (
          places.flatMap(({ place, item, index }) => [
            renderDropSlot(index),
            <PlannerDayItem
              key={`${day.day}-${place.id}-${index}`}
              place={place}
              item={item}
              onRemove={() => onRemovePlace(place.id)}
              onNoteChange={(value) => onItemNoteChange(index, value)}
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  "application/planner-item",
                  JSON.stringify({ dayIndex, itemIndex: index })
                );
                event.dataTransfer.effectAllowed = "move";
                setDraggingIndex(index);
              }}
              onDragEnd={() => {
                setDraggingIndex(null);
                setDropIndex(null);
              }}
              onDragOverCard={(event) => handleCardDragOver(event, index)}
              onDragLeaveCard={() => {}}
              onDropOnCard={(event) => handleDropAtIndex(event, dropIndex ?? index)}
              isDragging={draggingIndex === index}
            />,
          ]).concat(renderDropSlot(places.length))
        ) : (
          <div className="theme-planner-empty flex min-h-[110px] items-center justify-center rounded-[1rem] border border-dashed border-[#E5DCCF] bg-white/70 px-4 text-center text-sm text-[#7C7263]">
            Przeciagnij tutaj miejscowki z listy po lewej.
          </div>
        )}
      </div>
    </div>
  );
}

function PlannerPreview({ destination, plan }) {
  return (
    <div className="space-y-4">
      {normalizeItinerary(plan.itinerary).map((section, index) => (
        <div
          key={`preview-day-${index}`}
          className="theme-planner-card overflow-hidden rounded-[1.5rem] border border-[#E8DFD2] bg-white"
        >
          <div className="theme-planner-dayhead border-b border-[#EEE6DA] bg-[#FBF8F2] px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#8A7F6C]">Day</p>
            <h4 className="mt-1 text-xl font-semibold text-[#1F1D1A]">{section.day}</h4>
            {section.date ? (
              <p className="mt-2 text-sm normal-case tracking-normal text-[#6B6255]">
                {formatPlannerDate(section.date)}
              </p>
            ) : null}
          </div>

          <div className="space-y-3 p-4">
            {section.items.map((item, itemIndex) => {
              const normalized = normalizeItem(item);
              const place = findPlaceById(destination, normalized.placeId);
              if (!place) return null;

              return (
                <PlannerPreviewItem
                  key={`preview-item-${index}-${itemIndex}-${place.id}`}
                  place={place}
                  note={normalized.note}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function exportPlanToPdf(destination, country, plan) {
  const printable = window.open("", "_blank", "width=1200,height=900");
  if (!printable) return;

  const daysMarkup = normalizeItinerary(plan.itinerary)
    .map((section) => {
      const cards = section.items
        .map((item) => {
          const normalized = normalizeItem(item);
          const place = findPlaceById(destination, normalized.placeId);
          if (!place) return null;

          return `
            <article class="card">
              ${place.image ? `<img src="${place.image}" alt="${place.name}" />` : ""}
              <div class="body">
                <h3>${place.name}</h3>
                <p class="meta">${categoryMeta[place.category]?.label || place.category}</p>
                ${place.note ? `<p class="place-note">${place.note}</p>` : ""}
              </div>
              ${normalized.note ? `<div class="plan-note">${normalized.note}</div>` : ""}
            </article>
          `;
        })
        .filter(Boolean)
        .join("");

      return `
        <section class="day">
          <div class="day-head">
            <p>DAY</p>
            <h2>${section.day}</h2>
            ${section.date ? `<div class="date">${formatPlannerDate(section.date)}</div>` : ""}
          </div>
          <div class="list">${cards}</div>
        </section>
      `;
    })
    .join("");

  printable.document.write(`
    <html>
      <head>
        <title>${plan.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #1f1d1a; background: #f7f3ec; }
          .hero { margin-bottom: 32px; }
          .eyebrow { font-size: 11px; letter-spacing: 0.32em; text-transform: uppercase; color: #8a7f6c; }
          h1 { margin: 12px 0 8px; font-size: 34px; }
          .sub { color: #5e564b; font-size: 15px; }
          .day { margin-bottom: 24px; border: 1px solid #e6ded1; border-radius: 24px; overflow: hidden; background: white; }
          .day-head { padding: 18px 20px; background: #fbf8f2; border-bottom: 1px solid #eee6da; }
          .day-head p { margin: 0; font-size: 10px; letter-spacing: 0.24em; color: #8a7f6c; text-transform: uppercase; }
          .day-head h2 { margin: 8px 0 0; font-size: 24px; }
          .day-head .date { margin-top: 10px; color: #5e564b; font-size: 14px; }
          .list { display: flex; flex-direction: column; gap: 14px; padding: 16px; }
          .card { display: flex; gap: 16px; border: 1px solid #e8dfd2; border-radius: 18px; overflow: hidden; background: #fbf8f2; padding: 12px; align-items: flex-start; }
          .card img { width: 124px; height: 124px; object-fit: cover; display: block; border-radius: 14px; flex-shrink: 0; }
          .body { flex: 1; }
          .body h3 { margin: 0 0 8px; font-size: 20px; }
          .meta { color: #6b6255; font-size: 13px; margin: 0 0 10px; }
          .place-note { margin: 0; line-height: 1.6; color: #5b544a; }
          .plan-note { width: 260px; min-width: 260px; line-height: 1.6; padding: 10px 12px; border: 1px solid #e5dccf; border-radius: 12px; background: white; }
          @media print { body { margin: 16px; background: white; } }
        </style>
      </head>
      <body>
        <header class="hero">
          <p class="eyebrow">Travel Planner</p>
          <h1>${plan.name}</h1>
          <p class="sub">${country.countryName} · ${destination.name} · ${plan.daysCount} dni</p>
        </header>
        ${daysMarkup}
      </body>
    </html>
  `);
  printable.document.close();
  printable.focus();
  printable.print();
}

export default function PlannerPanel({
  countries,
  initialCountryId,
  initialDestinationId,
  initialPlanId,
  onOpenRoute,
}) {
  const [selectedCountryId, setSelectedCountryId] = useState(initialCountryId || countries[0]?.id || "");
  const [selectedDestinationId, setSelectedDestinationId] = useState(
    initialDestinationId || countries[0]?.destinations[0]?.id || ""
  );
  const [viewMode, setViewMode] = useState("preview");
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [draftPlan, setDraftPlan] = useState(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [planPreviewOpen, setPlanPreviewOpen] = useState(false);
  const [placeSearchTerm, setPlaceSearchTerm] = useState("");
  const canUsePortal = typeof document !== "undefined";
  const previousInitialCountryIdRef = useRef(initialCountryId);
  const previousInitialDestinationIdRef = useRef(initialDestinationId);
  const previousSelectedPlanKeyRef = useRef("");

  const selectedCountry = useMemo(
    () => countries.find((country) => country.id === selectedCountryId) || countries[0],
    [countries, selectedCountryId]
  );

  const selectedDestination =
    selectedCountry?.destinations.find((destination) => destination.id === selectedDestinationId) ||
    selectedCountry?.destinations[0];

  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) || plans[0] || null;

  useEffect(() => {
    const initialCountryChanged = previousInitialCountryIdRef.current !== initialCountryId;
    previousInitialCountryIdRef.current = initialCountryId;

    setSelectedCountryId((current) => {
      if (initialCountryChanged) {
        return initialCountryId || countries[0]?.id || "";
      }
      if (current && countries.some((country) => country.id === current)) {
        return current;
      }
      return initialCountryId || countries[0]?.id || "";
    });
  }, [initialCountryId, countries]);

  useEffect(() => {
    if (!selectedCountry) return;
    if (!selectedCountry.destinations.some((destination) => destination.id === selectedDestinationId)) {
      setSelectedDestinationId(selectedCountry.destinations[0]?.id || "");
    }
  }, [selectedCountry, selectedDestinationId]);

  useEffect(() => {
    const initialDestinationChanged =
      previousInitialDestinationIdRef.current !== initialDestinationId;
    previousInitialDestinationIdRef.current = initialDestinationId;

    setSelectedDestinationId((current) => {
      if (initialDestinationChanged) {
        return initialDestinationId || selectedCountry?.destinations[0]?.id || "";
      }
      if (
        current &&
        selectedCountry?.destinations.some((destination) => destination.id === current)
      ) {
        return current;
      }
      return initialDestinationId || selectedCountry?.destinations[0]?.id || "";
    });
  }, [initialDestinationId, selectedCountry?.id]);

  const loadPlans = async (destinationId) => {
    if (!destinationId) return [];
    setLoadingPlans(true);
    try {
      const nextPlans = await fetchPlannerPlans(destinationId);
      const normalizedPlans = nextPlans.map((plan) => {
        const itinerary = normalizeItinerary(plan.itinerary);
        return {
          ...plan,
          itinerary,
          daysCount: itinerary.length,
        };
      });
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
      return normalizedPlans;
    } catch (error) {
      setStatus(error.message || "Nie udalo sie pobrac planow.");
      setPlans([]);
      setSelectedPlanId("");
      return [];
    } finally {
      setLoadingPlans(false);
    }
  };

  useEffect(() => {
    if (!selectedDestination?.id) return;
    loadPlans(selectedDestination.id);
    setStatus("");
  }, [selectedDestination?.id, initialPlanId]);

  useEffect(() => {
    if (!initialPlanId) return;
    if (plans.some((plan) => plan.id === initialPlanId)) {
      setSelectedPlanId(initialPlanId);
    }
  }, [initialPlanId, plans]);

  useEffect(() => {
    if (viewMode !== "preview") {
      setPlanPreviewOpen(false);
    }
  }, [viewMode, selectedDestinationId]);

  useEffect(() => {
    const selectedPlanKey = `${selectedDestination?.id || ""}:${selectedPlanId || selectedPlan?.id || ""}`;
    if (previousSelectedPlanKeyRef.current === selectedPlanKey) {
      return;
    }
    previousSelectedPlanKeyRef.current = selectedPlanKey;

    if (!selectedPlan) {
      setDraftPlan(selectedDestination ? createEmptyPlan(selectedDestination.id) : null);
      return;
    }

    const itinerary = normalizeItinerary(selectedPlan.itinerary);
    setDraftPlan({
      ...JSON.parse(JSON.stringify(selectedPlan)),
      itinerary,
      daysCount: itinerary.length,
    });
  }, [selectedPlanId, selectedPlan?.id, selectedDestination?.id]);

  const plannedPlaceIds = new Set(
    normalizeItinerary(draftPlan?.itinerary || []).flatMap((section) =>
      section.items.map((item) => normalizeItem(item).placeId)
    )
  );

  const availablePlaces = (selectedDestination?.places || []).filter(
    (place) => !plannedPlaceIds.has(place.id)
  );
  const normalizedPlaceSearch = placeSearchTerm.trim().toLowerCase();
  const filteredAvailablePlaces = availablePlaces.filter((place) => {
    if (!normalizedPlaceSearch) return true;

    const haystack = [
      place.name,
      place.note,
      place.subtitle,
      place.info,
      categoryMeta[place.category]?.label,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedPlaceSearch);
  });

  const createPlan = () => {
    if (!selectedDestination) return;
    const nextPlan = createEmptyPlan(selectedDestination.id, plans.length);
    setPlans((prev) => [...prev, nextPlan]);
    setSelectedPlanId(nextPlan.id);
    setDraftPlan(nextPlan);
    setViewMode("edit");
  };

  const updateDraft = (updater) => {
    setDraftPlan((prev) => (prev ? updater(prev) : prev));
  };

  const addDay = () => {
    updateDraft((prev) => {
      const current = normalizeItinerary(prev.itinerary);
      const nextItinerary = [...current, createEmptyDay(current.length)];
      return { ...prev, daysCount: nextItinerary.length, itinerary: nextItinerary };
    });
  };

  const dropPlaceToDay = (dayIndex, placeId, insertIndex = null) => {
    updateDraft((prev) => {
      const current = normalizeItinerary(prev.itinerary);
      const nextItinerary = current.map((section, index) => {
        const filteredItems = section.items
          .map(normalizeItem)
          .filter((item) => item.placeId !== placeId);

        if (index !== dayIndex) {
          return { ...section, items: filteredItems };
        }

        const nextItems = [...filteredItems];
        const safeInsertIndex =
          insertIndex == null
            ? nextItems.length
            : Math.max(0, Math.min(insertIndex, nextItems.length));
        nextItems.splice(safeInsertIndex, 0, { placeId, note: "" });

        return {
          ...section,
          items: nextItems,
        };
      });

      return { ...prev, itinerary: nextItinerary, daysCount: nextItinerary.length };
    });
  };

  const movePlannedItem = (fromDayIndex, fromItemIndex, toDayIndex, insertIndex) => {
    updateDraft((prev) => {
      const current = normalizeItinerary(prev.itinerary);
      const sourceDay = current[fromDayIndex];
      const movedItem = sourceDay?.items?.[fromItemIndex]
        ? normalizeItem(sourceDay.items[fromItemIndex])
        : null;

      if (!movedItem) return prev;

      const nextItinerary = current.map((section, index) => ({
        ...section,
        items:
          index === fromDayIndex
            ? section.items
                .map(normalizeItem)
                .filter((_, itemIndex) => itemIndex !== fromItemIndex)
            : section.items.map(normalizeItem),
      }));

      const targetItems = [...nextItinerary[toDayIndex].items];
      const adjustedInsertIndex =
        fromDayIndex === toDayIndex && insertIndex > fromItemIndex
          ? insertIndex - 1
          : insertIndex;
      const safeInsertIndex = Math.max(
        0,
        Math.min(adjustedInsertIndex, targetItems.length)
      );
      targetItems.splice(safeInsertIndex, 0, movedItem);
      nextItinerary[toDayIndex] = {
        ...nextItinerary[toDayIndex],
        items: targetItems,
      };

      return { ...prev, itinerary: nextItinerary, daysCount: nextItinerary.length };
    });
  };

  const removePlaceFromDay = (dayIndex, placeId) => {
    updateDraft((prev) => {
      const nextItinerary = normalizeItinerary(prev.itinerary).map((section, index) =>
        index === dayIndex
          ? {
              ...section,
              items: section.items.filter((item) => normalizeItem(item).placeId !== placeId),
            }
          : section
      );

      return { ...prev, itinerary: nextItinerary, daysCount: nextItinerary.length };
    });
  };

  const deleteDay = (dayIndex) => {
    updateDraft((prev) => {
      const nextItinerary = normalizeItinerary(prev.itinerary).filter((_, index) => index !== dayIndex);
      const ensured = nextItinerary.length ? nextItinerary : [createEmptyDay(0)];
      return { ...prev, daysCount: ensured.length, itinerary: ensured };
    });
  };

  const renameDay = (dayIndex, value) => {
    updateDraft((prev) => ({
      ...prev,
      itinerary: normalizeItinerary(prev.itinerary).map((section, index) =>
        index === dayIndex ? { ...section, day: value } : section
      ),
    }));
  };

  const updateDayDate = (dayIndex, value) => {
    updateDraft((prev) => ({
      ...prev,
      itinerary: normalizeItinerary(prev.itinerary).map((section, index) =>
        index === dayIndex ? { ...section, date: value } : section
      ),
    }));
  };

  const moveDay = (dayIndex, direction) => {
    updateDraft((prev) => {
      const nextItinerary = [...normalizeItinerary(prev.itinerary)];
      const swapIndex = dayIndex + direction;
      if (swapIndex < 0 || swapIndex >= nextItinerary.length) return prev;

      [nextItinerary[dayIndex], nextItinerary[swapIndex]] = [
        nextItinerary[swapIndex],
        nextItinerary[dayIndex],
      ];

      return { ...prev, itinerary: nextItinerary, daysCount: nextItinerary.length };
    });
  };

  const updateItemNote = (dayIndex, itemIndex, value) => {
    updateDraft((prev) => {
      const nextItinerary = normalizeItinerary(prev.itinerary).map((section, index) => {
        if (index !== dayIndex) return section;

        return {
          ...section,
          items: section.items.map((item, currentIndex) =>
            currentIndex === itemIndex ? { ...normalizeItem(item), note: value } : normalizeItem(item)
          ),
        };
      });

      return { ...prev, itinerary: nextItinerary, daysCount: nextItinerary.length };
    });
  };

  const savePlan = async () => {
    if (!selectedDestination || !draftPlan) return;
    setSaving(true);
    setStatus("");

    try {
      const normalizedPlan = {
        ...draftPlan,
        itinerary: normalizeItinerary(draftPlan.itinerary),
      };
      normalizedPlan.daysCount = normalizedPlan.itinerary.length;

      const savedIndex = plans.findIndex((plan) => plan.id === normalizedPlan.id);
      const nextIndex = savedIndex >= 0 ? savedIndex : plans.length;
      await upsertPlannerPlan(selectedDestination.id, normalizedPlan, nextIndex);
      const nextPlans = await loadPlans(selectedDestination.id);
      setSelectedPlanId(normalizedPlan.id);
      setDraftPlan(nextPlans.find((plan) => plan.id === normalizedPlan.id) || normalizedPlan);
      setStatus("Plan zostal zapisany do Supabase.");
      setViewMode("preview");
    } catch (error) {
      setStatus(error.message || "Nie udalo sie zapisac planu.");
    } finally {
      setSaving(false);
    }
  };

  const removePlan = async () => {
    if (!selectedDestination || !selectedPlan) return;
    setSaving(true);
    setStatus("");

    try {
      await deletePlannerPlan(selectedPlan.id);
      const nextPlans = await loadPlans(selectedDestination.id);
      setDraftPlan(
        nextPlans[0]
          ? {
              ...JSON.parse(JSON.stringify(nextPlans[0])),
              itinerary: normalizeItinerary(nextPlans[0].itinerary),
            }
          : createEmptyPlan(selectedDestination.id)
      );
      setStatus("Plan zostal usuniety.");
    } catch (error) {
      setStatus(error.message || "Nie udalo sie usunac planu.");
    } finally {
      setSaving(false);
    }
  };

  const activePlanForPreview = selectedPlan || draftPlan;

  return (
    <section className="theme-planner-shell rounded-[2rem] border border-[#E6DED1] bg-white p-6 shadow-[0_16px_60px_rgba(34,31,25,0.05)]">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#8A7F6C]">Trip Planner</p>
          <h3 className="mt-2 text-3xl font-semibold">
            Gotowy planer z PDF oraz osobny widok do budowania wielu wariantow
          </h3>
        </div>

        <button className="theme-planner-button inline-flex items-center gap-2 rounded-full border border-[#E3D9CA] bg-[#F8F4ED] px-4 py-2 text-sm text-[#3D382F]">
          <Share2 className="h-4 w-4" />
          Public family view
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
          <button
            onClick={() => setViewMode("preview")}
            className={cn(
              "theme-planner-button inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition",
              viewMode === "preview"
                ? "border-[#D8CCBB] bg-white text-[#1F1D1A]"
                : "border-[#E3D9CA] bg-[#F8F4ED] text-[#6B6255]"
          )}
        >
          <Eye className="h-4 w-4" />
          Gotowy planer
        </button>

          <button
            onClick={() => setViewMode("edit")}
            className={cn(
              "theme-planner-button inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition",
              viewMode === "edit"
                ? "border-[#D8CCBB] bg-white text-[#1F1D1A]"
                : "border-[#E3D9CA] bg-[#F8F4ED] text-[#6B6255]"
          )}
        >
          <PencilLine className="h-4 w-4" />
          Edycja planow
        </button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <SelectInput
          label="Kraj"
          value={selectedCountryId}
          onChange={setSelectedCountryId}
          options={countries.map((country) => ({
            value: country.id,
            label: country.countryName,
          }))}
        />

        <SelectInput
          label="Destynacja"
          value={selectedDestinationId}
          onChange={setSelectedDestinationId}
          options={(selectedCountry?.destinations || []).map((destination) => ({
            value: destination.id,
            label: destination.name,
          }))}
        />
      </div>

      <div className="theme-planner-card mb-6 rounded-[1.4rem] border border-[#E8DFD2] bg-[#FBF8F2] p-4">
        <div
          className={cn(
            "grid gap-4",
            viewMode === "edit" ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "lg:grid-cols-[minmax(0,1fr)]"
          )}
        >
          {false && <SelectInput
            label="Plan"
            value={selectedPlanId}
            onChange={setSelectedPlanId}
            options={
              plans.length
                ? plans.map((plan) => ({
                    value: plan.id,
                    label: `${plan.name} · ${plan.daysCount} dni`,
                  }))
                : [{ value: "", label: loadingPlans ? "Ladowanie..." : "Brak planow" }]
            }
          />}

          <div>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#4D463D]">Plan</p>
                <p className="mt-1 text-sm text-[#6B6255]">
                  Wybierz wariant podrozy z zapisanych planow dla tej destynacji.
                </p>
              </div>
              <span className="rounded-full border border-[#E1D7C8] bg-white px-3 py-1 text-xs text-[#6B6255]">
                {loadingPlans ? "Ladowanie" : `${plans.length} planow`}
              </span>
            </div>

            {plans.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {plans.map((plan) => {
                  const coverImage = getPlanCover(plan, selectedDestination);
                  const isActive = plan.id === selectedPlanId;

                  return (
                    <div
                      key={plan.id}
                      className={cn(
                        "overflow-hidden rounded-[1.2rem] border bg-white transition hover:border-[#DCCFBD] hover:shadow-[0_8px_18px_rgba(34,31,25,0.04)]",
                        isActive ? "border-[#BFAE97] shadow-[0_8px_18px_rgba(34,31,25,0.06)]" : "border-[#E5DCCF]"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPlanId(plan.id);
                          if (viewMode === "preview") {
                            setPlanPreviewOpen(true);
                          }
                        }}
                        className="block w-full text-left"
                      >
                        <div className="h-36 w-full overflow-hidden bg-[#F4EEE3]">
                          {coverImage ? (
                            <img
                              src={coverImage}
                              alt={plan.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-[0.24em] text-[#8A7F6C]">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-semibold text-[#1F1D1A]">
                            {selectedDestination?.name} - plan {plan.daysCount} dniowy
                          </p>
                          <p className="mt-1 text-sm text-[#6B6255]">{plan.name}</p>
                        </div>
                      </button>

                      <div className="border-t border-[#EEE6DA] px-3 pb-3 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPlanId(plan.id);
                            setViewMode("edit");
                            setPlanPreviewOpen(false);
                          }}
                          className="theme-planner-button inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#D8CCBB] bg-[#FBF8F2] px-4 py-2.5 text-sm font-medium text-[#1F1D1A] transition hover:bg-[#F8F2E9]"
                        >
                          <PencilLine className="h-4 w-4" />
                          Edytuj planer
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[1.1rem] border border-dashed border-[#DDD2C3] bg-white px-5 py-10 text-center text-sm text-[#7C7263]">
                {loadingPlans ? "Ladowanie planow..." : "Brak planow dla tej destynacji."}
              </div>
            )}
          </div>

          {viewMode === "edit" ? (
            <div className="flex flex-col justify-end gap-3 md:flex-row lg:flex-col">
              <button
                onClick={createPlan}
                className="theme-planner-button inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#D8CCBB] bg-white px-4 py-2.5 text-sm font-medium text-[#1F1D1A] transition hover:bg-[#F8F2E9]"
              >
                <Plus className="h-4 w-4" />
                Nowy plan
              </button>

              <button
                onClick={removePlan}
                disabled={!selectedPlan || saving}
                className="theme-planner-button inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#E5CBC5] bg-[#FFF5F2] px-4 py-2.5 text-sm font-medium text-[#8E4E45] transition hover:bg-[#FDEBE6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                Usun plan
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {viewMode === "preview" ? (
        <>
          <div className="rounded-[1.75rem] border border-dashed border-[#DDD2C3] bg-[#FBF8F2] px-5 py-10 text-center text-sm text-[#7C7263]">
            <div className="mx-auto flex max-w-[520px] flex-col items-center gap-4">
              <p>
                Kliknij wybrany kafelek planu powyzej, aby otworzyc pelny widok `Ready Plan`.
              </p>
              <button
                onClick={createPlan}
                className="theme-planner-button inline-flex items-center justify-center gap-2 rounded-full border border-[#D8CCBB] bg-white px-4 py-2.5 text-sm font-medium text-[#1F1D1A] transition hover:bg-[#F8F2E9]"
              >
                <Plus className="h-4 w-4" />
                Dodaj plan
              </button>
            </div>
          </div>
          {false && (
        <div className="theme-planner-card rounded-[1.75rem] border border-[#EEE6DA] bg-[#FBF8F2] p-5">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#8A7F6C]">Ready Plan</p>
              <h4 className="mt-2 text-2xl font-semibold text-[#1F1D1A]">
                {activePlanForPreview?.name || "Brak planu"}
              </h4>
              <p className="mt-2 text-sm text-[#6B6255]">
                {selectedCountry?.countryName} · {selectedDestination?.name} ·{" "}
                {activePlanForPreview?.daysCount || 0} dni
              </p>
            </div>

            <button
              onClick={() =>
                activePlanForPreview &&
                exportPlanToPdf(selectedDestination, selectedCountry, activePlanForPreview)
              }
              disabled={!activePlanForPreview}
              className="theme-planner-button inline-flex items-center gap-2 rounded-full border border-[#D8CCBB] bg-white px-4 py-2.5 text-sm font-medium text-[#1F1D1A] transition hover:bg-[#F8F2E9] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileDown className="h-4 w-4" />
              Pobierz PDF
            </button>
          </div>

          {activePlanForPreview ? (
            <PlannerPreview destination={selectedDestination} plan={activePlanForPreview} />
          ) : (
            <div className="theme-planner-card rounded-[1.25rem] border border-dashed border-[#DDD2C3] bg-white px-5 py-10 text-center text-sm text-[#7C7263]">
              Dla tej destynacji nie ma jeszcze zadnego planu. Przejdz do widoku edycji i utworz pierwszy wariant.
            </div>
          )}
        </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[0.74fr_1.26fr]">
            <div className="xl:sticky xl:top-[112px] xl:self-start">
              <div className="theme-planner-card rounded-[1.75rem] border border-[#EEE6DA] bg-[#FBF8F2] p-5">
                <PlannerEditRouteMap destination={selectedDestination} plan={draftPlan} />

                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-medium">Saved Places</h4>
                    <p className="mt-1 text-sm text-[#7A7164]">
                      Przeciagnij miejscowki do konkretnego dnia planu.
                    </p>
                  </div>
                  <span className="rounded-full border border-[#E3D9CA] bg-white px-3 py-1 text-xs text-[#6B6255]">
                    {filteredAvailablePlaces.length} / {availablePlaces.length} dostepnych
                  </span>
                </div>

                <label className="mb-4 block">
                  <span className="mb-2 block text-sm font-medium text-[#4D463D]">
                    Szukaj miejsc
                  </span>
                  <input
                    value={placeSearchTerm}
                    onChange={(e) => setPlaceSearchTerm(e.target.value)}
                    placeholder="Wpisz nazwe, opis, kategorie..."
                    className="w-full rounded-[1rem] border border-[#E5DCCF] bg-white px-4 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B9AE9A]"
                  />
                </label>

                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {filteredAvailablePlaces.length ? (
                    filteredAvailablePlaces.map((place) => (
                      <PlannerPlaceCard
                        key={place.id}
                        place={place}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/place-id", place.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                      />
                    ))
                  ) : (
                    <div className="theme-planner-card rounded-[1.2rem] border border-dashed border-[#DDD2C3] bg-white/70 px-4 py-8 text-center text-sm text-[#7C7263]">
                      {availablePlaces.length
                        ? "Brak wynikow dla wpisanej frazy."
                        : "Wszystkie miejscowki sa juz przypisane do planu."}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="theme-planner-card rounded-[1.75rem] border border-[#EEE6DA] bg-[#FBF8F2] p-5">
            <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div>
                  <h4 className="font-medium">Edycja planu</h4>
                  <p className="mt-1 text-sm text-[#7A7164]">
                    Dodawaj dni, ustawiaj kolejnosc i dopisuj notatki do punktow.
                  </p>

                  {draftPlan && (
                    <label className="mt-4 block">
                      <span className="mb-2 block text-sm font-medium text-[#4D463D]">Nazwa planu</span>
                      <input
                        value={draftPlan.name}
                        onChange={(e) => updateDraft((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full rounded-[1rem] border border-[#E5DCCF] bg-white px-4 py-3 text-sm text-[#1F1D1A] outline-none"
                      />
                    </label>
                  )}
                </div>

                {draftPlan && (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#4D463D]">Notatki do planu</span>
                    <textarea
                      rows={4}
                      value={draftPlan.notes || ""}
                      onChange={(e) => updateDraft((prev) => ({ ...prev, notes: e.target.value }))}
                      className="w-full rounded-[1rem] border border-[#E5DCCF] bg-white px-4 py-3 text-sm text-[#1F1D1A] outline-none"
                    />
                  </label>
                )}
              </div>

              <div className="flex flex-wrap gap-3 xl:justify-end">
                <button
                  onClick={addDay}
                  className="theme-planner-button inline-flex items-center gap-2 rounded-full border border-[#D8CCBB] bg-white px-4 py-2.5 text-sm font-medium text-[#1F1D1A] transition hover:bg-[#F8F2E9]"
                >
                  <Plus className="h-4 w-4" />
                  Dodaj dzien
                </button>

                <button
                  onClick={savePlan}
                  disabled={saving || !selectedDestination || !draftPlan}
                  className="theme-planner-button inline-flex items-center gap-2 rounded-full border border-[#D8CCBB] bg-[#1F1D1A] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#2C2924] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Zapisywanie..." : "Zapisz plan"}
                </button>
              </div>
            </div>

            <div className="max-h-[980px] space-y-4 overflow-y-auto pr-1">
              {normalizeItinerary(draftPlan?.itinerary || []).map((section, index, allDays) => (
                <DayColumn
                  key={`planner-day-${index}`}
                  dayIndex={index}
                  day={section}
                  destination={selectedDestination}
                  onDropPlace={(placeId, insertIndex) => dropPlaceToDay(index, placeId, insertIndex)}
                  onMovePlannedItem={movePlannedItem}
                  onRemovePlace={(placeId) => removePlaceFromDay(index, placeId)}
                  onDeleteDay={() => deleteDay(index)}
                  onRenameDay={(value) => renameDay(index, value)}
                  onDateChange={(value) => updateDayDate(index, value)}
                  onMoveDayUp={() => moveDay(index, -1)}
                  onMoveDayDown={() => moveDay(index, 1)}
                  onItemNoteChange={(itemIndex, value) => updateItemNote(index, itemIndex, value)}
                  isFirstDay={index === 0}
                  isLastDay={index === allDays.length - 1}
                />
              ))}
            </div>
          </div>
        </div>
        </div>
      )}

      {planPreviewOpen &&
        viewMode === "preview" &&
        activePlanForPreview &&
        canUsePortal &&
        createPortal(
          <div className="fixed inset-0 z-[1550] flex items-center justify-center bg-[rgba(24,21,18,0.58)] p-4 md:p-6">
            <div className="flex h-[min(88vh,980px)] w-full max-w-[1100px] justify-center">
              <div className="flex w-full flex-col overflow-hidden rounded-[2rem] border border-[#E6DED1] bg-white p-5 shadow-[0_30px_90px_rgba(0,0,0,0.24)] md:p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-[#8A7F6C]">Ready Plan</p>
                    <h4 className="mt-2 text-2xl font-semibold text-[#1F1D1A]">
                      {activePlanForPreview.name}
                    </h4>
                    <p className="mt-2 text-sm text-[#6B6255]">
                      {selectedCountry?.countryName} · {selectedDestination?.name} · {activePlanForPreview.daysCount || 0} dni
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        onOpenRoute?.(
                          selectedCountry?.id,
                          selectedDestination?.id,
                          activePlanForPreview.id
                        )
                      }
                      className="theme-planner-button inline-flex items-center gap-2 rounded-full border border-[#D8CCBB] bg-[#FBF8F2] px-4 py-2.5 text-sm font-medium text-[#1F1D1A] transition hover:bg-[#F8F2E9]"
                    >
                      <Route className="h-4 w-4" />
                      Otworz Route
                    </button>
                    <button
                      onClick={() =>
                        exportPlanToPdf(selectedDestination, selectedCountry, activePlanForPreview)
                      }
                      className="theme-planner-button inline-flex items-center gap-2 rounded-full border border-[#D8CCBB] bg-white px-4 py-2.5 text-sm font-medium text-[#1F1D1A] transition hover:bg-[#F8F2E9]"
                    >
                      <FileDown className="h-4 w-4" />
                      Pobierz PDF
                    </button>
                    <button
                      onClick={() => setPlanPreviewOpen(false)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5DCCF] bg-[#FBF8F2] text-[#3A352E] transition hover:bg-white"
                      aria-label="Zamknij podglad planu"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-1">
                  <PlannerPreview destination={selectedDestination} plan={activePlanForPreview} />
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {status && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[1450] w-[min(360px,calc(100vw-2rem))] rounded-[1.2rem] border border-[#D5E2C8] bg-[#F4FAEE] px-4 py-3 text-sm text-[#4F6A2F] shadow-[0_18px_40px_rgba(36,32,26,0.10)] backdrop-blur">
          {status}
        </div>
      )}
    </section>
  );
}
