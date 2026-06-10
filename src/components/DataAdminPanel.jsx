import { useEffect, useMemo, useState } from "react";
import { createElement } from "react";
import { Flag, ImagePlus, MapPinned, Plus, Save, Trash2, Upload, Video } from "lucide-react";
import {
  deleteCountryById,
  deleteDestinationById,
  deletePlaceById,
  upsertCountry,
  upsertDestination,
  upsertPlace,
} from "../lib/supabaseTravelData";
import {
  countryMediaFolder,
  destinationMediaFolder,
  placeFolder,
  replaceMediaCover,
  uploadMediaGallery,
  uploadMediaVideos,
} from "../lib/storageMedia";
import { filterSupabaseMediaUrls } from "../lib/mediaUrls";
import { buildMadeiraPrPlaceTemplates } from "../lib/madeiraPrCatalog";
import {
  MADEIRA_WORKBOOK_CATEGORY_ASSIGNMENTS,
  PLACE_CATEGORY_OPTIONS,
} from "../lib/placeCategories";

const DEFAULT_PLACE_NOTE = "[Google Maps]()";

function slugify(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function SectionCard({ title, subtitle, action, children }) {
  return (
    <section className="theme-admin-card rounded-[1.5rem] border border-[#DCECF0] bg-white p-5 shadow-[0_18px_55px_rgba(15,58,66,0.07)] md:p-7">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#008EA1]">{title}</p>
          <p className="mt-2 text-sm leading-7 text-[#647782]">{subtitle}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function TextInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#52616D]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-[#DCECF0] bg-white px-3 text-sm text-[#132334] outline-none transition focus:border-[#008EA1] focus:ring-4 focus:ring-[#008EA1]/10"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 4, helperText = "" }) {
  const resolvedHelperText =
    helperText ||
    (label === "Notka" || label === "Opis"
      ? "Obslugiwane: **pogrubienie**, *kursywa*, listy z '-' oraz linki https://... i [tekst](https://...)."
      : "");

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#52616D]">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#DCECF0] bg-white px-3 py-2 text-sm text-[#132334] outline-none transition focus:border-[#008EA1] focus:ring-4 focus:ring-[#008EA1]/10"
      />
      {resolvedHelperText ? (
        <span className="mt-2 block text-xs leading-5 text-[#7A7164]">{resolvedHelperText}</span>
      ) : null}
    </label>
  );
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#52616D]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-[#DCECF0] bg-white px-3 text-sm text-[#132334] outline-none transition focus:border-[#008EA1] focus:ring-4 focus:ring-[#008EA1]/10"
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

function SearchableSelectInput({ label, value, onChange, options, placeholder = "Szukaj..." }) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value) || null;
  const [query, setQuery] = useState(selectedOption?.label || "");

  useEffect(() => {
    setQuery(selectedOption?.label || "");
  }, [selectedOption?.label]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = options.filter((option) =>
    !normalizedQuery ? true : option.label.toLowerCase().includes(normalizedQuery)
  );

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#4D463D]">{label}</span>
      <div className="relative">
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false);
              setQuery(selectedOption?.label || "");
            }, 120);
          }}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-[#DCECF0] bg-white px-3 text-sm text-[#132334] outline-none transition focus:border-[#008EA1]"
        />

        {open ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-72 overflow-y-auto rounded-[1rem] border border-[#E5DCCF] bg-white p-2 shadow-[0_18px_40px_rgba(34,31,25,0.12)]">
            {filteredOptions.length ? (
              <div className="space-y-1">
                {filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onChange(option.value);
                      setQuery(option.label);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full rounded-[0.9rem] px-3 py-2.5 text-left text-sm transition",
                      option.value === value
                        ? "bg-[#FBF8F2] text-[#1F1D1A]"
                        : "text-[#4D463D] hover:bg-[#F8F2E9]"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-[0.9rem] bg-[#FBF8F2] px-3 py-3 text-sm text-[#6B6255]">
                Brak pasujacych miejsc.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </label>
  );
}

function MediaFields({
  media,
  onChange,
  currentMedia = {},
  showGallery = true,
  showVideos = true,
}) {
  const currentImages = [currentMedia.image, ...(currentMedia.gallery || [])].filter(Boolean);
  const currentVideos = [currentMedia.video, ...(currentMedia.videos || [])].filter(Boolean);

  return (
    <section className="rounded-[1.25rem] border border-[#CFE7EB] bg-[#F7FCFD] p-4 md:col-span-2 xl:col-span-3">
      <div className="mb-4">
        <h3 className="font-semibold text-[#132334]">Media</h3>
        <p className="mt-1 text-xs leading-5 text-[#647782]">
          Pliki zostaną wysłane do Supabase Storage podczas zapisywania formularza.
        </p>
      </div>
      <div
        className={cn(
          "grid gap-3",
          showGallery && showVideos ? "lg:grid-cols-3" : showGallery || showVideos ? "lg:grid-cols-2" : ""
        )}
      >
        <label className="rounded-xl border border-[#DCECF0] bg-white p-3">
          <span className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#007786]">
            <ImagePlus className="h-4 w-4" /> Cover
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) =>
              onChange((current) => ({ ...current, cover: event.target.files?.[0] || null }))
            }
            className="block w-full text-xs text-[#52616D] file:mr-3 file:rounded-lg file:border-0 file:bg-[#E6FAFC] file:px-3 file:py-2 file:font-semibold file:text-[#007786]"
          />
          <p className="mt-2 truncate text-xs text-[#647782]">
            {media.cover?.name || (currentMedia.image ? "Aktualny cover zapisany" : "Brak covera")}
          </p>
        </label>
        {showGallery ? (
        <label className="rounded-xl border border-[#DCECF0] bg-white p-3">
          <span className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#007786]">
            <Upload className="h-4 w-4" /> Galeria
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                gallery: Array.from(event.target.files || []),
              }))
            }
            className="block w-full text-xs text-[#52616D] file:mr-3 file:rounded-lg file:border-0 file:bg-[#E6FAFC] file:px-3 file:py-2 file:font-semibold file:text-[#007786]"
          />
          <p className="mt-2 text-xs text-[#647782]">
            {media.gallery.length
              ? `${media.gallery.length} nowych plików`
              : `${currentImages.length} zapisanych zdjęć`}
          </p>
        </label>
        ) : null}
        {showVideos ? (
        <label className="rounded-xl border border-[#DCECF0] bg-white p-3">
          <span className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#007786]">
            <Video className="h-4 w-4" /> Wideo
          </span>
          <input
            type="file"
            accept="video/*"
            multiple
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                videos: Array.from(event.target.files || []),
              }))
            }
            className="block w-full text-xs text-[#52616D] file:mr-3 file:rounded-lg file:border-0 file:bg-[#E6FAFC] file:px-3 file:py-2 file:font-semibold file:text-[#007786]"
          />
          <p className="mt-2 text-xs text-[#647782]">
            {media.videos.length
              ? `${media.videos.length} nowych plików`
              : `${currentVideos.length} zapisanych filmów`}
          </p>
        </label>
        ) : null}
      </div>
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  variant = "default",
  type = "button",
  disabled,
  className = "",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "theme-admin-button inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "danger"
          ? "theme-admin-danger border-[#E5CBC5] bg-[#FFF5F2] text-[#8E4E45] hover:bg-[#FDEBE6]"
          : variant === "primary"
          ? "border-[#008EA1] bg-[#008EA1] text-white hover:bg-[#007786]"
          : "border-[#B8D9DE] bg-white text-[#007786] hover:border-[#008EA1] hover:bg-[#F3FCFD]",
        className
      )}
    >
      {children}
    </button>
  );
}

function toCountryForm(country) {
  return {
    id: country?.id || "",
    countryName: country?.countryName || "",
    status: country?.status || "planned",
    year: country?.year || "",
    region: country?.region || "",
    summary: country?.summary || "",
    image: country?.image || "",
    gallery: country?.gallery || [],
    video: country?.video || "",
    videos: country?.videos || [],
  };
}

function toDestinationForm(destination) {
  return {
    id: destination?.id || "",
    name: destination?.name || "",
    area: destination?.area || "",
    video: destination?.video || "",
    summary: destination?.summary || "",
    image: destination?.image || "",
    gallery: destination?.gallery || [],
    videos: destination?.videos || [],
  };
}

function toPlaceForm(place) {
  return {
    id: place?.id || "",
    name: place?.name || "",
    category: place?.category || "city",
    latitude: place?.coordinates?.[0] ?? 0,
    longitude: place?.coordinates?.[1] ?? 0,
    note: place?.note || DEFAULT_PLACE_NOTE,
    status: place?.status || "planned",
    subtitle: place?.subtitle || "",
    description: place?.description || "",
    info: place?.info || "",
    ticket: place?.ticket || "",
    reservation: place?.reservation || "",
    paid: place?.paid || "",
    rating: place?.rating ?? 4.5,
    distanceKm: place?.distanceKm ?? place?.distance_km ?? 0,
    durationHours: place?.durationHours ?? place?.duration_hours ?? 0,
    startLatitude: place?.startCoordinates?.[0] ?? place?.start_latitude ?? 0,
    startLongitude: place?.startCoordinates?.[1] ?? place?.start_longitude ?? 0,
    endLatitude: place?.endCoordinates?.[0] ?? place?.end_latitude ?? 0,
    endLongitude: place?.endCoordinates?.[1] ?? place?.end_longitude ?? 0,
  };
}

export default function DataAdminPanel({
  countries,
  onReloadFromDatabase,
}) {
  const [editorMode, setEditorMode] = useState("place");
  const [formIntent, setFormIntent] = useState("edit");
  const [selectedCountryId, setSelectedCountryId] = useState(countries[0]?.id || "");
  const [selectedDestinationId, setSelectedDestinationId] = useState(
    countries[0]?.destinations[0]?.id || ""
  );
  const [selectedPlaceId, setSelectedPlaceId] = useState(
    countries[0]?.destinations[0]?.places[0]?.id || ""
  );
  const [countryForm, setCountryForm] = useState(toCountryForm(countries[0]));
  const [destinationForm, setDestinationForm] = useState(
    toDestinationForm(countries[0]?.destinations?.[0])
  );
  const [placeForm, setPlaceForm] = useState(
    toPlaceForm(countries[0]?.destinations?.[0]?.places?.[0])
  );
  const [countryMedia, setCountryMedia] = useState({ cover: null, gallery: [], videos: [] });
  const [destinationMedia, setDestinationMedia] = useState({ cover: null, gallery: [], videos: [] });
  const [placeMedia, setPlaceMedia] = useState({ cover: null, gallery: [], videos: [] });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  function changeEditorMode(mode) {
    setEditorMode(mode);
    setFormIntent("create");
    const timestamp = Date.now();

    if (mode === "country") {
      setCountryForm({
        ...toCountryForm(null),
        id: `country-${timestamp}`,
        countryName: "",
      });
      setCountryMedia({ cover: null, gallery: [], videos: [] });
    } else if (mode === "destination") {
      setDestinationForm({
        ...toDestinationForm(null),
        id: `destination-${timestamp}`,
        name: "",
      });
      setDestinationMedia({ cover: null, gallery: [], videos: [] });
    } else {
      setPlaceForm({
        ...toPlaceForm(null),
        id: `place-${timestamp}`,
        name: "",
      });
      setPlaceMedia({ cover: null, gallery: [], videos: [] });
    }
  }

  function startEditing(mode) {
    setEditorMode(mode);
    setFormIntent("edit");

    if (mode === "country") {
      setCountryForm(toCountryForm(selectedCountry));
      setCountryMedia({ cover: null, gallery: [], videos: [] });
    } else if (mode === "destination") {
      setDestinationForm(toDestinationForm(selectedDestination));
      setDestinationMedia({ cover: null, gallery: [], videos: [] });
    } else {
      setPlaceForm(toPlaceForm(selectedPlace));
      setPlaceMedia({ cover: null, gallery: [], videos: [] });
    }
  }

  const selectedCountry = useMemo(
    () => countries.find((country) => country.id === selectedCountryId) || countries[0],
    [countries, selectedCountryId]
  );
  const selectedDestination =
    selectedCountry?.destinations.find((item) => item.id === selectedDestinationId) ||
    selectedCountry?.destinations[0];
  const selectedPlace =
    selectedDestination?.places.find((item) => item.id === selectedPlaceId) ||
    selectedDestination?.places[0];

  useEffect(() => {
    if (!countries.length) return;
    if (!countries.some((country) => country.id === selectedCountryId)) {
      const nextCountry = countries[0];
      setSelectedCountryId(nextCountry.id);
      setSelectedDestinationId(nextCountry.destinations[0]?.id || "");
      setSelectedPlaceId(nextCountry.destinations[0]?.places[0]?.id || "");
    }
  }, [countries, selectedCountryId]);

  useEffect(() => {
    if (!selectedCountry) return;
    if (!selectedCountry.destinations.some((item) => item.id === selectedDestinationId)) {
      setSelectedDestinationId(selectedCountry.destinations[0]?.id || "");
    }
  }, [selectedCountry, selectedDestinationId]);

  useEffect(() => {
    if (!selectedDestination) return;
    if (!selectedDestination.places.some((item) => item.id === selectedPlaceId)) {
      setSelectedPlaceId(selectedDestination.places[0]?.id || "");
    }
  }, [selectedDestination, selectedPlaceId]);

  useEffect(() => {
    if (editorMode === "country" && formIntent === "create") return;
    setCountryForm(toCountryForm(selectedCountry));
    setCountryMedia({ cover: null, gallery: [], videos: [] });
  }, [editorMode, formIntent, selectedCountry?.id]);

  useEffect(() => {
    if (editorMode === "destination" && formIntent === "create") return;
    setDestinationForm(toDestinationForm(selectedDestination));
    setDestinationMedia({ cover: null, gallery: [], videos: [] });
  }, [editorMode, formIntent, selectedDestination?.id]);

  useEffect(() => {
    if (editorMode === "place" && formIntent === "create") return;
    setPlaceForm(toPlaceForm(selectedPlace));
    setPlaceMedia({ cover: null, gallery: [], videos: [] });
  }, [editorMode, formIntent, selectedPlace?.id]);

  async function uploadPendingMedia(folder, pendingMedia, currentEntity = {}) {
    const existingEntity = currentEntity || {};
    const [cover, gallery, videos] = await Promise.all([
      pendingMedia.cover ? replaceMediaCover(folder, pendingMedia.cover) : null,
      pendingMedia.gallery.length ? uploadMediaGallery(folder, pendingMedia.gallery) : [],
      pendingMedia.videos.length ? uploadMediaVideos(folder, pendingMedia.videos) : [],
    ]);

    const nextGallery = [
      ...filterSupabaseMediaUrls(existingEntity.gallery || []),
      ...gallery.map((item) => item.url),
    ].filter((value, index, array) => array.indexOf(value) === index);
    const nextVideos = [
      ...(Array.isArray(existingEntity.videos) ? existingEntity.videos : []),
      ...videos.map((item) => item.url),
    ].filter((value, index, array) => value && array.indexOf(value) === index);

    return {
      image: cover?.url || existingEntity.image || "",
      gallery: nextGallery,
      video: nextVideos[0] || existingEntity.video || "",
      videos: nextVideos,
    };
  }

  const runAction = async (action, message, nextSelection) => {
    setLoading(true);
    setStatus("");
    try {
      await action();
      const refreshedCountries = await onReloadFromDatabase();
      if (typeof nextSelection === "function") {
        const result = nextSelection(refreshedCountries || countries);
        if (result?.countryId) setSelectedCountryId(result.countryId);
        if (result?.destinationId) setSelectedDestinationId(result.destinationId);
        if (result?.placeId) setSelectedPlaceId(result.placeId);
      }
      setFormIntent("edit");
      setStatus(message);
    } catch (error) {
      setStatus(error.message || "Operacja na bazie danych nie powiodła się.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCountry = () =>
    runAction(
      async () => {
        const nextCountryId = slugify(countryForm.id) || countryForm.id;
        const mediaFields = await uploadPendingMedia(
          countryMediaFolder(nextCountryId),
          countryMedia,
          formIntent === "edit" ? selectedCountry : null
        );
        await upsertCountry(
          {
            ...(formIntent === "edit" ? selectedCountry : {}),
            ...countryForm,
            ...mediaFields,
            id: nextCountryId,
          },
          formIntent === "edit"
            ? countries.findIndex((country) => country.id === selectedCountryId)
            : countries.length
        );
      },
      "Zapisano zmiany kraju w Supabase.",
      () => ({
        countryId: slugify(countryForm.id) || countryForm.id,
      })
    );

  const handleSaveDestination = () =>
    runAction(
      async () => {
        const nextDestinationId = slugify(destinationForm.id) || destinationForm.id;
        const mediaFields = await uploadPendingMedia(
          destinationMediaFolder(selectedCountryId, nextDestinationId),
          destinationMedia,
          formIntent === "edit" ? selectedDestination : null
        );
        await upsertDestination(
          selectedCountryId,
          {
            ...(formIntent === "edit" ? selectedDestination : {}),
            ...destinationForm,
            ...mediaFields,
            id: nextDestinationId,
          },
          formIntent === "edit"
            ? selectedCountry?.destinations.findIndex(
                (destination) => destination.id === selectedDestinationId
              ) || 0
            : selectedCountry?.destinations.length || 0
        );
      },
      "Zapisano zmiany destynacji w Supabase.",
      () => ({
        countryId: selectedCountryId,
        destinationId: slugify(destinationForm.id) || destinationForm.id,
      })
    );

  const handleSavePlace = () =>
    runAction(
      async () => {
        const nextPlaceId = slugify(placeForm.id) || placeForm.id;
        const nextPlacePayload = {
          ...(formIntent === "edit" ? selectedPlace : {}),
          ...placeForm,
          id: nextPlaceId,
          coordinates: [Number(placeForm.latitude) || 0, Number(placeForm.longitude) || 0],
          startCoordinates:
            Number(placeForm.startLatitude) || Number(placeForm.startLongitude)
              ? [
                  Number(placeForm.startLatitude) || 0,
                  Number(placeForm.startLongitude) || 0,
                ]
              : [],
          endCoordinates:
            Number(placeForm.endLatitude) || Number(placeForm.endLongitude)
              ? [
                  Number(placeForm.endLatitude) || 0,
                  Number(placeForm.endLongitude) || 0,
                ]
              : [],
        };

        await upsertPlace(
          selectedDestinationId,
          nextPlacePayload,
          formIntent === "edit"
            ? selectedDestination?.places.findIndex((place) => place.id === selectedPlaceId) || 0
            : selectedDestination?.places.length || 0
        );

        if (
          (placeMedia.cover || placeMedia.gallery.length || placeMedia.videos.length) &&
          selectedCountryId &&
          selectedDestinationId &&
          nextPlaceId
        ) {
          const mediaFields = await uploadPendingMedia(
            placeFolder(selectedCountryId, selectedDestinationId, nextPlaceId),
            placeMedia,
            formIntent === "edit" ? selectedPlace : null
          );
          await upsertPlace(
            selectedDestinationId,
            {
              ...nextPlacePayload,
              ...mediaFields,
            },
            formIntent === "edit"
              ? selectedDestination?.places.findIndex((place) => place.id === selectedPlaceId) || 0
              : selectedDestination?.places.length || 0
          );
        }
      },
      placeMedia.cover || placeMedia.gallery.length || placeMedia.videos.length
        ? "Zapisano zmiany miejscówki i wgrano media do Supabase."
        : "Zapisano zmiany miejscówki w Supabase.",
      () => ({
        countryId: selectedCountryId,
        destinationId: selectedDestinationId,
        placeId: slugify(placeForm.id) || placeForm.id,
      })
    );

  const addMadeiraPrPlaces = () => {
    if (!selectedDestination) return;

    const anchorCoordinates =
      selectedDestination.places?.find((place) =>
        Array.isArray(place.coordinates) &&
        Number.isFinite(Number(place.coordinates[0])) &&
        Number.isFinite(Number(place.coordinates[1])) &&
        (Number(place.coordinates[0]) !== 0 || Number(place.coordinates[1]) !== 0)
      )?.coordinates || [32.75, -16.95];

    const templates = buildMadeiraPrPlaceTemplates(anchorCoordinates);
    const existingPlaces = selectedDestination.places || [];
    const existingPrIds = new Set(
      existingPlaces
        .filter((place) => String(place.id || "").startsWith("madeira-pr-"))
        .map((place) => place.id)
    );
    const missingTemplates = templates.filter((place) => !existingPrIds.has(place.id));

    if (!missingTemplates.length) {
      setStatus("Wszystkie szablony PR Madery sa juz dodane.");
      return;
    }

    runAction(
      async () => {
        for (const [index, place] of missingTemplates.entries()) {
          const existingPlace =
            selectedDestination?.places?.find(
              (existing) => existing.id === place.id
            ) || null;
          const mergedPlace = existingPlace
            ? {
                ...place,
                image: existingPlace.image || place.image,
                gallery: existingPlace.gallery?.length
                  ? existingPlace.gallery
                  : place.gallery,
                video: existingPlace.video || place.video,
                videos: existingPlace.videos?.length
                  ? existingPlace.videos
                  : place.videos,
                routePath: existingPlace.routePath?.length
                  ? existingPlace.routePath
                  : place.routePath,
                startCoordinates: existingPlace.startCoordinates?.length
                  ? existingPlace.startCoordinates
                  : place.startCoordinates,
                endCoordinates: existingPlace.endCoordinates?.length
                  ? existingPlace.endCoordinates
                  : place.endCoordinates,
              }
            : place;

          await upsertPlace(
            selectedDestinationId,
            mergedPlace,
            selectedDestination?.places?.findIndex((existingPlace) => existingPlace.id === place.id) >= 0
              ? selectedDestination.places.findIndex((existingPlace) => existingPlace.id === place.id)
              : (selectedDestination.places?.length || 0) + index
          );
        }
      },
      `Dodano ${missingTemplates.length} szablonow PR Madery do miejscowek.`,
      () => ({
        countryId: selectedCountryId,
        destinationId: selectedDestinationId,
        placeId: missingTemplates[0]?.id || selectedPlaceId,
      })
    );
  };

  const syncMadeiraPrPlaces = () => {
    if (!selectedDestination) return;

    const anchorCoordinates =
      selectedDestination.places?.find((place) =>
        Array.isArray(place.coordinates) &&
        Number.isFinite(Number(place.coordinates[0])) &&
        Number.isFinite(Number(place.coordinates[1])) &&
        (Number(place.coordinates[0]) !== 0 || Number(place.coordinates[1]) !== 0)
      )?.coordinates || [32.75, -16.95];

    const templates = buildMadeiraPrPlaceTemplates(anchorCoordinates);

    runAction(
      async () => {
        for (const [index, place] of templates.entries()) {
          const existingPlace =
            selectedDestination?.places?.find(
              (existing) => existing.id === place.id
            ) || null;
          const mergedPlace = existingPlace
            ? {
                ...place,
                image: existingPlace.image || place.image,
                gallery: existingPlace.gallery?.length
                  ? existingPlace.gallery
                  : place.gallery,
                video: existingPlace.video || place.video,
                videos: existingPlace.videos?.length
                  ? existingPlace.videos
                  : place.videos,
                routePath: existingPlace.routePath?.length
                  ? existingPlace.routePath
                  : place.routePath,
                startCoordinates: existingPlace.startCoordinates?.length
                  ? existingPlace.startCoordinates
                  : place.startCoordinates,
                endCoordinates: existingPlace.endCoordinates?.length
                  ? existingPlace.endCoordinates
                  : place.endCoordinates,
              }
            : place;

          const existingIndex = selectedDestination?.places?.findIndex(
            (existingPlace) => existingPlace.id === place.id
          );

          await upsertPlace(
            selectedDestinationId,
            mergedPlace,
            existingIndex >= 0
              ? existingIndex
              : (selectedDestination.places?.length || 0) + index
          );
        }
      },
      "Zsynchronizowano wszystkie PR Madery bez ruszania pozostalych miejsc.",
      () => ({
        countryId: selectedCountryId,
        destinationId: selectedDestinationId,
        placeId: templates[0]?.id || selectedPlaceId,
      })
    );
  };

  const syncMadeiraWorkbookCategories = () => {
    if (!selectedDestination) return;

    runAction(
      async () => {
        for (const assignment of MADEIRA_WORKBOOK_CATEGORY_ASSIGNMENTS) {
          const existingPlace =
            selectedDestination?.places?.find((place) => place.id === assignment.id) || null;
          if (!existingPlace || existingPlace.category === assignment.category) continue;

          const existingIndex =
            selectedDestination?.places?.findIndex((place) => place.id === assignment.id) || 0;

          await upsertPlace(
            selectedDestinationId,
            {
              ...existingPlace,
              category: assignment.category,
            },
            existingIndex
          );
        }
      },
      "Zsynchronizowano kategorie workbookowych miejsc na Maderze.",
      () => ({
        countryId: selectedCountryId,
        destinationId: selectedDestinationId,
        placeId: selectedPlaceId,
      })
    );
  };

  const deleteCountry = () => {
    if (!selectedCountry || countries.length <= 1) return;
    runAction(
      () => deleteCountryById(selectedCountryId),
      "Usunięto kraj z Supabase.",
      (refreshedCountries) => ({
        countryId: refreshedCountries[0]?.id || "",
        destinationId: refreshedCountries[0]?.destinations[0]?.id || "",
        placeId: refreshedCountries[0]?.destinations[0]?.places[0]?.id || "",
      })
    );
  };

  const deleteDestination = () => {
    if (!selectedDestination || selectedCountry?.destinations.length <= 1) return;
    runAction(
      () => deleteDestinationById(selectedDestinationId),
      "Usunięto destynację z Supabase.",
      (refreshedCountries) => {
        const nextCountry =
          refreshedCountries.find((country) => country.id === selectedCountryId) ||
          refreshedCountries[0];
        return {
          countryId: nextCountry?.id || "",
          destinationId: nextCountry?.destinations[0]?.id || "",
          placeId: nextCountry?.destinations[0]?.places[0]?.id || "",
        };
      }
    );
  };

  const deletePlace = () => {
    if (!selectedPlace || selectedDestination?.places.length <= 1) return;
    runAction(
      () => deletePlaceById(selectedPlaceId),
      "Usunięto miejscówkę z Supabase.",
      (refreshedCountries) => {
        const nextCountry =
          refreshedCountries.find((country) => country.id === selectedCountryId) ||
          refreshedCountries[0];
        const nextDestination =
          nextCountry?.destinations.find((destination) => destination.id === selectedDestinationId) ||
          nextCountry?.destinations[0];
        return {
          countryId: nextCountry?.id || "",
          destinationId: nextDestination?.id || "",
          placeId: nextDestination?.places[0]?.id || "",
        };
      }
    );
  };

  return (
    <section className="theme-admin-shell grid gap-5">
      <div className="mx-auto grid w-full max-w-4xl gap-3 sm:grid-cols-3">
        {[
          { key: "country", label: "Kraj", icon: Flag },
          { key: "destination", label: "Destynacja", icon: MapPinned },
          { key: "place", label: "Miejscówka", icon: Plus },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setEditorMode(key);
              startEditing(key);
            }}
            className={cn(
              "inline-flex min-h-16 items-center justify-center gap-3 rounded-xl border px-4 text-sm font-semibold transition",
              editorMode === key
                ? "border-[#008EA1] bg-[#008EA1] text-white shadow-[0_12px_28px_rgba(0,142,161,0.20)]"
                : "border-[#DCECF0] bg-white text-[#52616D] hover:border-[#8DDAE4] hover:bg-[#F3FCFD] hover:text-[#007786]"
            )}
          >
            {createElement(icon, { className: "h-5 w-5" })}
            {label}
          </button>
        ))}
      </div>

      <div>
        <div className="mx-auto mb-4 grid max-w-xl grid-cols-2 gap-2 rounded-xl border border-[#DCECF0] bg-[#F7FCFD] p-1.5">
          <button
            type="button"
            onClick={() => changeEditorMode(editorMode)}
            className={cn(
              "h-10 rounded-lg text-sm font-semibold transition",
              formIntent === "create"
                ? "bg-[#008EA1] text-white shadow-sm"
                : "text-[#52616D] hover:bg-white hover:text-[#007786]"
            )}
          >
            Dodaj nowy
          </button>
          <button
            type="button"
            onClick={() => startEditing(editorMode)}
            className={cn(
              "h-10 rounded-lg text-sm font-semibold transition",
              formIntent === "edit"
                ? "bg-white text-[#007786] shadow-sm ring-1 ring-[#B8D9DE]"
                : "text-[#52616D] hover:bg-white hover:text-[#007786]"
            )}
          >
            Edytuj istniejący
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[#DCECF0] bg-[#F7FCFD] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[#132334]">
              {formIntent === "create" ? "Dodawanie nowego elementu" : "Edycja istniejącego elementu"}
            </p>
            <p className="mt-0.5 text-xs text-[#647782]">
              {formIntent === "create"
                ? "Uzupełnij formularz i zapisz, aby utworzyć nowy rekord."
                : "Zmiany zostaną zapisane w aktualnie wybranym rekordzie."}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-bold",
              formIntent === "create"
                ? "bg-[#008EA1] text-white"
                : "bg-[#E6FAFC] text-[#007786]"
            )}
          >
            {formIntent === "create" ? "NOWY" : "EDYCJA"}
          </span>
        </div>

        {editorMode === "country" ? (
        <SectionCard
          title="Kraj"
          subtitle="Uzupełnij dane nowego kraju albo wybierz istniejący, aby go edytować."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SelectInput
              label="Edytuj istniejący kraj"
              value={formIntent === "edit" ? selectedCountryId : ""}
              onChange={(value) => {
                if (!value) return;
                setFormIntent("edit");
                setSelectedCountryId(value);
                const country = countries.find((item) => item.id === value);
                setCountryForm(toCountryForm(country));
              }}
              options={[
                { value: "", label: "Wybierz kraj do edycji..." },
                ...countries.map((country) => ({
                  value: country.id,
                  label: country.countryName,
                })),
              ]}
            />
            <TextInput
              label="ID kraju"
              value={countryForm.id}
              onChange={(value) => setCountryForm((prev) => ({ ...prev, id: value }))}
              placeholder="np. pl"
            />
            <TextInput
              label="Nazwa kraju"
              value={countryForm.countryName}
              onChange={(value) => setCountryForm((prev) => ({ ...prev, countryName: value }))}
              placeholder="np. Poland"
            />
            <TextInput
              label="Rok"
              value={countryForm.year}
              onChange={(value) => setCountryForm((prev) => ({ ...prev, year: value }))}
              placeholder="np. 2025"
            />
            <TextInput
              label="Region"
              value={countryForm.region}
              onChange={(value) => setCountryForm((prev) => ({ ...prev, region: value }))}
              placeholder="np. Europa Środkowa"
            />
            <SelectInput
              label="Status"
              value={countryForm.status}
              onChange={(value) => setCountryForm((prev) => ({ ...prev, status: value }))}
              options={[
                { value: "visited", label: "visited" },
                { value: "planned", label: "planned" },
              ]}
            />
            <TextArea
              label="Podsumowanie"
              value={countryForm.summary}
              onChange={(value) => setCountryForm((prev) => ({ ...prev, summary: value }))}
              placeholder="Krótki opis kraju"
            />
            <div className="grid gap-3 sm:grid-cols-2 md:col-span-2 xl:col-span-3">
              <ActionButton
                onClick={handleSaveCountry}
                variant="primary"
                disabled={loading}
                className="w-full"
              >
                <Save className="h-4 w-4" />
                {formIntent === "create" ? "Dodaj kraj" : "Zapisz zmiany"}
              </ActionButton>
              <ActionButton
                onClick={deleteCountry}
                variant="danger"
                disabled={loading || formIntent === "create"}
                className="w-full"
              >
                <Trash2 className="h-4 w-4" />
                Usuń kraj
              </ActionButton>
            </div>
          </div>
        </SectionCard>
        ) : null}

        {editorMode === "destination" ? (
        <SectionCard
          title="Destynacja"
          subtitle="Wybierz kraj, uzupełnij dane i opcjonalnie dodaj cover wykorzystywany na kartach destynacji."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
              label="Edytuj istniejącą destynację"
              value={formIntent === "edit" ? selectedDestinationId : ""}
              onChange={(value) => {
                if (!value) return;
                setFormIntent("edit");
                setSelectedDestinationId(value);
                const destination = selectedCountry?.destinations.find(
                  (item) => item.id === value
                );
                setDestinationForm(toDestinationForm(destination));
              }}
              options={[
                { value: "", label: "Wybierz destynację do edycji..." },
                ...(selectedCountry?.destinations || []).map((destination) => ({
                  value: destination.id,
                  label: destination.name,
                })),
              ]}
            />
            <TextInput
              label="ID destynacji"
              value={destinationForm.id}
              onChange={(value) => setDestinationForm((prev) => ({ ...prev, id: value }))}
              placeholder="np. krakow"
            />
            <TextInput
              label="Nazwa"
              value={destinationForm.name}
              onChange={(value) => setDestinationForm((prev) => ({ ...prev, name: value }))}
              placeholder="np. Kraków"
            />
            <TextInput
              label="Area"
              value={destinationForm.area}
              onChange={(value) => setDestinationForm((prev) => ({ ...prev, area: value }))}
              placeholder="np. Old Town"
            />
            <TextArea
              label="Summary"
              value={destinationForm.summary}
              onChange={(value) => setDestinationForm((prev) => ({ ...prev, summary: value }))}
              placeholder="Opis destynacji"
            />
            <MediaFields
              media={destinationMedia}
              onChange={setDestinationMedia}
              currentMedia={formIntent === "edit" ? selectedDestination : {}}
              showGallery={false}
              showVideos
            />
            <div className="grid gap-3 sm:grid-cols-2 md:col-span-2 xl:col-span-3">
              <ActionButton
                onClick={handleSaveDestination}
                variant="primary"
                disabled={loading || !selectedCountry}
                className="w-full"
              >
                <Save className="h-4 w-4" />
                {formIntent === "create" ? "Dodaj destynację" : "Zapisz zmiany"}
              </ActionButton>
              <ActionButton
                onClick={deleteDestination}
                variant="danger"
                disabled={loading || !selectedDestination || formIntent === "create"}
                className="w-full"
              >
                <Trash2 className="h-4 w-4" />
                Usuń miasto
              </ActionButton>
            </div>
          </div>
        </SectionCard>
        ) : null}

        {editorMode === "place" ? (
        <SectionCard
          title="Miejscówka"
          subtitle="Wybierz kraj i destynację, a następnie dodaj lub edytuj miejscówkę razem ze wszystkimi mediami."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="grid gap-3 md:col-span-2 md:grid-cols-2 xl:col-span-3">
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
            <div className="md:col-span-2 xl:col-span-3">
              <SearchableSelectInput
                label="Edytuj istniejącą miejscówkę"
                value={formIntent === "edit" ? selectedPlaceId : ""}
                onChange={(value) => {
                  setFormIntent("edit");
                  setSelectedPlaceId(value);
                  const place = selectedDestination?.places.find((item) => item.id === value);
                  setPlaceForm(toPlaceForm(place));
                }}
                options={(selectedDestination?.places || []).map((place) => ({
                  value: place.id,
                  label: place.name,
                }))}
                placeholder="Wyszukaj miejscówkę po nazwie..."
              />
            </div>
            <TextInput
              label="ID miejsca"
              value={placeForm.id}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, id: value }))}
              placeholder="np. wawel"
            />
            <TextInput
              label="Nazwa"
              value={placeForm.name}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, name: value }))}
              placeholder="np. Wawel"
            />
            <SelectInput
              label="Kategoria"
              value={placeForm.category}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, category: value }))}
              options={PLACE_CATEGORY_OPTIONS}
            />
            <TextInput
              label="Latitude"
              value={String(placeForm.latitude)}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, latitude: value }))}
              placeholder="np. 50.0614"
              type="number"
            />
            <TextInput
              label="Longitude"
              value={String(placeForm.longitude)}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, longitude: value }))}
              placeholder="np. 19.9366"
              type="number"
            />
            <SelectInput
              label="Status"
              value={placeForm.status}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, status: value }))}
              options={[
                { value: "visited", label: "Odwiedzone" },
                { value: "planned", label: "Do odwiedzenia" },
              ]}
            />
            <TextInput
              label="Podtytuł"
              value={placeForm.subtitle}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, subtitle: value }))}
              placeholder="Krótki podtytuł"
            />
            <TextInput
              label="Ocena"
              value={String(placeForm.rating)}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, rating: value }))}
              placeholder="np. 4.8"
              type="number"
            />

            <details className="rounded-xl border border-[#DCECF0] bg-[#F7FCFD] md:col-span-2 xl:col-span-3">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#007786]">
                Trasa i parametry szlaku
              </summary>
              <div className="grid gap-3 border-t border-[#DCECF0] p-4 md:grid-cols-2 xl:grid-cols-3">
                <TextInput
                  label="Start latitude"
                  value={String(placeForm.startLatitude)}
                  onChange={(value) =>
                    setPlaceForm((prev) => ({ ...prev, startLatitude: value }))
                  }
                  type="number"
                />
                <TextInput
                  label="Start longitude"
                  value={String(placeForm.startLongitude)}
                  onChange={(value) =>
                    setPlaceForm((prev) => ({ ...prev, startLongitude: value }))
                  }
                  type="number"
                />
                <TextInput
                  label="Koniec latitude"
                  value={String(placeForm.endLatitude)}
                  onChange={(value) =>
                    setPlaceForm((prev) => ({ ...prev, endLatitude: value }))
                  }
                  type="number"
                />
                <TextInput
                  label="Koniec longitude"
                  value={String(placeForm.endLongitude)}
                  onChange={(value) =>
                    setPlaceForm((prev) => ({ ...prev, endLongitude: value }))
                  }
                  type="number"
                />
                <TextInput
                  label="Dystans w 2 strony (km)"
                  value={String(placeForm.distanceKm)}
                  onChange={(value) =>
                    setPlaceForm((prev) => ({ ...prev, distanceKm: value }))
                  }
                  type="number"
                />
                <TextInput
                  label="Czas w 2 strony (h)"
                  value={String(placeForm.durationHours)}
                  onChange={(value) =>
                    setPlaceForm((prev) => ({ ...prev, durationHours: value }))
                  }
                  type="number"
                />
              </div>
            </details>

            <details className="rounded-xl border border-[#DCECF0] bg-[#F7FCFD] md:col-span-2 xl:col-span-3">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#007786]">
                Opisy i informacje praktyczne
              </summary>
              <div className="grid gap-3 border-t border-[#DCECF0] p-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="md:col-span-2 xl:col-span-3">
                  <TextArea
                    label="Notka"
                    value={placeForm.note}
                    onChange={(value) => setPlaceForm((prev) => ({ ...prev, note: value }))}
                    rows={2}
                  />
                </div>
                <div className="md:col-span-2 xl:col-span-3">
                  <TextArea
                    label="Opis"
                    value={placeForm.description}
                    onChange={(value) =>
                      setPlaceForm((prev) => ({ ...prev, description: value }))
                    }
                    rows={3}
                  />
                </div>
                <TextInput
                  label="Info"
                  value={placeForm.info}
                  onChange={(value) => setPlaceForm((prev) => ({ ...prev, info: value }))}
                />
                <TextInput
                  label="Bilet"
                  value={placeForm.ticket}
                  onChange={(value) => setPlaceForm((prev) => ({ ...prev, ticket: value }))}
                />
                <TextInput
                  label="Rezerwacja"
                  value={placeForm.reservation}
                  onChange={(value) =>
                    setPlaceForm((prev) => ({ ...prev, reservation: value }))
                  }
                />
                <TextInput
                  label="Płatność"
                  value={placeForm.paid}
                  onChange={(value) => setPlaceForm((prev) => ({ ...prev, paid: value }))}
                />
              </div>
            </details>
            <MediaFields
              media={placeMedia}
              onChange={setPlaceMedia}
              currentMedia={formIntent === "edit" ? selectedPlace : {}}
              showVideos={false}
            />
            <div className="grid gap-3 sm:grid-cols-2 md:col-span-2 xl:col-span-3">
              <ActionButton
                onClick={handleSavePlace}
                variant="primary"
                disabled={loading || !selectedDestination}
                className="w-full"
              >
                <Save className="h-4 w-4" />
                {formIntent === "create" ? "Dodaj miejscówkę" : "Zapisz zmiany"}
              </ActionButton>
              <ActionButton
                onClick={deletePlace}
                variant="danger"
                disabled={loading || !selectedPlace || formIntent === "create"}
                className="w-full"
              >
                <Trash2 className="h-4 w-4" />
                Usuń miejscówkę
              </ActionButton>
            </div>
          </div>
        </SectionCard>
        ) : null}
      </div>

      {status && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[1450] w-[min(360px,calc(100vw-2rem))] rounded-[1.2rem] border border-[#D5E2C8] bg-[#F4FAEE] px-4 py-3 text-sm text-[#4F6A2F] shadow-[0_18px_40px_rgba(36,32,26,0.10)] backdrop-blur">
          {status}
        </div>
      )}
    </section>
  );
}

