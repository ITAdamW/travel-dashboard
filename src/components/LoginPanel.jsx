import { createElement, useState } from "react";
import {
  CalendarDays,
  Images,
  MapPin,
  Moon,
  Navigation,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { ensureCurrentUserProfile } from "../lib/userProfiles";

const PENDING_APPROVAL_MESSAGE_KEY = "travel-dashboard-pending-approval-message";

const getInitialStatus = () => {
  if (typeof window === "undefined") return { type: "", message: "" };

  const pendingMessage = window.sessionStorage.getItem(PENDING_APPROVAL_MESSAGE_KEY);
  if (!pendingMessage) return { type: "", message: "" };

  window.sessionStorage.removeItem(PENDING_APPROVAL_MESSAGE_KEY);
  return { type: "error", message: pendingMessage };
};

const featureCards = [
  {
    title: "Planuj trasy",
    description: "Ukladaj dni podrozy i wszystkie miejsca w jednym widoku.",
    icon: CalendarDays,
  },
  {
    title: "Odkrywaj miejsca",
    description: "Korzystaj z map, opisow destynacji i zapisanych punktow.",
    icon: MapPin,
  },
  {
    title: "Zachowuj wspomnienia",
    description: "Tworz galerie i wracaj do najwazniejszych chwil.",
    icon: Images,
  },
];

export default function LoginPanel({ theme = "light", onToggleTheme }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [login, setLogin] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(getInitialStatus);
  const [loading, setLoading] = useState(false);

  const isSignIn = mode === "signin";

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
    <div className="theme-login-shell min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_8%,rgba(107,213,224,0.22),transparent_28%),radial-gradient(circle_at_92%_92%,rgba(0,142,161,0.12),transparent_30%),#F7FCFD] px-4 py-4 text-[#132334] sm:px-6 sm:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1320px] flex-col sm:min-h-[calc(100vh-3rem)]">
        <main className="grid flex-1 items-center gap-5 py-2 lg:grid-cols-[1.12fr_0.88fr] lg:gap-7 lg:py-4">
          <section className="theme-login-hero order-2 flex overflow-hidden rounded-[1.75rem] border border-[#CDE9ED] bg-[linear-gradient(145deg,#008EA1_0%,#087A8D_58%,#125768_100%)] p-6 text-white shadow-[0_24px_70px_rgba(8,91,106,0.18)] sm:p-8 lg:order-1 lg:p-9">
            <div className="flex w-full flex-col">
              <div className="flex items-center gap-3.5">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white text-[#008EA1] shadow-[0_10px_24px_rgba(0,62,73,0.18)]">
                  <Navigation className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-lg font-bold tracking-tight text-white">Travel Dashboard</p>
                  <p className="text-xs text-[#D8F2F5]">Twoje podroze w jednym miejscu</p>
                </div>
              </div>

              <div className="mt-8 max-w-xl lg:mt-10">
              <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D9FAFD]">
                Planuj. Odkrywaj. Wspominaj.
              </span>
              <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                Kazda podroz zaczyna sie od dobrego planu.
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-7 text-[#D8F2F5] sm:text-base">
                Organizuj destynacje, trasy, miejsca i zdjecia w jednym przejrzystym
                panelu dostepnym na kazdym urzadzeniu.
              </p>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3 lg:mt-8">
              {featureCards.map(({ title, description, icon: Icon }) => (
                <article
                  key={title}
                  className="theme-login-card rounded-[1.25rem] border border-white/20 bg-white/10 p-4 backdrop-blur-sm"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#008EA1]">
                    {createElement(Icon, { className: "h-5 w-5" })}
                  </span>
                  <h2 className="mt-4 text-sm font-semibold text-white">{title}</h2>
                  <p className="mt-2 text-xs leading-5 text-[#D8F2F5]">{description}</p>
                </article>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-[1.15rem] border border-white/20 bg-[#064F5D]/35 px-4 py-3 text-xs leading-5 text-[#D8F2F5] sm:text-sm">
              <ShieldCheck className="h-5 w-5 shrink-0 text-white" />
              Nowe konto zostanie aktywowane po akceptacji przez administratora.
            </div>
            </div>
          </section>

          <section className="theme-login-panel relative order-1 flex flex-col justify-center rounded-[1.75rem] border border-[#DCECF0] bg-white/95 p-5 shadow-[0_24px_70px_rgba(28,80,91,0.10)] backdrop-blur sm:p-8 lg:order-2 lg:p-9">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === "light" ? "Wlacz tryb ciemny" : "Wlacz tryb jasny"}
              title={theme === "light" ? "Wlacz tryb ciemny" : "Wlacz tryb jasny"}
              className="theme-login-toggle absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[#DCECF0] bg-white text-[#315362] shadow-sm transition hover:border-[#9EDCE4] hover:text-[#008EA1] sm:right-7 sm:top-7"
            >
              {theme === "light" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <div className="theme-login-segment mt-14 flex items-center gap-1 rounded-[0.9rem] border border-[#DCECF0] bg-[#F2FAFB] p-1 sm:mt-10">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={[
                "flex-1 rounded-[0.7rem] px-4 py-2.5 text-sm font-semibold transition",
                isSignIn
                  ? "theme-login-segment-active bg-[#008EA1] text-white shadow-[0_6px_16px_rgba(0,142,161,0.2)]"
                  : "text-[#647782] hover:text-[#008EA1]",
              ].join(" ")}
            >
              Logowanie
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={[
                "flex-1 rounded-[0.7rem] px-4 py-2.5 text-sm font-semibold transition",
                !isSignIn
                  ? "theme-login-segment-active bg-[#008EA1] text-white shadow-[0_6px_16px_rgba(0,142,161,0.2)]"
                  : "text-[#647782] hover:text-[#008EA1]",
              ].join(" ")}
            >
              Rejestracja
            </button>
          </div>

          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#008EA1]">
              {isSignIn ? "Witaj ponownie" : "Dolacz do nas"}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              {isSignIn ? "Zaloguj sie" : "Utworz konto"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#647782]">
              {isSignIn
                ? "Wpisz dane dostepowe, aby przejsc do swoich podrozy."
                : "Uzupelnij dane. Po rejestracji konto bedzie czekac na akceptacje."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {!isSignIn && (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#315362]">
                  Login
                </span>
                <input
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="theme-login-input w-full rounded-[0.9rem] border border-[#DCECF0] bg-[#F8FCFD] px-4 py-3 text-sm text-[#132334] outline-none transition focus:border-[#40B7C6] focus:bg-white focus:ring-4 focus:ring-[#DDF5F8]"
                  placeholder="np. adam-travels"
                />
              </label>
            )}

            {!isSignIn && (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#315362]">
                    Imie
                  </span>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="theme-login-input w-full rounded-[0.9rem] border border-[#DCECF0] bg-[#F8FCFD] px-4 py-3 text-sm text-[#132334] outline-none transition focus:border-[#40B7C6] focus:bg-white focus:ring-4 focus:ring-[#DDF5F8]"
                    placeholder="np. Adam"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#315362]">
                    Nazwisko
                  </span>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="theme-login-input w-full rounded-[0.9rem] border border-[#DCECF0] bg-[#F8FCFD] px-4 py-3 text-sm text-[#132334] outline-none transition focus:border-[#40B7C6] focus:bg-white focus:ring-4 focus:ring-[#DDF5F8]"
                    placeholder="np. Kowalski"
                  />
                </label>
              </div>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#315362]">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="theme-login-input w-full rounded-[0.9rem] border border-[#DCECF0] bg-[#F8FCFD] px-4 py-3 text-sm text-[#132334] outline-none transition focus:border-[#40B7C6] focus:bg-white focus:ring-4 focus:ring-[#DDF5F8]"
                placeholder="twoj@email.com"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#315362]">
                Haslo
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="theme-login-input w-full rounded-[0.9rem] border border-[#DCECF0] bg-[#F8FCFD] px-4 py-3 text-sm text-[#132334] outline-none transition focus:border-[#40B7C6] focus:bg-white focus:ring-4 focus:ring-[#DDF5F8]"
                placeholder="Minimum 6 znakow"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[0.9rem] bg-[#008EA1] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,142,161,0.22)] transition hover:bg-[#007B8D] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading
                ? "Trwa przetwarzanie..."
                : isSignIn
                  ? "Zaloguj"
                  : "Utworz konto"}
            </button>
          </form>

            <div className="mt-5 flex items-start gap-2.5 rounded-[0.9rem] bg-[#F1FAFB] px-3.5 py-3 text-xs leading-5 text-[#647782]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#008EA1]" />
              Twoje dane logowania sa obslugiwane przez bezpieczne uwierzytelnianie.
            </div>
          </section>
        </main>

        <footer className="px-2 py-2 text-center text-[11px] text-[#82939C]">
          Travel Dashboard · planowanie podrozy w jednym miejscu
        </footer>
      </div>

      {status.message && (
        <div
          className={[
            "pointer-events-none fixed bottom-4 left-1/2 z-[1450] w-[min(390px,calc(100vw-2rem))] -translate-x-1/2 rounded-[1rem] border px-4 py-3 text-sm shadow-[0_18px_40px_rgba(36,75,82,0.14)] backdrop-blur sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0",
            status.type === "error"
              ? "border-[#E3C7C1] bg-[#FFF3F0] text-[#8C4C43]"
              : "border-[#B9E4E9] bg-[#EFFBFC] text-[#087386]",
          ].join(" ")}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
