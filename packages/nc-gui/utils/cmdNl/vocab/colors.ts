import type { CmdNlColor } from '../ir'

/** "colour won deals green", "highlight overdue tasks". */
export const COLOR_VERBS = new Set([
  'colour',
  'color',
  'colourize',
  'colorize',
  'colourise',
  'colorise',
  'highlight',
  'hilight',
  'paint',
  'tint',
  'shade',
])

/** What the colouring is called: "clear row colours", "remove highlights". */
export const COLOR_NOUNS = new Set([
  'colour',
  'color',
  'colours',
  'colors',
  'colouring',
  'coloring',
  'colourings',
  'colorings',
  'highlight',
  'highlights',
  'highlighting',
  'highlighted',
])

/** Turning row colours off: "clear row colours", "remove highlights", "uncolour". */
export const COLOR_OFF_VERBS = new Set(['clear', 'remove', 'reset', 'delete', 'drop', 'stop', 'disable', 'no'])
export const COLOR_OFF_WORDS = new Set(['uncolour', 'uncolor', 'unhighlight', 'decolour', 'decolor'])

/** Palette names a colour word stands for; anything but the name itself is a guess. */
export const COLOR_NAMES: Record<string, CmdNlColor> = {
  red: 'red',
  pink: 'pink',
  orange: 'orange',
  yellow: 'yellow',
  green: 'green',
  teal: 'teal',
  blue: 'blue',
  purple: 'purple',
  maroon: 'maroon',
  gray: 'gray',
  grey: 'gray',
  crimson: 'red',
  scarlet: 'red',
  rose: 'pink',
  magenta: 'pink',
  fuchsia: 'pink',
  amber: 'orange',
  gold: 'yellow',
  golden: 'yellow',
  lime: 'green',
  mint: 'green',
  cyan: 'teal',
  turquoise: 'teal',
  aqua: 'teal',
  navy: 'blue',
  violet: 'purple',
  lavender: 'purple',
  brown: 'maroon',
  burgundy: 'maroon',
  silver: 'gray',
}

/** The colour a highlight with none named gets. */
export const DEFAULT_HIGHLIGHT: CmdNlColor = 'yellow'
