/**
 * Solid palette for environment dots/badges + the edit-modal swatch picker.
 * The first two are the built-in Production (green) / Staging (orange) defaults
 * (`DEFAULT_ENVIRONMENTS` in nocodb-sdk), so a custom env's color always lines
 * up with a swatch here.
 */
export const ENV_COLORS = [
  '#17803d', // green   (Production default)
  '#c2410c', // orange  (Staging default)
  '#2563eb', // blue
  '#7c3aed', // purple
  '#0d9488', // teal
  '#db2777', // pink
  '#dc2626', // red
  '#0f766e', // dark teal
]

/** Default color for a newly created environment (blue — distinct from the built-ins). */
export const DEFAULT_ENV_COLOR = ENV_COLORS[2]
