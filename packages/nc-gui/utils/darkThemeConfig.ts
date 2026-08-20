/**
 * Dark-mode palette configuration — token registry + curated presets.
 *
 * A preset is a named set of values for the dark surface tokens defined in
 * `[theme='dark']` of assets/css/variables.css. Presets are applied at runtime
 * by useTheme() via an injected `<style>` scoped to `[theme='dark']`, so light
 * mode is never affected.
 */

export interface DarkPaletteToken {
  key: string
  /** i18n key under labels.themeConfig */
  labelKey: string
  /** reference token to override; the matching --rgb-* triplet is emitted too */
  cssVar: string
  /** false for values that may be rgba (no --rgb-* triplet emitted) */
  rgb: boolean
}

export const DARK_PALETTE_TOKENS: DarkPaletteToken[] = [
  { key: 'minisidebar', labelKey: 'miniSidebar', cssVar: '--color-minisidebar-bg', rgb: true },
  { key: 'sidebar', labelKey: 'sidebar', cssVar: '--color-sidebar-bg', rgb: true },
  { key: 'content', labelKey: 'content', cssVar: '--color-base-white', rgb: true },
  { key: 'canvas', labelKey: 'canvas', cssVar: '--nc-bg-canvas', rgb: true },
  { key: 'elevated', labelKey: 'elevated', cssVar: '--nc-bg-elevated', rgb: true },
  { key: 'input', labelKey: 'input', cssVar: '--nc-bg-input', rgb: false },
  { key: 'hover', labelKey: 'hover', cssVar: '--color-gray-50', rgb: true },
  { key: 'borderLight', labelKey: 'gridLines', cssVar: '--color-gray-100', rgb: true },
  { key: 'border', labelKey: 'borders', cssVar: '--color-gray-200', rgb: true },
  { key: 'selection', labelKey: 'selection', cssVar: '--color-brand-50', rgb: true },
  { key: 'text', labelKey: 'text', cssVar: '--color-gray-800', rgb: true },
  { key: 'textMuted', labelKey: 'mutedText', cssVar: '--color-gray-500', rgb: true },
]

export interface DarkPalettePreset {
  id: string
  /** shown as-is, like the Light/Dark/System labels */
  label: string
  values: Record<string, string>
}

/**
 * 'default' mirrors the values shipped in variables.css — selecting it removes
 * the runtime override entirely.
 */
export const DARK_PALETTE_PRESETS: DarkPalettePreset[] = [
  {
    id: 'default',
    label: 'NocoDB',
    values: {
      minisidebar: '#16181d',
      sidebar: '#1d1f25',
      content: '#23252c',
      canvas: '#111215',
      elevated: '#292b32',
      input: 'rgba(195, 212, 249, 0.14)',
      hover: '#2c2f36',
      borderLight: '#33373f',
      border: '#3f434d',
      selection: '#1e2947',
      text: '#e2e9f6',
      textMuted: '#989ca5',
    },
  },
  {
    id: 'graphite',
    label: 'Graphite',
    values: {
      minisidebar: '#141518',
      sidebar: '#1a1b1f',
      content: '#202226',
      canvas: '#0f1012',
      elevated: '#26282d',
      input: 'rgba(195, 212, 249, 0.12)',
      hover: '#282a30',
      borderLight: '#2c2e33',
      border: '#3a3c43',
      selection: '#1c2742',
      text: '#e8eaed',
      textMuted: '#a0a4ad',
    },
  },
  {
    id: 'slate',
    label: 'Soft slate',
    values: {
      minisidebar: '#303237',
      sidebar: '#232529',
      content: '#1c1e22',
      canvas: '#17181c',
      elevated: '#24262b',
      input: 'rgba(195, 212, 249, 0.12)',
      hover: '#26282d',
      borderLight: '#2b2d33',
      border: '#383a41',
      selection: '#1a2440',
      text: '#e6e8ec',
      textMuted: '#9da1aa',
    },
  },
  {
    id: 'carbon',
    label: 'Carbon',
    values: {
      minisidebar: '#161616',
      sidebar: '#1c1c1c',
      content: '#222222',
      canvas: '#101010',
      elevated: '#292929',
      input: 'rgba(235, 235, 235, 0.1)',
      hover: '#282828',
      borderLight: '#2e2e2e',
      border: '#3a3a3a',
      selection: '#20283f',
      text: '#ebebeb',
      textMuted: '#a3a3a3',
    },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    values: {
      minisidebar: '#12141b',
      sidebar: '#181b23',
      content: '#1e222b',
      canvas: '#0e1016',
      elevated: '#262b36',
      input: 'rgba(195, 212, 249, 0.12)',
      hover: '#252a34',
      borderLight: '#2d323d',
      border: '#3a4150',
      selection: '#1e2a4a',
      text: '#e5e8ef',
      textMuted: '#9aa0ae',
    },
  },
]

export interface DarkPaletteState {
  preset: string
  overrides: Record<string, string>
}

export function resolveDarkPalette(state: DarkPaletteState): Record<string, string> {
  const preset = DARK_PALETTE_PRESETS.find((p) => p.id === state.preset) ?? DARK_PALETTE_PRESETS[0]
  return { ...preset.values, ...state.overrides }
}
