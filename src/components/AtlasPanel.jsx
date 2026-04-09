import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const statusStyles = {
  visited: "bg-[#6B7A52] text-white border-[#6B7A52]",
  planned: "bg-[#E7E2D8] text-[#2B2A27] border-[#CFC7B7]",
};

const countryCodeMap = {
  Portugal: "pt",
  Spain: "es",
  France: "fr",
  Italy: "it",
  Czechia: "cz",
  "Czech Republic": "cz",
  Austria: "at",
  Poland: "pl",
  Hungary: "hu",
  Greece: "gr",
  Malta: "mt",
};

function EuropeViewport() {
  const map = useMap();

  useEffect(() => {
    map.setView([49.2, 14.5], 4);
    setTimeout(() => {
      map.invalidateSize();
    }, 300);
  }, [map]);

  return null;
}

function AtlasLeafletMap({ countries, selectedCountryId, onSelectCountry }) {
  const [geojsonData, setGeojsonData] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/europe.geojson`)
      .then((res) => res.json())
      .then((data) => setGeojsonData(data))
      .catch((err) => console.error("GeoJSON fetch error:", err));
  }, []);

  const countryById = useMemo(
    () => Object.fromEntries(countries.map((c) => [c.id, c])),
    [countries]
  );

  const styleFeature = (feature) => {
    const name = feature?.properties?.NAME || feature?.properties?.name;
    const mappedId = countryCodeMap[name];
    const country = mappedId ? countryById[mappedId] : null;
    const isSelected = country?.id === selectedCountryId;

    const fill = country
      ? isSelected
        ? "#22201C"
        : country.status === "visited"
        ? "#6B7A52"
        : "#CBD4BE"
      : "#EAE3D7";

    return {
      fillColor: fill,
      weight: isSelected ? 2.4 : 1.1,
      opacity: 1,
      color: "#FFFDF8",
      fillOpacity: 1,
    };
  };

  const onEachFeature = (feature, layer) => {
    const name = feature?.properties?.NAME || feature?.properties?.name;
    const mappedId = countryCodeMap[name];
    const country = mappedId ? countryById[mappedId] : null;

    if (!country) return;

    layer.on({
      click: () => onSelectCountry(country.id),
      mouseover: () => {
        layer.setStyle({
          weight: 2.1,
          color: "#FFFDF8",
          fillOpacity: 0.92,
        });
      },
      mouseout: () => {
        const isSelected = country.id === selectedCountryId;
        const fill = isSelected
          ? "#22201C"
          : country.status === "visited"
          ? "#6B7A52"
          : "#CBD4BE";

        layer.setStyle({
          fillColor: fill,
          weight: isSelected ? 2.4 : 1.1,
          opacity: 1,
          color: "#FFFDF8",
          fillOpacity: 1,
        });
      },
    });

    layer.bindTooltip(country.countryName, {
      sticky: true,
      direction: "top",
    });
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "480px",
        overflow: "hidden",
        borderRadius: "32px",
        border: "1px solid rgba(231, 222, 210, 0.95)",
        background:
          "radial-gradient(circle at top left, rgba(107,122,82,0.08), transparent 26%), rgba(255,255,255,0.55)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.65), 0 12px 30px rgba(34,31,25,0.05)",
      }}
    >
      <MapContainer
        center={[49.2, 14.5]}
        zoom={4}
        minZoom={3}
        maxZoom={7}
        scrollWheelZoom={true}
        zoomControl={true}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <EuropeViewport />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {geojsonData && (
          <GeoJSON
            data={geojsonData}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  );
}

function PlaceRow({ place, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="w-full rounded-[1.2rem] border border-[#EAE1D5] bg-white px-4 py-4 text-left transition duration-200 hover:border-[#DCCFBD] hover:bg-[#FCFAF6] hover:shadow-[0_8px_18px_rgba(34,31,25,0.04)]"
    >
      <p className="font-medium text-[#1F1D1A]">{place.name}</p>
      <p className="mt-2 text-sm leading-6 text-[#5B544A]">{place.note}</p>
    </button>
  );
}

function PlacesListByDestination({
  destinations,
  selectedDestinationId,
  onSelectDestination,
  onOpenPlace,
}) {
  const [openIds, setOpenIds] = useState([]);

  const toggle = (id) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex-1 overflow-hidden rounded-[1.6rem] border border-[#E8DFD3] bg-[linear-gradient(180deg,#FBF8F2_0%,#F7F1E7_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#8A7F6C]">
            Collection
          </p>
          <h3 className="mt-1 font-medium text-[#1F1D1A]">
            Places worth visiting
          </h3>
        </div>
        <span className="rounded-full border border-[#E2D7C8] bg-white px-3 py-1 text-xs text-[#7E7464]">
          Open in Panel 2
        </span>
      </div>

      <div className="h-[410px] space-y-4 overflow-y-auto pr-1">
        {destinations.map((destination) => {
          const isSelected = destination.id === selectedDestinationId;
          const isOpen = openIds.includes(destination.id);

          return (
            <div
              key={destination.id}
              className="rounded-[1.45rem] border border-[#E7DED2] bg-white p-4 shadow-[0_4px_14px_rgba(34,31,25,0.025)]"
            >
              <button
                onClick={() => {
                  onSelectDestination(destination.id);
                  toggle(destination.id);
                }}
                className={cn(
                  "mb-3 flex w-full items-center justify-between rounded-[1.1rem] border px-4 py-3 text-left transition",
                  isSelected
                    ? "border-[#D8CCBB] bg-[#F8F2E9]"
                    : "border-[#EFE7DB] bg-white hover:bg-[#F8F2E9]"
                )}
              >
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#8A7F6C]">
                    Destination
                  </p>
                  <p className="mt-2 text-lg font-medium text-[#1F1D1A]">
                    {destination.name}
                  </p>
                  <p className="mt-1 text-sm text-[#6B6255]">
                    {destination.area}
                  </p>
                </div>
                <span className="rounded-full border border-[#E5DCCF] bg-white px-2.5 py-1 text-sm text-[#8A7F6C]">
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {isOpen && (
                <div className="space-y-3">
                  {destination.places.map((place) => (
                    <PlaceRow
                      key={place.id}
                      place={place}
                      onOpen={() => onOpenPlace(destination.id, place.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AtlasPanel({
  countries,
  selectedCountry,
  selectedDestinationId,
  onSelectCountry,
  onSelectDestination,
  onOpenPlace,
}) {
  return (
    <section className="grid min-h-[calc(100vh-7rem)] grid-cols-1 gap-4 overflow-hidden rounded-[2.2rem] border border-[#E6DED1] bg-[linear-gradient(180deg,#FBF8F2_0%,#F6F1E7_100%)] p-4 shadow-[0_22px_80px_rgba(34,31,25,0.06)] md:grid-cols-[1.45fr_0.82fr] md:p-6">
      <div className="relative rounded-[2rem] border border-[#E8E0D3] bg-[radial-gradient(circle_at_top_left,_rgba(107,122,82,0.12),_transparent_28%),linear-gradient(180deg,_#F7F3EC_0%,_#F2ECE2_100%)] p-4 md:p-6">
        <div className="mb-5">
          <p className="mb-2 text-xs uppercase tracking-[0.35em] text-[#8A7F6C]">
            Travel Atlas
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1F1D1A] md:text-5xl">
            World map, zoomed into Europe
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#5E564B]">
            Kliknij państwo na mapie albo wybierz je z filtra, aby przejrzeć
            destynacje i zapisane miejsca warte odwiedzenia.
          </p>

          <div className="mt-5 flex flex-wrap items-stretch gap-3">
            <div className="flex min-h-[96px] min-w-[235px] flex-col justify-center rounded-[1.25rem] border border-[#E5DCCF] bg-white/78 px-4 py-3 backdrop-blur shadow-[0_8px_18px_rgba(34,31,25,0.03)]">
              <p className="text-[10px] uppercase tracking-[0.26em] text-[#8A7F6C]">
                Country filter
              </p>
              <select
                value={selectedCountry.id}
                onChange={(e) => onSelectCountry(e.target.value)}
                className="mt-2 rounded-xl border border-[#E5DCCF] bg-[#FBF8F2] px-3 py-2 text-sm text-[#3D382F] outline-none"
              >
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.countryName}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-[#6B6255]">
                {countries.length} countries available
              </p>
            </div>

            <div className="flex min-h-[96px] min-w-[235px] flex-col justify-center rounded-[1.25rem] border border-[#E5DCCF] bg-white/78 px-4 py-3 backdrop-blur shadow-[0_8px_18px_rgba(34,31,25,0.03)]">
              <p className="text-[10px] uppercase tracking-[0.26em] text-[#8A7F6C]">
                Selected country
              </p>
              <p className="mt-1 font-medium text-[#1F1D1A]">
                {selectedCountry.countryName}
              </p>
              <p className="mt-2 text-sm text-[#6B6255]">
                {selectedCountry.destinations.length} destination
                {selectedCountry.destinations.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        <AtlasLeafletMap
          countries={countries}
          selectedCountryId={selectedCountry.id}
          onSelectCountry={onSelectCountry}
        />

        <div className="pointer-events-none absolute bottom-6 left-6 z-[500] rounded-[1.2rem] border border-[#E5DCCF] bg-white/90 px-4 py-3 shadow-[0_10px_24px_rgba(36,32,26,0.05)] backdrop-blur">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#8A7F6C]">
            Legend
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#4A4338]">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#6B7A52]" />
              Visited
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#CBD4BE]" />
              Planned
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#22201C]" />
              Selected
            </span>
          </div>
        </div>
      </div>

      <aside className="flex h-full flex-col rounded-[2rem] border border-[#E8E0D3] bg-white/76 p-4 backdrop-blur shadow-[0_14px_40px_rgba(34,31,25,0.03)] md:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-[#8A7F6C]">
              Selected country
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-[#1F1D1A]">
              {selectedCountry.countryName}
            </h2>
            <p className="mt-2 text-sm text-[#6B6255]">
              {selectedCountry.region} · {selectedCountry.year}
            </p>
          </div>

          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium capitalize shadow-sm",
              selectedCountry.status === "visited"
                ? statusStyles.visited
                : statusStyles.planned
            )}
          >
            {selectedCountry.status}
          </span>
        </div>

        <p className="mb-6 max-w-md text-[15px] leading-7 text-[#4D463D]">
          {selectedCountry.summary}
        </p>

        <PlacesListByDestination
          destinations={selectedCountry.destinations}
          selectedDestinationId={selectedDestinationId}
          onSelectDestination={onSelectDestination}
          onOpenPlace={onOpenPlace}
        />
      </aside>
    </section>
  );
}