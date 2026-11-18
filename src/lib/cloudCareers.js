import { supabase } from "./supabase.js";
import { encodeCloudSave, decodeCloudSave } from "./saveEnvelope.js";

const TABLE = "career_saves";

export function cloudSavesAvailable() {
  return Boolean(supabase);
}

export async function getCloudSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function subscribeToCloudAuth(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(session, event));
  return () => data.subscription.unsubscribe();
}

export async function signUpForCloud(email, password) {
  if (!supabase) throw new Error("Cloud saves are not configured yet.");
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(), password,
    options: { emailRedirectTo: `${window.location.origin}/` },
  });
  if (error) throw error;
  return data;
}

export async function signInToCloud(email, password) {
  if (!supabase) throw new Error("Cloud saves are not configured yet.");
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data;
}

export async function signOutOfCloud() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function sendPasswordReset(email) {
  if (!supabase) throw new Error("Cloud saves are not configured yet.");
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/`,
  });
  if (error) throw error;
}

export async function updateCloudPassword(password) {
  if (!supabase) throw new Error("Cloud saves are not configured yet.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function listCloudCareers(userId) {
  const { data, error } = await supabase.from(TABLE)
    .select("save_id,save_data,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const decoded = await Promise.allSettled((data ?? []).map((row) => decodeCloudSave(row.save_data)));
  return {
    saves: decoded.filter((result) => result.status === 'fulfilled').map((result) => result.value),
    damagedCount: decoded.filter((result) => result.status === 'rejected').length,
  };
}

export async function putCloudCareer(userId, save) {
  const saveData = await encodeCloudSave(save);
  const { error } = await supabase.from(TABLE).upsert({
    user_id: userId,
    save_id: save.id,
    save_data: saveData,
    updated_at: save.savedAt,
  }, { onConflict: "user_id,save_id" });
  if (error) throw error;
}

export async function removeCloudCareer(userId, saveId) {
  const { error } = await supabase.from(TABLE).delete()
    .eq("user_id", userId).eq("save_id", saveId);
  if (error) throw error;
}

export async function sendCloudErrorReport(reference, screen, error, componentStack) {
  if (!supabase) throw new Error("Issue reporting is unavailable.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to send an issue report, or copy the issue details.");
  const { error: writeError } = await supabase.from("client_error_reports").insert({
    user_id: user.id,
    reference,
    screen: String(screen).slice(0, 120),
    error_name: String(error?.name ?? "Error").slice(0, 120),
    error_message: String(error?.message ?? "Unknown error").slice(0, 2000),
    component_stack: String(componentStack ?? "").slice(0, 8000),
  });
  if (writeError) throw writeError;
}
