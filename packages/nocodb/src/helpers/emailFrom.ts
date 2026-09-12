/**
 * Extract the bare email address from a sender string that may be either a
 * plain address (`noreply@example.com`) or a display-name form
 * (`"NocoDB" <noreply@example.com>`). Used when overriding only the From
 * display name while preserving the configured/verified sender address.
 */
export function emailAddressOnly(from?: string): string {
  const match = /<([^>]+)>/.exec(from || '');
  return (match ? match[1] : from || '').trim();
}
