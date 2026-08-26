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
  { key: 'inputBorder', labelKey: 'inputBorder', cssVar: '--nc-border-input', rgb: false },
  { key: 'tooltip', labelKey: 'tooltip', cssVar: '--nc-bg-tooltip', rgb: true },
  { key: 'hover', labelKey: 'hover', cssVar: '--color-gray-50', rgb: true },
  { key: 'borderLight', labelKey: 'surfaceLight', cssVar: '--color-gray-100', rgb: true },
  { key: 'gridLine', labelKey: 'gridLines', cssVar: '--nc-grid-line', rgb: false },
  { key: 'border', labelKey: 'borders', cssVar: '--color-gray-200', rgb: true },
  { key: 'selection', labelKey: 'selection', cssVar: '--color-brand-50', rgb: true },
  { key: 'text', labelKey: 'text', cssVar: '--color-gray-800', rgb: true },
  { key: 'cellText', labelKey: 'cellText', cssVar: '--color-gray-600', rgb: true },
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
    /** classic (pre-refactor) production dark palette */
    id: 'default',
    label: 'NocoDB classic',
    values: {
      minisidebar: '#2a2c2e',
      sidebar: '#1d1d1f',
      content: '#171717',
      canvas: '#1d1d1f',
      elevated: '#171717',
      input: '#171717',
      inputBorder: '#3b3d40',
      tooltip: '#3a3f4b',
      hover: '#1d1d1f',
      borderLight: '#2a2c2e',
      gridLine: '#3b3d40',
      border: '#3b3d40',
      selection: '#141a3a',
      text: '#e2e9f6',
      cellText: '#c5cbd6',
      textMuted: '#989ca5',
    },
  },
  {
    /**
     * flat surfaces + tinted-overlay inputs (mined reference system) — the
     * planned future default; 'default' (classic) stays applied until the
     * remaining dark issues are fixed, then this moves into variables.css.
     * The rail is the one deliberate break from flat: at the sidebar's own
     * colour it had no edge at all, only a hairline border.
     */
    id: 'cobalt',
    label: 'Default',
    values: {
      minisidebar: '#2b2e36',
      sidebar: '#1d1f25',
      content: '#1d1f25',
      canvas: '#000000',
      elevated: '#1d1f25',
      input: 'rgba(195, 212, 249, 0.18)',
      inputBorder: 'rgba(255, 255, 255, 0.1)',
      tooltip: '#31353e',
      hover: '#282a30',
      /* must differ from `hover`: cards rest on gray-50 and hover to gray-100 */
      borderLight: '#2d2f35',
      gridLine: '#3d3e44',
      border: '#34363b',
      selection: '#243043',
      text: '#ffffff',
      cellText: '#ffffff',
      textMuted: '#979aa0',
    },
  },
  {
    /** reference-hue elevation model — the new NocoDB dark theme (WIP name) */
    id: 'elevated',
    label: 'Elevated',
    values: {
      minisidebar: '#16181d',
      sidebar: '#1d1f25',
      content: '#23252c',
      canvas: '#111215',
      elevated: '#292b32',
      input: 'rgba(195, 212, 249, 0.14)',
      inputBorder: '#3f434d',
      tooltip: '#3f434d',
      hover: '#2c2f36',
      borderLight: '#33373f',
      gridLine: '#414349',
      border: '#3f434d',
      selection: '#1e2947',
      text: '#e2e9f6',
      cellText: '#c5cbd6',
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
      inputBorder: '#3a3c43',
      tooltip: '#3a3c43',
      hover: '#282a30',
      borderLight: '#2c2e33',
      gridLine: '#3f4044',
      border: '#3a3c43',
      selection: '#1c2742',
      text: '#e8eaed',
      cellText: '#c5cbd6',
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
      inputBorder: '#383a41',
      tooltip: '#383a41',
      hover: '#26282d',
      borderLight: '#2b2d33',
      gridLine: '#3c3d41',
      border: '#383a41',
      selection: '#1a2440',
      text: '#e6e8ec',
      cellText: '#c5cbd6',
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
      inputBorder: '#3a3a3a',
      tooltip: '#3a3a3a',
      hover: '#282828',
      borderLight: '#2e2e2e',
      gridLine: '#404040',
      border: '#3a3a3a',
      selection: '#20283f',
      text: '#ebebeb',
      cellText: '#c5cbd6',
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
      inputBorder: '#3a4150',
      tooltip: '#3a4150',
      hover: '#252a34',
      borderLight: '#2d323d',
      gridLine: '#3d4048',
      border: '#3a4150',
      selection: '#1e2a4a',
      text: '#e5e8ef',
      cellText: '#c5cbd6',
      textMuted: '#9aa0ae',
    },
  },
  {
    id: 'notion',
    label: 'Notion',
    values: {
      minisidebar: '#262626',
      sidebar: '#202020',
      content: '#191919',
      canvas: '#141414',
      elevated: '#252525',
      input: 'rgba(235, 235, 235, 0.08)',
      inputBorder: '#373737',
      tooltip: '#373737',
      hover: '#222222',
      borderLight: '#2b2b2b',
      gridLine: '#3a3a3a',
      border: '#373737',
      selection: '#1c2742',
      text: '#e8e7e4',
      cellText: '#c5cbd6',
      textMuted: '#9b9a97',
    },
  },
  {
    id: 'linear',
    label: 'Linear',
    values: {
      minisidebar: '#24262b',
      sidebar: '#141518',
      content: '#191a1e',
      canvas: '#0a0b0d',
      elevated: '#212226',
      input: 'rgba(195, 212, 249, 0.08)',
      inputBorder: '#33343a',
      tooltip: '#33343a',
      hover: '#1f2024',
      borderLight: '#26272b',
      gridLine: '#3a3a3e',
      border: '#33343a',
      selection: '#1b2340',
      text: '#eeeff2',
      cellText: '#c5cbd6',
      textMuted: '#9698a1',
    },
  },
  {
    id: 'github-dim',
    label: 'GitHub dim',
    values: {
      minisidebar: '#212b37',
      sidebar: '#151b23',
      content: '#1a212c',
      canvas: '#090c11',
      elevated: '#222937',
      input: 'rgba(195, 212, 249, 0.1)',
      inputBorder: '#3a4452',
      tooltip: '#3a4452',
      hover: '#212a38',
      borderLight: '#2c3442',
      gridLine: '#3a4452',
      border: '#3a4452',
      selection: '#1f2d4d',
      text: '#e6edf3',
      cellText: '#c5cbd6',
      textMuted: '#8d96a0',
    },
  },
  {
    /**
     * Primer dark (default). The page is canvas.default #0d1117 — putting
     * canvas.subtle on `content` shifted the whole app one step up the ramp and
     * pushed the rail down to canvas.inset, a near-black slab.
     */
    id: 'github-default',
    label: 'GitHub default',
    values: {
      minisidebar: '#21262d',
      sidebar: '#161b22',
      content: '#0d1117',
      canvas: '#010409',
      elevated: '#161b22',
      input: '#0d1117',
      inputBorder: '#30363d',
      tooltip: '#30363d',
      hover: '#1c2129',
      borderLight: '#21262d',
      gridLine: '#21262d',
      border: '#30363d',
      selection: '#0d2847',
      text: '#e6edf3',
      cellText: '#c9d1d9',
      textMuted: '#8b949e',
    },
  },
  {
    id: 'contrast',
    label: 'High contrast',
    values: {
      minisidebar: '#2c2c30',
      sidebar: '#151517',
      content: '#232327',
      canvas: '#050506',
      elevated: '#2e2e34',
      input: 'rgba(235, 235, 235, 0.1)',
      inputBorder: '#4a4a52',
      tooltip: '#4a4a52',
      hover: '#2c2c31',
      borderLight: '#3a3a41',
      gridLine: '#4a4a52',
      border: '#4a4a52',
      selection: '#22305a',
      text: '#f2f2f4',
      cellText: '#c5cbd6',
      textMuted: '#b0b2ba',
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
