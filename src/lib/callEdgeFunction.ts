import { supabase } from "./supabaseClient";

// Shared helper for calling a Supabase Edge Function from the app,
// with the caller's own access token attached (functions like
// secretary-create verify the caller's identity from this). Mirrors
// the pattern already used in the admin panel's screens.
export async function callEdgeFunction<T = any>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  let result: any;
  try {
    result = await response.json();
  } catch {
    throw new Error(`Unexpected response (status ${response.status}) from ${name}.`);
  }

  if (!response.ok && !result?.error) {
    throw new Error(`Request failed (status ${response.status})`);
  }
  if (result?.error) {
    throw new Error(result.error);
  }
  return result as T;
}
