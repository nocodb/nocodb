import type { CmdFillType } from '../commandPaletteRelativeEdit'
import { cmdFillAccepts } from '../commandPaletteRelativeEdit'
import type { Agg, CmdIR, CmdNlCmp, CmdNlEdit, CmdNlKind, Cond, Scalar } from './ir'
import { CMD_NL_RATIO, CMD_NL_SHARE, isCondLeaf } from './ir'
import type { CmdNlField, CmdNlSchema } from './schema'
import { cmdNlField } from './schema'

/** Comparisons each field kind accepts, mirroring the toolbar filter menu. */
export const CMD_NL_CMPS: Record<CmdNlKind, CmdNlCmp[]> = {
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'blank', 'notblank'],
  date: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'within', 'blank', 'notblank'],
  datetime: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'within', 'blank', 'notblank'],
  checkbox: ['checked', 'notchecked'],
  select: ['eq', 'neq', 'anyof', 'nanyof', 'blank', 'notblank'],
  multiselect: ['anyof', 'allof', 'nanyof', 'eq', 'neq', 'blank', 'notblank'],
  user: ['anyof', 'nanyof', 'eq', 'neq', 'blank', 'notblank'],
  text: ['eq', 'neq', 'like', 'nlike', 'blank', 'notblank'],
  other: ['eq', 'neq', 'like', 'nlike', 'blank', 'notblank'],
}

const VALUELESS = new Set<CmdNlCmp>(['blank', 'notblank', 'checked', 'notchecked'])

/** Upper bound for "top N"; the where-edit path caps matched records at the same size. */
export const CMD_NL_MAX_LIMIT = 1000

export interface CmdNlValidation {
  ok: boolean
  errors: string[]
}

function isDateScalar(value: Scalar): boolean {
  if (typeof value === 'string') return !Number.isNaN(Date.parse(value))
  return typeof value === 'object' && value !== null && ('date' in value || 'relative' in value || 'range' in value)
}

function checkScalar(field: CmdNlField, cmp: CmdNlCmp, value: Scalar, errors: string[]) {
  const where = `${field.title} ${cmp}`
  switch (field.kind) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`${where}: “${String(value)}” is not a number`)
      return
    case 'date':
    case 'datetime':
      if (!isDateScalar(value)) errors.push(`${where}: “${JSON.stringify(value)}” is not a date`)
      if (cmp === 'within' && !(typeof value === 'object' && value !== null && 'relative' in value)) {
        errors.push(`${where}: “within” needs a relative period`)
      }
      return
    case 'select':
    case 'multiselect':
      if (typeof value !== 'string' || !field.options?.includes(value)) {
        errors.push(`${where}: “${String(value)}” is not an option of ${field.title}`)
      }
      return
    case 'user': {
      const ok =
        typeof value === 'object' &&
        value !== null &&
        ('me' in value || ('member' in value && (field.members ?? []).some((m) => m.id === value.member)))
      if (!ok) errors.push(`${where}: not a member of this base`)
      return
    }
    case 'text':
    case 'other':
      if (typeof value !== 'string' && typeof value !== 'number') errors.push(`${where}: expects text`)
  }
}

function checkCond(cond: Cond, schema: CmdNlSchema, errors: string[]) {
  if (!isCondLeaf(cond)) {
    if (cond.op === 'not') return checkCond(cond.arg, schema, errors)
    if (!cond.args.length) errors.push(`empty “${cond.op}” group`)
    return cond.args.forEach((arg) => checkCond(arg, schema, errors))
  }
  const field = cmdNlField(schema, cond.field.id)
  if (!field) return errors.push(`unknown field ${cond.field.id}`)
  if (!CMD_NL_CMPS[field.kind].includes(cond.cmp)) return errors.push(`${field.title} can't use “${cond.cmp}”`)
  if (VALUELESS.has(cond.cmp)) {
    if (cond.value !== undefined) errors.push(`${field.title} ${cond.cmp} takes no value`)
    return
  }
  if (cond.value === undefined) return errors.push(`${field.title} ${cond.cmp} needs a value`)
  if (cond.cmp === 'between') {
    if (!Array.isArray(cond.value) || cond.value.length !== 2) return errors.push(`${field.title} between needs two values`)
  }
  const values = Array.isArray(cond.value) ? cond.value : [cond.value]
  if (!values.length) errors.push(`${field.title} ${cond.cmp} needs a value`)
  for (const value of values) checkScalar(field, cond.cmp, value, errors)
}

/** Which relative-edit kinds fit which field kinds. */
const RELATIVE_FITS: Record<string, CmdNlKind[]> = {
  number: ['number'],
  date: ['date', 'datetime'],
  text: ['text'],
  checkbox: ['checkbox'],
  select: ['select'],
  option: ['multiselect'],
  user: ['user'],
}

const FILL_TYPE: Partial<Record<CmdNlKind, CmdFillType>> = {
  number: 'number',
  date: 'date',
  datetime: 'date',
  text: 'text',
  select: 'select',
}

function checkEdit(edit: CmdNlEdit, schema: CmdNlSchema, errors: string[]) {
  if (!edit.field) return
  const field = cmdNlField(schema, edit.field.id)
  if (!field) return errors.push(`unknown field ${edit.field.id}`)
  if (field.readonly) return errors.push(`${field.title} can't be edited`)
  const { op } = edit
  if (op.kind === 'relative') {
    if (!RELATIVE_FITS[op.edit.kind]?.includes(field.kind)) errors.push(`${field.title} can't take a ${op.edit.kind} edit`)
  } else if (op.kind === 'fill') {
    if (!cmdFillAccepts(op.fill, FILL_TYPE[field.kind] ?? 'other', field.options))
      errors.push(`${field.title} can't take this fill`)
  } else if (op.kind === 'set') {
    const values = Array.isArray(op.value) ? op.value : [op.value]
    if (field.kind !== 'multiselect' && field.kind !== 'user' && values.length > 1) errors.push(`${field.title} takes one value`)
    for (const value of values) if (value !== null) checkScalar(field, 'eq', value, errors)
  }
}

/** A share needs its base and either a condition (one share) or a grouping (a share per group), not both. */
function checkShare(ir: CmdIR, agg: Agg, schema: CmdNlSchema, errors: string[]) {
  if (agg.base === 'sum') {
    const field = agg.field ? cmdNlField(schema, agg.field.id) : undefined
    if (!field) errors.push('a share of a sum needs a field')
    else if (field.kind !== 'number' || !field.aggregations.includes('sum')) errors.push(`${field.title} can't be summed`)
  } else if (agg.base === 'count') {
    if (agg.field) errors.push('a share of the record count takes no field')
  } else errors.push('a share needs a base (sum or count)')
  const grouped = !!ir.groupBy?.length
  if (grouped && ir.where) errors.push('a share per group takes no condition')
  if (!grouped && !ir.where) errors.push('a share needs a condition or a grouping')
}

/** A ratio needs its base and both sides; the two sides must differ. */
function checkRatio(ir: CmdIR, agg: Agg, schema: CmdNlSchema, errors: string[]) {
  if (agg.base === 'sum') {
    const field = agg.field ? cmdNlField(schema, agg.field.id) : undefined
    if (!field) errors.push('a ratio of sums needs a field')
    else if (field.kind !== 'number' || !field.aggregations.includes('sum')) errors.push(`${field.title} can't be summed`)
  } else if (agg.base === 'count') {
    if (agg.field) errors.push('a ratio of record counts takes no field')
  } else errors.push('a ratio needs a base (sum or count)')
  if (!agg.num || !agg.den) return errors.push('a ratio needs both sides')
  checkCond(agg.num, schema, errors)
  checkCond(agg.den, schema, errors)
  if (JSON.stringify(agg.num) === JSON.stringify(agg.den)) errors.push('a ratio of a condition to itself')
  if (ir.groupBy?.length) errors.push('a ratio takes no grouping')
}

/** Every structural problem with a reading; the palette shows only readings with `ok`. */
export function validateIR(ir: CmdIR, schema: CmdNlSchema): CmdNlValidation {
  const errors: string[] = []
  if (ir.where) checkCond(ir.where, schema, errors)

  for (const agg of ir.aggs ?? []) {
    if (agg.fn === CMD_NL_SHARE) {
      checkShare(ir, agg, schema, errors)
      continue
    }
    if (agg.fn === CMD_NL_RATIO) {
      checkRatio(ir, agg, schema, errors)
      continue
    }
    if (agg.num || agg.den) errors.push(`“${agg.fn}” takes no sides`)
    if (agg.base) errors.push(`“${agg.fn}” takes no base`)
    if (!agg.field) {
      if (agg.fn !== 'count') errors.push(`“${agg.fn}” needs a field`)
      continue
    }
    const field = cmdNlField(schema, agg.field.id)
    if (!field) errors.push(`unknown field ${agg.field.id}`)
    else if (!field.aggregations.includes(agg.fn)) errors.push(`${field.title} has no “${agg.fn}”`)
  }

  for (const ref of ir.groupBy ?? []) if (!cmdNlField(schema, ref.id)) errors.push(`unknown field ${ref.id}`)
  for (const order of ir.orderBy ?? []) {
    if (order.field === 'agg0') {
      if (!ir.aggs?.length) errors.push('sort by aggregate without one')
    } else if (!cmdNlField(schema, order.field.id)) errors.push(`unknown field ${order.field.id}`)
  }

  if (ir.limit !== undefined && (!Number.isInteger(ir.limit) || ir.limit < 1 || ir.limit > CMD_NL_MAX_LIMIT)) {
    errors.push(`limit must be 1–${CMD_NL_MAX_LIMIT}`)
  }

  for (const edit of ir.edits ?? []) checkEdit(edit, schema, errors)

  if (ir.create) {
    for (const [id, value] of Object.entries(ir.create.values)) {
      const field = cmdNlField(schema, id)
      if (!field) errors.push(`unknown field ${id}`)
      else if (field.readonly) errors.push(`${field.title} can't be set`)
      else for (const v of Array.isArray(value) ? value : [value]) if (v !== null) checkScalar(field, 'eq', v, errors)
    }
    for (const field of schema.fields) {
      if (field.required && !field.readonly && ir.create.values[field.id] === undefined) errors.push(`${field.title} is required`)
    }
  }

  const needs: Partial<Record<CmdIR['intent'], boolean>> = {
    stat: !!ir.aggs?.length,
    edit: !!ir.edits?.length,
    fill: !!ir.edits?.length,
    create: !!ir.create,
    calc: !!ir.calc,
    group: !!ir.groupBy?.length,
    sort: !!ir.orderBy?.length,
  }
  if (needs[ir.intent] === false) errors.push(`“${ir.intent}” reading has nothing to do`)
  if (ir.scope === 'where' && !ir.where) errors.push('“where” scope without a condition')

  return { ok: !errors.length, errors }
}
