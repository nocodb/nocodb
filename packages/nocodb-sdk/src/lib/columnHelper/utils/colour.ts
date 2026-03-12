/**
 * Shared hex colour validation and normalization utilities.
 *
 * All colour values in NocoDB are stored as uppercase 6-digit hex strings
 * with a leading `#` (e.g. `#FF5733`). These helpers centralise the regex
 * and normalisation logic so that the SDK column helper, the backend field
 * handler, and the frontend components all use the same rules.
 */

/** Matches a 6-digit hex colour with an optional `#` prefix. */
export const HEX_COLOUR_REGEX = /^#?([0-9A-Fa-f]{6})$/;

/**
 * Matches a 6-digit hex colour with an optional `#` prefix and an optional
 * 2-digit alpha suffix.  The alpha channel is captured but stripped during
 * normalisation so that the stored value is always 6 digits.
 */
export const HEX_COLOUR_WITH_ALPHA_REGEX =
  /^#?([0-9A-Fa-f]{6})([0-9A-Fa-f]{2})?$/;

/**
 * Validate and normalise a raw value to `#RRGGBB` (uppercase).
 *
 * @param value – Any value that might represent a hex colour.
 * @returns The normalised `#RRGGBB` string, or `null` when the input is
 *          empty / invalid.
 */
export function normalizeHexColour(value: unknown): string | null {
  if (!value) return null;

  const str = String(value).trim();
  if (!str) return null;

  const match = str.match(HEX_COLOUR_REGEX);
  return match ? `#${match[1].toUpperCase()}` : null;
}

/**
 * Same as {@link normalizeHexColour} but also accepts 8-digit hex values
 * (with a 2-digit alpha suffix) and strips the alpha channel.
 */
export function normalizeHexColourWithAlpha(value: unknown): string | null {
  if (!value) return null;

  const str = String(value).trim();
  if (!str) return null;

  const match = str.match(HEX_COLOUR_WITH_ALPHA_REGEX);
  return match ? `#${match[1].toUpperCase()}` : null;
}

/**
 * Check whether a string is a valid `#RRGGBB` colour (requires `#` prefix).
 */
export function isValidHexColour(value: unknown): boolean {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);
}
