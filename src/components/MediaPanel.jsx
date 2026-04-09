import { useEffect, useMemo, useState } from "react";
import { ImagePlus, RefreshCw, Trash2, Upload, Video } from "lucide-react";
import {
  listPlaceMedia,
  removeStorageObject,
  replaceCover,
  uploadGalleryFiles,
  uploadVideoFiles,
} from "../lib/storageMedia";

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

  const runAction = async (action, successMessage) => {
    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      await action();
      await refreshMedia();
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

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#4D463D]">Miejsce</span>
            <select
              value={selectedPlaceId}
              onChange={(e) => setSelectedPlaceId(e.target.value)}
              className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm"
            >
              {selectedDestination?.places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="theme-media-card mt-6 rounded-[1.4rem] border border-[#E8DFD2] bg-[#FBF8F2] p-4">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#8A7F6C]">
            Docelowa ścieżka
          </p>
          <p className="mt-2 break-all text-sm text-[#4D463D]">
            {selectedCountry?.id}/{selectedDestination?.id}/{selectedPlace?.id}
          </p>
        </div>

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
                  () =>
                    replaceCover(
                      selectedCountry.id,
                      selectedDestination.id,
                      selectedPlace.id,
                      file
                    ),
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
                  () =>
                    uploadGalleryFiles(
                      selectedCountry.id,
                      selectedDestination.id,
                      selectedPlace.id,
                      files
                    ),
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
                  () =>
                    uploadVideoFiles(
                      selectedCountry.id,
                      selectedDestination.id,
                      selectedPlace.id,
                      files
                    ),
                  "Pliki wideo zostały dodane."
                );
                e.target.value = "";
              }}
              className="theme-media-file block w-full rounded-xl bg-[#FBF8F2] px-3 py-2 text-sm text-[#5E564B]"
            />
          </label>
        </div>

        {status.message && (
          <div
            className={[
              "mt-6 rounded-[1rem] border px-4 py-3 text-sm",
              status.type === "error"
                ? "border-[#E3C7C1] bg-[#FFF3F0] text-[#8C4C43]"
                : "border-[#D5E2C8] bg-[#F4FAEE] text-[#4F6A2F]",
            ].join(" ")}
          >
            {status.message}
          </div>
        )}

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
                    () => removeStorageObject(item.bucket, item.path),
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
                        () => removeStorageObject(nextItem.bucket, nextItem.path),
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
                        () => removeStorageObject(nextItem.bucket, nextItem.path),
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
    </section>
  );
}
