import { useEffect, useState } from "react";
import { ChevronDown, Landmark, Coffee, Mountain, Route, Waves, MapPin, Share2 } from "lucide-react";

const categoryMeta = {
  beach: { label: "Plaże", icon: Waves },
  viewpoint: { label: "Punkty widokowe", icon: Mountain },
  cafe: { label: "Kawiarnie / relax", icon: Coffee },
  museum: { label: "Muzea / architektura", icon: Landmark },
  city: { label: "Miasto / spacer", icon: Route },
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function findPlaceById(destination, id) {
  return destination.places.find((place) => place.id === id) || destination.places[0];
}

function DestinationScroller({ destinations, selectedDestinationId, onSelect }) {
  return (
    <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1">
      {destinations.map((destination) => (
        <button
          key={destination.id}
          onClick={() => onSelect(destination.id)}
          className={cn(
            "shrink-0 rounded-full border px-4 py-2 text-sm transition",
            selectedDestinationId === destination.id
              ? "border-[#D7CCBC] bg-white text-[#1F1D1A] shadow-[0_6px_14px_rgba(34,31,25,0.05)]"
              : "border-[#E4DBCD] bg-[#FBF8F2] text-[#6B6255] hover:bg-white"
          )}
        >
          {destination.name}
        </button>
      ))}
    </div>
  );
}

function ItineraryAccordion({ destination }) {
  const [openDay, setOpenDay] = useState(0);

  return (
    <div className="space-y-3">
      {destination.itinerary?.map((section, index) => {
        const isOpen = openDay === index;

        return (
          <div
            key={section.day}
            className="overflow-hidden rounded-2xl border border-[#E8DFD2] bg-white"
          >
            <button
              onClick={() => setOpenDay(isOpen ? -1 : index)}
              className="flex w-full items-center justify-between px-4 py-4 text-left"
            >
              <span className="font-medium text-[#1F1D1A]">{section.day}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-[#8A7F6C] transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            </button>

            {isOpen && (
              <div className="max-h-[260px] space-y-3 overflow-y-auto border-t border-[#EEE6DA] px-4 py-4">
                {section.items.map((placeId) => {
                  const place = findPlaceById(destination, placeId);

                  return (
                    <div
                      key={place.id}
                      className="grid grid-cols-[64px_1fr] gap-3 rounded-2xl border border-[#EEE6DA] bg-[#FBF8F2] p-3"
                    >
                      <img
                        src={place.image}
                        alt={place.name}
                        className="h-16 w-16 rounded-xl object-cover"
                      />
                      <div>
                        <p className="font-medium">{place.name}</p>
                        <p className="mt-1 text-sm text-[#5B544A]">{place.note}</p>
                        <p className="mt-2 text-xs text-[#8A7F6C]">
                          {place.ticket || "Brak informacji"} ·{" "}
                          {place.reservation || "Nie wymaga rezerwacji"} ·{" "}
                          {place.paid || "Bezpłatne lub zależne od atrakcji"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PlannerPanel({ country }) {
  const [selectedDestinationId, setSelectedDestinationId] = useState(
    country.destinations[0]?.id || ""
  );

  useEffect(() => {
    setSelectedDestinationId(country.destinations[0]?.id || "");
  }, [country.id]);

  const destination =
    country.destinations.find((d) => d.id === selectedDestinationId) ||
    country.destinations[0];

  return (
    <section className="rounded-[2rem] border border-[#E6DED1] bg-white p-6 shadow-[0_16px_60px_rgba(34,31,25,0.05)]">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#8A7F6C]">
            Trip Planner
          </p>
          <h3 className="mt-2 text-3xl font-semibold">
            Plan it beautifully, then keep it forever
          </h3>
        </div>

        <button className="inline-flex items-center gap-2 rounded-full border border-[#E3D9CA] bg-[#F8F4ED] px-4 py-2 text-sm text-[#3D382F]">
          <Share2 className="h-4 w-4" />
          Public family view
        </button>
      </div>

      <DestinationScroller
        destinations={country.destinations}
        selectedDestinationId={selectedDestinationId}
        onSelect={setSelectedDestinationId}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[1.75rem] border border-[#EEE6DA] bg-[#FBF8F2] p-5">
          <h4 className="mb-4 font-medium">Saved Places</h4>
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {destination.places.map((place) => {
              const Icon = categoryMeta[place.category]?.icon || MapPin;

              return (
                <div
                  key={place.id}
                  className="flex items-center justify-between rounded-2xl border border-[#E8DFD2] bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EDE7DB] text-[#6B7A52]">
                      <Icon className="h-4 w-4" />
                    </span>

                    <div>
                      <p className="font-medium">{place.name}</p>
                      <p className="text-sm text-[#7A7164]">
                        {categoryMeta[place.category]?.label || place.category}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-[#EEE6DA] bg-[#FBF8F2] p-5 lg:col-span-2">
          <h4 className="mb-4 font-medium">Mini Itinerary</h4>
          <ItineraryAccordion destination={destination} />
        </div>
      </div>
    </section>
  );
}