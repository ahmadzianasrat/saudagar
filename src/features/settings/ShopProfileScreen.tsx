import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { fetchShopProfile } from "../../lib/shopProfile";
import { normalizeAfghanPhone } from "../../lib/phone";
import { useTranslation } from "../../i18n/useTranslation";
import { colors, inputStyle, primaryButtonStyle, radius } from "../../theme";
import { Card, PageHeader } from "../../components/ui";
import { StoreIcon } from "../../components/icons";

// Address and WhatsApp number are new (Phase 2, for receipts) —
// existing shop owners will see these blank until they fill them in
// here. Name/shop name/mobile were already collected at signup, so
// this screen also lets them correct those rather than duplicating
// that data-entry step elsewhere.
export default function ShopProfileScreen() {
  const navigate = useNavigate();
  const { tr } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [ownerName, setOwnerName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchShopProfile().then((profile) => {
      if (profile) {
        setOwnerName(profile.owner_name);
        setShopName(profile.shop_name);
        setPhoneNumber(profile.phone_number);
        setWhatsappNumber(profile.whatsapp_number ?? "");
        setAddress(profile.address ?? "");
      } else {
        setError(tr("shopProfile.loadError"));
      }
      setLoading(false);
    });
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaving(false);
      return;
    }

    // phone_number is intentionally NOT editable here — it's also the
    // login identifier (mapped to a synthetic email), so changing it
    // would need the same admin-mediated flow as a password reset,
    // not a plain profile edit.
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        owner_name: ownerName,
        shop_name: shopName,
        whatsapp_number: whatsappNumber ? normalizeAfghanPhone(whatsappNumber) : null,
        address: address || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userData.user.id);

    setSaving(false);
    if (updateError) {
      console.error("failed to save shop profile:", updateError);
      setError(tr("shopProfile.saveError"));
      return;
    }
    setSuccess(true);
  }

  return (
    <div style={{ padding: 16, paddingBottom: 28 }}>
      <PageHeader title={tr("shopProfile.title")} onBack={() => navigate("/settings")} />

      <Card style={{ textAlign: "center", marginBottom: 16, paddingTop: 20, paddingBottom: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: radius.pill, background: colors.primarySoft, color: colors.primary, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>
          <StoreIcon size={22} />
        </div>
        <div style={{ fontSize: 12.5, color: colors.textSecondary, maxWidth: 260, margin: "0 auto" }}>{tr("shopProfile.hint")}</div>
      </Card>

      {error && (
        <p style={{ color: colors.danger, fontSize: 13, background: colors.dangerSoft, padding: "8px 10px", borderRadius: radius.sm }}>{error}</p>
      )}
      {success && (
        <p style={{ color: colors.success, fontSize: 13, background: colors.successSoft, padding: "8px 10px", borderRadius: radius.sm }}>{tr("shopProfile.saved")}</p>
      )}

      {!loading && (
        <Card>
          <form onSubmit={handleSave} style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary, display: "block", marginBottom: 5 }}>{tr("shopProfile.ownerName")}</label>
              <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary, display: "block", marginBottom: 5 }}>{tr("shopProfile.shopName")}</label>
              <input value={shopName} onChange={(e) => setShopName(e.target.value)} required style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary, display: "block", marginBottom: 5 }}>{tr("shopProfile.mobileNumber")}</label>
              <input value={phoneNumber} disabled style={{ ...inputStyle, opacity: 0.6 }} />
              <p style={{ fontSize: 10.5, color: colors.textFaint, margin: "4px 0 0" }}>{tr("shopProfile.mobileLocked")}</p>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary, display: "block", marginBottom: 5 }}>{tr("shopProfile.whatsappNumber")}</label>
              <input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} inputMode="tel" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary, display: "block", marginBottom: 5 }}>{tr("shopProfile.address")}</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} />
            </div>
            <button type="submit" disabled={saving} style={{ ...primaryButtonStyle, opacity: saving ? 0.7 : 1 }}>
              {saving ? "…" : tr("shopProfile.save")}
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
