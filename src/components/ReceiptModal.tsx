import type { ReactNode } from "react";
import { colors, radius, shadow } from "../theme";
import { useTranslation } from "../i18n/useTranslation";
import { DownloadIcon, StoreIcon, WhatsappIcon } from "./icons";
import type { ShopProfile } from "../lib/shopProfile";

interface ReceiptModalProps {
  onClose: () => void;
  shop: ShopProfile;
  title: string;
  dateLabel: string;
  party?: {
    label: string;
    name: string;
    phone: string | null;
    whatsapp: string | null;
    address: string | null;
  };
  rows: { label: string; value: string; emphasis?: boolean; tone?: "success" | "danger" }[];
  totalLabel: string;
  totalValue: string;
  onDownload: () => void;
  whatsappHref: string;
}

// Shared "View" presentation for both transaction receipts and
// account-statement receipts — the caller builds `rows`/`party`/totals
// from whichever data it has, this component only handles layout.
// This is the ONE part of the receipt flow that's fully localized
// (plain HTML/CSS renders any script fine); the downloaded PDF is
// English/Latin-digit only — see the note in lib/receipt.ts for why.
export default function ReceiptModal({
  onClose,
  shop,
  title,
  dateLabel,
  party,
  rows,
  totalLabel,
  totalValue,
  onDownload,
  whatsappHref,
}: ReceiptModalProps) {
  const { tr } = useTranslation();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(16, 27, 51, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.surface,
          borderRadius: radius.lg,
          width: "100%",
          maxWidth: 420,
          maxHeight: "88vh",
          overflowY: "auto",
          boxShadow: shadow.raised,
        }}
      >
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: radius.pill, background: colors.primarySoft, color: colors.primary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <StoreIcon size={17} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: colors.textPrimary }}>{shop.shop_name}</div>
              <div style={{ fontSize: 11.5, color: colors.textFaint }}>{shop.owner_name}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 4 }}>
            {shop.phone_number}
            {shop.whatsapp_number ? ` · WA ${shop.whatsapp_number}` : ""}
            {shop.address ? ` · ${shop.address}` : ""}
          </div>

          <div style={{ borderTop: `1px dashed ${colors.border}`, margin: "14px 0" }} />

          <div style={{ fontWeight: 700, fontSize: 14, color: colors.primary }}>{title}</div>
          <div style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 2 }}>{dateLabel}</div>

          {party && (
            <div style={{ marginTop: 12, background: colors.surfaceMuted, borderRadius: radius.md, padding: 10 }}>
              <div style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 600 }}>{party.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, marginTop: 2 }}>{party.name}</div>
              {(party.phone || party.whatsapp) && (
                <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 2 }}>
                  {[party.phone, party.whatsapp ? `WA ${party.whatsapp}` : null].filter(Boolean).join(" · ")}
                </div>
              )}
              {party.address && <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 1 }}>{party.address}</div>}
            </div>
          )}

          <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
            {rows.map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: row.emphasis ? 13.5 : 12.5, fontWeight: row.emphasis ? 700 : 500 }}>
                <span style={{ color: colors.textSecondary }}>{row.label}</span>
                <span style={{ color: row.tone === "success" ? colors.success : row.tone === "danger" ? colors.danger : colors.textPrimary }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>{totalLabel}</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: colors.primary }}>{totalValue}</span>
          </div>
        </div>

        <div style={{ padding: "0 20px 20px", display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <ActionButton icon={<DownloadIcon size={15} />} label={tr("receipt.download")} onClick={onDownload} />
            <a href={whatsappHref} target="_blank" rel="noreferrer" style={{ flex: 1, textDecoration: "none" }}>
              <ActionButton icon={<WhatsappIcon size={15} color="#25D366" />} label={tr("receipt.whatsapp")} onClick={() => {}} tone="whatsapp" />
            </a>
          </div>
          <p style={{ fontSize: 10, color: colors.textFaint, margin: 0, textAlign: "center" }}>{tr("receipt.pdfLanguageNote")}</p>
          <button onClick={onClose} style={{ background: "none", border: "none", color: colors.textSecondary, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "4px 0" }}>
            {tr("receipt.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, tone }: { icon: ReactNode; label: string; onClick: () => void; tone?: "whatsapp" }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "11px 10px",
        borderRadius: radius.md,
        border: `1px solid ${tone === "whatsapp" ? "#BFEED2" : colors.border}`,
        background: tone === "whatsapp" ? "#EAFBF1" : colors.surface,
        color: tone === "whatsapp" ? "#128C4A" : colors.textPrimary,
        fontSize: 12.5,
        fontWeight: 700,
        cursor: "pointer",
        width: "100%",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
