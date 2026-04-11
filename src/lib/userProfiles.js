import { supabase } from "./supabase";

function isMissingTableError(error) {
  return error?.code === "42P01" || /user_profiles/i.test(error?.message || "");
}

function normalizeProfile(row, fallbackUser = null) {
  const metadata = fallbackUser?.user_metadata || {};
  const role = row?.role || metadata.role || "user";
  const login = row?.login || metadata.login || fallbackUser?.email?.split("@")[0] || "";
  const firstName = row?.first_name || metadata.first_name || "";
  const lastName = row?.last_name || metadata.last_name || "";
  const navbarStyle = metadata.navbar_style || "capsule";
  const approved =
    typeof row?.approved === "boolean"
      ? row.approved
      : metadata.account_approved === true;

  return {
    id: row?.id || fallbackUser?.id || "",
    email: row?.email || fallbackUser?.email || "",
    login,
    firstName,
    lastName,
    role,
    approved,
    approvedAt: row?.approved_at || null,
    approvedBy: row?.approved_by || null,
    navbarStyle,
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null,
  };
}

async function syncAuthMetadata(user, profile) {
  if (!supabase || !user?.id) return profile;

  const nextMetadata = {
    ...(user.user_metadata || {}),
    login: profile.login || "",
    first_name: profile.firstName || "",
    last_name: profile.lastName || "",
    full_name: [profile.firstName, profile.lastName].filter(Boolean).join(" "),
    role: profile.role || "user",
    account_approved: profile.approved === true,
    navbar_style: profile.navbarStyle || "capsule",
  };

  const currentMetadata = user.user_metadata || {};
  const hasChanged =
    currentMetadata.login !== nextMetadata.login ||
    currentMetadata.first_name !== nextMetadata.first_name ||
    currentMetadata.last_name !== nextMetadata.last_name ||
    currentMetadata.full_name !== nextMetadata.full_name ||
    currentMetadata.role !== nextMetadata.role ||
    currentMetadata.account_approved !== nextMetadata.account_approved ||
    currentMetadata.navbar_style !== nextMetadata.navbar_style;

  if (!hasChanged) return profile;

  const { data, error } = await supabase.auth.updateUser({
    data: nextMetadata,
  });

  if (error) throw error;

  return normalizeProfile(profile, data.user);
}

export async function ensureCurrentUserProfile(session) {
  if (!supabase || !session?.user) return null;

  const user = session.user;
  const email = user.email || "";
  const metadata = user.user_metadata || {};
  const fallbackLogin = metadata.login || email.split("@")[0] || "";

  try {
    const [
      { data: existingProfile, error: profileError },
      { count: adminCount, error: countError },
    ] = await Promise.all([
      supabase.from("user_profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin"),
    ]);

    if (profileError) throw profileError;
    if (countError) throw countError;

    const resolvedRole =
      existingProfile?.role || metadata.role || (adminCount === 0 ? "admin" : "user");
    const resolvedApproved =
      typeof existingProfile?.approved === "boolean"
        ? existingProfile.approved
        : metadata.account_approved === true || adminCount === 0;

    const payload = {
      id: user.id,
      email,
      login: existingProfile?.login || fallbackLogin,
      first_name: existingProfile?.first_name || metadata.first_name || "",
      last_name: existingProfile?.last_name || metadata.last_name || "",
      role: resolvedRole,
      approved: resolvedApproved,
      approved_at: resolvedApproved
        ? existingProfile?.approved_at || new Date().toISOString()
        : null,
      approved_by: existingProfile?.approved_by || null,
    };

    const { data: savedProfile, error: upsertError } = await supabase
      .from("user_profiles")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (upsertError) throw upsertError;

    return await syncAuthMetadata(user, normalizeProfile(savedProfile, user));
  } catch (error) {
    if (!isMissingTableError(error)) throw error;

    const fallbackProfile = normalizeProfile(
      {
        id: user.id,
        email,
        login: fallbackLogin,
        first_name: metadata.first_name || "",
        last_name: metadata.last_name || "",
        role: metadata.role || "admin",
        approved: true,
        navbarStyle: metadata.navbar_style || "capsule",
      },
      user
    );

    return await syncAuthMetadata(user, fallbackProfile);
  }
}

export async function updateCurrentUserProfile(session, values) {
  if (!supabase || !session?.user) return null;

  const profile = {
    id: session.user.id,
    email: session.user.email || "",
    login: values.login.trim(),
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    role: values.role || session.user.user_metadata?.role || "user",
    approved: session.user.user_metadata?.account_approved === true,
    navbarStyle: values.navbarStyle || session.user.user_metadata?.navbar_style || "capsule",
  };

  try {
    const { error } = await supabase.from("user_profiles").upsert(
      {
        id: profile.id,
        email: profile.email,
        login: profile.login,
        first_name: profile.firstName,
        last_name: profile.lastName,
        role: profile.role,
        approved: profile.approved,
      },
      { onConflict: "id" }
    );

    if (error) throw error;
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }

  return await syncAuthMetadata(session.user, profile);
}

export async function fetchUserProfiles() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []).map((row) => normalizeProfile(row));
}

export async function updateUserRole(userId, role) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .update({ role })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) throw error;

  return normalizeProfile(data);
}

export async function updateUserApproval(userId, approved) {
  if (!supabase) return null;

  const payload = {
    approved,
    approved_at: approved ? new Date().toISOString() : null,
    approved_by: approved ? (await supabase.auth.getUser()).data.user?.id || null : null,
  };

  const { data, error } = await supabase
    .from("user_profiles")
    .update(payload)
    .eq("id", userId)
    .select("*")
    .single();

  if (error) throw error;

  return normalizeProfile(data);
}

export async function deleteUserAccount(userId) {
  if (!supabase) return;

  const { error } = await supabase.rpc("delete_user_account", {
    target_user_id: userId,
  });

  if (error) throw error;
}
