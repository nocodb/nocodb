/**
 * Shared color palettes for the doc editor's color pickers.
 *
 * TEXT_COLORS — used in column toolbar, cell selection bubble menu, and inline text color.
 * CELL_BG_COLORS — lighter tints for table cell backgrounds (large areas, borders stay visible).
 */

export interface DocColorOption {
  name: string
  color: string
}

export const TEXT_COLORS: DocColorOption[] = [
  { name: 'Default', color: '' },
  { name: 'Gray', color: '#6b7280' },
  { name: 'Brown', color: '#92400e' },
  { name: 'Yellow', color: '#a16207' },
  { name: 'Green', color: '#15803d' },
  { name: 'Blue', color: '#1d4ed8' },
  { name: 'Purple', color: '#7c3aed' },
  { name: 'Pink', color: '#db2777' },
  { name: 'Orange', color: '#ea580c' },
  { name: 'Red', color: '#dc2626' },
]

export const CELL_BG_COLORS: DocColorOption[] = [
  { name: 'None', color: '' },
  { name: 'Gray', color: '#f3f4f6' },
  { name: 'Orange', color: '#fff3e0' },
  { name: 'Pink', color: '#fce4ec' },
  { name: 'Yellow', color: '#fffde7' },
  { name: 'Green', color: '#e8f5e9' },
  { name: 'Blue', color: '#e3f2fd' },
  { name: 'Purple', color: '#f3e8ff' },
  { name: 'Rose', color: '#fff1f2' },
  { name: 'Red', color: '#ffebee' },
]
