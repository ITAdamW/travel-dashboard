import { useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";
import AtlasPanel from "./components/AtlasPanel";
import StoryPanel from "./components/StoryPanel";
import PlannerPanel from "./components/PlannerPanel";
import LoginPanel from "./components/LoginPanel";
import MediaPanel from "./components/MediaPanel";
import DataAdminPanel from "./components/DataAdminPanel";
import { countries } from "./data/travelData";
import { supabase } from "./lib/supabase";
import { hydrateCountriesWithStorage } from "./lib/storageMedia";
import { fetchTravelCountriesFromDb, seedTravelData } from "./lib/supabaseTravelData";

const THEME_STORAGE_KEY = "travel-dashboard-theme";

function navButtonClass(active) {
  return [
    "theme-nav-button group relative flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200",
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
          ? "theme-nav-badge-active border-[#D8CCBB] bg-[#F6F1E8] text-[#5F6D45]"
          : "theme-nav-badge border-[#E7DDD0] bg-white text-[#8B806F]",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export default function App() {
  const [activePanel, setActivePanel] = useState("atlas");
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem(THEME_STORAGE_KEY) || "light";
  });
  const [selectedCountryId, setSelectedCountryId] = useState("cz");
  const [selectedDestinationId, setSelectedDestinationId] = useState("prague");
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [baseCountries, setBaseCountries] = useState(countries);
  const [travelCountries, setTravelCountries] = useState(countries);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [databaseEmpty, setDatabaseEmpty] = useState(false);
  const [dataStatus, setDataStatus] = useState("");

  useEffect(() => {
    document.body.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

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

  useEffect(() => {
    if (!baseCountries.length) return;
    if (!baseCountries.some((country) => country.id === selectedCountryId)) {
      const nextCountry = baseCountries[0];
      setSelectedCountryId(nextCountry.id);
      setSelectedDestinationId(nextCountry.destinations[0]?.id || "");
      return;
    }

    const nextCountry =
      baseCountries.find((country) => country.id === selectedCountryId) || baseCountries[0];

    if (!nextCountry.destinations.some((destination) => destination.id === selectedDestinationId)) {
      setSelectedDestinationId(nextCountry.destinations[0]?.id || "");
      return;
    }

    const nextDestination =
      nextCountry.destinations.find((destination) => destination.id === selectedDestinationId) ||
      nextCountry.destinations[0];

    if (!nextDestination?.places?.length) return;
  }, [baseCountries, selectedCountryId, selectedDestinationId]);

  const refreshStorageMedia = async (sourceCountries = baseCountries) => {
    setMediaLoading(true);
    try {
      const nextCountries = await hydrateCountriesWithStorage(sourceCountries);
      setTravelCountries(nextCountries);
    } finally {
      setMediaLoading(false);
    }
  };

  const loadTravelData = async () => {
    setDataLoading(true);
    setDataStatus("");
    try {
      const dbCountries = await fetchTravelCountriesFromDb();
      if (dbCountries.length) {
        setBaseCountries(dbCountries);
        setDatabaseEmpty(false);
        return dbCountries;
      }

      setBaseCountries(countries);
      setDatabaseEmpty(true);
      setDataStatus("Baza jest jeszcze pusta. Możesz ją zasilić danymi startowymi z panelu admin.");
      return countries;
    } catch (error) {
      setBaseCountries(countries);
      setDatabaseEmpty(true);
      setDataStatus(error.message || "Nie udało się pobrać danych z Supabase Database.");
      return countries;
    } finally {
      setDataLoading(false);
    }
  };

  const seedDefaultData = async () => {
    setDataLoading(true);
    setDataStatus("");
    try {
      await seedTravelData(countries, { reset: true });
      setDatabaseEmpty(false);
      setDataStatus("Dane startowe zostały zapisane do Supabase Database.");
      const next = await fetchTravelCountriesFromDb();
      setBaseCountries(next.length ? next : countries);
      return next.length ? next : countries;
    } catch (error) {
      setDataStatus(error.message || "Nie udało się zasilić bazy danymi startowymi.");
      return baseCountries;
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (!session) return;
    loadTravelData();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    refreshStorageMedia(baseCountries);
  }, [session, baseCountries]);

  const selectedCountry = useMemo(
    () => travelCountries.find((c) => c.id === selectedCountryId) || travelCountries[0],
    [selectedCountryId, travelCountries]
  );

  const selectedDestination =
    selectedCountry?.destinations.find((d) => d.id === selectedDestinationId) ||
    selectedCountry?.destinations[0];

  if (authLoading) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center px-4">
        <div className="rounded-[1.6rem] border border-[#E6DED1] bg-white/90 px-6 py-5 text-sm text-[#5E564B] shadow-[0_22px_80px_rgba(34,31,25,0.06)]">
          Sprawdzam sesję użytkownika...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <LoginPanel
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
      />
    );
  }

  const userEmail = session.user?.email || "Zalogowany użytkownik";

  return (
    <div className="app-shell min-h-screen text-[#1F1D1A]">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-6">
        <div className="mb-5 flex flex-col gap-3 rounded-[1.4rem] border border-[#E7DED2] bg-[linear-gradient(180deg,#FCFAF6_0%,#F6F0E5_100%)] p-4 shadow-[0_10px_24px_rgba(36,32,26,0.04)] md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#8A7F6C]">
              Active session
            </p>
            <p className="mt-2 text-sm font-medium text-[#1F1D1A]">{userEmail}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
              aria-label={theme === "light" ? "Wlacz tryb ciemny" : "Wlacz tryb jasny"}
              title={theme === "light" ? "Wlacz tryb ciemny" : "Wlacz tryb jasny"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[#D8CCBB] bg-white text-[#1F1D1A] transition hover:bg-[#F8F2E9]"
            >
              {theme === "light" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <button
              onClick={() => supabase?.auth.signOut()}
              className="inline-flex items-center justify-center rounded-[1rem] border border-[#D8CCBB] bg-white px-4 py-2.5 text-sm font-medium text-[#1F1D1A] transition hover:bg-[#F8F2E9]"
            >
              Wyloguj
            </button>
          </div>
        </div>

        <div className="mb-5 rounded-[1.4rem] border border-[#E7DED2] bg-[linear-gradient(180deg,#FCFAF6_0%,#F6F0E5_100%)] p-1.5 shadow-[0_10px_24px_rgba(36,32,26,0.04)]">
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-5">
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

            <button
              onClick={() => setActivePanel("admin")}
              className={navButtonClass(activePanel === "admin")}
            >
              <NavBadge active={activePanel === "admin"}>5</NavBadge>
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#8A7F6C]">
                  Panel 5
                </p>
                <p className="text-sm font-medium">Data admin</p>
              </div>
            </button>
          </div>
        </div>

        {mediaLoading && (
          <div className="mb-5 rounded-[1.2rem] border border-[#E7DED2] bg-white/80 px-4 py-3 text-sm text-[#6B6255] shadow-[0_10px_24px_rgba(36,32,26,0.04)]">
            Synchronizuję zdjęcia i filmy z Supabase Storage...
          </div>
        )}

        {dataLoading && (
          <div className="mb-5 rounded-[1.2rem] border border-[#E7DED2] bg-white/80 px-4 py-3 text-sm text-[#6B6255] shadow-[0_10px_24px_rgba(36,32,26,0.04)]">
            Synchronizuję kraje, miasta i miejscówki z Supabase Database...
          </div>
        )}

        {dataStatus && (
          <div className="mb-5 rounded-[1.2rem] border border-[#E7DED2] bg-[#FBF8F2] px-4 py-3 text-sm text-[#6B6255] shadow-[0_10px_24px_rgba(36,32,26,0.04)]">
            {dataStatus}
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
          <PlannerPanel
            countries={travelCountries}
            initialCountryId={selectedCountryId}
            initialDestinationId={selectedDestinationId}
            onPlannerSaved={loadTravelData}
          />
        )}

        {activePanel === "media" && (
          <MediaPanel countries={travelCountries} onMediaChanged={refreshStorageMedia} />
        )}

        {activePanel === "admin" && (
          <DataAdminPanel
            countries={baseCountries}
            databaseEmpty={databaseEmpty}
            onReloadFromDatabase={loadTravelData}
            onSeedDefaults={seedDefaultData}
          />
        )}
      </div>
    </div>
  );
}
