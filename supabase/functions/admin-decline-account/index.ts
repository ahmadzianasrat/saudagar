// Simple counterpart to admin-approve-account — no user/profile is
// ever created for a declined request, keeping account_requests
// fully separate from real user data.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    }

    const { data: admin } = await supabase
      .from("admin_users")
      .select("*")
      .eq("id", userData.user.id)
      .single();

    if (!admin || !admin.can_approve_accounts) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
    }

    const { request_id, reason } = await req.json();
    if (!request_id) {
      return new Response(JSON.stringify({ error: "missing_request_id" }), { status: 400 });
    }

    await supabase
      .from("account_requests")
      .update({
        status: "declined",
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request_id)
      .eq("status", "pending");

    // `reason` isn't persisted in the current schema — add a column
    // if you want to keep a record of why a request was declined.
    void reason;

    return new Response(JSON.stringify({ status: "declined" }), { status: 200 });
  } catch (err) {
    console.error("admin-decline-account error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500 });
  }
});
