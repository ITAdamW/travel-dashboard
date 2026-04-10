import { useEffect, useMemo, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Coffee,
  ExternalLink,
  Landmark,
  MapPin,
  Mountain,
  Route,
  Star,
  Waves,
  X,
} from "lucide-react";

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
  return [
    ...destination.places.map((place) => ({
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
    ...(destination.video
      ? [
          {
            id: `${destination.id}-video`,
            type: "video",
            title: "Video recap",
            subtitle: "Krotki film z calej destynacji.",
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
    places: places.filter((place) => place.category === key),
  }));
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

function FloatingToolbar({
  countries,
  selectedCountryId,
  selectedDestinationId,
  onOpenChangeDestination,
}) {
  const selectedCountry =
    countries.find((country) => country.id === selectedCountryId) || countries[0];
  const selectedDestination =
    selectedCountry.destinations.find(
      (destination) => destination.id === selectedDestinationId
    ) || selectedCountry.destinations[0];

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

function DestinationTabs({ destination, activeIndex, onPrev, onNext, onGoTo }) {
  const slides = useMemo(() => getStorySlides(destination), [destination]);
  const currentSlide = slides[activeIndex];
  const activePlace =
    currentSlide.type === "place"
      ? findPlaceById(destination, currentSlide.placeId)
      : null;
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
  const [galleryStart, setGalleryStart] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const visibleThumbs = galleryImages.slice(galleryStart, galleryStart + 4);
  const canUsePortal = typeof document !== "undefined";

  return (
    <>
      <div className="flex h-full min-h-[calc(100%-2rem)] flex-col rounded-[1.5rem] border border-[#E6DED1] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_18px_38px_rgba(34,31,25,0.12)] backdrop-blur">
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
          <div className="text-sm font-medium text-[#6B6255]">
            {activeIndex + 1} / {slides.length}
          </div>
        </div>

        <div className="mb-3">
          <select
            value={activeIndex}
            onChange={(e) => onGoTo(Number(e.target.value))}
            className="w-full rounded-xl border border-[#E5DCCF] bg-[#FBF8F2] px-3 py-2 text-sm text-[#4D463D]"
          >
            {slides.map((slide, index) => (
              <option key={slide.id} value={index}>
                {slide.type === "video" ? "Video" : slide.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
        {currentSlide.type === "video" ? (
          <div className="aspect-video overflow-hidden rounded-[1.1rem] bg-black">
            <iframe
              className="h-full w-full"
              src={destination.video}
              title={`${destination.name} video`}
              allowFullScreen
            />
          </div>
        ) : (
          <>
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
                  className="h-44 w-full object-cover"
                />
              </button>
            </div>
            <p className="mt-3 text-sm leading-7 text-[#4D463D] line-clamp-4">
              {currentSlide.description}
            </p>
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
                          className="h-14 w-full object-cover"
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
          </>
        )}
        </div>

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
  const activePlace = findPlaceById(destination, activePlaceId);

  return (
    <div className="theme-story-card overflow-hidden rounded-[2rem] border border-[#E6DED1] bg-white p-4 shadow-[0_18px_60px_rgba(34,31,25,0.06)]">
      <div className="relative overflow-hidden rounded-[1.6rem] border border-[#E8E0D3] bg-[radial-gradient(circle_at_top_left,rgba(107,122,82,0.08),transparent_35%),linear-gradient(180deg,#F3EEE5_0%,#ECE5D8_100%)] min-h-[860px]">
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
  const slides = useMemo(() => getStorySlides(destination), [destination]);
  const availableCategories = useMemo(
    () => countByCategory(destination.places).filter((item) => item.count > 0),
    [destination]
  );
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [activePlaceId, setActivePlaceId] = useState(destination.places[0]?.id || "");
  const [selectedCategory, setSelectedCategory] = useState(
    availableCategories[0]?.key || "beach"
  );
  const [destinationDialogOpen, setDestinationDialogOpen] = useState(false);
  const [pendingCountryId, setPendingCountryId] = useState(selectedCountryId);
  const [pendingDestinationId, setPendingDestinationId] =
    useState(selectedDestinationId);
  const effectiveSelectedCategory =
    availableCategories.find((item) => item.key === selectedCategory)?.key ||
    availableCategories[0]?.key ||
    "beach";

  const syncToSlide = (index) => {
    setActiveStoryIndex(index);
    const slide = slides[index];
    if (slide?.type === "place") setActivePlaceId(slide.placeId);
  };

  const handleSelectPlace = (placeId) => {
    setActivePlaceId(placeId);
    const place = findPlaceById(destination, placeId);
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

  return (
    <section className="theme-story-shell">
      <DestinationMapSurface
        countries={countries}
        selectedCountryId={selectedCountryId}
        selectedDestinationId={selectedDestinationId}
        onOpenChangeDestination={openDestinationDialog}
        destination={destination}
        activePlaceId={activePlaceId}
        selectedCategory={effectiveSelectedCategory}
        onSelectPlace={handleSelectPlace}
        storyOverlay={
          <DestinationTabs
            key={`${destination.id}-${activeStoryIndex}`}
            destination={destination}
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
              destination={destination}
              activePlaceId={activePlaceId}
            />
            <FloatingCategoryPicker
              availableCategories={availableCategories}
              selectedCategory={effectiveSelectedCategory}
              onSelectCategory={setSelectedCategory}
            />
            <FloatingCategoryPlaces
              destination={destination}
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
