import type { ChartRule } from './chart'
import type { CmdIR, FieldRef, Scalar } from './ir'
import type { CmdNlCtx } from './procedural'
import type { CmdNlField } from './schema'
import { cmdNlField } from './schema'

/** Terminal values and helpers shared by the grammar's rule files. */

export type Body = Omit<CmdIR, 'meta'>

export interface FieldT {
  fieldId: string
  via: FieldRef['via']
  /** The words the field was typed as ("close date", "amont"). */
  words: string[]
}

export type ValT =
  | { t: 'num'; value: number; percent?: boolean }
  | { t: 'date'; value: Scalar }
  | { t: 'opt'; fieldId: string; value: string }
  | { t: 'member'; fieldId: string; member: string }
  | { t: 'me' }
  | { t: 'bool'; value: boolean }
  | { t: 'quoted'; text: string }

export type K = unknown[]
export type R = ChartRule<CmdNlCtx>

export const r = (lhs: string, rhs: string, weight: number, build?: (k: K, ctx: CmdNlCtx) => unknown): R => ({
  lhs,
  rhs: rhs.split(' '),
  weight,
  build,
})

export const ref = (id: string, via: FieldRef['via']): FieldRef => ({ id, via })

export const F = (ctx: CmdNlCtx, f: FieldT) => cmdNlField(ctx.schema, f.fieldId)

export const isDateKind = (f: CmdNlField) => f.kind === 'date' || f.kind === 'datetime'

export const fieldT = (k: unknown) => k as FieldT

export const valT = (k: unknown) => k as ValT

/** A value fitted to `field`, or undefined when it can't be one of its values. */
export function fit(field: CmdNlField, v: ValT): Scalar | Scalar[] | undefined {
  switch (field.kind) {
    case 'number':
      return v.t === 'num' ? v.value : undefined
    case 'date':
    case 'datetime':
      return v.t === 'date' ? v.value : undefined
    case 'user':
      if (v.t === 'me') return { me: true }
      return v.t === 'member' && v.fieldId === field.id ? { member: v.member } : undefined
    case 'select':
      return v.t === 'opt' && v.fieldId === field.id ? v.value : undefined
    case 'multiselect':
      return v.t === 'opt' && v.fieldId === field.id ? [v.value] : undefined
    case 'checkbox':
      return
    default:
      if (v.t === 'quoted') return v.text
      if (v.t === 'opt' && v.fieldId === field.id) return v.value
  }
}

/** `fit` for writing a value (set, create): checkboxes take true/false, text takes numbers. */
export function fitSet(field: CmdNlField, v: ValT): Scalar | Scalar[] | undefined {
  if (field.kind === 'checkbox') return v.t === 'bool' ? v.value : undefined
  if ((field.kind === 'text' || field.kind === 'other') && v.t === 'num') return String(v.value)
  return fit(field, v)
}
