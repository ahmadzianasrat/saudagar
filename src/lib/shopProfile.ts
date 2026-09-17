import { supabase } from "./supabaseClient";

export interface ShopProfile {
  owner_name: string;
  shop_name: string;
  phone_number: string;
  whatsapp_number: string | null;
  address: string | null;
}

export async function fetchShopProfile(): Promise<ShopProfile | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("owner_name, shop_name, phone_number, whatsapp_number, address")
    .eq("id", userData.user.id)
    .single();

  if (error) {
    console.error("failed to fetch shop profile:", error);
    return null;
  }
  return data;
}
