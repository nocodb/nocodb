/**
 * Email-side branding overrides. Used by transactional email templates
 * (invites, password reset, etc.) so the footer doesn't say "NocoDB Team"
 * on a white-labelled instance.
 */
export interface WhiteLabelEmailConfig {
  /** Replaces "NocoDB Team" in the sign-off (e.g. "Acme Team") */
  senderName?: string | null;
  /** Replaces the default footer tagline / signature */
  footerText?: string | null;
  /** Replaces "https://nocodb.com" — used by the footer brand link */
  footerUrl?: string | null;
}

/**
 * Instance-level white-label config for on-prem Enterprise deployments.
 * Stored as JSON in nc_store under key `nc_white_label_config`.
 * Exposed (sanitized) via /api/v1/meta/nocodb/info to allow pre-login branding.
 */
export interface WhiteLabelConfig {
  /** Master switch — when false, defaults are used regardless of other fields */
  enabled: boolean;
  /** Display name that replaces "NocoDB" in titles, sidebars, login screens */
  productName?: string | null;
  /** URL/path to the light-mode logo (rendered on light backgrounds) */
  logoUrl?: string | null;
  /** URL/path to the dark-mode logo (falls back to logoUrl when absent) */
  logoDarkUrl?: string | null;
  /** URL/path to the favicon (.ico / .png) */
  faviconUrl?: string | null;
  /** Hex color string (e.g. "#0D5A5A") used to override --color-brand-500 */
  brandColor?: string | null;
  /** Optional email-side branding (used by transactional templates) */
  email?: WhiteLabelEmailConfig | null;
}

export const NC_STORE_KEY_WHITE_LABEL = 'nc_white_label_config';
