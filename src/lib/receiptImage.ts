import type { Options as HtmlToImageOptions } from "html-to-image/lib/types";

// ============================================================
// Receipt/statement images.
// ------------------------------------------------------------
// Receipts used to be generated as PDFs via jsPDF, whose built-in
// fonts (Helvetica/Times/Courier) only cover Latin script — Pashto
// and Dari text came out as blank boxes, so the downloaded PDF was
// always forced to English labels and Western digits regardless of
// the app's language setting (only the on-screen "View" modal, being
// plain HTML/CSS, was ever fully localized).
//
// Rasterizing the same already-localized DOM the "View" modal shows
// — instead of re-describing the receipt to a PDF library in a
// separate, English-only code path — removes that limitation
// entirely: whatever script is on screen is what ends up in the
// downloaded image, because it's a picture of the same real text.
// ============================================================

/**
 * Renders a DOM node to a PNG blob. `pixelRatio` is bumped above the
 * device's default so the downloaded/shared image stays crisp even
 * though receipts are typically viewed zoomed-in on a phone screen.
 */
export async function captureElementAsPng(node: HTMLElement, pixelRatio = 2.5): Promise<Blob> {
  // Lazy-loaded (same reasoning the old jsPDF integration used): most
  // sessions never open a receipt, so this keeps html-to-image out of
  // the app's initial offline-install bundle.
  const { toBlob } = await import("html-to-image");
  const options: HtmlToImageOptions = {
    pixelRatio,
    backgroundColor: "#ffffff",
    cacheBust: true,
  };
  const blob = await toBlob(node, options);
  if (!blob) throw new Error("Failed to render receipt image");
  return blob;
}

/** Triggers a browser download of a blob under the given filename. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Tries the Web Share API with the receipt image attached as a real
 * file — this is what lets "Share" hand WhatsApp (or any other app
 * in the share sheet) the actual receipt picture, not just a text
 * summary. Returns true when a share sheet was shown (including when
 * the person cancelled it themselves — that's their choice, not a
 * failure). Returns false when the platform/browser can't share
 * files at all, so the caller can fall back to a wa.me text link.
 */
export async function shareImageFile(blob: Blob, filename: string, text: string, title?: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) return false;
  try {
    const file = new File([blob], filename, { type: blob.type || "image/png" });
    if (!navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], text, title });
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return true;
    return false;
  }
}
