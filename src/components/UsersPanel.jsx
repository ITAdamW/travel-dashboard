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
    <div className="theme-users-card rounded-[1.4rem] border border-[#E8DFD2] bg-white p-4 shadow-[0_10px_24px_rgba(36,32,26,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-medium text-[#1F1D1A]">
            {displayName}
          </p>
          <p className="mt-1 truncate text-sm text-[#6B6255]">{profile.email}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#8A7F6C]">
            Login: {profile.login || "brak"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isCurrentUser && (
            <span className="theme-users-badge rounded-full border border-[#D8CCBB] bg-[#F8F2E9] px-3 py-1 text-xs font-medium text-[#5E564B]">
              Ty
            </span>
          )}
          <span
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium",
              profile.approved
                ? "border-[#D5E2C8] bg-[#F4FAEE] text-[#4F6A2F]"
                : "border-[#E8D7BE] bg-[#FFF8EE] text-[#8A6A28]",
            ].join(" ")}
          >
            {profile.approved ? "zaakceptowane" : "oczekuje"}
          </span>
          <span className="theme-users-role rounded-full border border-[#D5E2C8] bg-[#F4FAEE] px-3 py-1 text-xs font-medium capitalize text-[#4F6A2F]">
            {profile.role}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          value={profile.role}
          onChange={(event) => onChangeRole(profile.id, event.target.value)}
          disabled={busy || isCurrentUser}
          className="theme-users-select rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] px-4 py-2.5 text-sm text-[#1F1D1A] disabled:opacity-60"
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
              ? "border-[#E5DCCF] bg-white text-[#6B6255] hover:bg-[#FBF8F2]"
              : "border-[#D5E2C8] bg-[#F4FAEE] text-[#4F6A2F] hover:bg-[#ECF6E0]",
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
    <section className="theme-users-shell grid gap-5 xl:grid-cols-[0.86fr_1.14fr]">
      <aside className="theme-users-panel rounded-[2rem] border border-[#E6DED1] bg-white p-6 shadow-[0_16px_60px_rgba(34,31,25,0.05)]">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-[1rem] border border-[#E5DCCF] bg-[#FBF8F2] text-[#5F6D45]">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#8A7F6C]">
              Panel 7
            </p>
            <h2 className="mt-1 text-3xl font-semibold text-[#1F1D1A]">
              Users
            </h2>
          </div>
        </div>

        <p className="mt-4 text-sm leading-7 text-[#5E564B]">
          Admin moze zaakceptowac konto do logowania, zmieniac role i usuwac
          konta, ktore nie powinny miec dostepu do aplikacji.
        </p>

        <div className="theme-users-note mt-6 rounded-[1.4rem] border border-[#E8DFD2] bg-[#FBF8F2] p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#5F6D45]" />
            <p className="text-sm font-medium text-[#1F1D1A]">Workflow kont</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#6B6255]">
            Nowy uzytkownik po rejestracji trafia na liste jako konto oczekujace.
            Dopiero po akceptacji w tym panelu moze zalogowac sie do systemu.
          </p>
        </div>

        <button
          onClick={loadProfiles}
          disabled={loading}
          className="theme-users-button mt-6 inline-flex items-center gap-2 rounded-[1rem] border border-[#D8CCBB] bg-white px-4 py-3 text-sm font-medium text-[#1F1D1A] transition hover:bg-[#F8F2E9] disabled:opacity-70"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Odswiez liste
        </button>
      </aside>

      <div className="theme-users-panel rounded-[2rem] border border-[#E6DED1] bg-white p-6 shadow-[0_16px_60px_rgba(34,31,25,0.05)]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#8A7F6C]">
              Registered users
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-[#1F1D1A]">
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
            <div className="theme-users-empty rounded-[1.4rem] border border-dashed border-[#DDD2C3] bg-[#FBF8F2] px-5 py-8 text-sm text-[#7C7263]">
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
