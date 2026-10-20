import type { CmdNlColor, Cond } from './ir'
import type { CmdNlCtx } from './procedural'
import type { Body, FieldT, R } from './grammarCore'
import { F, fieldT, r, ref } from './grammarCore'
import type { AssumeT } from './grammarExtra'
import { COLOR_NAMES, COLOR_NOUNS, COLOR_OFF_VERBS, COLOR_OFF_WORDS, COLOR_VERBS, DEFAULT_HIGHLIGHT } from './vocab/colors'

/**
 * Row colouring for the chart grammar: "colour won deals green", "highlight overdue tasks",
 * "colour by stage", "clear row colours". A colour the palette has no name for, or none at all, is a guess.
 */

type Add = (cat: string, start: number, end: number, value?: unknown, score?: number) => void

interface ColorT {
  name: CmdNlColor
  assume?: AssumeT
}

/** Words between an "off" verb and what it turns off: "clear all the row colours". */
const OFF_GAP = new Set(['all', 'the', 'row', 'rows', 'record', 'records', 'my', 'any', 'view'])

/** What introduces the condition in "red if owner is me", "green for won deals". */
const COND_WORDS = new Set(['if', 'when', 'whenever', 'where', 'wherever', 'for'])

const titled = (name: string) => `${name.charAt(0).toUpperCase()}${name.slice(1)}`

export function addColorTerminals(ctx: CmdNlCtx, words: string[], add: Add) {
  for (let i = 0; i < words.length; i++) {
    if (ctx.tokens[i]!.quoted) continue
    const w = words[i]!
    const next = words[i + 1] ?? ''

    if (COLOR_VERBS.has(w)) add('COLORV', i, ['code', 'coded', 'coding'].includes(next) ? i + 2 : i + 1)

    const name = COLOR_NAMES[w]
    if (name) {
      const value: ColorT = name === w ? { name } : { name, assume: { text: `Colour: ${titled(name)}`, kind: 'color' } }
      // "red color if …": the noun belongs to the colour.
      const end = COLOR_NOUNS.has(next) ? i + 2 : i + 1
      add('COLOR', i, end, value, name === w ? 1 : 0.9)
      // "rows owned by me in blue"
      if (words[i - 1] === 'in') add('INCOLOR', i - 1, end, value, name === w ? 1 : 0.9)
    }
    if (COND_WORDS.has(w)) add('CONDW', i, i + 1)

    if (COLOR_OFF_WORDS.has(w)) add('COLOROFF', i, i + 1)
    // "clear row colours", "turn off highlights"
    const off = COLOR_OFF_VERBS.has(w) ? i + 1 : ['turn', 'switch'].includes(w) && next === 'off' ? i + 2 : -1
    if (off >= 0) {
      let j = off
      while (OFF_GAP.has(words[j] ?? '')) j++
      if (COLOR_NOUNS.has(words[j] ?? '')) add('COLOROFF', i, j + 1)
    }
    // "row colours off"
    if (COLOR_NOUNS.has(w) && next === 'off') add('COLOROFF', i, i + 2)
  }
}

const cond = (k: unknown) => k as Cond

function conditionBody(where: Cond, color?: ColorT): Body {
  return { intent: 'color', scope: 'where', where, color: { mode: 'condition', color: color?.name ?? DEFAULT_HIGHLIGHT } }
}

/** Colouring by a field: its option colours, so a single select. */
function fieldBody(ctx: CmdNlCtx, f: FieldT): Body | undefined {
  if (F(ctx, f)?.kind !== 'select') return
  return { intent: 'color', scope: 'view', color: { mode: 'field', field: ref(f.fieldId, f.via) } }
}

export const COLOR_RULES: R[] = [
  r('Q', 'Color', 1),
  r('Color', 'COLORV Expr COLOR', 1, (k) => conditionBody(cond(k[1]), k[2] as ColorT)),
  r('Color', 'COLORV COLOR Expr', 1, (k) => conditionBody(cond(k[2]), k[1] as ColorT)),
  r('Color', 'COLORV Expr ASW COLOR', 1, (k) => conditionBody(cond(k[1]), k[3] as ColorT)),
  r('Color', 'COLORV COLOR CONDW Expr', 1, (k) => conditionBody(cond(k[3]), k[1] as ColorT)),
  // No verb: the colour leads with a condition word ("red if owner is me", "green for won deals"), or trails with "in".
  r('Color', 'COLOR CONDW Expr', 1, (k) => conditionBody(cond(k[2]), k[0] as ColorT)),
  r('Color', 'Expr INCOLOR', 0.95, (k) => conditionBody(cond(k[0]), k[1] as ColorT)),
  // "make rows red where amount > 10k", "turn won deals green"
  r('Color', 'SETV COLOR Expr', 0.95, (k) => conditionBody(cond(k[2]), k[1] as ColorT)),
  r('Color', 'SETV COLOR CONDW Expr', 0.95, (k) => conditionBody(cond(k[3]), k[1] as ColorT)),
  r('Color', 'SETV Expr COLOR', 0.95, (k) => conditionBody(cond(k[1]), k[2] as ColorT)),
  // "highlight my tasks": the default highlight, shown as a guess.
  r('Color', 'COLORV Expr', 0.95, (k) => conditionBody(cond(k[1]))),
  r('Color', 'COLORV BY FIELD', 1, (k, ctx) => fieldBody(ctx, fieldT(k[2]))),
  r('Color', 'COLORV FIELD', 0.9, (k, ctx) => fieldBody(ctx, fieldT(k[1]))),
  r('Color', 'COLOROFF', 1, () => ({ intent: 'color', scope: 'view', color: { mode: 'clear' } } satisfies Body)),
]
