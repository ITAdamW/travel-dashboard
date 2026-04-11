import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  Coffee,
  Eye,
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

const categoryMeta = {
  beach: { label: "Plaze", icon: Waves },
  viewpoint: { label: "Punkty widokowe", icon: Mountain },
  cafe: { label: "Kawiarnie / relax", icon: Coffee },
  museum: { label: "Muzea / architektura", icon: Landmark },
  city: { label: "Miasto / spacer", icon: Route },
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function findPlaceById(destination, id) {
  return destination?.places.find((place) => place.id === id) || null;
}

function createEmptyDay(index) {
  return {
    day: `Day ${index + 1}`,
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
    items: Array.isArray(day?.items)
      ? day.items.map(normalizeItem).filter((item) => item.placeId)
      : [],
  }));
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
          {!compact && <p className="mt-1 text-sm text-[#5B544A]">{place.note}</p>}
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
              {place.note ? <p className="mt-2 text-sm text-[#5B544A]">{place.note}</p> : null}
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
          {place.note ? <p className="mt-2 text-sm leading-6 text-[#5B544A]">{place.note}</p> : null}
        </div>
        {note ? (
          <div className="rounded-[1rem] border border-[#E5DCCF] bg-white px-3 py-3 text-sm text-[#4F493F] md:w-[280px] md:min-w-[280px]">
            {note}
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
          <input
            value={day.day}
            onChange={(e) => onRenameDay(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#E5DCCF] bg-[#FBF8F2] px-3 py-2 text-base font-medium text-[#1F1D1A] outline-none"
          />
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
          key={`${section.day}-${index}`}
          className="theme-planner-card overflow-hidden rounded-[1.5rem] border border-[#E8DFD2] bg-white"
        >
          <div className="theme-planner-dayhead border-b border-[#EEE6DA] bg-[#FBF8F2] px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#8A7F6C]">Day</p>
            <h4 className="mt-1 text-xl font-semibold text-[#1F1D1A]">{section.day}</h4>
          </div>

          <div className="space-y-3 p-4">
            {section.items.map((item, itemIndex) => {
              const normalized = normalizeItem(item);
              const place = findPlaceById(destination, normalized.placeId);
              if (!place) return null;

              return (
                <PlannerPreviewItem
                  key={`${section.day}-${place.id}-${itemIndex}`}
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
  const canUsePortal = typeof document !== "undefined";

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
    setSelectedCountryId(initialCountryId || countries[0]?.id || "");
  }, [initialCountryId, countries]);

  useEffect(() => {
    if (!selectedCountry) return;
    if (!selectedCountry.destinations.some((destination) => destination.id === selectedDestinationId)) {
      setSelectedDestinationId(selectedCountry.destinations[0]?.id || "");
    }
  }, [selectedCountry, selectedDestinationId]);

  useEffect(() => {
    setSelectedDestinationId(initialDestinationId || selectedCountry?.destinations[0]?.id || "");
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
  }, [selectedPlan?.id, selectedDestination?.id]);

  const plannedPlaceIds = new Set(
    normalizeItinerary(draftPlan?.itinerary || []).flatMap((section) =>
      section.items.map((item) => normalizeItem(item).placeId)
    )
  );

  const availablePlaces = (selectedDestination?.places || []).filter(
    (place) => !plannedPlaceIds.has(place.id)
  );

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
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        if (viewMode === "preview") {
                          setPlanPreviewOpen(true);
                        }
                      }}
                      className={cn(
                        "overflow-hidden rounded-[1.2rem] border bg-white text-left transition hover:border-[#DCCFBD] hover:shadow-[0_8px_18px_rgba(34,31,25,0.04)]",
                        isActive ? "border-[#BFAE97] shadow-[0_8px_18px_rgba(34,31,25,0.06)]" : "border-[#E5DCCF]"
                      )}
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
            Kliknij wybrany kafelek planu powyzej, aby otworzyc pelny widok `Ready Plan`.
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
        <div className="grid gap-4 xl:grid-cols-[0.74fr_1.26fr]">
          <div className="theme-planner-card rounded-[1.75rem] border border-[#EEE6DA] bg-[#FBF8F2] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="font-medium">Saved Places</h4>
                <p className="mt-1 text-sm text-[#7A7164]">
                  Przeciagnij miejscowki do konkretnego dnia planu.
                </p>
              </div>
              <span className="rounded-full border border-[#E3D9CA] bg-white px-3 py-1 text-xs text-[#6B6255]">
                {availablePlaces.length} dostepnych
              </span>
            </div>

            {draftPlan && (
              <div className="theme-planner-card mb-4 space-y-4 rounded-[1.2rem] border border-[#E8DFD2] bg-white p-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#4D463D]">Nazwa planu</span>
                  <input
                    value={draftPlan.name}
                    onChange={(e) => updateDraft((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#4D463D]">Notatki do planu</span>
                  <textarea
                    rows={3}
                    value={draftPlan.notes || ""}
                    onChange={(e) => updateDraft((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none"
                  />
                </label>
              </div>
            )}

            <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
              {availablePlaces.length ? (
                availablePlaces.map((place) => (
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
                  Wszystkie miejscowki sa juz przypisane do planu.
                </div>
              )}
            </div>
          </div>

          <div className="theme-planner-card rounded-[1.75rem] border border-[#EEE6DA] bg-[#FBF8F2] p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="font-medium">Edycja planu</h4>
                <p className="mt-1 text-sm text-[#7A7164]">
                  Dodawaj dni, ustawiaj kolejnosc i dopisuj notatki do punktow.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
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

            <div className="space-y-4">
              {normalizeItinerary(draftPlan?.itinerary || []).map((section, index, allDays) => (
                <DayColumn
                  key={`${section.day}-${index}`}
                  dayIndex={index}
                  day={section}
                  destination={selectedDestination}
                  onDropPlace={(placeId, insertIndex) => dropPlaceToDay(index, placeId, insertIndex)}
                  onMovePlannedItem={movePlannedItem}
                  onRemovePlace={(placeId) => removePlaceFromDay(index, placeId)}
                  onDeleteDay={() => deleteDay(index)}
                  onRenameDay={(value) => renameDay(index, value)}
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
