import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getShopContext } from "../../lib/authSession";
import { normalizeAfghanPhone } from "../../lib/phone";
import { callEdgeFunction } from "../../lib/callEdgeFunction";
import { useTranslation } from "../../i18n/useTranslation";
import { colors, inputStyle, primaryButtonStyle, radius, secondaryButtonStyle } from "../../theme";
import { Card, EmptyState, LoadingRows, PageHeader, Pill } from "../../components/ui";
import { PersonIcon, PlusIcon } from "../../components/icons";

interface Secretary {
  id: string;
  name: string;
  phone_number: string;
  status: "active" | "revoked";
  created_at: string;
}

// Owner-only screen (see migrations/020_shop_secretaries.sql — a
// secretary has no rows they'd see here anyway, since "owner manages
// own secretaries" only lets an owner see/manage their OWN
// secretaries list, not their own membership row from someone else's
// perspective). A secretary who lands on this route sees an empty
// list and can't create anything — the create call is rejected
// server-side by secretary-create's "must be an owner" check — but
// we also redirect them straight back to Settings for a cleaner UX.
export default function ManageSecretariesScreen() {
  const navigate = useNavigate();
  const { tr } = useTranslation();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [secretaries, setSecretaries] = useState<Secretary[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The only place a freshly generated password is ever visible —
  // shown once, right after creating/resetting, so the owner can
  // relay it. Never stored anywhere in plaintext.
  const [credentialNotice, setCredentialNotice] = useState<{ name: string; phone: string; password: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    getShopContext().then(({ shopProfileId, role }) => {
      if (role === "secretary") {
        navigate("/settings", { replace: true });
        return;
      }
      if (shopProfileId) {
        setProfileId(shopProfileId);
        load(shopProfileId);
      }
    });
  }, []);

  async function load(ownerProfileId: string) {
    const { data, error: loadErr } = await supabase
      .from("shop_secretaries")
      .select("id, name, phone_number, status, created_at")
      .eq("owner_profile_id", ownerProfileId)
      .order("created_at", { ascending: false });

    if (loadErr) {
      console.error("failed to load secretaries:", loadErr);
      setError(tr("secretaries.loadError"));
      setSecretaries([]);
      return;
    }
    setSecretaries(data ?? []);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const result = await callEdgeFunction<{ name: string; login_phone: string; temp_password: string }>(
        "secretary-create",
        { name: name.trim(), phone_number: phone.trim() }
      );
      setCredentialNotice({ name: result.name, phone: result.login_phone, password: result.temp_password });
      setName("");
      setPhone("");
      setShowAdd(false);
      if (profileId) load(profileId);
    } catch (err) {
      console.error("failed to create secretary:", err);
      const message = err instanceof Error ? err.message : "";
      setError(message === "phone_already_registered" ? tr("secretaries.phoneTaken") : tr("secretaries.createError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(secretary: Secretary) {
    if (!profileId || busyId) return;
    setBusyId(secretary.id);
    setError(null);
    const nextStatus = secretary.status === "active" ? "revoked" : "active";

    const { error: updateErr } = await supabase
      .from("shop_secretaries")
      .update({ status: nextStatus })
      .eq("id", secretary.id)
      .eq("owner_profile_id", profileId);

    setBusyId(null);
    if (updateErr) {
      console.error("failed to update secretary status:", updateErr);
      setError(tr("secretaries.updateError"));
      return;
    }
    setSecretaries((prev) => (prev ?? []).map((s) => (s.id === secretary.id ? { ...s, status: nextStatus } : s)));
  }

  async function handleResetPassword(secretary: Secretary) {
    if (busyId) return;
    setBusyId(secretary.id);
    setError(null);

    try {
      const result = await callEdgeFunction<{ name: string; phone_number: string; new_password: string }>(
        "secretary-reset-password",
        { secretary_id: secretary.id }
      );
      setCredentialNotice({ name: result.name, phone: result.phone_number, password: result.new_password });
    } catch (err) {
      console.error("failed to reset secretary password:", err);
      setError(tr("secretaries.resetError"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: 16, paddingBottom: 28 }}>
      <PageHeader title={tr("secretaries.title")} onBack={() => navigate("/settings")} />
      <p style={{ fontSize: 12.5, color: colors.textSecondary, lineHeight: 1.6, margin: "-8px 0 16px" }}>{tr("secretaries.explainer")}</p>

      {error && (
        <p style={{ color: colors.danger, fontSize: 13, background: colors.dangerSoft, padding: "8px 10px", borderRadius: radius.sm, marginBottom: 12 }}>{error}</p>
      )}

      {credentialNotice && (
        <Card style={{ marginBottom: 16, border: `1px solid ${colors.primary}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, marginBottom: 6 }}>
            {tr("secretaries.credentialsTitle", { name: credentialNotice.name })}
          </div>
          <p style={{ fontSize: 12, color: colors.textSecondary, margin: "0 0 10px" }}>{tr("secretaries.credentialsHint")}</p>
          <div style={{ display: "grid", gap: 6, fontSize: 13.5 }}>
            <div><strong>{tr("secretaries.phoneLabel")}:</strong> {credentialNotice.phone}</div>
            <div><strong>{tr("secretaries.passwordLabel")}:</strong> {credentialNotice.password}</div>
          </div>
          <button onClick={() => setCredentialNotice(null)} style={{ ...secondaryButtonStyle, marginTop: 12 }}>{tr("common.close")}</button>
        </Card>
      )}

      {!showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          style={{ ...primaryButtonStyle, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <PlusIcon size={16} />
          {tr("secretaries.add")}
        </button>
      )}

      {showAdd && (
        <Card style={{ marginBottom: 16 }}>
          <form onSubmit={handleAdd} style={{ display: "grid", gap: 10 }}>
            <input placeholder={tr("secretaries.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} required />
            <input
              placeholder={tr("secretaries.phonePlaceholder")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={(e) => setPhone(normalizeAfghanPhone(e.target.value))}
              inputMode="tel"
              style={inputStyle}
              required
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={submitting} style={{ ...primaryButtonStyle, flex: 1, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "…" : tr("common.save")}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} style={{ ...secondaryButtonStyle, flex: 1 }}>{tr("common.cancel")}</button>
            </div>
          </form>
        </Card>
      )}

      {secretaries === null && <LoadingRows count={2} />}
      {secretaries !== null && secretaries.length === 0 && <EmptyState>{tr("secretaries.none")}</EmptyState>}
      {secretaries !== null && secretaries.length > 0 && (
        <Card style={{ padding: 4 }}>
          {secretaries.map((s, i) => (
            <div
              key={s.id}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 10px", borderTop: i === 0 ? "none" : `1px solid ${colors.border}` }}
            >
              <div style={{ width: 36, height: 36, borderRadius: radius.pill, background: colors.primarySoft, color: colors.primary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <PersonIcon size={17} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>{s.name}</div>
                <div style={{ fontSize: 11.5, color: colors.textFaint }}>{s.phone_number}</div>
              </div>
              <Pill bg={s.status === "active" ? colors.successSoft : colors.surfaceMuted} fg={s.status === "active" ? colors.success : colors.textFaint}>
                {tr(s.status === "active" ? "secretaries.active" : "secretaries.revoked")}
              </Pill>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button
                  onClick={() => handleResetPassword(s)}
                  disabled={busyId === s.id}
                  style={{ fontSize: 10.5, fontWeight: 600, color: colors.primary, background: "none", border: "none", cursor: "pointer", padding: 0, opacity: busyId === s.id ? 0.5 : 1 }}
                >
                  {tr("secretaries.resetPassword")}
                </button>
                <button
                  onClick={() => handleToggleStatus(s)}
                  disabled={busyId === s.id}
                  style={{ fontSize: 10.5, fontWeight: 600, color: s.status === "active" ? colors.danger : colors.success, background: "none", border: "none", cursor: "pointer", padding: 0, opacity: busyId === s.id ? 0.5 : 1 }}
                >
                  {tr(s.status === "active" ? "secretaries.revoke" : "secretaries.reactivate")}
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
