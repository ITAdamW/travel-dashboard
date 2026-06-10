import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Shield, Trash2, UserCheck, Users, UserX } from "lucide-react";
import {
  deleteUserAccount,
  fetchUserProfiles,
  updateUserApproval,
  updateUserRole,
} from "../lib/userProfiles";

function UserCard({
  profile,
  currentUserId,
  busy,
  onApprove,
  onChangeRole,
  onDelete,
}) {
  const displayName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    profile.login ||
    profile.email;
  const isCurrentUser = profile.id === currentUserId;

  return (
    <div className="theme-users-card rounded-[1.25rem] border border-[#DCECF0] bg-white p-4 shadow-[0_12px_30px_rgba(15,58,66,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-[#132334]">
            {displayName}
          </p>
          <p className="mt-1 truncate text-sm text-[#647782]">{profile.email}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#008EA1]">
            Login: {profile.login || "brak"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isCurrentUser && (
            <span className="theme-users-badge rounded-full border border-[#B8D9DE] bg-[#E6FAFC] px-3 py-1 text-xs font-semibold text-[#007786]">
              Ty
            </span>
          )}
          <span
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium",
              profile.approved
                ? "border-[#9EDDE5] bg-[#E6FAFC] text-[#007786]"
                : "border-[#F1D59D] bg-[#FFF8E8] text-[#8A651C]",
            ].join(" ")}
          >
            {profile.approved ? "zaakceptowane" : "oczekuje"}
          </span>
          <span className="theme-users-role rounded-full border border-[#DCECF0] bg-[#F3F8F9] px-3 py-1 text-xs font-semibold capitalize text-[#52616D]">
            {profile.role}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          value={profile.role}
          onChange={(event) => onChangeRole(profile.id, event.target.value)}
          disabled={busy || isCurrentUser}
          className="theme-users-select h-10 rounded-lg border border-[#DCECF0] bg-white px-3 text-sm text-[#132334] outline-none focus:border-[#008EA1] disabled:opacity-60"
        >
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>

        <button
          type="button"
          onClick={() => onApprove(profile.id, !profile.approved)}
          disabled={busy || isCurrentUser}
          className={[
            "inline-flex items-center gap-2 rounded-[1rem] border px-4 py-2.5 text-sm font-medium transition disabled:opacity-60",
            profile.approved
              ? "border-[#B8D9DE] bg-white text-[#52616D] hover:bg-[#F3FCFD]"
              : "border-[#008EA1] bg-[#008EA1] text-white hover:bg-[#007786]",
          ].join(" ")}
        >
          {profile.approved ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
          {profile.approved ? "Cofnij akceptacje" : "Akceptuj konto"}
        </button>

        <button
          type="button"
          onClick={() => onDelete(profile)}
          disabled={busy || isCurrentUser}
          className="inline-flex items-center gap-2 rounded-[1rem] border border-[#E7CFC9] bg-[#FFF7F5] px-4 py-2.5 text-sm font-medium text-[#8C4C43] transition hover:bg-[#FFF0EC] disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" />
          Usun konto
        </button>
      </div>
    </div>
  );
}

export default function UsersPanel({ currentUserId }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });

  const sortedProfiles = useMemo(
    () =>
      [...profiles].sort((a, b) => {
        if (a.id === currentUserId) return -1;
        if (b.id === currentUserId) return 1;
        if (a.approved !== b.approved) return a.approved ? 1 : -1;
        return a.email.localeCompare(b.email);
      }),
    [profiles, currentUserId]
  );

  const loadProfiles = async () => {
    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const nextProfiles = await fetchUserProfiles();
      setProfiles(nextProfiles);
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error.message ||
          "Nie udalo sie pobrac listy uzytkownikow. Sprawdz, czy migracje user_profiles zostaly wdrozone.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleChangeRole = async (userId, role) => {
    setSavingUserId(userId);
    setStatus({ type: "", message: "" });

    try {
      const updatedProfile = await updateUserRole(userId, role);
      setProfiles((prev) =>
        prev.map((profile) =>
          profile.id === userId ? { ...profile, role: updatedProfile.role } : profile
        )
      );
      setStatus({
        type: "success",
        message: "Rola uzytkownika zostala zaktualizowana.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error.message ||
          "Nie udalo sie zmienic roli uzytkownika. Sprawdz polityki RLS i migracje.",
      });
    } finally {
      setSavingUserId("");
    }
  };

  const handleApprove = async (userId, approved) => {
    setSavingUserId(userId);
    setStatus({ type: "", message: "" });

    try {
      const updatedProfile = await updateUserApproval(userId, approved);
      setProfiles((prev) =>
        prev.map((profile) =>
          profile.id === userId
            ? {
                ...profile,
                approved: updatedProfile.approved,
                approvedAt: updatedProfile.approvedAt,
                approvedBy: updatedProfile.approvedBy,
              }
            : profile
        )
      );
      setStatus({
        type: "success",
        message: approved
          ? "Konto zostalo zaakceptowane."
          : "Akceptacja konta zostala cofnieta.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error.message ||
          "Nie udalo sie zmienic statusu konta. Sprawdz migracje i polityki dostepu.",
      });
    } finally {
      setSavingUserId("");
    }
  };

  const handleDelete = async (profile) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        `Usunac konto ${profile.email}? Ta operacja usunie rowniez mozliwosc logowania.`
      );

      if (!confirmed) return;
    }

    setSavingUserId(profile.id);
    setStatus({ type: "", message: "" });

    try {
      await deleteUserAccount(profile.id);
      setProfiles((prev) => prev.filter((item) => item.id !== profile.id));
      setStatus({
        type: "success",
        message: "Konto zostalo usuniete.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error.message ||
          "Nie udalo sie usunac konta. Sprawdz funkcje SQL delete_user_account.",
      });
    } finally {
      setSavingUserId("");
    }
  };

  return (
    <section className="theme-users-shell grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="theme-users-panel rounded-[1.5rem] border border-[#DCECF0] bg-white p-6 shadow-[0_18px_55px_rgba(15,58,66,0.07)]">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#E6FAFC] text-[#008EA1]">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#008EA1]">
              Administracja
            </p>
            <h2 className="mt-1 text-3xl font-semibold text-[#132334]">
              Użytkownicy
            </h2>
          </div>
        </div>

        <p className="mt-4 text-sm leading-7 text-[#647782]">
          Admin moze zaakceptowac konto do logowania, zmieniac role i usuwac
          konta, ktore nie powinny miec dostepu do aplikacji.
        </p>

        <div className="theme-users-note mt-6 rounded-xl border border-[#CFE7EB] bg-[#F7FCFD] p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#008EA1]" />
            <p className="text-sm font-semibold text-[#132334]">Akceptacja kont</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#647782]">
            Nowy uzytkownik po rejestracji trafia na liste jako konto oczekujace.
            Dopiero po akceptacji w tym panelu moze zalogowac sie do systemu.
          </p>
        </div>

        <button
          onClick={loadProfiles}
          disabled={loading}
          className="theme-users-button mt-6 inline-flex h-11 items-center gap-2 rounded-lg border border-[#B8D9DE] bg-white px-4 text-sm font-semibold text-[#007786] transition hover:border-[#008EA1] hover:bg-[#F3FCFD] disabled:opacity-70"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Odswiez liste
        </button>
      </aside>

      <div className="theme-users-panel rounded-[1.5rem] border border-[#DCECF0] bg-white p-6 shadow-[0_18px_55px_rgba(15,58,66,0.07)]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#008EA1]">
              Zarejestrowane konta
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-[#132334]">
              {loading ? "Ladowanie..." : `${sortedProfiles.length} kont`}
            </h3>
          </div>
        </div>

        <div className="space-y-4">
          {sortedProfiles.map((profile) => (
            <UserCard
              key={profile.id}
              profile={profile}
              currentUserId={currentUserId}
              onChangeRole={handleChangeRole}
              onApprove={handleApprove}
              onDelete={handleDelete}
              busy={savingUserId === profile.id}
            />
          ))}

          {!loading && !sortedProfiles.length && (
            <div className="theme-users-empty rounded-xl border border-dashed border-[#B8D9DE] bg-[#F7FCFD] px-5 py-8 text-sm text-[#647782]">
              Brak profili do wyswietlenia.
            </div>
          )}
        </div>
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
    </section>
  );
}
