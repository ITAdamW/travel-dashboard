import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup as LeafletPopup,
  useMap,
} from "react-leaflet";
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  ExternalLink,
  Landmark,
  MapPin,
  Mountain,
  Coffee,
  Route,
  Star,
  Waves,
  X,
} from "lucide-react";

const fallbackImage =
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1400&q=80";

const categoryMeta = {
  beach: { label: "Plaże", icon: Waves },
  viewpoint: { label: "Punkty widokowe", icon: Mountain },
  cafe: { label: "Kawiarnie / relax", icon: Coffee },
  museum: { label: "Muzea / architektura", icon: Landmark },
  city: { label: "Miasto / spacer", icon: Route },
};

function mapsUrl(place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.coordinates[0]},${place.coordinates[1]}`;
}

function findPlaceById(destination, id) {
  return destination.places.find((place) => place.id === id) || destination.places[0];
}

function getStorySlides(destination) {
  return [
    ...destination.places.map((place) => ({
      id: `${place.id}-slide`,
      type: "place",
      placeId: place.id,
      title: place.name,
      subtitle: place.subtitle || place.note,
      description:
        place.description ||
        "To miejsce możesz później uzupełnić własnym opisem, wspomnieniem albo praktyczną notatką do planowania wyjazdu.",
      image: place.image || fallbackImage,
    })),
    ...(destination.video
      ? [
          {
            id: `${destination.id}-video`,
            type: "video",
            title: "Video recap",
            subtitle: "Krótki film z całej destynacji.",
          },
        ]
      : []),
  ];
}

function countByCategory(places) {
  return Object.keys(categoryMeta).map((key) => ({
    key,
    label: categoryMeta[key].label,
    count: places.filter((place) => place.category === key).length,
  }));
}

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(points.map((p) => p.coordinates), {
      padding: [45, 45],
      maxZoom: 12,
    });
  }, [map, points]);

  return null;
}

function PopupCard({ place, onClose }) {
  if (!place) return null;

  return (
    <div className="absolute left-1/2 top-6 z-[600] w-[340px] max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-[1.5rem] border border-[#E4DACA] bg-white/97 p-4 shadow-[0_10px_24px_rgba(34,31,25,0.10)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-[#1F1D1A]">{place.name}</p>
          <div className="mt-2 flex items-center gap-3 text-sm text-[#6B6255]">
            <span className="inline-flex items-center gap-1">
              <Star className="h-4 w-4 fill-current text-[#6B7A52]" />
              {place.rating?.toFixed?.(1) ?? place.rating ?? "—"}
            </span>
            <span>{place.info || "Najlepiej odwiedzić rano lub pod wieczór."}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full border border-[#E6DED1] bg-[#FBF8F2] p-2 text-[#6B6255] hover:bg-[#F2ECE2]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <button
        onClick={() => window.open(mapsUrl(place), "_blank", "noopener,noreferrer")}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#DCD1C0] bg-[#F8F4ED] px-3 py-1.5 text-xs text-[#3E382F] transition hover:bg-[#F2ECE2]"
      >
        Nawiguj <ExternalLink className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function DestinationMiniMap({ destination, activePlaceId, onSelectPlace }) {
  return (
    <div className="theme-story-card rounded-[2rem] border border-[#E6DED1] bg-white p-5 shadow-[0_16px_60px_rgba(34,31,25,0.05)]">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#8A7F6C]">
            Places map
          </p>
          <h3 className="mt-2 text-2xl font-semibold">Interactive destination map</h3>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-[#6B6255]">
          {Object.entries(categoryMeta).map(([key, meta]) => {
            const Icon = meta.icon;
            const exists = destination.places.some((place) => place.category === key);
            if (!exists) return null;

            return (
              <span
                key={key}
                className="theme-story-chip inline-flex items-center gap-1 rounded-full border border-[#E5DCCF] bg-[#FBF8F2] px-2.5 py-1.5"
              >
                <Icon className="h-3.5 w-3.5 text-[#6B7A52]" />
                {meta.label}
              </span>
            );
          })}
        </div>
      </div>

      <div className="relative aspect-[16/9] overflow-hidden rounded-[1.5rem] border border-[#E8E0D3] bg-[radial-gradient(circle_at_top_left,rgba(107,122,82,0.08),transparent_35%),linear-gradient(180deg,#F3EEE5_0%,#ECE5D8_100%)]">
        <div className="absolute inset-0 z-0 [filter:saturate(0.35)_sepia(0.15)_contrast(0.95)]">
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

              return (
                <CircleMarker
                  key={place.id}
                  center={place.coordinates}
                  radius={isActive ? 9 : 7}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 2,
                    fillColor: isActive ? "#2B2A27" : "#6B7A52",
                    fillOpacity: 1,
                  }}
                  eventHandlers={{
                    click: () => {
                      onSelectPlace(place.id);
                    },
                  }}
                >
                  <LeafletPopup>
                    <div className="min-w-[180px]">
                      <p className="font-semibold text-[#1F1D1A]">{place.name}</p>
                      <div className="mt-2 flex items-center gap-2 text-sm text-[#6B6255]">
                        <Star className="h-4 w-4 fill-current text-[#6B7A52]" />
                        <span>{place.rating?.toFixed?.(1) ?? place.rating ?? "—"}</span>
                      </div>
                      <p className="mt-2 text-sm text-[#5B544A]">
                        {place.info || "Najlepiej odwiedzić rano lub pod wieczór."}
                      </p>
                      <button
                        onClick={() =>
                          window.open(mapsUrl(place), "_blank", "noopener,noreferrer")
                        }
                        className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#DCD1C0] bg-[#F8F4ED] px-3 py-1.5 text-xs text-[#3E382F]"
                      >
                        Nawiguj <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </LeafletPopup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

function RatingStars({ rating }) {
  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${
            n <= Math.round(rating) ? "fill-[#6B7A52] text-[#6B7A52]" : "text-[#CFC7B7]"
          }`}
        />
      ))}
      <span className="ml-1 text-sm text-[#6B6255]">{rating.toFixed(1)}</span>
    </div>
  );
}

function DestinationInfo({ destination }) {
  const stats = countByCategory(destination.places);

  return (
    <div className="theme-story-card rounded-[2rem] border border-[#E6DED1] bg-white p-6 shadow-[0_16px_60px_rgba(34,31,25,0.05)]">
      <p className="text-xs uppercase tracking-[0.3em] text-[#8A7F6C]">
        Destination details
      </p>
      <h3 className="mt-2 text-2xl font-semibold">{destination.name}</h3>
      <p className="mt-4 text-[15px] leading-8 text-[#4D463D]">
        {destination.summary}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="theme-story-chip rounded-2xl border border-[#EEE6DA] bg-[#FBF8F2] p-4">
          <p className="text-sm text-[#8A7F6C]">Łącznie miejscówek</p>
          <p className="mt-1 text-2xl font-semibold">{destination.places.length}</p>
        </div>

        {stats
          .filter((item) => item.count > 0)
          .map((item) => (
            <div
              key={item.key}
              className="theme-story-chip rounded-2xl border border-[#EEE6DA] bg-[#FBF8F2] p-4"
            >
              <p className="text-sm text-[#8A7F6C]">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold">{item.count}</p>
            </div>
          ))}
      </div>
    </div>
  );
}

function DestinationTabs({ destination, activeIndex, onPrev, onNext, onGoTo }) {
  const slides = useMemo(() => getStorySlides(destination), [destination]);
  const currentSlide = slides[activeIndex];
  const activePlace =
    currentSlide.type === "place" ? findPlaceById(destination, currentSlide.placeId) : null;

  const galleryImages =
    activePlace?.gallery?.length
      ? activePlace.gallery
      : activePlace
      ? [activePlace.image || fallbackImage]
      : [];
  const placeVideos = activePlace?.videos?.length
    ? activePlace.videos
    : activePlace?.video
    ? [activePlace.video]
    : [];

  const [galleryStart, setGalleryStart] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    setGalleryStart(0);
    setLightboxOpen(false);
    setLightboxIndex(0);
  }, [activeIndex]);

  const visibleThumbs = galleryImages.slice(galleryStart, galleryStart + 4);

  return (
    <div className="theme-story-card rounded-[2rem] border border-[#E6DED1] bg-white p-6 shadow-[0_16px_60px_rgba(34,31,25,0.05)]">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.3em] text-[#8A7F6C]">
          Narrative cards & video
        </p>
        <h3 className="mt-2 text-2xl font-semibold">Selected place story</h3>
      </div>

      <div className="mb-4">
        <select
          value={activeIndex}
          onChange={(e) => onGoTo(Number(e.target.value))}
          className="w-full rounded-xl border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-2 text-sm text-[#4D463D]"
        >
          {slides.map((slide, index) => (
            <option key={slide.id} value={index}>
              {slide.type === "video" ? "Video" : slide.title}
            </option>
          ))}
        </select>
      </div>

      <div className="theme-story-card overflow-hidden rounded-[1.75rem] border border-[#EEE6DA] bg-[#FBF8F2]">
        <div className="grid min-h-[430px] md:grid-cols-[1.05fr_0.95fr]">
          <div className="relative min-h-[280px] md:min-h-[430px]">
            {currentSlide.type === "video" ? (
              <div className="flex h-full items-center justify-center bg-[#1E1C19] p-6 text-white">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10">
                    <Clapperboard className="h-7 w-7" />
                  </div>
                  <p className="text-xs uppercase tracking-[0.32em] text-white/60">
                    Video
                  </p>
                  <h4 className="mt-3 text-2xl font-semibold">{currentSlide.title}</h4>
                </div>
              </div>
            ) : (
              <img
                src={currentSlide.image || fallbackImage}
                alt={currentSlide.title}
                className="h-full w-full object-cover"
              />
            )}
          </div>

          <div className="flex flex-col justify-between p-6 md:p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#8A7F6C]">
                {destination.name}
              </p>
              <h4 className="mt-3 text-3xl font-semibold text-[#1F1D1A]">
                {currentSlide.title}
              </h4>
              <p className="mt-4 text-base font-medium text-[#6B7A52]">
                {currentSlide.subtitle}
              </p>

              {currentSlide.type === "video" ? (
                <div className="mt-6 aspect-video overflow-hidden rounded-[1.25rem] bg-black">
                  <iframe
                    className="h-full w-full"
                    src={destination.video}
                    title={`${destination.name} video`}
                    allowFullScreen
                  />
                </div>
              ) : (
                <>
                  {galleryImages.length > 0 && (
                    <div className="theme-story-card mt-5 rounded-[1.25rem] border border-[#E8DFD2] bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">
                          Gallery
                        </p>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setGalleryStart((prev) => Math.max(prev - 1, 0))}
                            className="theme-story-nav rounded-full border border-[#E4DBCD] bg-[#FBF8F2] p-1.5 text-[#3A352E]"
                            disabled={galleryStart === 0}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() =>
                              setGalleryStart((prev) =>
                                Math.min(prev + 1, Math.max(galleryImages.length - 4, 0))
                              )
                            }
                            className="theme-story-nav rounded-full border border-[#E4DBCD] bg-[#FBF8F2] p-1.5 text-[#3A352E]"
                            disabled={galleryStart >= Math.max(galleryImages.length - 4, 0)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-4 gap-2">
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
                                className="h-16 w-full object-cover"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {placeVideos.length > 0 && (
                    <div className="theme-story-card mt-5 rounded-[1.25rem] border border-[#E8DFD2] bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">
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

                  <div className="mt-5">
                    <RatingStars rating={activePlace?.rating || 4.5} />
                  </div>

                  <p className="mt-5 text-[15px] leading-8 text-[#4D463D]">
                    {currentSlide.description}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="theme-story-chip rounded-2xl border border-[#E8DFD2] bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">
                        Info
                      </p>
                      <p className="mt-2 text-sm text-[#4D463D]">
                        {activePlace?.info || "Najlepiej odwiedzić rano lub pod wieczór."}
                      </p>
                    </div>

                    <div className="theme-story-chip rounded-2xl border border-[#E8DFD2] bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">
                        Bilet / rezerwacja
                      </p>
                      <p className="mt-2 text-sm text-[#4D463D]">
                        {activePlace?.ticket || "Brak informacji"} ·{" "}
                        {activePlace?.reservation || "Nie wymaga rezerwacji"}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-[#E8DFD2] pt-5 text-sm text-[#6B6255]">
              <div className="flex items-center gap-2">
                <button
                  onClick={onPrev}
                  className="theme-story-nav rounded-full border border-[#E4DBCD] bg-[#FBF8F2] p-2 text-[#3A352E] transition hover:bg-[#F2ECE2]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={onNext}
                  className="theme-story-nav rounded-full border border-[#E4DBCD] bg-[#FBF8F2] p-2 text-[#3A352E] transition hover:bg-[#F2ECE2]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="text-sm font-medium">
                {activeIndex + 1} / {slides.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {lightboxOpen && galleryImages.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute right-6 top-6 rounded-full border border-white/20 bg-white/10 p-2 text-white"
          >
            <X className="h-5 w-5" />
          </button>

          <button
            onClick={() =>
              setLightboxIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length)
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
        </div>
      )}
    </div>
  );
}

export default function StoryPanel({ destination }) {
  const slides = useMemo(() => getStorySlides(destination), [destination]);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [activePlaceId, setActivePlaceId] = useState(destination.places[0]?.id || "");

  useEffect(() => {
    setActiveStoryIndex(0);
    setActivePlaceId(destination.places[0]?.id || "");
  }, [destination.id]);

  const syncToSlide = (index) => {
    setActiveStoryIndex(index);
    const slide = slides[index];
    if (slide?.type === "place") {
      setActivePlaceId(slide.placeId);
    }
  };

  const handleSelectPlace = (placeId) => {
    setActivePlaceId(placeId);
    const idx = slides.findIndex((slide) => slide.placeId === placeId);
    if (idx >= 0) setActiveStoryIndex(idx);
  };

  return (
    <section className="theme-story-shell grid gap-5">
      <DestinationMiniMap
        destination={destination}
        activePlaceId={activePlaceId}
        onSelectPlace={handleSelectPlace}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.72fr_1.28fr]">
        <DestinationInfo destination={destination} />
        <DestinationTabs
          destination={destination}
          activeIndex={activeStoryIndex}
          onPrev={() => syncToSlide((activeStoryIndex - 1 + slides.length) % slides.length)}
          onNext={() => syncToSlide((activeStoryIndex + 1) % slides.length)}
          onGoTo={syncToSlide}
        />
      </div>
    </section>
  );
}
