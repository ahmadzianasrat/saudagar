import { supabase } from "./supabaseClient";
import { getShopContext } from "./authSession";
import { cachedQuery } from "./offlineQueue";

export interface ShopProfile {
  owner_name: string;
  shop_name: string;
  phone_number: string;
  whatsapp_number: string | null;
  address: string | null;
}

export async function fetchShopProfile(): Promise<ShopProfile | null> {
  // getShopContext() resolves the SHOP's profile id — the owner's own
  // id if this login is the owner, or their employer's id if it's a
  // secretary — so a secretary sees the same shop header/receipt
  // details the owner does. It's also offline-safe (see
  // lib/authSession.ts) instead of silently failing before the query
  // below even runs.
  const { shopProfileId } = await getShopContext();
  if (!shopProfileId) return null;

  const { data, error } = await cachedQuery(`profile:shop:${shopProfileId}`, () =>
    supabase
      .from("profiles")
      .select("owner_name, shop_name, phone_number, whatsapp_number, address")
      .eq("id", shopProfileId)
      .single()
  );

  if (error) {
    console.error("failed to fetch shop profile:", error);
    return null;
  }
  return data;
}
