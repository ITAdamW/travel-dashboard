import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { ExternalLink, Star } from "lucide-react";

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = points.map((p) => p.coordinates);
    map.fitBounds(bounds, { padding: [45, 45], maxZoom: 12 });
  }, [map, points]);
  return null;
}

function MiniWorldLocator({ destination }) {
  const lat = destination.places.reduce((sum, p) => sum + p.coordinates[0], 0) / destination.places.length;
  const lng = destination.places.reduce((sum, p) => sum + p.coordinates[1], 0) / destination.places.length;
  const left = Math.min(Math.max(((lng + 180) / 360) * 100, 8), 92);
  const top = Math.min(Math.max(((90 - lat) / 180) * 100, 8), 92);

  return (
    <div className="absolute bottom-4 right-4 z-[600] w-36 overflow-hidden rounded-2xl border border-[#D9CFBF] bg-white/90 p-3 shadow-[0_8px_20px_rgba(34,31,25,0.08)] backdrop-blur">
      <p className="text-[10px] uppercase tracking-[0.24em] text-[#8A7F6C]">World position</p>
      <div className="mt-2 relative h-20 rounded-xl bg-[linear-gradient(180deg,#EDE7DB_0%,#E5DED1_100%)]">
        <div className="absolute left-[8%] top-[20%] h-5 w-8 rounded-full bg-[#D3CAB9] opacity-80" />
        <div className="absolute left-[42%] top-[18%] h-6 w-10 rounded-full bg-[#D3CAB9] opacity-80" />
        <div className="absolute left-[67%] top-[38%] h-5 w-8 rounded-full bg-[#D3CAB9] opacity-80" />
        <div className="absolute left-[30%] top-[56%] h-6 w-14 rounded-full bg-[#D3CAB9] opacity-80" />
        <span className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#6B7A52] shadow" style={{ left: `${left}%`, top: `${top}%` }} />
      </div>
    </div>
  );
}

function mapsUrl(place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.coordinates[0]},${place.coordinates[1]}`;
}

export default function DestinationMapLeaflet({ destination, activePlaceId, onSelectPlace }) {
  const activePlace = destination.places.find((place) => place.id === activePlaceId) || destination.places[0];

  return (
    <div className="rounded-[2rem] border border-[#E6DED1] bg-white p-5 shadow-[0_16px_60px_rgba(34,31,25,0.05)]">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-[#8A7F6C]">Places map</p>
        <h3 className="mt-2 text-2xl font-semibold">Interactive destination map</h3>
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
                  eventHandlers={{ click: () => onSelectPlace(place.id) }}
                >
                  <Popup>
                    <div className="min-w-[180px]">
                      <p className="font-semibold text-[#1F1D1A]">{place.name}</p>
                      <div className="mt-2 flex items-center gap-2 text-sm text-[#6B6255]"><Star className="h-4 w-4 fill-current text-[#6B7A52]" /><span>{place.rating.toFixed(1)}</span></div>
                      <p className="mt-2 text-sm text-[#5B544A]">{place.info}</p>
                      <button onClick={() => window.open(mapsUrl(place), "_blank", "noopener,noreferrer")} className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#DCD1C0] bg-[#F8F4ED] px-3 py-1.5 text-xs text-[#3E382F]">
                        Nawiguj <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        <MiniWorldLocator destination={destination} />

        <div className="absolute left-1/2 top-6 z-[600] w-[330px] max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-[1.5rem] border border-[#E4DACA] bg-white/97 p-4 shadow-[0_10px_24px_rgba(34,31,25,0.10)] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-[#1F1D1A]">{activePlace.name}</p>
              <div className="mt-2 flex items-center gap-3 text-sm text-[#6B6255]">
                <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-current text-[#6B7A52]" /> {activePlace.rating.toFixed(1)}</span>
                <span>{activePlace.info}</span>
              </div>
            </div>
          </div>
          <button onClick={() => window.open(mapsUrl(activePlace), "_blank", "noopener,noreferrer")} className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#DCD1C0] bg-[#F8F4ED] px-3 py-1.5 text-xs text-[#3E382F] transition hover:bg-[#F2ECE2]">
            Nawiguj <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}