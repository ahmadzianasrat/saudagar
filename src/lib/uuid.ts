// Tiny client-side uuid generator for client_id values used by the
// offline queue (crypto.randomUUID is available in all modern
// mobile/desktop browsers this PWA targets).
export function generateClientId(): string {
  return crypto.randomUUID();
}
