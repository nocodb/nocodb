/**
 * Whether a Google profile's email is explicitly UNVERIFIED.
 *
 * The flag's shape differs between the passport profile
 * (`emails[i].verified`, `_json.email_verified`) and a raw ID token
 * (`email_verified`). Fails CLOSED only when a flag is present and false —
 * absent is treated as allowed, so providers that omit it keep working.
 *
 * @returns true when the email must be rejected as unverified.
 */
export function isGoogleEmailUnverified(profile: any, email: string): boolean {
  const flags: unknown[] = [];

  const emails = profile?.emails;
  if (Array.isArray(emails)) {
    const match = emails.find((e) => e?.value === email) ?? emails[0];
    if (match && typeof match === 'object' && 'verified' in match) {
      flags.push((match as any).verified);
    }
  }

  const json = profile?._json ?? profile;
  if (json && typeof json === 'object' && 'email_verified' in json) {
    flags.push((json as any).email_verified);
  }

  // Present-and-false (boolean false or the string "false") => unverified.
  return flags.some((v) => v === false || v === 'false');
}
