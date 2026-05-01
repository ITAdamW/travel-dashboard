import { useEffect, useMemo, useState } from "react";
import { ImagePlus, RefreshCw, Trash2, Upload, Video } from "lucide-react";
import {
  IMAGE_BUCKET,
  listPlaceMedia,
  migrateRemoteImagesToStorage,
  removeStorageObject,
  replaceCover,
  uploadGalleryFiles,
  uploadVideoFiles,
} from "../lib/storageMedia";
import { upsertPlace } from "../lib/supabaseTravelData";

function FileCard({ item, type, onDelete }) {
  return (
    <div className="theme-media-card overflow-hidden rounded-[1.25rem] border border-[#E8DFD2] bg-white">
      {type === "video" ? (
        <video src={item.url} controls className="aspect-video w-full bg-black object-cover" />
      ) : (
        <img src={item.url} alt={item.name} className="aspect-[4/3] w-full object-cover" />
      )}

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#1F1D1A]">{item.name}</p>
          <p className="mt-1 text-xs text-[#8A7F6C]">{item.path}</p>
        </div>

        <button
          onClick={() => onDelete(item)}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#E3D7C8] bg-[#FBF8F2] px-3 py-2 text-xs text-[#4D463D] transition hover:bg-[#F3ECE2]"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Usuń
        </button>
      </div>
    </div>
  );
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function SearchableSelectInput({ label, value, onChange, options, placeholder = "Szukaj..." }) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value) || null;
  const [inputState, setInputState] = useState({
    ownerValue: value,
    query: selectedOption?.label || "",
  });
  const query =
    inputState.ownerValue === value ? inputState.query : selectedOption?.label || "";

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
            setInputState({ ownerValue: value, query: e.target.value });
            setOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false);
              setInputState({
                ownerValue: value,
                query: selectedOption?.label || "",
              });
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
                      setInputState({ ownerValue: option.value, query: option.label });
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

function isStorageImageUrl(url) {
  return typeof url === "string" && url.includes(`/storage/v1/object/public/${IMAGE_BUCKET}/`);
}

export default function MediaPanel({ countries, onMediaChanged }) {
  const [selectedCountryId, setSelectedCountryId] = useState(countries[0]?.id || "");
  const [selectedDestinationId, setSelectedDestinationId] = useState(
    countries[0]?.destinations[0]?.id || ""
  );
  const [selectedPlaceId, setSelectedPlaceId] = useState(
    countries[0]?.destinations[0]?.places[0]?.id || ""
  );
  const [media, setMedia] = useState({ cover: null, gallery: [], videos: [] });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const selectedCountry = useMemo(
    () => countries.find((country) => country.id === selectedCountryId) || countries[0],
    [countries, selectedCountryId]
  );

  const selectedDestination =
    selectedCountry?.destinations.find((destination) => destination.id === selectedDestinationId) ||
    selectedCountry?.destinations[0];

  const selectedPlace =
    selectedDestination?.places.find((place) => place.id === selectedPlaceId) ||
    selectedDestination?.places[0];
  const dbImageUrls = useMemo(
    () =>
      [
        ...new Set(
          [selectedPlace?.image, ...(selectedPlace?.gallery || [])].filter(
            (url) => url && !isStorageImageUrl(url)
          )
        ),
      ],
    [selectedPlace]
  );

  useEffect(() => {
    setSelectedDestinationId(selectedCountry?.destinations[0]?.id || "");
  }, [selectedCountryId]);

  useEffect(() => {
    setSelectedPlaceId(selectedDestination?.places[0]?.id || "");
  }, [selectedDestinationId]);

  const refreshMedia = async () => {
    if (!selectedCountry || !selectedDestination || !selectedPlace) return;

    setLoading(true);
    try {
      const nextMedia = await listPlaceMedia(
        selectedCountry.id,
        selectedDestination.id,
        selectedPlace.id
      );
      setMedia(nextMedia);
      setStatus({ type: "", message: "" });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Nie udało się pobrać mediów z Supabase Storage.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshMedia();
  }, [selectedCountry?.id, selectedDestination?.id, selectedPlace?.id]);

  const persistPlaceMedia = async (nextMediaState) => {
    if (!selectedDestination || !selectedPlace) return;

    await upsertPlace(
      selectedDestination.id,
      {
        ...selectedPlace,
        coordinates: selectedPlace.coordinates,
        image: nextMediaState.cover?.url || "",
        gallery: nextMediaState.gallery.map((item) => item.url),
        video: nextMediaState.videos[0]?.url || "",
        videos: nextMediaState.videos.map((item) => item.url),
      },
      selectedDestination.places.findIndex((place) => place.id === selectedPlace.id)
    );
  };

  const runAction = async (action, successMessage) => {
    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const nextMediaState = await action();
      if (nextMediaState) {
        setMedia(nextMediaState);
        await persistPlaceMedia(nextMediaState);
      } else {
        await refreshMedia();
      }
      await onMediaChanged?.();
      setStatus({ type: "success", message: successMessage });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Operacja na mediach nie powiodła się.",
      });
      setLoading(false);
    }
  };

  const migrateDbImagesForSelectedPlace = async () => {
    if (!selectedCountry || !selectedDestination || !selectedPlace) return;

    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const result = await migrateRemoteImagesToStorage(
        selectedCountry.id,
        selectedDestination.id,
        selectedPlace.id,
        dbImageUrls
      );

      await upsertPlace(
        selectedDestination.id,
        {
          ...selectedPlace,
          coordinates: selectedPlace.coordinates,
          image: result.uploadedImages[0]?.url || "",
          gallery: result.uploadedImages.slice(1).map((item) => item.url),
        },
        selectedDestination.places.findIndex((place) => place.id === selectedPlace.id)
      );

      setMedia({
        cover: result.uploadedImages[0] || null,
        gallery: result.uploadedImages.slice(1),
        videos: [],
      });
      await onMediaChanged?.();

      setStatus({
        type: result.uploadedCount > 0 ? "success" : "error",
        message:
          result.uploadedCount > 0
            ? result.failedUrls.length
              ? `Przeniesiono ${result.uploadedCount} zdjec do Storage, a niedostepne linki usunieto z bazy.`
              : `Przeniesiono ${result.uploadedCount} zdjec do Storage i wyczyszczono stare linki z bazy.`
            : "Nie udalo sie pobrac zdjec z linkow, wiec stare odwolania zostaly usuniete z bazy.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Nie udalo sie zmigrowac zdjec tego miejsca.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="theme-media-shell grid gap-5 lg:grid-cols-[0.76fr_1.24fr]">
      <aside className="theme-media-card rounded-[2rem] border border-[#E6DED1] bg-white p-6 shadow-[0_16px_60px_rgba(34,31,25,0.05)]">
        <p className="text-xs uppercase tracking-[0.3em] text-[#8A7F6C]">Media admin</p>
        <h2 className="mt-2 text-3xl font-semibold">Upload i modyfikacja plików</h2>
        <p className="mt-3 text-sm leading-7 text-[#5E564B]">
          Pliki zapisują się w bucketach `travel-images` i `travel-videos` według
          ścieżki `country/destination/place`.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#4D463D]">Kraj</span>
            <select
              value={selectedCountryId}
              onChange={(e) => setSelectedCountryId(e.target.value)}
              className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm"
            >
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.countryName}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#4D463D]">Destynacja</span>
            <select
              value={selectedDestinationId}
              onChange={(e) => setSelectedDestinationId(e.target.value)}
              className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm"
            >
              {selectedCountry?.destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.name}
                </option>
              ))}
            </select>
          </label>

          <SearchableSelectInput
            label="Miejsce"
            value={selectedPlaceId}
            onChange={setSelectedPlaceId}
            options={(selectedDestination?.places || []).map((place) => ({
              value: place.id,
              label: place.name,
            }))}
            placeholder="Wyszukaj miejscowke po nazwie..."
          />
        </div>

        <div className="theme-media-card mt-6 rounded-[1.4rem] border border-[#E8DFD2] bg-[#FBF8F2] p-4">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#8A7F6C]">
            Docelowa ścieżka
          </p>
          <p className="mt-2 break-all text-sm text-[#4D463D]">
            {selectedCountry?.id}/{selectedDestination?.id}/{selectedPlace?.id}
          </p>
        </div>

        {dbImageUrls.length > 0 && (
          <div className="theme-media-card mt-6 rounded-[1.4rem] border border-[#E8DFD2] bg-[#FBF8F2] p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#8A7F6C]">
              Zdjecia poza Storage
            </p>
            <p className="mt-2 text-sm leading-6 text-[#4D463D]">
              To miejsce ma jeszcze zdjecia zapisane jako linki w bazie. Mozesz je
              przeniesc do Storage, a stare odwolania z bazy zostana wyczyszczone.
            </p>
            <button
              onClick={migrateDbImagesForSelectedPlace}
              disabled={loading}
              className="theme-media-button mt-4 inline-flex items-center gap-2 rounded-full border border-[#D8CCBB] bg-white px-4 py-2.5 text-sm font-medium text-[#1F1D1A] transition hover:bg-[#F8F2E9] disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              Przenies do Storage
            </button>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <label className="theme-media-card block rounded-[1.3rem] border border-[#E8DFD2] bg-[#FBF8F2] p-4">
            <span className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[#1F1D1A]">
              <ImagePlus className="h-4 w-4 text-[#6B7A52]" />
              Cover
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file || !selectedCountry || !selectedDestination || !selectedPlace) return;
                runAction(
                  async () => {
                    const cover = await replaceCover(
                      selectedCountry.id,
                      selectedDestination.id,
                      selectedPlace.id,
                      file
                    );
                    return { cover, gallery: media.gallery, videos: media.videos };
                  },
                  "Cover został zaktualizowany."
                );
                e.target.value = "";
              }}
              className="theme-media-file block w-full rounded-xl bg-[#FBF8F2] px-3 py-2 text-sm text-[#5E564B]"
            />
          </label>

          <label className="theme-media-card block rounded-[1.3rem] border border-[#E8DFD2] bg-[#FBF8F2] p-4">
            <span className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[#1F1D1A]">
              <Upload className="h-4 w-4 text-[#6B7A52]" />
              Galeria
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (!files.length || !selectedCountry || !selectedDestination || !selectedPlace)
                  return;
                runAction(
                  async () => {
                    const uploaded = await uploadGalleryFiles(
                      selectedCountry.id,
                      selectedDestination.id,
                      selectedPlace.id,
                      files
                    );
                    return {
                      cover: media.cover,
                      gallery: [...media.gallery, ...uploaded],
                      videos: media.videos,
                    };
                  },
                  "Zdjęcia galerii zostały dodane."
                );
                e.target.value = "";
              }}
              className="theme-media-file block w-full rounded-xl bg-[#FBF8F2] px-3 py-2 text-sm text-[#5E564B]"
            />
          </label>

          <label className="theme-media-card block rounded-[1.3rem] border border-[#E8DFD2] bg-[#FBF8F2] p-4">
            <span className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[#1F1D1A]">
              <Video className="h-4 w-4 text-[#6B7A52]" />
              Wideo
            </span>
            <input
              type="file"
              accept="video/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (!files.length || !selectedCountry || !selectedDestination || !selectedPlace)
                  return;
                runAction(
                  async () => {
                    const uploaded = await uploadVideoFiles(
                      selectedCountry.id,
                      selectedDestination.id,
                      selectedPlace.id,
                      files
                    );
                    return {
                      cover: media.cover,
                      gallery: media.gallery,
                      videos: [...media.videos, ...uploaded],
                    };
                  },
                  "Pliki wideo zostały dodane."
                );
                e.target.value = "";
              }}
              className="theme-media-file block w-full rounded-xl bg-[#FBF8F2] px-3 py-2 text-sm text-[#5E564B]"
            />
          </label>
        </div>

        <button
          onClick={refreshMedia}
          disabled={loading}
          className="theme-media-button mt-6 inline-flex items-center gap-2 rounded-full border border-[#D8CCBB] bg-white px-4 py-2.5 text-sm font-medium text-[#1F1D1A] transition hover:bg-[#F8F2E9] disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Odśwież media
        </button>
      </aside>

      <div className="theme-media-card rounded-[2rem] border border-[#E6DED1] bg-white p-6 shadow-[0_16px_60px_rgba(34,31,25,0.05)]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#8A7F6C]">Preview</p>
            <h3 className="mt-2 text-2xl font-semibold">{selectedPlace?.name}</h3>
          </div>
          <span className="theme-media-status rounded-full border border-[#E3D9CA] bg-[#F8F4ED] px-4 py-2 text-xs text-[#6B6255]">
            {loading ? "Ładowanie..." : "Gotowe"}
          </span>
        </div>

        <div className="space-y-8">
          <div>
            <h4 className="mb-3 text-lg font-medium">Cover</h4>
            {media.cover ? (
              <FileCard
                item={media.cover}
                type="image"
                onDelete={(item) =>
                  runAction(
                    async () => {
                      await removeStorageObject(item.bucket, item.path);
                      return {
                        cover: null,
                        gallery: media.gallery,
                        videos: media.videos,
                      };
                    },
                    "Cover został usunięty."
                  )
                }
              />
            ) : (
              <div className="theme-media-card rounded-[1.25rem] border border-dashed border-[#DDD2C3] bg-[#FBF8F2] px-5 py-8 text-sm text-[#7C7263]">
                Brak covera w Storage dla tego miejsca.
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-3 text-lg font-medium">Galeria</h4>
            {media.gallery.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {media.gallery.map((item) => (
                  <FileCard
                    key={item.path}
                    item={item}
                    type="image"
                    onDelete={(nextItem) =>
                      runAction(
                        async () => {
                          await removeStorageObject(nextItem.bucket, nextItem.path);
                          return {
                            cover: media.cover,
                            gallery: media.gallery.filter((entry) => entry.path !== nextItem.path),
                            videos: media.videos,
                          };
                        },
                        "Zdjęcie zostało usunięte."
                      )
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="theme-media-card rounded-[1.25rem] border border-dashed border-[#DDD2C3] bg-[#FBF8F2] px-5 py-8 text-sm text-[#7C7263]">
                Brak zdjęć galerii w Storage dla tego miejsca.
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-3 text-lg font-medium">Wideo</h4>
            {media.videos.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {media.videos.map((item) => (
                  <FileCard
                    key={item.path}
                    item={item}
                    type="video"
                    onDelete={(nextItem) =>
                      runAction(
                        async () => {
                          await removeStorageObject(nextItem.bucket, nextItem.path);
                          return {
                            cover: media.cover,
                            gallery: media.gallery,
                            videos: media.videos.filter((entry) => entry.path !== nextItem.path),
                          };
                        },
                        "Wideo zostało usunięte."
                      )
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="theme-media-card rounded-[1.25rem] border border-dashed border-[#DDD2C3] bg-[#FBF8F2] px-5 py-8 text-sm text-[#7C7263]">
                Brak wideo w Storage dla tego miejsca.
              </div>
            )}
          </div>
        </div>
      </div>

      {(status.message || loading) && (
        <div
          className={[
            "pointer-events-none fixed bottom-6 right-6 z-[1450] w-[min(360px,calc(100vw-2rem))] rounded-[1.2rem] border px-4 py-3 text-sm shadow-[0_18px_40px_rgba(36,32,26,0.10)] backdrop-blur",
            status.message
              ? status.type === "error"
                ? "border-[#E3C7C1] bg-[#FFF3F0] text-[#8C4C43]"
                : "border-[#D5E2C8] bg-[#F4FAEE] text-[#4F6A2F]"
              : "border-[#E7DED2] bg-white/92 text-[#6B6255]",
          ].join(" ")}
        >
          {status.message || "Ladowanie mediow..."}
        </div>
      )}
    </section>
  );
}
