import type { FilterType } from 'nocodb-sdk'
import type { CmdFill, CmdRelativeEdit } from '../commandPaletteRelativeEdit'
import type { CmdIR, CmdNlCmp, CmdNlEdit, CmdNlRelativeDate, Cond, CondLeaf, Scalar } from './ir'
import { CMD_NL_RATIO, CMD_NL_SHARE, cmdNlPercentileText, isCmdNlPercentile, isCondLeaf } from './ir'
import type { CmdNlField, CmdNlSchema } from './schema'
import { cmdNlField } from './schema'

/** The view filter API's token for the signed-in user. */
export const CMD_NL_ME = '@me'

/** What a negated comparison becomes; NocoDB filters have no NOT group, so NOT is pushed into leaves. */
const NEGATE: Partial<Record<CmdNlCmp, CmdNlCmp>> = {
  eq: 'neq',
  neq: 'eq',
  gt: 'lte',
  gte: 'lt',
  lt: 'gte',
  lte: 'gt',
  like: 'nlike',
  nlike: 'like',
  blank: 'notblank',
  notblank: 'blank',
  checked: 'notchecked',
  notchecked: 'checked',
  anyof: 'nanyof',
  nanyof: 'anyof',
}

/** De Morgan: a NOT-free tree. Undefined when a negation has no filter form ("not within past week"). */
export function pushNot(cond: Cond, negate = false): Cond | undefined {
  if (isCondLeaf(cond)) {
    if (!negate) return cond
    if (cond.cmp === 'between' && Array.isArray(cond.value)) {
      return {
        op: 'or',
        args: [
          { field: cond.field, cmp: 'lt', value: cond.value[0] },
          { field: cond.field, cmp: 'gt', value: cond.value[1] },
        ],
      }
    }
    const flipped = NEGATE[cond.cmp]
    return flipped ? { ...cond, cmp: flipped } : undefined
  }
  if (cond.op === 'not') return pushNot(cond.arg, !negate)
  const args = cond.args.map((arg) => pushNot(arg, negate))
  if (args.some((arg) => !arg)) return
  const op = negate ? (cond.op === 'and' ? 'or' : 'and') : cond.op
  return { op, args: args as Cond[] }
}

function dateString(value: Scalar): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'date' in value) return value.date
}

/** One leaf's filter: comparison plus, for dates, the sub-operator NocoDB needs. */
function leafFilters(leaf: CondLeaf, field: CmdNlField, logical: 'and' | 'or'): FilterType[] {
  const base = { fk_column_id: field.id, logical_op: logical } as const
  const one = (comparison_op: string, extra: Partial<FilterType> = {}) => [
    { ...base, comparison_op: comparison_op as FilterType['comparison_op'], ...extra },
  ]
  const values = leaf.value === undefined ? [] : Array.isArray(leaf.value) ? leaf.value : [leaf.value]

  if (leaf.cmp === 'blank' || leaf.cmp === 'notblank' || leaf.cmp === 'checked' || leaf.cmp === 'notchecked') {
    return one(leaf.cmp)
  }

  if (field.kind === 'user') {
    const ids = values.map((v) =>
      typeof v === 'object' && v !== null && 'me' in v
        ? CMD_NL_ME
        : typeof v === 'object' && v !== null && 'member' in v
        ? v.member
        : String(v),
    )
    return one(leaf.cmp === 'neq' || leaf.cmp === 'nanyof' ? 'nanyof' : 'anyof', { value: ids.join(',') })
  }

  if (field.kind === 'multiselect') {
    const op = leaf.cmp === 'eq' ? 'anyof' : leaf.cmp === 'neq' ? 'nanyof' : leaf.cmp
    return one(op, { value: values.map(String).join(',') })
  }

  if (field.kind === 'select' && (leaf.cmp === 'anyof' || leaf.cmp === 'nanyof')) {
    return one(leaf.cmp, { value: values.map(String).join(',') })
  }

  if (field.kind === 'date' || field.kind === 'datetime') {
    const sub = (value: Scalar): Partial<FilterType> => {
      if (typeof value === 'object' && value !== null && 'relative' in value) {
        return {
          comparison_sub_op: value.relative as FilterType['comparison_sub_op'],
          ...(value.n !== undefined ? { value: String(value.n) } : {}),
        }
      }
      return { comparison_sub_op: 'exactDate', value: dateString(value) }
    }
    if (leaf.cmp === 'within') return one('isWithin', sub(values[0]!))
    if (leaf.cmp === 'between') {
      return [
        {
          ...base,
          is_group: true,
          children: [...one('gte', sub(values[0]!)), ...one('lte', sub(values[1]!))].map((f) => ({ ...f, logical_op: 'and' })),
        },
      ]
    }
    const range = values[0] && typeof values[0] === 'object' && 'range' in values[0] ? values[0].range : undefined
    if (range && (leaf.cmp === 'eq' || leaf.cmp === 'neq')) {
      // "in October": a span, so eq means inside it and neq outside.
      const inside = [...one('gte', sub(range[0])), ...one('lte', sub(range[1]))]
      const outside = [...one('lt', sub(range[0])), ...one('gt', sub(range[1]))]
      const children = (leaf.cmp === 'eq' ? inside : outside).map((f) => ({ ...f, logical_op: leaf.cmp === 'eq' ? 'and' : 'or' }))
      return [{ ...base, is_group: true, children } as FilterType]
    }
    return one(leaf.cmp, sub(values[0]!))
  }

  if (leaf.cmp === 'between') {
    return [
      {
        ...base,
        is_group: true,
        children: [...one('gte', { value: values[0] as string }), ...one('lte', { value: values[1] as string })].map((f) => ({
          ...f,
          logical_op: 'and',
        })),
      },
    ]
  }

  return one(leaf.cmp, { value: values[0] as FilterType['value'] })
}

function compileNode(cond: Cond, schema: CmdNlSchema, logical: 'and' | 'or', errors: string[]): FilterType[] {
  if (isCondLeaf(cond)) {
    const field = cmdNlField(schema, cond.field.id)
    if (!field) {
      errors.push(`unknown field ${cond.field.id}`)
      return []
    }
    if (isCmdNlPercentile(cond.value)) {
      errors.push(`${field.title}: threshold not resolved yet`)
      return []
    }
    return leafFilters(cond, field, logical)
  }
  if (cond.op === 'not') {
    errors.push('unexpected NOT after pushNot')
    return []
  }
  const children = cond.args.flatMap((arg) => compileNode(arg, schema, cond.op as 'and' | 'or', errors))
  return [{ is_group: true, logical_op: logical, children }]
}

/**
 * A condition as the view filter tree: top-level filters (each `logical_op` joins it to the previous one),
 * groups as `is_group` + `children`. An `and` root is flattened, as the toolbar stores it.
 */
export function compileCond(cond: Cond, schema: CmdNlSchema): { filters: FilterType[]; errors: string[] } {
  const errors: string[] = []
  const notFree = pushNot(cond)
  if (!notFree) return { filters: [], errors: ['a negated condition has no filter form'] }
  const filters =
    !isCondLeaf(notFree) && notFree.op === 'and'
      ? notFree.args.flatMap((arg) => compileNode(arg, schema, 'and', errors))
      : !isCondLeaf(notFree) && notFree.op === 'or'
      ? notFree.args.flatMap((arg) => compileNode(arg, schema, 'or', errors))
      : compileNode(notFree, schema, 'and', errors)
  return { filters, errors }
}

/* canonical(): one plain sentence per reading, used for row titles, chips and comparing readings. */

const CMP_TEXT: Record<CmdNlCmp, string> = {
  eq: 'is',
  neq: 'is not',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  like: 'contains',
  nlike: 'does not contain',
  blank: 'is empty',
  notblank: 'is not empty',
  checked: 'is checked',
  notchecked: 'is not checked',
  anyof: 'is any of',
  allof: 'has all of',
  nanyof: 'is none of',
  between: 'is between',
  within: 'is within',
}

const RELATIVE_TEXT: Record<CmdNlRelativeDate, string> = {
  today: 'today',
  tomorrow: 'tomorrow',
  yesterday: 'yesterday',
  oneWeekAgo: 'one week ago',
  oneWeekFromNow: 'one week from now',
  oneMonthAgo: 'one month ago',
  oneMonthFromNow: 'one month from now',
  daysAgo: '{n} days ago',
  daysFromNow: '{n} days from now',
  pastWeek: 'the past week',
  pastMonth: 'the past month',
  pastYear: 'the past year',
  nextWeek: 'the next week',
  nextMonth: 'the next month',
  nextYear: 'the next year',
  pastNumberOfDays: 'the past {n} days',
  nextNumberOfDays: 'the next {n} days',
}

/** The footer's names for its aggregations. */
export const CMD_NL_AGG_TEXT: Record<string, string> = {
  sum: 'Sum',
  avg: 'Average',
  min: 'Min',
  max: 'Max',
  median: 'Median',
  std_dev: 'Standard deviation',
  range: 'Range',
  count: 'Count',
  count_empty: 'Empty',
  count_filled: 'Filled',
  count_unique: 'Unique',
  percent_empty: 'Percent empty',
  percent_filled: 'Percent filled',
  percent_unique: 'Percent unique',
  checked: 'Checked',
  unchecked: 'Unchecked',
  percent_checked: 'Percent checked',
  percent_unchecked: 'Percent unchecked',
  earliest_date: 'Earliest',
  latest_date: 'Latest',
  date_range: 'Date range',
  month_range: 'Month range',
}

function scalarText(value: Scalar, field?: CmdNlField): string {
  if (value === null) return 'empty'
  if (typeof value === 'number') return value.toLocaleString('en-US')
  if (typeof value !== 'object') return String(value)
  if ('me' in value) return 'me'
  if ('member' in value) return field?.members?.find((m) => m.id === value.member)?.name ?? value.member
  if ('date' in value) return value.date
  if ('range' in value) return `${value.range[0]} – ${value.range[1]}`
  if ('percentile' in value) return cmdNlPercentileText('gte', value.percentile)
  return RELATIVE_TEXT[value.relative].replace('{n}', String(value.n ?? ''))
}

function title(schema: CmdNlSchema, id: string) {
  return cmdNlField(schema, id)?.title ?? id
}

export function canonicalCond(cond: Cond, schema: CmdNlSchema, nested = false): string {
  if (!isCondLeaf(cond)) {
    if (cond.op === 'not') return `not (${canonicalCond(cond.arg, schema, true)})`
    const text = cond.args.map((arg) => canonicalCond(arg, schema, true)).join(` ${cond.op} `)
    return nested && cond.args.length > 1 ? `(${text})` : text
  }
  const field = cmdNlField(schema, cond.field.id)
  const name = field?.title ?? cond.field.id
  if (cond.value === undefined) return `${name} ${CMP_TEXT[cond.cmp]}`
  if (isCmdNlPercentile(cond.value)) return `${name} in the ${cmdNlPercentileText(cond.cmp, cond.value.percentile)}`
  if (cond.cmp === 'between' && Array.isArray(cond.value)) {
    return `${name} is between ${scalarText(cond.value[0]!, field)} and ${scalarText(cond.value[1]!, field)}`
  }
  const values = Array.isArray(cond.value) ? cond.value : [cond.value]
  return `${name} ${CMP_TEXT[cond.cmp]} ${values.map((v) => scalarText(v, field)).join(', ')}`
}

function relativeText(edit: CmdRelativeEdit): string {
  switch (edit.kind) {
    case 'number':
      if (edit.op === 'add')
        return `${edit.amount >= 0 ? 'add' : 'subtract'} ${Math.abs(edit.amount)}${edit.unit ? ` ${edit.unit}` : ''}`
      return 'amount' in edit ? `${edit.op} ${edit.amount}` : edit.op
    case 'date':
      if (edit.op === 'shift') return `${edit.amount >= 0 ? 'add' : 'subtract'} ${Math.abs(edit.amount)} ${edit.unit}`
      if (edit.op === 'weekday') return `move to ${edit.which} weekday ${edit.weekday}`
      return `move to ${edit.op === 'start-of' ? 'start' : 'end'} of ${edit.unit}${edit.offset ? ` ${edit.offset}` : ''}`
    case 'text':
      if (edit.op === 'replace') return `replace “${edit.from}” with “${edit.to}”`
      if (edit.op === 'append' || edit.op === 'prepend' || edit.op === 'remove') return `${edit.op} “${edit.text}”`
      return edit.op
    case 'checkbox':
    case 'select':
      return edit.op
    case 'option':
      return edit.op === 'clear' ? 'clear' : `${edit.op} ${edit.option}`
    case 'user':
      return `${edit.op === 'add' ? 'assign' : 'unassign'} ${edit.who}`
  }
}

function fillText(fill: CmdFill): string {
  switch (fill.kind) {
    case 'down':
    case 'series':
    case 'cycle':
      return `fill ${fill.kind}`
    case 'number':
      return `fill ${fill.start}${fill.end !== undefined ? `..${fill.end}` : ''} step ${fill.step}`
    case 'constant':
      return `fill with ${fill.value}`
    case 'text':
      return `fill ${fill.prefix}${fill.start}..`
    case 'date':
      return `fill every ${fill.step} ${fill.unit}${fill.from ? ` from ${fill.from}` : ''}`
  }
}

function editText(edit: CmdNlEdit, schema: CmdNlSchema): string {
  const field = edit.field ? cmdNlField(schema, edit.field.id) : undefined
  const name = field?.title ?? 'the field'
  switch (edit.op.kind) {
    case 'set': {
      const values = Array.isArray(edit.op.value) ? edit.op.value : [edit.op.value]
      return `set ${name} to ${values.map((v) => scalarText(v, field)).join(', ')}`
    }
    case 'clear':
      return `clear ${name}`
    case 'relative':
      return `${relativeText(edit.op.edit)} (${name})`
    case 'fill':
      return `${fillText(edit.op.fill)} (${name})`
  }
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** The reading as one plain sentence, deterministic for a given IR. */
export function canonical(ir: Omit<CmdIR, 'meta'>, schema: CmdNlSchema): string {
  const where = ir.where ? ` where ${canonicalCond(ir.where, schema)}` : ''
  const groupBy = ir.groupBy?.length ? ` by ${ir.groupBy.map((g) => title(schema, g.id)).join(', ')}` : ''
  const order = ir.orderBy?.length
    ? ` sorted by ${ir.orderBy
        .map(
          (o) =>
            `${o.field === 'agg0' ? 'the figure' : title(schema, o.field.id)} ${o.dir === 'asc' ? 'ascending' : 'descending'}`,
        )
        .join(', ')}`
    : ''
  const limit = ir.limit !== undefined ? `, first ${ir.limit}` : ''

  switch (ir.intent) {
    case 'calc':
      return `= ${ir.calc?.value ?? ''}`
    case 'stat':
      return capitalize(
        `${(ir.aggs ?? [])
          .map((a) => {
            // "Share of Annual revenue where …", "Percent of deals where …"
            if (a.fn === CMD_NL_SHARE) {
              return a.base === 'sum' && a.field
                ? `share of ${title(schema, a.field.id)}`
                : `percent of ${schema.table.title.toLowerCase()}`
            }
            // "Ratio of deals where Stage is Won to Stage is Lost", "Ratio of Amount where … to …"
            if (a.fn === CMD_NL_RATIO && a.num && a.den) {
              const of = a.base === 'sum' && a.field ? title(schema, a.field.id) : schema.table.title.toLowerCase()
              return `ratio of ${of} where ${canonicalCond(a.num, schema, true)} to ${canonicalCond(a.den, schema, true)}`
            }
            return a.field ? `${CMD_NL_AGG_TEXT[a.fn] ?? a.fn} of ${title(schema, a.field.id)}` : CMD_NL_AGG_TEXT[a.fn] ?? a.fn
          })
          .join(', ')}${groupBy}${where}${order}${limit}`,
      )
    case 'edit':
    case 'fill':
      return capitalize(`${(ir.edits ?? []).map((e) => editText(e, schema)).join(', ')}${where}`)
    case 'create':
      return `Create record: ${Object.entries(ir.create?.values ?? {})
        .map(([id, value]) => {
          const field = cmdNlField(schema, id)
          const values = Array.isArray(value) ? value : [value]
          return `${field?.title ?? id} “${values.map((v) => scalarText(v, field)).join(', ')}”`
        })
        .join(' · ')}`
    case 'sort':
      return capitalize(`records${where}${order}${limit}`).replace(/^Records sorted/, 'Sort')
    case 'group':
      return `Group by ${(ir.groupBy ?? []).map((g) => title(schema, g.id)).join(', ')}${where}`
    case 'filter':
    case 'navigate':
      return capitalize(`records${where}${order}${limit}`)
  }
}
