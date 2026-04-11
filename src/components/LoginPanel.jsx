import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Compass,
  Map,
  Moon,
  Route,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { ensureCurrentUserProfile } from "../lib/userProfiles";

const PENDING_APPROVAL_MESSAGE_KEY = "travel-dashboard-pending-approval-message";

const featureCards = [
  {
    label: "Panel 1",
    title: "Atlas",
    description: "Kraje, destynacje, miniature coverow i szybkie przejscie dalej.",
    icon: Compass,
  },
  {
    label: "Panel 2",
    title: "Destination",
    description: "Story miejsca, mapa punktow, galerie i rozbudowany overlay opisu.",
    icon: Map,
  },
  {
    label: "Panel 3",
    title: "Planner",
    description: "DnD w planie, live route map i gotowe plany podrozy.",
    icon: Route,
  },
  {
    label: "Panel 4",
    title: "Route",
    description: "Kolory dni, numerowane markery i trasy pomiedzy atrakcjami.",
    icon: Route,
  },
];

const highlightItems = [
  "Scrollowalne story miejsca z galeria i multimediami.",
  "Planner z mapa aktualizowana na zywo podczas planowania.",
  "Panel route z podzialem na dni i trasami pomiedzy punktami.",
  "Panel users z akceptacja nowych kont przez administratora.",
];

export default function LoginPanel({ theme = "light", onToggleTheme }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [login, setLogin] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  const isSignIn = mode === "signin";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pendingMessage = window.sessionStorage.getItem(PENDING_APPROVAL_MESSAGE_KEY);
    if (!pendingMessage) return;

    setStatus({ type: "error", message: pendingMessage });
    window.sessionStorage.removeItem(PENDING_APPROVAL_MESSAGE_KEY);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isSupabaseConfigured || !supabase) {
      setStatus({
        type: "error",
        message:
          "Brakuje konfiguracji Supabase. Uzupelnij VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY.",
      });
      return;
    }

    setLoading(true);
    setStatus({ type: "", message: "" });

    const derivedLogin = login.trim() || email.split("@")[0] || "";

    const { data, error } = isSignIn
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              login: derivedLogin,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              full_name: [firstName.trim(), lastName.trim()]
                .filter(Boolean)
                .join(" "),
              role: "user",
            },
          },
        });

    if (error) {
      setStatus({ type: "error", message: error.message });
      setLoading(false);
      return;
    }

    if (isSignIn && data?.session) {
      try {
        const profile = await ensureCurrentUserProfile(data.session);
        if (!profile?.approved) {
          await supabase.auth.signOut();
          setStatus({
            type: "error",
            message:
              "Konto czeka na akceptacje administratora. Po akceptacji bedzie mozna sie zalogowac.",
          });
          setLoading(false);
          return;
        }
      } catch (profileError) {
        setStatus({
          type: "error",
          message:
            profileError.message ||
            "Nie udalo sie zweryfikowac statusu konta. Sprobuj ponownie.",
        });
        setLoading(false);
        return;
      }
    }

    if (!isSignIn && data?.session) {
      try {
        await ensureCurrentUserProfile(data.session);
      } catch {
        // Profil zostanie utworzony przy pierwszym poprawnym logowaniu.
      }

      await supabase.auth.signOut();
    }

    setStatus({
      type: "success",
      message: isSignIn
        ? "Zalogowano pomyslnie."
        : "Konto zostalo utworzone i czeka na akceptacje administratora. Logowanie bedzie mozliwe po zatwierdzeniu.",
    });
    setLoading(false);
  };

  return (
    <div className="theme-login-shell min-h-screen bg-[linear-gradient(180deg,#F7F3EC_0%,#F2ECE3_100%)] px-4 py-8 text-[#1F1D1A]">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="theme-login-hero rounded-[2rem] border border-[#E6DED1] bg-[radial-gradient(circle_at_top_left,_rgba(107,122,82,0.16),_transparent_30%),linear-gradient(180deg,_#FBF8F2_0%,_#F3ECE1_100%)] p-6 shadow-[0_22px_80px_rgba(34,31,25,0.06)] md:p-8">
          <p className="text-xs uppercase tracking-[0.34em] text-[#8A7F6C]">
            Travel Dashboard
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl">
            Travel Dashboard dla atlasu, story, plannerow i tras podrozy.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-8 text-[#5E564B]">
            Przed zalogowaniem pokazujemy przeglad funkcjonalnosci aplikacji. Po
            rejestracji konto trafia do akceptacji administratora w panelu users
            i dopiero wtedy mozna korzystac z calego systemu.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {featureCards.map(({ label, title, description, icon: Icon }) => (
              <div
                key={title}
                className="theme-login-card rounded-[1.35rem] border border-[#E5DCCF] bg-white/80 p-4 shadow-[0_10px_24px_rgba(36,32,26,0.04)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-[#8A7F6C]">
                      {label}
                    </p>
                    <p className="mt-2 text-lg font-medium">{title}</p>
                  </div>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] text-[#5F6D45]">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#645C51]">{description}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[1.6rem] border border-[#E5DCCF] bg-white/75 p-5 shadow-[0_10px_24px_rgba(36,32,26,0.04)]">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] text-[#5F6D45]">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#8A7F6C]">
                    Co znajdziesz po zalogowaniu
                  </p>
                  <p className="mt-1 text-lg font-medium text-[#1F1D1A]">
                    Najwazniejsze funkcje
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {highlightItems.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-[1rem] border border-[#EEE4D8] bg-[#FCFAF5] px-3 py-3 text-sm leading-6 text-[#5E564B]"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6B7A52]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-[#E5DCCF] bg-[#F8F4EC] p-5 shadow-[0_10px_24px_rgba(36,32,26,0.04)]">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[#E5DCCF] bg-white text-[#5F6D45]">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#8A7F6C]">
                    Dostep i bezpieczenstwo
                  </p>
                  <p className="mt-1 text-lg font-medium text-[#1F1D1A]">
                    Akceptacja kont przez admina
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm leading-6 text-[#5E564B]">
                <p className="rounded-[1rem] border border-[#E5DCCF] bg-white/75 px-4 py-3">
                  Rejestracja tworzy konto w statusie oczekujacym.
                </p>
                <p className="rounded-[1rem] border border-[#E5DCCF] bg-white/75 px-4 py-3">
                  Admin zatwierdza uzytkownika w panelu <span className="font-medium">Users</span>.
                </p>
                <p className="rounded-[1rem] border border-[#E5DCCF] bg-white/75 px-4 py-3">
                  Dopiero po akceptacji mozna zalogowac sie do atlasu, story,
                  planera i route.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="theme-login-panel rounded-[2rem] border border-[#E6DED1] bg-white/88 p-6 shadow-[0_22px_80px_rgba(34,31,25,0.06)] backdrop-blur md:p-8">
          <div className="mb-5 flex items-center justify-end">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === "light" ? "Wlacz tryb ciemny" : "Wlacz tryb jasny"}
              title={theme === "light" ? "Wlacz tryb ciemny" : "Wlacz tryb jasny"}
              className="theme-login-toggle inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[#D8CCBB] bg-white text-[#1F1D1A] transition hover:bg-[#F8F2E9]"
            >
              {theme === "light" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>

          <div className="theme-login-segment flex items-center gap-2 rounded-full border border-[#E6DED1] bg-[#F8F4EC] p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={[
                "flex-1 rounded-full px-4 py-2 text-sm font-medium transition",
                isSignIn
                  ? "theme-login-segment-active bg-white text-[#1F1D1A] shadow-sm"
                  : "text-[#7B7264]",
              ].join(" ")}
            >
              Logowanie
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={[
                "flex-1 rounded-full px-4 py-2 text-sm font-medium transition",
                !isSignIn
                  ? "theme-login-segment-active bg-white text-[#1F1D1A] shadow-sm"
                  : "text-[#7B7264]",
              ].join(" ")}
            >
              Rejestracja
            </button>
          </div>

          <div className="mt-6">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#8A7F6C]">
              Supabase Auth
            </p>
            <h2 className="mt-2 text-3xl font-semibold">
              {isSignIn ? "Zaloguj sie" : "Utworz konto"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#5E564B]">
              Uzyj maila i hasla. Nowe konto po rejestracji czeka na akceptacje
              administratora, a po zatwierdzeniu odblokuje wszystkie panele aplikacji.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {!isSignIn && (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#4D463D]">
                  Login
                </span>
                <input
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="theme-login-input w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B9AE9A]"
                  placeholder="np. adam-travels"
                />
              </label>
            )}

            {!isSignIn && (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#4D463D]">
                    Imie
                  </span>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="theme-login-input w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B9AE9A]"
                    placeholder="np. Adam"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#4D463D]">
                    Nazwisko
                  </span>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="theme-login-input w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B9AE9A]"
                    placeholder="np. Kowalski"
                  />
                </label>
              </div>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#4D463D]">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="theme-login-input w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B9AE9A]"
                placeholder="twoj@email.com"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#4D463D]">
                Haslo
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="theme-login-input w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B9AE9A]"
                placeholder="Minimum 6 znakow"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[1rem] border border-[#D8CCBB] bg-[#1F1D1A] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#2C2924] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading
                ? "Trwa przetwarzanie..."
                : isSignIn
                  ? "Zaloguj"
                  : "Utworz konto"}
            </button>
          </form>

          <p className="mt-5 text-xs leading-6 text-[#7C7263]">
            Logowanie chroni dostep do interfejsu, ale nie sluzy do przechowywania
            sekretow po stronie klienta.
          </p>
        </section>
      </div>

      {status.message && (
        <div
          className={[
            "pointer-events-none fixed bottom-6 right-6 z-[1450] w-[min(360px,calc(100vw-2rem))] rounded-[1.2rem] border px-4 py-3 text-sm shadow-[0_18px_40px_rgba(36,32,26,0.10)] backdrop-blur",
            status.type === "error"
              ? "border-[#E3C7C1] bg-[#FFF3F0] text-[#8C4C43]"
              : "border-[#D5E2C8] bg-[#F4FAEE] text-[#4F6A2F]",
          ].join(" ")}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
