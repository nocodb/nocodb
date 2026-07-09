import type { Row } from '~/lib/types'

// Resolved colours for a single calendar event, independent of which display
// theme is active. Calendar cards never receive a preset `color` prop — the
// only colour source is the EE row-colouring output stored on `row.rowMeta`
// (`rowBgColor` = soft tint, `rowLeftBorderColor` = strong accent,
// `rowBorderColor` = border). When no row colour is set we fall back to a
// neutral gray, matching the default (uncoloured) look.
export interface CalendarEventColors {
  // Whether a custom row colour is applied (vs the neutral gray default).
  hasColor: boolean
  // Strong colour — used for the dot, solid fill, left bar and pill background.
  accent: string
  // Soft tint — used as the bordered-theme background fill.
  tint: string
  // Border colour for the bordered theme.
  border: string
  // Readable text colour to lay over `accent` (solid / pill themes).
  onAccent: string
}

// Neutral defaults for events without a row colour. CSS vars keep them
// theme-aware (light/dark) for the surfaces that adapt; the solid fill keeps a
// fixed readable pairing so white text always reads on the gray block.
const NEUTRAL: CalendarEventColors = {
  hasColor: false,
  accent: 'rgb(var(--rgb-color-gray-500))',
  tint: 'var(--nc-bg-default)',
  border: 'var(--nc-border-gray-dark)',
  onAccent: '#ffffff',
}

export function getCalendarEventColors(record?: Row): CalendarEventColors {
  const accent = record?.rowMeta?.rowLeftBorderColor
  const tint = record?.rowMeta?.rowBgColor
  const border = record?.rowMeta?.rowBorderColor

  if (!accent && !tint) return NEUTRAL

  // Prefer the strong left-border colour as the accent; fall back to the tint
  // when a row colour was set without an explicit left-border colour.
  const resolvedAccent = accent || tint!

  return {
    hasColor: true,
    accent: resolvedAccent,
    tint: tint || 'transparent',
    border: border || resolvedAccent,
    // tinycolor-backed util — picks readable text even for pale custom colours.
    onAccent: getOppositeColorOfBackground(resolvedAccent),
  }
}
