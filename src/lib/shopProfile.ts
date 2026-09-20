import { supabase } from "./supabaseClient";
import { getCurrentUserId } from "./authSession";
import { cachedQuery } from "./offlineQueue";

export interface ShopProfile {
  owner_name: string;
  shop_name: string;
  phone_number: string;
  whatsapp_number: string | null;
  address: string | null;
}

export async function fetchShopProfile(): Promise<ShopProfile | null> {
  // getCurrentUserId() (not supabase.auth.getUser()) so this — used
  // for the header on every screen and for receipts — still works
  // offline instead of silently failing before the query below even
  // runs. See lib/authSession.ts.
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await cachedQuery(`profile:shop:${userId}`, () =>
    supabase
      .from("profiles")
      .select("owner_name, shop_name, phone_number, whatsapp_number, address")
      .eq("id", userId)
      .single()
  );

  if (error) {
    console.error("failed to fetch shop profile:", error);
    return null;
  }
  return data;
}
