import dayjs from 'dayjs'
import type { CmdCalcResult, CmdCreatePlan, CmdSetAction, CmdStatCondition, CmdStatQuery } from '../commandPaletteDataOps'
import {
  evaluateCmdCalc,
  parseCmdQuickCreate,
  parseCmdSetAction,
  parseCmdStats,
  parseCmdWhereClause,
  splitCmdWhere,
} from '../commandPaletteDataOps'
import type { CmdFill, CmdRelativeEdit } from '../commandPaletteRelativeEdit'
import { matchCmdName, parseCmdFill, parseCmdRelativeEdits } from '../commandPaletteRelativeEdit'
import { canonical } from './compile'
import type { CmdIR, CmdNlEdit, Cond, CondLeaf, FieldRef, Scalar } from './ir'
import { andConds } from './ir'
import type { CmdNlField, CmdNlSchema } from './schema'
import { cmdNlField, cmdNlFieldByTitle, toCmdCreateColumns, toCmdStatColumns } from './schema'
import { validateIR } from './validate'

/** The legacy parsers' outputs as CmdIR; the legacy code still executes them. */

type IRBody = Omit<CmdIR, 'meta'>

export function withMeta(body: IRBody, schema: CmdNlSchema, meta: Partial<CmdIR['meta']> = {}): CmdIR {
  return {
    ...body,
    meta: { score: 1, coverage: 1, spans: [], source: 'grammar', ...meta, canonical: meta.canonical ?? canonical(body, schema) },
  }
}

const ref = (id: string, via: FieldRef['via'] = 'title'): FieldRef => ({ id, via })

/** A typed name ("amount", "due date", "amont") to a field, by the same matcher the legacy edits use. */
export function resolveCmdNlField(schema: CmdNlSchema, typed: string | undefined): CmdNlField | undefined {
  if (!typed) return
  const exact = cmdNlFieldByTitle(schema, typed)
  if (exact) return exact
  const title = matchCmdName(
    typed,
    schema.fields.map((f) => f.title),
  )
  return title ? cmdNlFieldByTitle(schema, title) : undefined
}

/** A value typed against a field, fitted to its kind; undefined when it can't be. */
export function fitCmdNlScalar(field: CmdNlField, raw: string, schema: CmdNlSchema): Scalar | undefined {
  const text = raw.trim()
  switch (field.kind) {
    case 'number': {
      const n = Number(text.replace(/[,$€£₹¥%]/g, ''))
      return Number.isFinite(n) && text !== '' ? n : undefined
    }
    case 'checkbox':
      if (/^(true|yes|checked|done|1)$/i.test(text)) return true
      if (/^(false|no|unchecked|0)$/i.test(text)) return false
      return
    case 'select':
    case 'multiselect':
      return field.options?.find((o) => o.toLowerCase() === text.toLowerCase())
    case 'user': {
      if (/^(me|myself|@me)$/i.test(text)) return { me: true }
      const members = field.members ?? []
      const byId = members.find((m) => m.id === text)
      if (byId) return { member: byId.id }
      const name = matchCmdName(
        text,
        members.map((m) => m.name),
      )
      const email = name
        ? undefined
        : matchCmdName(
            text,
            members.map((m) => m.email ?? ''),
          )
      const member = members.find((m) => (name && m.name === name) || (email && m.email === email))
      return member ? { member: member.id } : schema.me && /^me$/i.test(text) ? { member: schema.me } : undefined
    }
    case 'date':
    case 'datetime': {
      const date = dayjs(text)
      return date.isValid()
        ? {
            date: date.format(field.kind === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm'),
            precision: field.kind === 'date' ? 'day' : 'minute',
          }
        : undefined
    }
    default:
      return text
  }
}

/* ---------------------------------------------------------------------------------------------- */

export function fromStatCondition(condition: CmdStatCondition, schema: CmdNlSchema): CondLeaf | undefined {
  const field = cmdNlField(schema, condition.column.id)
  if (!field) return
  const leaf: CondLeaf = { field: ref(field.id), cmp: condition.op }
  if (condition.value === undefined) return leaf
  if (condition.op === 'anyof' || condition.op === 'nanyof') {
    if (field.kind === 'user') {
      leaf.value = condition.value === '@me' ? { me: true } : { member: condition.value }
      return leaf
    }
    leaf.value = condition.value.split(',').map((v) => v.trim())
    return leaf
  }
  const value = field.kind === 'number' ? fitCmdNlScalar(field, condition.value, schema) : condition.value
  if (value === undefined) return
  leaf.value = value
  return leaf
}

function fromStatWhere(where: CmdStatCondition[], schema: CmdNlSchema): Cond | undefined | null {
  const leaves = where.map((c) => fromStatCondition(c, schema))
  if (leaves.some((l) => !l)) return null
  return andConds(leaves as Cond[])
}

export function fromStatQuery(query: CmdStatQuery, schema: CmdNlSchema): CmdIR | undefined {
  const where = fromStatWhere(query.where, schema)
  if (where === null) return
  return withMeta(
    {
      intent: 'stat',
      scope: where ? 'where' : 'view',
      where,
      aggs: [{ fn: query.aggregation, field: query.column ? ref(query.column.id) : undefined }],
    },
    schema,
  )
}

/** Undefined when the edit names a field this table doesn't have (the legacy parser offers every reading). */
export function fromRelativeEdit(edit: CmdRelativeEdit, schema: CmdNlSchema, where?: Cond): CmdIR | undefined {
  const field = resolveCmdNlField(schema, edit.field)
  if (edit.field && !field) return
  // As on the surfaces: an option/member edit only exists when that option or member does.
  if (edit.kind === 'option' && edit.op !== 'clear') {
    const fits = (f: CmdNlField) =>
      f.kind === 'multiselect' && !!f.options?.some((o) => o.toLowerCase() === edit.option.toLowerCase())
    if (field ? !fits(field) : !schema.fields.some(fits)) return
  }
  if (edit.kind === 'user') {
    const fits = (f: CmdNlField) => f.kind === 'user' && fitCmdNlScalar(f, edit.who, schema) !== undefined
    if (field ? !fits(field) : !schema.fields.some(fits)) return
  }
  const via = field?.title.toLowerCase() === edit.field?.toLowerCase() ? 'title' : 'fuzzy'
  const editOp: CmdNlEdit = { field: field ? ref(field.id, via) : undefined, op: { kind: 'relative', edit } }
  return withMeta({ intent: 'edit', scope: where ? 'where' : 'selection', where, edits: [editOp] }, schema)
}

export function fromFill(fill: CmdFill, schema: CmdNlSchema): CmdIR {
  return withMeta({ intent: 'fill', scope: 'selection', edits: [{ op: { kind: 'fill', fill } }] }, schema)
}

export function fromSetAction(action: CmdSetAction, schema: CmdNlSchema, where?: Cond): CmdIR | undefined {
  const field = cmdNlField(schema, action.column.id)
  if (!field) return
  let edit: CmdNlEdit
  if (action.clear) {
    edit = { field: ref(field.id), op: { kind: 'clear' } }
  } else {
    const parts = field.kind === 'multiselect' ? action.value.split(',') : [action.value]
    const values = parts.map((p) => fitCmdNlScalar(field, p, schema))
    if (values.includes(undefined)) return
    edit = { field: ref(field.id), op: { kind: 'set', value: values.length === 1 ? values[0]! : (values as Scalar[]) } }
  }
  return withMeta({ intent: 'edit', scope: where ? 'where' : 'selection', where, edits: [edit] }, schema)
}

function fromCreateValue(field: CmdNlField, value: unknown): Scalar | Scalar[] | undefined {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.map((v) => String(v))
  if (field.kind === 'user') return value === '@me' ? { me: true } : { member: String(value) }
  if (field.kind === 'multiselect' && typeof value === 'string') return value.split(',').map((v) => v.trim())
  if (field.kind === 'date' || field.kind === 'datetime') {
    const date = dayjs(String(value))
    return date.isValid()
      ? {
          date: date.format(field.kind === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm'),
          precision: field.kind === 'date' ? 'day' : 'minute',
        }
      : undefined
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return value
}

export function fromQuickCreate(plan: CmdCreatePlan, schema: CmdNlSchema): CmdIR | undefined {
  if (plan.error) return
  const values: Record<string, Scalar | Scalar[]> = {}
  for (const [titleText, value] of Object.entries(plan.values)) {
    const field = cmdNlFieldByTitle(schema, titleText)
    if (!field) return
    const scalar = fromCreateValue(field, value)
    if (scalar === undefined) return
    values[field.id] = scalar
  }
  return withMeta({ intent: 'create', scope: 'view', create: { values } }, schema)
}

export function fromCalc(calc: CmdCalcResult, schema: CmdNlSchema): CmdIR {
  return withMeta({ intent: 'calc', scope: 'view', calc: { expression: calc.expression, value: calc.value } }, schema)
}

/** Every legacy parser over the query, each reading as CmdIR. */
export function legacyCmdNlParse(query: string, schema: CmdNlSchema, opts: { now?: dayjs.Dayjs } = {}): CmdIR[] {
  const text = query.trim()
  if (!text) return []
  const statColumns = toCmdStatColumns(schema)
  const readings: CmdIR[] = []

  const calc = evaluateCmdCalc(text)
  if (calc) readings.push(fromCalc(calc, schema))

  const split = splitCmdWhere(text)
  if (split) {
    const conds = parseCmdWhereClause(split.clause, statColumns)
    const where = conds ? fromStatWhere(conds, schema) : undefined
    if (where) {
      const set = parseCmdSetAction(split.action, statColumns)
      if (set) {
        const ir = fromSetAction(set, schema, where)
        if (ir) readings.push(ir)
      } else {
        for (const edit of parseCmdRelativeEdits(split.action)) {
          const ir = fromRelativeEdit(edit, schema, where)
          if (ir) readings.push(ir)
        }
      }
    }
  }

  for (const reading of parseCmdStats(text, statColumns)) {
    if (reading.kind !== 'query') continue
    const ir = fromStatQuery(reading.query, schema)
    if (ir) readings.push(ir)
  }

  if (!split) {
    const set = parseCmdSetAction(text, statColumns)
    if (set) {
      const ir = fromSetAction(set, schema)
      if (ir) readings.push(ir)
    }
    for (const edit of parseCmdRelativeEdits(text)) {
      const ir = fromRelativeEdit(edit, schema)
      if (ir) readings.push(ir)
    }
  }

  const fill = parseCmdFill(text)
  if (fill) readings.push(fromFill(fill, schema))

  const plan = parseCmdQuickCreate(text, { tableTitle: schema.table.title, columns: toCmdCreateColumns(schema), now: opts.now })
  if (plan) {
    const ir = fromQuickCreate(plan, schema)
    if (ir) readings.push(ir)
  }

  // The surfaces keep only readings that fit the table; so does the baseline.
  return readings.filter((ir) => validateIR(ir, schema).ok)
}
