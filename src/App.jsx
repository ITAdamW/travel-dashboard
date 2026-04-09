import { useEffect, useMemo, useState } from "react";
import AtlasPanel from "./components/AtlasPanel";
import StoryPanel from "./components/StoryPanel";
import PlannerPanel from "./components/PlannerPanel";
import LoginPanel from "./components/LoginPanel";
import MediaPanel from "./components/MediaPanel";
import { countries } from "./data/travelData";
import { supabase } from "./lib/supabase";
import { hydrateCountriesWithStorage } from "./lib/storageMedia";

function navButtonClass(active) {
  return [
    "group relative flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200",
    active
      ? "border-[#D8CCBB] bg-white shadow-[0_10px_24px_rgba(36,32,26,0.07)]"
      : "border-transparent bg-[#F8F4EC] hover:border-[#E7DDD0] hover:bg-white/80",
  ].join(" ");
}

function NavBadge({ children, active }) {
  return (
    <span
      className={[
        "inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium transition",
        active
          ? "border-[#D8CCBB] bg-[#F6F1E8] text-[#5F6D45]"
          : "border-[#E7DDD0] bg-white text-[#8B806F]",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export default function App() {
  const [activePanel, setActivePanel] = useState("atlas");
  const [selectedCountryId, setSelectedCountryId] = useState("cz");
  const [selectedDestinationId, setSelectedDestinationId] = useState("prague");
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [travelCountries, setTravelCountries] = useState(countries);
  const [mediaLoading, setMediaLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshStorageMedia = async () => {
    setMediaLoading(true);
    try {
      const nextCountries = await hydrateCountriesWithStorage(countries);
      setTravelCountries(nextCountries);
    } finally {
      setMediaLoading(false);
    }
  };

  useEffect(() => {
    if (!session) return;
    refreshStorageMedia();
  }, [session]);

  const selectedCountry = useMemo(
    () => travelCountries.find((c) => c.id === selectedCountryId) || travelCountries[0],
    [selectedCountryId, travelCountries]
  );

  const selectedDestination =
    selectedCountry.destinations.find((d) => d.id === selectedDestinationId) ||
    selectedCountry.destinations[0];

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#F7F3EC_0%,#F2ECE3_100%)] px-4">
        <div className="rounded-[1.6rem] border border-[#E6DED1] bg-white/90 px-6 py-5 text-sm text-[#5E564B] shadow-[0_22px_80px_rgba(34,31,25,0.06)]">
          Sprawdzam sesję użytkownika...
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPanel />;
  }

  const userEmail = session.user?.email || "Zalogowany użytkownik";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F7F3EC_0%,#F2ECE3_100%)] text-[#1F1D1A]">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-6">
        <div className="mb-5 flex flex-col gap-3 rounded-[1.4rem] border border-[#E7DED2] bg-[linear-gradient(180deg,#FCFAF6_0%,#F6F0E5_100%)] p-4 shadow-[0_10px_24px_rgba(36,32,26,0.04)] md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#8A7F6C]">
              Active session
            </p>
            <p className="mt-2 text-sm font-medium text-[#1F1D1A]">{userEmail}</p>
          </div>

          <button
            onClick={() => supabase?.auth.signOut()}
            className="inline-flex items-center justify-center rounded-[1rem] border border-[#D8CCBB] bg-white px-4 py-2.5 text-sm font-medium text-[#1F1D1A] transition hover:bg-[#F8F2E9]"
          >
            Wyloguj
          </button>
        </div>

        <div className="mb-5 rounded-[1.4rem] border border-[#E7DED2] bg-[linear-gradient(180deg,#FCFAF6_0%,#F6F0E5_100%)] p-1.5 shadow-[0_10px_24px_rgba(36,32,26,0.04)]">
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
            <button
              onClick={() => setActivePanel("atlas")}
              className={navButtonClass(activePanel === "atlas")}
            >
              <NavBadge active={activePanel === "atlas"}>1</NavBadge>
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#8A7F6C]">
                  Panel 1
                </p>
                <p className="text-sm font-medium">Atlas</p>
              </div>
            </button>

            <button
              onClick={() => setActivePanel("story")}
              className={navButtonClass(activePanel === "story")}
            >
              <NavBadge active={activePanel === "story"}>2</NavBadge>
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#8A7F6C]">
                  Panel 2
                </p>
                <p className="text-sm font-medium">Destination</p>
              </div>
            </button>

            <button
              onClick={() => setActivePanel("planner")}
              className={navButtonClass(activePanel === "planner")}
            >
              <NavBadge active={activePanel === "planner"}>3</NavBadge>
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#8A7F6C]">
                  Panel 3
                </p>
                <p className="text-sm font-medium">Planner</p>
              </div>
            </button>

            <button
              onClick={() => setActivePanel("media")}
              className={navButtonClass(activePanel === "media")}
            >
              <NavBadge active={activePanel === "media"}>4</NavBadge>
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#8A7F6C]">
                  Panel 4
                </p>
                <p className="text-sm font-medium">Media</p>
              </div>
            </button>
          </div>
        </div>

        {mediaLoading && (
          <div className="mb-5 rounded-[1.2rem] border border-[#E7DED2] bg-white/80 px-4 py-3 text-sm text-[#6B6255] shadow-[0_10px_24px_rgba(36,32,26,0.04)]">
            Synchronizuję zdjęcia i filmy z Supabase Storage...
          </div>
        )}

        {activePanel === "atlas" && (
          <AtlasPanel
            countries={travelCountries}
            selectedCountry={selectedCountry}
            selectedDestinationId={selectedDestinationId}
            onSelectCountry={(countryId) => {
              setSelectedCountryId(countryId);
              const nextCountry =
                travelCountries.find((item) => item.id === countryId) || travelCountries[0];
              setSelectedDestinationId(nextCountry.destinations[0]?.id || "");
            }}
            onSelectDestination={setSelectedDestinationId}
            onOpenPlace={(destinationId) => {
              setSelectedDestinationId(destinationId);
              setActivePanel("story");
            }}
          />
        )}

        {activePanel === "story" && (
          <StoryPanel destination={selectedDestination} />
        )}

        {activePanel === "planner" && (
          <PlannerPanel country={selectedCountry} />
        )}

        {activePanel === "media" && (
          <MediaPanel countries={travelCountries} onMediaChanged={refreshStorageMedia} />
        )}
      </div>
    </div>
  );
}
