import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export default function LoginPanel({ theme = "light", onToggleTheme }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  const isSignIn = mode === "signin";

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isSupabaseConfigured || !supabase) {
      setStatus({
        type: "error",
        message:
          "Brakuje konfiguracji Supabase. Uzupełnij VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY.",
      });
      return;
    }

    setLoading(true);
    setStatus({ type: "", message: "" });

    const { error } = isSignIn
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) {
      setStatus({ type: "error", message: error.message });
      setLoading(false);
      return;
    }

    setStatus({
      type: "success",
      message: isSignIn
        ? "Zalogowano pomyślnie."
        : "Konto zostało utworzone. Jeśli włączyłeś potwierdzenie maila, sprawdź skrzynkę.",
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
          <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight md:text-5xl">
            Zaloguj się, aby otworzyć atlas, story i planner podróży.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-8 text-[#5E564B]">
            Dostęp do paneli jest ukryty do momentu zalogowania. Sesja zostanie
            zapamiętana w przeglądarce, więc po odświeżeniu nie trzeba logować
            się ponownie.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="theme-login-card rounded-[1.35rem] border border-[#E5DCCF] bg-white/80 p-4 shadow-[0_10px_24px_rgba(36,32,26,0.04)]">
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#8A7F6C]">
                Panel 1
              </p>
              <p className="mt-2 text-lg font-medium">Atlas</p>
              <p className="mt-2 text-sm leading-6 text-[#645C51]">
                Mapa państw, destynacje i lista miejsc.
              </p>
            </div>

            <div className="theme-login-card rounded-[1.35rem] border border-[#E5DCCF] bg-white/80 p-4 shadow-[0_10px_24px_rgba(36,32,26,0.04)]">
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#8A7F6C]">
                Panel 2
              </p>
              <p className="mt-2 text-lg font-medium">Story</p>
              <p className="mt-2 text-sm leading-6 text-[#645C51]">
                Mapa punktów, galerie i opisy miejsc.
              </p>
            </div>

            <div className="theme-login-card rounded-[1.35rem] border border-[#E5DCCF] bg-white/80 p-4 shadow-[0_10px_24px_rgba(36,32,26,0.04)]">
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#8A7F6C]">
                Panel 3
              </p>
              <p className="mt-2 text-lg font-medium">Planner</p>
              <p className="mt-2 text-sm leading-6 text-[#645C51]">
                Planowanie wyjazdu, listy i organizacja.
              </p>
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
              {isSignIn ? "Zaloguj się" : "Utwórz konto"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#5E564B]">
              Użyj maila i hasła. Po zalogowaniu od razu pokażemy wszystkie
              panele aplikacji.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
                Hasło
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="theme-login-input w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B9AE9A]"
                placeholder="Minimum 6 znaków"
              />
            </label>

            {status.message && (
              <div
                className={[
                  "rounded-[1rem] border px-4 py-3 text-sm",
                  status.type === "error"
                    ? "border-[#E3C7C1] bg-[#FFF3F0] text-[#8C4C43]"
                    : "border-[#D5E2C8] bg-[#F4FAEE] text-[#4F6A2F]",
                ].join(" ")}
              >
                {status.message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[1rem] border border-[#D8CCBB] bg-[#1F1D1A] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#2C2924] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading
                ? "Trwa przetwarzanie..."
                : isSignIn
                ? "Zaloguj"
                : "Utwórz konto"}
            </button>
          </form>

          <p className="mt-5 text-xs leading-6 text-[#7C7263]">
            Na GitHub Pages to logowanie chroni dostęp do interfejsu, ale nie
            służy do przechowywania sekretów po stronie klienta.
          </p>
        </section>
      </div>
    </div>
  );
}
