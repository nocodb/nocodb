/**
 * Shared color palettes for the doc editor's color pickers.
 *
 * Colors are stored as semantic keys (e.g. 'gray', 'blue') in ProseMirror attributes.
 * Each key maps to light and dark hex values, resolved at render time via CSS.
 */

export interface DocColorOption {
  name: string
  /** Semantic key stored in the document (e.g. 'gray', 'blue'). Empty = default/none. */
  key: string
  /** Light mode hex */
  light: string
  /** Dark mode hex */
  dark: string
}

export const TEXT_COLORS: DocColorOption[] = [
  { name: 'Default', key: '', light: '', dark: '' },
  { name: 'Gray', key: 'gray', light: '#6b7280', dark: '#9ca3af' },
  { name: 'Brown', key: 'brown', light: '#92400e', dark: '#d97706' },
  { name: 'Yellow', key: 'yellow', light: '#a16207', dark: '#facc15' },
  { name: 'Green', key: 'green', light: '#15803d', dark: '#4ade80' },
  { name: 'Blue', key: 'blue', light: '#1d4ed8', dark: '#60a5fa' },
  { name: 'Purple', key: 'purple', light: '#7c3aed', dark: '#a78bfa' },
  { name: 'Pink', key: 'pink', light: '#db2777', dark: '#f472b6' },
  { name: 'Orange', key: 'orange', light: '#ea580c', dark: '#fb923c' },
  { name: 'Red', key: 'red', light: '#dc2626', dark: '#f87171' },
]

export const CELL_BG_COLORS: DocColorOption[] = [
  { name: 'None', key: '', light: '', dark: '' },
  { name: 'Gray', key: 'gray', light: '#f3f4f6', dark: '#374151' },
  { name: 'Orange', key: 'orange', light: '#fff3e0', dark: '#431407' },
  { name: 'Pink', key: 'pink', light: '#fce4ec', dark: '#500724' },
  { name: 'Yellow', key: 'yellow', light: '#fffde7', dark: '#422006' },
  { name: 'Green', key: 'green', light: '#e8f5e9', dark: '#052e16' },
  { name: 'Blue', key: 'blue', light: '#e3f2fd', dark: '#172554' },
  { name: 'Purple', key: 'purple', light: '#f3e8ff', dark: '#3b0764' },
  { name: 'Rose', key: 'rose', light: '#fff1f2', dark: '#4c0519' },
  { name: 'Red', key: 'red', light: '#ffebee', dark: '#450a0a' },
]

/** Build CSS custom properties from color palettes for injection into the editor */
export function buildColorCssVars(isDark: boolean): Record<string, string> {
  const vars: Record<string, string> = {}

  for (const tc of TEXT_COLORS) {
    if (!tc.key) continue
    vars[`--nc-doc-text-${tc.key}`] = isDark ? tc.dark : tc.light
  }

  for (const bg of CELL_BG_COLORS) {
    if (!bg.key) continue
    vars[`--nc-doc-bg-${bg.key}`] = isDark ? bg.dark : bg.light
  }

  return vars
}
