// ============================================================
// wa.me text-summary fallback.
// ------------------------------------------------------------
// The actual receipt image is built/shared via lib/receiptImage.ts
// (Web Share API with the file attached, where supported). This
// text link stays as the fallback for browsers that can't share
// files through navigator.share — wa.me can only pre-fill TEXT, not
// attach a file, so on those platforms the chat opens with a text
// summary instead of the picture. If a phone number is known (the
// transaction's counterparty, or the ledger contact), the chat opens
// directly with them; otherwise it opens WhatsApp with the message
// ready to forward to whoever the user picks.
// ============================================================
export function whatsAppShareLink(text: string, phone?: string | null): string {
  const encoded = encodeURIComponent(text);
  const digits = phone ? phone.replace(/\D/g, "") : "";
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}
