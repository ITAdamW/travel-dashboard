import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import {
  BookImage,
  BookOpen,
  CalendarDays,
  Compass,
  Database,
  Globe2,
  Images,
  LogOut,
  Map,
  Menu,
  Moon,
  Navigation,
  Plus,
  Route as RouteIcon,
  Settings2,
  Sun,
  Users as UsersIcon,
  X,
} from "lucide-react";
import AtlasPanel from "./components/AtlasPanel";
import StoryPanel from "./components/StoryPanel";
import PlannerPanel from "./components/PlannerPanel";
import RoutePanel from "./components/RoutePanel";
import GuidePanel from "./components/GuidePanel";
import LoginPanel from "./components/LoginPanel";
import MediaPanel from "./components/MediaPanel";
import DataAdminPanel from "./components/DataAdminPanel";
import UserSettingsPanel from "./components/UserSettingsPanel";
import UsersPanel from "./components/UsersPanel";
import { supabase } from "./lib/supabase";
import { fetchTravelCountriesFromDb } from "./lib/supabaseTravelData";
import { ensureCurrentUserProfile } from "./lib/userProfiles";

const THEME_STORAGE_KEY = "travel-dashboard-theme";
const PENDING_APPROVAL_MESSAGE_KEY = "travel-dashboard-pending-approval-message";

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

function SideNavItem({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "theme-side-nav-item relative flex w-full flex-col items-center justify-center gap-2 px-2 py-4 text-center text-xs font-semibold transition",
        active ? "text-[#008EA1]" : "text-[#4D5A68] hover:text-[#008EA1]",
      ].join(" ")}
      title={label}
    >
      {active ? (
        <span className="absolute left-0 top-1/2 h-12 w-1 -translate-y-1/2 rounded-r-full bg-[#008EA1]" />
      ) : null}
      {createElement(Icon, { className: "mx-auto block h-6 w-6 shrink-0" })}
      <span className="block w-full text-center leading-tight">{label}</span>
    </button>
  );
}

function SideNavbar({
  activePanel,
  onChangePanel,
  theme,
  onToggleTheme,
  onOpenSettings,
  userGreeting,
  session,
  isAdmin,
  onSignOut,
}) {
  const avatarUrl = session?.user?.user_metadata?.avatar_url;
  const initials = (userGreeting || "U").slice(0, 1).toUpperCase();
  const primaryItems = [
    { key: "atlas", label: "Mapa swiata", icon: Globe2 },
    { key: "story", label: "Mapa destynacji", icon: Compass },
    { key: "planner", label: "Plany i trasy", icon: CalendarDays },
    { key: "guide", label: "Przewodniki", icon: BookOpen },
  ];
  const adminItems = isAdmin
    ? [
        { key: "admin", label: "Dodaj miejsce", icon: Database, onClick: () => onChangePanel("admin") },
        { key: "media", label: "Media", icon: Images, onClick: () => onChangePanel("media") },
        { key: "users", label: "Uzytkownicy", icon: UsersIcon, onClick: () => onChangePanel("users") },
      ]
    : [];
  return (
    <aside className="theme-side-nav fixed bottom-4 left-4 top-4 z-[1400] hidden w-[104px] flex-col overflow-hidden rounded-[1.4rem] border border-[#DCECF0] bg-white shadow-[0_24px_70px_rgba(15,58,66,0.12)] xl:flex">
      <div className="flex h-20 items-center justify-center bg-[#008EA1] text-white">
        <Navigation className="h-9 w-9 fill-white/95 stroke-white" />
      </div>
      <nav className="atlas-scroll flex flex-1 flex-col items-center justify-between overflow-y-auto py-4">
        <div className="w-full">
          {primaryItems.map((item) => (
            <SideNavItem
              key={item.key}
              active={activePanel === item.key}
              icon={item.icon}
              label={item.label}
              onClick={() => onChangePanel(item.key)}
            />
          ))}
          {adminItems.map((item) => (
            <SideNavItem
              key={item.key}
              active={activePanel === item.key}
              icon={item.icon}
              label={item.label}
              onClick={item.onClick}
            />
          ))}
        </div>

        <div className="w-full">
          <button
            type="button"
            onClick={onToggleTheme}
            className="theme-side-nav-toggle mx-auto mt-3 flex h-11 w-14 items-center justify-center rounded-xl border border-[#DCECF0] bg-white text-[#4D5A68] transition hover:text-[#008EA1]"
            aria-label={theme === "light" ? "Wlacz tryb ciemny" : "Wlacz tryb jasny"}
            title={theme === "light" ? "Wlacz tryb ciemny" : "Wlacz tryb jasny"}
          >
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="mx-auto mt-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[#DCECF0] bg-[#E6FAFC] text-sm font-bold text-[#008EA1] transition hover:border-[#008EA1] hover:bg-[#DDF8FB]"
            aria-label="Ustawienia profilu"
            title="Ustawienia profilu"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={userGreeting} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="theme-side-nav-toggle mx-auto mt-3 flex h-11 w-14 items-center justify-center rounded-xl border border-[#DCECF0] bg-white text-[#4D5A68] transition hover:border-[#008EA1] hover:text-[#008EA1]"
            aria-label="Wyloguj sie"
            title="Wyloguj sie"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </nav>
    </aside>
  );
}

export default function App() {
  const [activePanel, setActivePanel] = useState("atlas");
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem(THEME_STORAGE_KEY) || "light";
  });
  const [selectedCountryId, setSelectedCountryId] = useState("");
  const [selectedDestinationId, setSelectedDestinationId] = useState("");
  const [selectedPlannerPlanId, setSelectedPlannerPlanId] = useState("");
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [baseCountries, setBaseCountries] = useState([]);
  const [travelCountries, setTravelCountries] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataStatus, setDataStatus] = useState("");
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

      // Main app panels use media URLs stored in the database.
      // Storage scanning is handled only in the Media panel.
      setTravelCountries(dbCountries);
      return dbCountries;
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
  }, []);

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
          if (nextProfile && !nextProfile.approved) {
            setCurrentUserProfile(null);
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem(
                PENDING_APPROVAL_MESSAGE_KEY,
                "Konto czeka na akceptacje administratora. Po zatwierdzeniu sprobuj zalogowac sie ponownie."
              );
            }
            await supabase?.auth.signOut();
            return;
          }
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
  const navItems = [
    { key: "atlas", label: "Atlas", panelLabel: "Panel 1", number: "1", icon: Globe2, visible: true },
    { key: "story", label: "Destination", panelLabel: "Panel 2", number: "2", icon: Map, visible: true },
    { key: "planner", label: "Plany i trasy", panelLabel: "Panel 3", number: "3", icon: BookImage, visible: true },
    { key: "guide", label: "Przewodniki", panelLabel: "Panel 4", number: "4", icon: BookOpen, visible: true },
    { key: "route", label: "Route", panelLabel: "Panel 4", number: "4", icon: RouteIcon, visible: false },
    { key: "media", label: "Media", panelLabel: "Panel 5", number: "5", icon: Images, visible: isAdmin },
    { key: "admin", label: "Dodaj miejsce", panelLabel: "Panel 6", number: "6", icon: Database, visible: isAdmin },
    { key: "users", label: "Uzytkownicy", panelLabel: "Panel 7", number: "7", icon: UsersIcon, visible: isAdmin },
  ].filter((item) => item.visible);

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
      <SideNavbar
        activePanel={activePanel}
        onChangePanel={setActivePanel}
        theme={theme}
        onToggleTheme={() =>
          setTheme((prev) => (prev === "light" ? "dark" : "light"))
        }
        onOpenSettings={() => setUserSettingsOpen(true)}
        userGreeting={userGreeting}
        session={session}
        isAdmin={isAdmin}
        onSignOut={() => supabase?.auth.signOut()}
      />
      <header className="theme-navbar mobile-navbar fixed inset-x-0 top-0 z-[1500] w-full border-b border-[#DCECF0] bg-white/95 shadow-[0_8px_24px_rgba(15,58,66,0.08)] backdrop-blur xl:hidden">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
          <button
            type="button"
            onClick={() => setActivePanel("atlas")}
            className="flex min-w-0 items-center gap-2 text-left"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#008EA1] text-white">
              <Navigation className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[#132334]">Travel Dashboard</span>
              <span className="block truncate text-xs text-[#647782]">Witaj, {userGreeting}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="theme-navbar-utility inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#DCECF0] bg-white text-[#132334]"
            aria-label={mobileMenuOpen ? "Zamknij menu" : "Otworz menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenuOpen ? (
          <div className="mobile-menu-panel border-t border-[#DCECF0] px-3 pb-3 pt-2 sm:px-4">
            <nav className="grid max-h-[calc(100dvh-10rem)] grid-cols-2 gap-2 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activePanel === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActivePanel(item.key);
                      setMobileMenuOpen(false);
                    }}
                    className={[
                      "inline-flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold transition",
                      active
                        ? "border-[#008EA1] bg-[#E6FAFC] text-[#007786]"
                        : "border-[#DCECF0] bg-white text-[#52616D]",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <div className="mt-2 grid grid-cols-3 gap-2 border-t border-[#DCECF0] pt-2">
              <button
                type="button"
                onClick={() => {
                  setUserSettingsOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="theme-navbar-utility inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#DCECF0] bg-white text-xs font-semibold text-[#132334]"
              >
                <Settings2 className="h-4 w-4" />
                Profil
              </button>
              <button
                type="button"
                onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
                className="theme-navbar-utility inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#DCECF0] bg-white text-xs font-semibold text-[#132334]"
              >
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                Motyw
              </button>
              <button
                type="button"
                onClick={() => supabase?.auth.signOut()}
                className="theme-navbar-utility inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#DCECF0] bg-white text-xs font-semibold text-[#132334]"
              >
                <LogOut className="h-4 w-4" />
                Wyloguj
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <div className="app-content w-full min-w-0 px-3 pb-4 pt-2 sm:px-4 md:px-6 md:pb-6 md:pt-3 xl:pl-[136px] xl:pr-5">

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
                setSelectedPlannerPlanId("");
                setActivePanel("story");
              }}
              onOpenPlan={(destinationId, planId) => {
                setSelectedDestinationId(destinationId);
                setSelectedPlannerPlanId(planId);
                setActivePanel("planner");
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
              initialPlanId={selectedPlannerPlanId}
              onOpenRoute={(countryId, destinationId, planId) => {
                setSelectedCountryId(countryId);
                setSelectedDestinationId(destinationId);
                setSelectedPlannerPlanId(planId);
                setActivePanel("planner");
              }}
              onPlannerSaved={loadTravelData}
            />
          ) : (
            <EmptyPanelState message="Planner pojawi sie po dodaniu pierwszej destynacji w bazie." />
          ))}

        {activePanel === "guide" &&
          (travelCountries.length > 0 ? (
            <GuidePanel
              countries={travelCountries}
              initialCountryId={selectedCountryId}
              initialDestinationId={selectedDestinationId}
            />
          ) : (
            <EmptyPanelState message="Przewodniki pojawia sie po dodaniu pierwszej destynacji w bazie." />
          ))}

        {activePanel === "route" &&
          (travelCountries.length > 0 ? (
            <RoutePanel
              countries={travelCountries}
              initialCountryId={selectedCountryId}
              initialDestinationId={selectedDestinationId}
              initialPlanId={selectedPlannerPlanId}
            />
          ) : (
            <EmptyPanelState message="Route pojawi sie po dodaniu pierwszego planu w bazie." />
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

        {(dataLoading || dataStatus || profileLoading) && (
          <div className="pointer-events-none fixed bottom-6 right-6 z-[1450] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-3">
            {profileLoading && (
              <FloatingToast>
                Synchronizuje profil i role uzytkownika...
              </FloatingToast>
            )}
            {dataLoading && (
              <FloatingToast>
                Synchronizuje kraje, miasta, miejscowki i zdjecia z Supabase Database...
              </FloatingToast>
            )}
            {dataStatus && <FloatingToast tone="error">{dataStatus}</FloatingToast>}
          </div>
        )}

        {userSettingsOpen && (
          <UserSettingsPanel
            session={session}
            onClose={() => setUserSettingsOpen(false)}
            onUserUpdated={(nextProfile) => {
              setCurrentUserProfile(nextProfile);
              setSession((prev) =>
                prev
                  ? {
                      ...prev,
                      user: {
                        ...prev.user,
                        user_metadata: {
                          ...prev.user.user_metadata,
                          login: nextProfile?.login || "",
                          first_name: nextProfile?.firstName || "",
                          last_name: nextProfile?.lastName || "",
                          full_name: [
                            nextProfile?.firstName || "",
                            nextProfile?.lastName || "",
                          ]
                            .filter(Boolean)
                            .join(" "),
                          role: nextProfile?.role || "user",
                          navbar_style: nextProfile?.navbarStyle || "capsule",
                        },
                      },
                    }
                  : prev
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
