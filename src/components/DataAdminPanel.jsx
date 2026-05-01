import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import {
  deleteCountryById,
  deleteDestinationById,
  deletePlaceById,
  upsertCountry,
  upsertDestination,
  upsertPlace,
} from "../lib/supabaseTravelData";
import { replaceCover } from "../lib/storageMedia";
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
    <section className="theme-admin-card rounded-[1.75rem] border border-[#E6DED1] bg-white p-5 shadow-[0_16px_60px_rgba(34,31,25,0.05)]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#8A7F6C]">{title}</p>
          <p className="mt-2 text-sm leading-7 text-[#5E564B]">{subtitle}</p>
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
      <span className="mb-2 block text-sm font-medium text-[#4D463D]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B9AE9A]"
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
      <span className="mb-2 block text-sm font-medium text-[#4D463D]">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B9AE9A]"
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
          className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B9AE9A]"
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

function FileInput({ label, onChange, accept = "", helperText = "", fileName = "" }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#4D463D]">{label}</span>
      <input
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        className="block w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-[#1F1D1A] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#2C2924]"
      />
      {fileName ? (
        <span className="mt-2 block text-xs leading-5 text-[#5E564B]">
          Wybrany plik: {fileName}
        </span>
      ) : null}
      {helperText ? (
        <span className="mt-2 block text-xs leading-5 text-[#7A7164]">{helperText}</span>
      ) : null}
    </label>
  );
}

function ActionButton({ children, onClick, variant = "default", type = "button", disabled }) {
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
          ? "border-[#D8CCBB] bg-[#1F1D1A] text-white hover:bg-[#2C2924]"
          : "border-[#D8CCBB] bg-white text-[#1F1D1A] hover:bg-[#F8F2E9]"
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
  };
}

function toDestinationForm(destination) {
  return {
    id: destination?.id || "",
    name: destination?.name || "",
    area: destination?.area || "",
    video: destination?.video || "",
    summary: destination?.summary || "",
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
  const [placeCoverFile, setPlaceCoverFile] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

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
    setCountryForm(toCountryForm(selectedCountry));
  }, [selectedCountry?.id]);

  useEffect(() => {
    setDestinationForm(toDestinationForm(selectedDestination));
  }, [selectedDestination?.id]);

  useEffect(() => {
    setPlaceForm(toPlaceForm(selectedPlace));
    setPlaceCoverFile(null);
  }, [selectedPlace?.id]);

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
      setStatus(message);
    } catch (error) {
      setStatus(error.message || "Operacja na bazie danych nie powiodła się.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCountry = () =>
    runAction(
      () =>
        upsertCountry(
          {
            ...selectedCountry,
            ...countryForm,
            id: slugify(countryForm.id) || countryForm.id,
          },
          countries.findIndex((country) => country.id === selectedCountryId)
        ),
      "Zapisano zmiany kraju w Supabase.",
      () => ({
        countryId: slugify(countryForm.id) || countryForm.id,
      })
    );

  const handleSaveDestination = () =>
    runAction(
      () =>
        upsertDestination(
          selectedCountryId,
          {
            ...selectedDestination,
            ...destinationForm,
            id: slugify(destinationForm.id) || destinationForm.id,
          },
          selectedCountry?.destinations.findIndex(
            (destination) => destination.id === selectedDestinationId
          ) || 0
        ),
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

        await upsertPlace(
          selectedDestinationId,
          {
            ...selectedPlace,
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
          },
          selectedDestination?.places.findIndex((place) => place.id === selectedPlaceId) || 0
        );

        if (placeCoverFile && selectedCountryId && selectedDestinationId && nextPlaceId) {
          await replaceCover(selectedCountryId, selectedDestinationId, nextPlaceId, placeCoverFile);
        }
      },
      placeCoverFile
        ? "Zapisano zmiany miejscówki i wgrano cover do Supabase."
        : "Zapisano zmiany miejscówki w Supabase.",
      () => ({
        countryId: selectedCountryId,
        destinationId: selectedDestinationId,
        placeId: slugify(placeForm.id) || placeForm.id,
      })
    );

  const addCountry = () => {
    const nextId = `country-${Date.now()}`;
    runAction(
      () =>
        upsertCountry(
          {
            id: nextId,
            countryName: "Nowy kraj",
            status: "planned",
            year: "Planned",
            region: "",
            summary: "",
          },
          countries.length
        ),
      "Dodano nowy kraj do Supabase.",
      () => ({ countryId: nextId })
    );
  };

  const addDestination = () => {
    if (!selectedCountry) return;
    const nextId = `destination-${Date.now()}`;
    runAction(
      () =>
        upsertDestination(
          selectedCountryId,
          {
            id: nextId,
            name: "Nowe miasto",
            area: "",
            video: "",
            summary: "",
            itinerary: [],
            places: [],
          },
          selectedCountry.destinations.length
        ),
      "Dodano nową destynację do Supabase.",
      () => ({ countryId: selectedCountryId, destinationId: nextId })
    );
  };

  const addPlace = () => {
    if (!selectedDestination) return;
    const nextId = `place-${Date.now()}`;
    runAction(
      () =>
        upsertPlace(
          selectedDestinationId,
          {
            id: nextId,
            name: "Nowe miejsce",
            category: "city",
            coordinates: [0, 0],
            note: DEFAULT_PLACE_NOTE,
            status: "planned",
            subtitle: "",
            description: "",
            image: "",
            gallery: [],
            video: "",
            videos: [],
            rating: 4.5,
            info: "",
            ticket: "",
            reservation: "",
            paid: "",
            distanceKm: 0,
            durationHours: 0,
            startCoordinates: [],
            endCoordinates: [],
          },
          selectedDestination.places.length
        ),
      "Dodano nową miejscówkę do Supabase.",
      () => ({
        countryId: selectedCountryId,
        destinationId: selectedDestinationId,
        placeId: nextId,
      })
    );
  };

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

  const reloadData = () =>
    runAction(
      () => Promise.resolve(onReloadFromDatabase()),
      "Dane zostały przeładowane z Supabase.",
      (refreshedCountries) => {
        const nextCountry =
          refreshedCountries.find((country) => country.id === selectedCountryId) ||
          refreshedCountries[0];
        const nextDestination =
          nextCountry?.destinations.find((destination) => destination.id === selectedDestinationId) ||
          nextCountry?.destinations[0];
        const nextPlace =
          nextDestination?.places.find((place) => place.id === selectedPlaceId) ||
          nextDestination?.places[0];
        return {
          countryId: nextCountry?.id || "",
          destinationId: nextDestination?.id || "",
          placeId: nextPlace?.id || "",
        };
      }
    );

  return (
    <section className="theme-admin-shell grid gap-5">
      <div className="flex flex-wrap gap-3">
        <ActionButton onClick={reloadData} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          Przeładuj z bazy
        </ActionButton>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <SectionCard
          title="Country"
          subtitle="Wybierz i modyfikuj podstawowe dane kraju oraz jego status."
          action={
            <ActionButton onClick={addCountry} disabled={loading}>
              <Plus className="h-4 w-4" />
              Dodaj kraj
            </ActionButton>
          }
        >
          <div className="space-y-4">
            <SelectInput
              label="Wybrany kraj"
              value={selectedCountryId}
              onChange={setSelectedCountryId}
              options={countries.map((country) => ({
                value: country.id,
                label: country.countryName,
              }))}
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
            <div className="flex flex-wrap gap-3">
              <ActionButton onClick={handleSaveCountry} variant="primary" disabled={loading}>
                <Save className="h-4 w-4" />
                Zapisz kraj
              </ActionButton>
              <ActionButton onClick={deleteCountry} variant="danger" disabled={loading}>
                <Trash2 className="h-4 w-4" />
                Usuń kraj
              </ActionButton>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Destination"
          subtitle="Edytuj miasto lub destynację przypisaną do wybranego kraju."
          action={
            <ActionButton onClick={addDestination} disabled={loading || !selectedCountry}>
              <Plus className="h-4 w-4" />
              Dodaj miasto
            </ActionButton>
          }
        >
          <div className="space-y-4">
            <SelectInput
              label="Wybrana destynacja"
              value={selectedDestinationId}
              onChange={setSelectedDestinationId}
              options={(selectedCountry?.destinations || []).map((destination) => ({
                value: destination.id,
                label: destination.name,
              }))}
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
            <div className="flex flex-wrap gap-3">
              <ActionButton
                onClick={handleSaveDestination}
                variant="primary"
                disabled={loading || !selectedCountry}
              >
                <Save className="h-4 w-4" />
                Zapisz miasto
              </ActionButton>
              <ActionButton
                onClick={deleteDestination}
                variant="danger"
                disabled={loading || !selectedDestination}
              >
                <Trash2 className="h-4 w-4" />
                Usuń miasto
              </ActionButton>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Place"
          subtitle="Dodawaj i edytuj konkretne miejscówki wraz z koordynatami i opisami."
          action={
            <div className="flex flex-wrap gap-2">
              <ActionButton onClick={addPlace} disabled={loading || !selectedDestination}>
                <Plus className="h-4 w-4" />
                Dodaj miejscówkę
              </ActionButton>
              <ActionButton
                onClick={addMadeiraPrPlaces}
                disabled={loading || !selectedDestination}
              >
                <Plus className="h-4 w-4" />
                Dodaj wszystkie PR Madery
              </ActionButton>
              <ActionButton
                onClick={syncMadeiraPrPlaces}
                disabled={loading || !selectedDestination}
              >
                <RefreshCw className="h-4 w-4" />
                Napraw / zsynchronizuj PR Madery
              </ActionButton>
              <ActionButton
                onClick={syncMadeiraWorkbookCategories}
                disabled={loading || !selectedDestination}
              >
                <RefreshCw className="h-4 w-4" />
                Zsynchronizuj kategorie Madery
              </ActionButton>
            </div>
          }
        >
          <div className="space-y-4">
            <SearchableSelectInput
              label="Wybrane miejsce"
              value={selectedPlaceId}
              onChange={setSelectedPlaceId}
              options={(selectedDestination?.places || []).map((place) => ({
                value: place.id,
                label: place.name,
              }))}
              placeholder="Wyszukaj miejscowke po nazwie..."
            />
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
            <TextInput
              label="Start latitude"
              value={String(placeForm.startLatitude)}
              onChange={(value) =>
                setPlaceForm((prev) => ({ ...prev, startLatitude: value }))
              }
              placeholder="np. 32.7354"
              type="number"
            />
            <TextInput
              label="Start longitude"
              value={String(placeForm.startLongitude)}
              onChange={(value) =>
                setPlaceForm((prev) => ({ ...prev, startLongitude: value }))
              }
              placeholder="np. -16.8863"
              type="number"
            />
            <TextInput
              label="Koniec latitude"
              value={String(placeForm.endLatitude)}
              onChange={(value) =>
                setPlaceForm((prev) => ({ ...prev, endLatitude: value }))
              }
              placeholder="np. 32.7415"
              type="number"
            />
            <TextInput
              label="Koniec longitude"
              value={String(placeForm.endLongitude)}
              onChange={(value) =>
                setPlaceForm((prev) => ({ ...prev, endLongitude: value }))
              }
              placeholder="np. -16.8902"
              type="number"
            />
            <SelectInput
              label="Status"
              value={placeForm.status}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, status: value }))}
              options={[
                { value: "visited", label: "visited" },
                { value: "planned", label: "planned" },
              ]}
            />
            <TextInput
              label="Subtitle"
              value={placeForm.subtitle}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, subtitle: value }))}
              placeholder="Krótki podtytuł"
            />
            <TextArea
              label="Notka"
              value={placeForm.note}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, note: value }))}
              placeholder="Krótka notka o miejscu"
            />
            <TextArea
              label="Opis"
              value={placeForm.description}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, description: value }))}
              placeholder="Dłuższy opis miejsca"
            />
            <FileInput
              label="Cover miejsca"
              accept="image/*"
              fileName={placeCoverFile?.name || ""}
              onChange={setPlaceCoverFile}
              helperText="Mozesz od razu dodac nowy cover. Zostanie zapisany przy kliknieciu 'Zapisz miejscowke'."
            />
            <TextInput
              label="Info"
              value={placeForm.info}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, info: value }))}
              placeholder="np. Najlepiej rano"
            />
            <TextInput
              label="Bilet"
              value={placeForm.ticket}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, ticket: value }))}
              placeholder="np. 30 PLN"
            />
            <TextInput
              label="Rezerwacja"
              value={placeForm.reservation}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, reservation: value }))}
              placeholder="np. Wymagana online"
            />
            <TextInput
              label="Paid"
              value={placeForm.paid}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, paid: value }))}
              placeholder="np. Bezpłatne"
            />
            <TextInput
              label="Rating"
              value={String(placeForm.rating)}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, rating: value }))}
              placeholder="np. 4.8"
              type="number"
            />
            <TextInput
              label="Dystans w 2 strony (km)"
              value={String(placeForm.distanceKm)}
              onChange={(value) => setPlaceForm((prev) => ({ ...prev, distanceKm: value }))}
              placeholder="np. 11"
              type="number"
            />
            <TextInput
              label="Czas w 2 strony (h)"
              value={String(placeForm.durationHours)}
              onChange={(value) =>
                setPlaceForm((prev) => ({ ...prev, durationHours: value }))
              }
              placeholder="np. 4.5"
              type="number"
            />
            <div className="flex flex-wrap gap-3">
              <ActionButton
                onClick={handleSavePlace}
                variant="primary"
                disabled={loading || !selectedDestination}
              >
                <Save className="h-4 w-4" />
                Zapisz miejscówkę
              </ActionButton>
              <ActionButton
                onClick={deletePlace}
                variant="danger"
                disabled={loading || !selectedPlace}
              >
                <Trash2 className="h-4 w-4" />
                Usuń miejscówkę
              </ActionButton>
            </div>
          </div>
        </SectionCard>
      </div>

      {status && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[1450] w-[min(360px,calc(100vw-2rem))] rounded-[1.2rem] border border-[#D5E2C8] bg-[#F4FAEE] px-4 py-3 text-sm text-[#4F6A2F] shadow-[0_18px_40px_rgba(36,32,26,0.10)] backdrop-blur">
          {status}
        </div>
      )}
    </section>
  );
}
