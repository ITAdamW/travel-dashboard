import { useEffect, useMemo, useState } from "react";
import { KeyRound, Save, Shield, UserRound, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { updateCurrentUserProfile } from "../lib/userProfiles";

function getInitialProfile(session) {
  const metadata = session?.user?.user_metadata || {};

  return {
    login: metadata.login || "",
    firstName: metadata.first_name || "",
    lastName: metadata.last_name || "",
  };
}

function resolveRole(session) {
  return (
    session?.user?.app_metadata?.role ||
    session?.user?.user_metadata?.role ||
    "user"
  );
}

export default function UserSettingsPanel({
  session,
  onClose,
  onUserUpdated,
}) {
  const [profileForm, setProfileForm] = useState(() => getInitialProfile(session));
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const email = session?.user?.email || "";
  const role = useMemo(() => resolveRole(session), [session]);

  useEffect(() => {
    setProfileForm(getInitialProfile(session));
  }, [session]);

  const handleProfileSave = async (event) => {
    event.preventDefault();

    if (!supabase) return;

    const login = profileForm.login.trim();
    const firstName = profileForm.firstName.trim();
    const lastName = profileForm.lastName.trim();

    if (!login) {
      setStatus({
        type: "error",
        message: "Login nie moze byc pusty.",
      });
      return;
    }

    setProfileLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const nextProfile = await updateCurrentUserProfile(session, {
        login,
        firstName,
        lastName,
        role,
      });

      onUserUpdated?.(nextProfile);
      setStatus({
        type: "success",
        message: "Ustawienia profilu zostaly zapisane.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Nie udalo sie zapisac ustawien profilu.",
      });
      setProfileLoading(false);
      return;
    }
    setProfileLoading(false);
  };

  const handlePasswordSave = async (event) => {
    event.preventDefault();

    if (!supabase) return;

    if (passwordForm.password.length < 6) {
      setStatus({
        type: "error",
        message: "Nowe haslo musi miec przynajmniej 6 znakow.",
      });
      return;
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      setStatus({
        type: "error",
        message: "Hasla nie sa takie same.",
      });
      return;
    }

    setPasswordLoading(true);
    setStatus({ type: "", message: "" });

    const { error } = await supabase.auth.updateUser({
      password: passwordForm.password,
    });

    if (error) {
      setStatus({
        type: "error",
        message: error.message || "Nie udalo sie zmienic hasla.",
      });
      setPasswordLoading(false);
      return;
    }

    setPasswordForm({ password: "", confirmPassword: "" });
    setStatus({
      type: "success",
      message: "Haslo zostalo zmienione.",
    });
    setPasswordLoading(false);
  };

  return (
    <div
      className="fixed inset-0 z-[1550] flex items-center justify-center bg-black/35 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-[2rem] border border-[#E6DED1] bg-[linear-gradient(180deg,#FBF8F2_0%,#F3ECE1_100%)] p-5 shadow-[0_28px_80px_rgba(34,31,25,0.18)] md:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#8A7F6C]">
              User settings
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-[#1F1D1A]">
              Twoj profil
            </h2>
            <p className="mt-2 text-sm leading-7 text-[#5E564B]">
              Ustaw, jak mamy Cie witac w aplikacji i zaktualizuj haslo.
            </p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[#D8CCBB] bg-white text-[#1F1D1A] transition hover:bg-[#F8F2E9]"
            aria-label="Zamknij ustawienia uzytkownika"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[1.6rem] border border-[#E6DED1] bg-white/82 p-5 shadow-[0_12px_34px_rgba(34,31,25,0.05)]">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] text-[#5F6D45]">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium text-[#1F1D1A]">
                  Dane profilu
                </p>
                <p className="text-sm text-[#6B6255]">
                  Login, imie, nazwisko i podstawowe informacje.
                </p>
              </div>
            </div>

            <form onSubmit={handleProfileSave} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#4D463D]">
                  Email
                </span>
                <input
                  value={email}
                  disabled
                  className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#F4EFE7] px-4 py-3 text-sm text-[#7B7264]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#4D463D]">
                  Login
                </span>
                <input
                  value={profileForm.login}
                  onChange={(event) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      login: event.target.value,
                    }))
                  }
                  className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B9AE9A]"
                  placeholder="np. adam-travels"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#4D463D]">
                    Imie
                  </span>
                  <input
                    value={profileForm.firstName}
                    onChange={(event) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        firstName: event.target.value,
                      }))
                    }
                    className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B9AE9A]"
                    placeholder="np. Adam"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#4D463D]">
                    Nazwisko
                  </span>
                  <input
                    value={profileForm.lastName}
                    onChange={(event) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        lastName: event.target.value,
                      }))
                    }
                    className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B9AE9A]"
                    placeholder="np. Kowalski"
                  />
                </label>
              </div>

              <div className="rounded-[1.2rem] border border-[#E7DDD0] bg-[#FBF8F2] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[#5F6D45]" />
                  <p className="text-sm font-medium text-[#1F1D1A]">Rola</p>
                </div>
                <p className="mt-2 text-sm capitalize text-[#6B6255]">{role}</p>
              </div>

              <button
                type="submit"
                disabled={profileLoading}
                className="inline-flex items-center gap-2 rounded-[1rem] border border-[#D8CCBB] bg-[#1F1D1A] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#2C2924] disabled:opacity-70"
              >
                <Save className="h-4 w-4" />
                {profileLoading ? "Zapisywanie..." : "Zapisz profil"}
              </button>
            </form>
          </section>

          <section className="rounded-[1.6rem] border border-[#E6DED1] bg-white/82 p-5 shadow-[0_12px_34px_rgba(34,31,25,0.05)]">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] text-[#5F6D45]">
                <KeyRound className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium text-[#1F1D1A]">
                  Zmiana hasla
                </p>
                <p className="text-sm text-[#6B6255]">
                  Ustaw nowe haslo do logowania przez Supabase Auth.
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordSave} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#4D463D]">
                  Nowe haslo
                </span>
                <input
                  type="password"
                  minLength={6}
                  value={passwordForm.password}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                  className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B9AE9A]"
                  placeholder="Minimum 6 znakow"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#4D463D]">
                  Powtorz haslo
                </span>
                <input
                  type="password"
                  minLength={6}
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      confirmPassword: event.target.value,
                    }))
                  }
                  className="w-full rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-3 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B9AE9A]"
                  placeholder="Wpisz ponownie nowe haslo"
                />
              </label>

              <button
                type="submit"
                disabled={passwordLoading}
                className="inline-flex items-center gap-2 rounded-[1rem] border border-[#D8CCBB] bg-white px-4 py-3 text-sm font-medium text-[#1F1D1A] transition hover:bg-[#F8F2E9] disabled:opacity-70"
              >
                <KeyRound className="h-4 w-4" />
                {passwordLoading ? "Zmiana hasla..." : "Zmien haslo"}
              </button>
            </form>
          </section>
        </div>

        {status.message && (
          <div
            className={[
              "mt-5 rounded-[1.2rem] border px-4 py-3 text-sm shadow-[0_12px_28px_rgba(36,32,26,0.08)]",
              status.type === "error"
                ? "border-[#E3C7C1] bg-[#FFF3F0] text-[#8C4C43]"
                : "border-[#D5E2C8] bg-[#F4FAEE] text-[#4F6A2F]",
            ].join(" ")}
          >
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}
