import { useRef, useState, type ReactNode } from "react";
import { colors, radius, shadow } from "../theme";
import { useTranslation } from "../i18n/useTranslation";
import { DownloadIcon, StoreIcon, WhatsappIcon } from "./icons";
import type { ShopProfile } from "../lib/shopProfile";
import { captureElementAsPng, downloadBlob, shareImageFile } from "../lib/receiptImage";
import { whatsAppShareLink } from "../lib/receipt";

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
  /** Base filename, without extension — ".png" is appended. */
  filename: string;
  /** Plain-text summary used for the wa.me fallback (and as the Web Share caption when the image itself is shared). */
  whatsappText: string;
  /** Preferred recipient for the wa.me fallback, if known. */
  whatsappPhone?: string | null;
}

// Shared "View" presentation for both transaction receipts and
// account-statement receipts — the caller builds `rows`/`party`/totals
// from whichever data it has, this component only handles layout.
// The "Download" and "Share" actions both rasterize `printableRef`
// below (the same localized content rendered right here on screen)
// into a PNG — so whatever language/script is showing is exactly
// what ends up in the saved/shared image, no separate English-only
// rendering path involved.
export default function ReceiptModal({
  onClose,
  shop,
  title,
  dateLabel,
  party,
  rows,
  totalLabel,
  totalValue,
  filename,
  whatsappText,
  whatsappPhone,
}: ReceiptModalProps) {
  const { tr } = useTranslation();
  const printableRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [captureError, setCaptureError] = useState(false);

  async function capture(): Promise<Blob> {
    if (!printableRef.current) throw new Error("Receipt content not ready");
    return captureElementAsPng(printableRef.current);
  }

  async function handleDownload() {
    setBusy("download");
    setCaptureError(false);
    try {
      const blob = await capture();
      downloadBlob(blob, `${filename}.png`);
    } catch (err) {
      console.error("failed to render receipt image:", err);
      setCaptureError(true);
    } finally {
      setBusy(null);
    }
  }

  async function handleWhatsApp() {
    setBusy("share");
    setCaptureError(false);
    try {
      const blob = await capture();
      const shared = await shareImageFile(blob, `${filename}.png`, whatsappText, title);
      if (!shared) {
        window.open(whatsAppShareLink(whatsappText, whatsappPhone), "_blank");
      }
    } catch (err) {
      console.error("failed to render/share receipt image:", err);
      window.open(whatsAppShareLink(whatsappText, whatsappPhone), "_blank");
    } finally {
      setBusy(null);
    }
  }

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
        {/* Everything inside this div is what gets rasterized for
            download/share — keep action buttons and the close
            button OUTSIDE it, below. */}
        <div ref={printableRef} style={{ padding: 20, background: colors.surface }}>
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
            <ActionButton
              icon={<DownloadIcon size={15} />}
              label={busy === "download" ? tr("receipt.generating") : tr("receipt.download")}
              onClick={handleDownload}
              disabled={busy !== null}
            />
            <ActionButton
              icon={<WhatsappIcon size={15} color="#25D366" />}
              label={busy === "share" ? tr("receipt.generating") : tr("receipt.whatsapp")}
              onClick={handleWhatsApp}
              disabled={busy !== null}
              tone="whatsapp"
            />
          </div>
          {captureError && (
            <p style={{ fontSize: 11, color: colors.danger, margin: 0, textAlign: "center" }}>{tr("receipt.generateFailed")}</p>
          )}
          <button onClick={onClose} style={{ background: "none", border: "none", color: colors.textSecondary, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "4px 0" }}>
            {tr("receipt.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, tone, disabled }: { icon: ReactNode; label: string; onClick: () => void; tone?: "whatsapp"; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
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
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.65 : 1,
        width: "100%",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
