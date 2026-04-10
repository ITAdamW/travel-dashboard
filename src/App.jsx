import { useCallback, useEffect, useMemo, useState } from "react";
import { Moon, Settings2, Sun } from "lucide-react";
import AtlasPanel from "./components/AtlasPanel";
import StoryPanel from "./components/StoryPanel";
import PlannerPanel from "./components/PlannerPanel";
import LoginPanel from "./components/LoginPanel";
import MediaPanel from "./components/MediaPanel";
import DataAdminPanel from "./components/DataAdminPanel";
import UserSettingsPanel from "./components/UserSettingsPanel";
import UsersPanel from "./components/UsersPanel";
import { supabase } from "./lib/supabase";
import { hydrateCountriesWithStorage } from "./lib/storageMedia";
import { fetchTravelCountriesFromDb } from "./lib/supabaseTravelData";
import { ensureCurrentUserProfile } from "./lib/userProfiles";

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

function EmptyPanelState({ message }) {
  return (
    <div className="rounded-[2rem] border border-[#E6DED1] bg-white px-6 py-10 text-center text-[#5E564B] shadow-[0_16px_60px_rgba(34,31,25,0.05)]">
      {message}
    </div>
  );
}

function FloatingToast({ children, tone = "neutral" }) {
  const toneClass =
    tone === "error"
      ? "border-[#E3C7C1] bg-[#FFF3F0] text-[#8C4C43]"
      : tone === "success"
        ? "border-[#D5E2C8] bg-[#F4FAEE] text-[#4F6A2F]"
        : "border-[#E7DED2] bg-white/92 text-[#6B6255]";

  return (
    <div
      className={`rounded-[1.2rem] border px-4 py-3 text-sm shadow-[0_18px_40px_rgba(36,32,26,0.10)] backdrop-blur ${toneClass}`}
    >
      {children}
    </div>
  );
}

function getUserRole(profile, session) {
  return (
    profile?.role ||
    session?.user?.app_metadata?.role ||
    session?.user?.user_metadata?.role ||
    "user"
  );
}

function getUserGreeting(profile, session) {
  const metadata = session?.user?.user_metadata || {};
  const login = profile?.login?.trim() || metadata.login?.trim();
  const fullName =
    [profile?.firstName || metadata.first_name, profile?.lastName || metadata.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || metadata.full_name?.trim();
  const emailPrefix = session?.user?.email?.split("@")[0];

  return login || fullName || emailPrefix || "podrozniku";
}

export default function App() {
  const [activePanel, setActivePanel] = useState("atlas");
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem(THEME_STORAGE_KEY) || "light";
  });
  const [selectedCountryId, setSelectedCountryId] = useState("");
  const [selectedDestinationId, setSelectedDestinationId] = useState("");
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [baseCountries, setBaseCountries] = useState([]);
  const [travelCountries, setTravelCountries] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataStatus, setDataStatus] = useState("");
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

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
    if (!travelCountries.length) {
      if (selectedCountryId) setSelectedCountryId("");
      if (selectedDestinationId) setSelectedDestinationId("");
      return;
    }

    if (!travelCountries.some((country) => country.id === selectedCountryId)) {
      const nextCountry = travelCountries[0];
      setSelectedCountryId(nextCountry.id);
      setSelectedDestinationId(nextCountry.destinations[0]?.id || "");
      return;
    }

    const nextCountry =
      travelCountries.find((country) => country.id === selectedCountryId) ||
      travelCountries[0];

    if (
      !nextCountry.destinations.some(
        (destination) => destination.id === selectedDestinationId
      )
    ) {
      setSelectedDestinationId(nextCountry.destinations[0]?.id || "");
    }
  }, [travelCountries, selectedCountryId, selectedDestinationId]);

  const refreshStorageMedia = useCallback(async (sourceCountries = []) => {
    if (!sourceCountries?.length) {
      setTravelCountries([]);
      return [];
    }

    setMediaLoading(true);
    try {
      const nextCountries = await hydrateCountriesWithStorage(sourceCountries);
      setTravelCountries(nextCountries);
      return nextCountries;
    } finally {
      setMediaLoading(false);
    }
  }, []);

  const loadTravelData = useCallback(async () => {
    setDataLoading(true);
    setDataStatus("");

    try {
      const dbCountries = await fetchTravelCountriesFromDb();
      setBaseCountries(dbCountries);
      if (!dbCountries.length) {
        setTravelCountries([]);
        setDataStatus("Baza danych jest pusta. Dodaj pierwszy kraj w panelu admin.");
        return [];
      }

      return await refreshStorageMedia(dbCountries);
    } catch (error) {
      setBaseCountries([]);
      setTravelCountries([]);
      setDataStatus(
        error.message || "Nie udalo sie pobrac danych z Supabase Database."
      );
      return [];
    } finally {
      setDataLoading(false);
    }
  }, [refreshStorageMedia]);

  useEffect(() => {
    if (!session) return;
    loadTravelData();
  }, [session, loadTravelData]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapProfile() {
      if (!session) {
        setCurrentUserProfile(null);
        return;
      }

      setProfileLoading(true);
      try {
        const nextProfile = await ensureCurrentUserProfile(session);
        if (!cancelled) {
          setCurrentUserProfile(nextProfile);
        }
      } catch {
        if (!cancelled) {
          setCurrentUserProfile(null);
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }

    bootstrapProfile();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const selectedCountry = useMemo(
    () =>
      travelCountries.find((country) => country.id === selectedCountryId) ||
      travelCountries[0],
    [selectedCountryId, travelCountries]
  );

  const selectedDestination =
    selectedCountry?.destinations.find(
      (destination) => destination.id === selectedDestinationId
    ) || selectedCountry?.destinations[0];

  const userGreeting = getUserGreeting(currentUserProfile, session);
  const userRole = getUserRole(currentUserProfile, session);
  const isAdmin = userRole === "admin";

  if (authLoading) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center px-4">
        <div className="rounded-[1.6rem] border border-[#E6DED1] bg-white/90 px-6 py-5 text-sm text-[#5E564B] shadow-[0_22px_80px_rgba(34,31,25,0.06)]">
          Sprawdzam sesje uzytkownika...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <LoginPanel
        theme={theme}
        onToggleTheme={() =>
          setTheme((prev) => (prev === "light" ? "dark" : "light"))
        }
      />
    );
  }

  return (
    <div className="app-shell min-h-screen text-[#1F1D1A]">
      <div className="w-full px-3 py-4 sm:px-4 md:px-6 md:py-6 xl:px-8">
        <div className="sticky top-0 z-[1200] mb-5 rounded-[1.4rem] border border-[#E7DED2] bg-[linear-gradient(180deg,rgba(252,250,246,0.96)_0%,rgba(246,240,229,0.96)_100%)] p-1.5 shadow-[0_10px_24px_rgba(36,32,26,0.06)] backdrop-blur">
          <div className="flex flex-col gap-1.5 xl:flex-row xl:items-stretch xl:justify-between">
            <div className="grid flex-1 grid-cols-2 gap-1.5 md:grid-cols-6">
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
              {isAdmin && (
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
              )}
              {isAdmin && (
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
              )}
              {isAdmin && (
                <button
                  onClick={() => setActivePanel("users")}
                  className={navButtonClass(activePanel === "users")}
                >
                  <NavBadge active={activePanel === "users"}>6</NavBadge>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#8A7F6C]">
                      Panel 6
                    </p>
                    <p className="text-sm font-medium">Users</p>
                  </div>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 rounded-[1.2rem] border border-[#E7DDD0] bg-white/70 px-3 py-2 xl:min-w-[350px] xl:justify-end">
              <div className="min-w-0 xl:mr-auto">
                <p className="truncate text-sm font-medium text-[#1F1D1A]">
                  Witaj, {userGreeting}
                </p>
                <p className="truncate text-xs capitalize text-[#6B6255]">
                  Rola: {userRole}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUserSettingsOpen(true)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[#D8CCBB] bg-white text-[#1F1D1A] transition hover:bg-[#F8F2E9]"
                  aria-label="Ustawienia uzytkownika"
                  title="Ustawienia uzytkownika"
                >
                  <Settings2 className="h-5 w-5" />
                </button>
                <button
                  onClick={() =>
                    setTheme((prev) => (prev === "light" ? "dark" : "light"))
                  }
                  aria-label={
                    theme === "light"
                      ? "Wlacz tryb ciemny"
                      : "Wlacz tryb jasny"
                  }
                  title={
                    theme === "light"
                      ? "Wlacz tryb ciemny"
                      : "Wlacz tryb jasny"
                  }
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[#D8CCBB] bg-white text-[#1F1D1A] transition hover:bg-[#F8F2E9]"
                >
                  {theme === "light" ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </button>

                <button
                  onClick={() => supabase?.auth.signOut()}
                  className="inline-flex items-center justify-center rounded-[1rem] border border-[#D8CCBB] bg-white px-4 py-2.5 text-sm font-medium text-[#1F1D1A] transition hover:bg-[#F8F2E9]"
                >
                  Wyloguj
                </button>
              </div>
            </div>
          </div>
        </div>

        {activePanel === "atlas" &&
          (travelCountries.length > 0 ? (
            <AtlasPanel
              countries={travelCountries}
              selectedCountry={selectedCountry}
              selectedDestinationId={selectedDestinationId}
              onSelectCountry={(countryId) => {
                setSelectedCountryId(countryId);
                const nextCountry =
                  travelCountries.find((item) => item.id === countryId) ||
                  travelCountries[0];
                setSelectedDestinationId(nextCountry.destinations[0]?.id || "");
              }}
              onSelectDestination={setSelectedDestinationId}
              onOpenPlace={(destinationId) => {
                setSelectedDestinationId(destinationId);
                setActivePanel("story");
              }}
            />
          ) : (
            <EmptyPanelState message="Brak danych do wyswietlenia. Dodaj kraje i destynacje w panelu admin." />
          ))}

        {activePanel === "story" &&
          (selectedDestination ? (
            <StoryPanel
              key={selectedDestinationId}
              countries={travelCountries}
              selectedCountryId={selectedCountryId}
              selectedDestinationId={selectedDestinationId}
              onSelectCountry={(countryId) => {
                setSelectedCountryId(countryId);
                const nextCountry =
                  travelCountries.find((item) => item.id === countryId) ||
                  travelCountries[0];
                setSelectedDestinationId(nextCountry.destinations[0]?.id || "");
              }}
              onSelectDestination={setSelectedDestinationId}
              destination={selectedDestination}
            />
          ) : (
            <EmptyPanelState message="Panel destination bedzie dostepny po dodaniu danych w bazie." />
          ))}

        {activePanel === "planner" &&
          (travelCountries.length > 0 ? (
            <PlannerPanel
              countries={travelCountries}
              initialCountryId={selectedCountryId}
              initialDestinationId={selectedDestinationId}
              onPlannerSaved={loadTravelData}
            />
          ) : (
            <EmptyPanelState message="Planner pojawi sie po dodaniu pierwszej destynacji w bazie." />
          ))}

        {activePanel === "media" &&
          (isAdmin && travelCountries.length > 0 ? (
            <MediaPanel
              countries={travelCountries}
              onMediaChanged={loadTravelData}
            />
          ) : (
            <EmptyPanelState message="Panel media jest dostepny tylko dla admina i wymaga danych krajow, destynacji i miejsc w bazie." />
          ))}

        {activePanel === "admin" &&
          (isAdmin ? (
            <DataAdminPanel
              countries={baseCountries}
              onReloadFromDatabase={loadTravelData}
            />
          ) : (
            <EmptyPanelState message="Panel data admin jest dostepny tylko dla admina." />
          ))}

        {activePanel === "users" &&
          (isAdmin ? (
            <UsersPanel currentUserId={session?.user?.id} />
          ) : (
            <EmptyPanelState message="Panel users jest dostepny tylko dla admina." />
          ))}

        {(mediaLoading || dataLoading || dataStatus || profileLoading) && (
          <div className="pointer-events-none fixed bottom-6 right-6 z-[1450] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-3">
            {profileLoading && (
              <FloatingToast>
                Synchronizuje profil i role uzytkownika...
              </FloatingToast>
            )}
            {mediaLoading && (
              <FloatingToast>
                Synchronizuje zdjecia i filmy z Supabase Storage...
              </FloatingToast>
            )}
            {dataLoading && (
              <FloatingToast>
                Synchronizuje kraje, miasta i miejscowki z Supabase Database...
              </FloatingToast>
            )}
            {dataStatus && <FloatingToast tone="error">{dataStatus}</FloatingToast>}
          </div>
        )}

        {userSettingsOpen && (
          <UserSettingsPanel
            session={session}
            onClose={() => setUserSettingsOpen(false)}
            onUserUpdated={(nextProfile) => setCurrentUserProfile(nextProfile)}
          />
        )}
      </div>
    </div>
  );
}
