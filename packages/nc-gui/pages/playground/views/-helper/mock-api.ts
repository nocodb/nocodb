import { AxiosError } from 'axios'
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import type {
  ColumnType,
  FilterType,
  LinkToAnotherRecordType,
  ListType,
  LookupType,
  RollupType,
  SelectOptionsType,
  SortType,
  TableType,
  ViewType,
} from 'nocodb-sdk'
import { UITypes, ViewTypes, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { MOCK_BASE_ID, MOCK_TASKS_TABLE_ID, MOCK_USERS, auditColumnMeta, buildAudits, buildRows, mockBase } from './mock-data'
import type { MockComment } from './mock-data'
import { downloadMockExport } from './mock-export'
import { parseImportFile, previewColumns, sheetRecords } from './mock-import'

export interface UnmockedRequest {
  method: string
  url: string
  operation?: string
  at: number
}

export interface MockDb {
  tables: Record<string, TableType>
  views: Record<string, ViewType>
  rows: Record<string, any>[]
  tasks: Record<string, any>[]
  comments: MockComment[]
  audits: Record<string, any>[]
  user: Record<string, any>
  filters: FilterType[]
  sorts: (SortType & { fk_view_id?: string })[]
  viewColumnPatches: Record<string, Record<string, unknown>>
  /** condition filters live in `filters` under `fk_row_color_condition_id` */
  rowColors: Record<string, MockRowColor>
}

export interface MockRowColorCondition {
  id: string
  color: string
  nc_order: number
  is_set_as_background: boolean
  type: string
  fk_target_column_id?: string | null
}

export type MockRowColor =
  | { mode: 'select'; fk_column_id: string; is_set_as_background: boolean }
  | { mode: 'filter'; conditions: MockRowColorCondition[] }

const pageInfo = (total: number, offset: number, limit: number) => ({
  totalRows: total,
  page: Math.floor(offset / Math.max(limit, 1)) + 1,
  pageSize: limit,
  isFirstPage: offset === 0,
  isLastPage: offset + limit >= total,
})

export class MockRequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

/** Copy: stores must never hold the mock's own objects, or in-place edits bypass reactivity. */
export function serialize<T>(data: T): T {
  return data === undefined ? data : JSON.parse(JSON.stringify(data))
}

function parseBody(data: unknown) {
  if (typeof data !== 'string') return data
  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}

function parseJson<T>(raw: unknown): T | undefined {
  if (typeof raw !== 'string' || !raw) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

/** Like-search values arrive as `%term%`, which isn't a valid escape sequence. */
function safeDecode(v: string) {
  try {
    return decodeURIComponent(v)
  } catch {
    return v
  }
}

const isBlank = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)

/** User cells are addressed by comma-joined ids in group keys and filter values. */
const userIds = (v: unknown) => (Array.isArray(v) ? v.map((u) => u?.id).join(',') : '')

/** Supports the `(Field,op,value)~and(...)` shapes the toolbar search, kanban stacks and hide-empty-groups send. */
function applyWhere(rows: Record<string, any>[], where?: string) {
  if (!where) return rows
  const clauses = [...where.matchAll(/\(([^,()]+),([a-z_]+),?([^)]*)\)/g)]
  return rows.filter((row) =>
    clauses.every(([, field, op, raw]) => {
      const value = row[field]
      const needle = safeDecode(String(raw ?? '').replace(/^%|%$/g, ''))
      if (op === 'like')
        return String(value ?? '')
          .toLowerCase()
          .includes(needle.toLowerCase())
      if (op === 'eq' || op === 'gb_eq') return String(value ?? '') === needle
      if (op === 'blank' || op === 'gb_null') return isBlank(value)
      if (op === 'notblank') return !isBlank(value)
      return true
    }),
  )
}

function rollup(values: unknown[], fn?: string) {
  const nums = values.map(Number).filter((n) => !Number.isNaN(n))
  const distinct = [...new Set(nums)]
  const sum = (list: number[]) => list.reduce((a, b) => a + b, 0)
  switch (fn) {
    case 'count':
      return values.length
    case 'countDistinct':
      return new Set(values.map(String)).size
    case 'sum':
      return sum(nums)
    case 'sumDistinct':
      return sum(distinct)
    case 'avg':
      return nums.length ? sum(nums) / nums.length : null
    case 'avgDistinct':
      return distinct.length ? sum(distinct) / distinct.length : null
    case 'min':
      return nums.length ? Math.min(...nums) : null
    case 'max':
      return nums.length ? Math.max(...nums) : null
    default:
      return values.length
  }
}

const percent = (part: number, total: number) => (total ? (part / total) * 100 : 0)

const DAY_MS = 86400000

function aggregateValue(type: string, values: unknown[]): unknown {
  const filled = values.filter((v) => !isBlank(v))
  const unique = new Set(filled.map((v) => JSON.stringify(v))).size
  const nums = filled.map(Number).filter((n) => !Number.isNaN(n))
  const sorted = [...nums].sort((a, b) => a - b)
  const sum = nums.reduce((a, b) => a + b, 0)
  const mean = nums.length ? sum / nums.length : 0
  const times = filled.map((v) => new Date(String(v)).getTime()).filter((t) => !Number.isNaN(t))
  const [first, last] = [Math.min(...times), Math.max(...times)]
  switch (type) {
    case 'count':
      return values.length
    case 'count_empty':
      return values.length - filled.length
    case 'count_filled':
      return filled.length
    case 'count_unique':
      return unique
    case 'percent_empty':
      return percent(values.length - filled.length, values.length)
    case 'percent_filled':
      return percent(filled.length, values.length)
    case 'percent_unique':
      return percent(unique, values.length)
    case 'sum':
      return sum
    case 'min':
      return sorted[0] ?? null
    case 'max':
      return sorted[sorted.length - 1] ?? null
    case 'avg':
      return nums.length ? mean : null
    case 'median': {
      if (!sorted.length) return null
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1]! + sorted[mid]!) / 2
    }
    case 'std_dev':
      return nums.length ? Math.sqrt(nums.reduce((a, n) => a + (n - mean) ** 2, 0) / nums.length) : null
    case 'range':
      return sorted.length ? sorted[sorted.length - 1]! - sorted[0]! : null
    case 'checked':
      return values.filter(Boolean).length
    case 'unchecked':
      return values.filter((v) => !v).length
    case 'percent_checked':
      return percent(values.filter(Boolean).length, values.length)
    case 'percent_unchecked':
      return percent(values.filter((v) => !v).length, values.length)
    case 'attachment_size':
      return filled.flatMap((v) => (Array.isArray(v) ? v : [])).reduce((a, f) => a + (Number(f?.size) || 0), 0)
    case 'earliest_date':
      return times.length ? new Date(first).toISOString() : null
    case 'latest_date':
      return times.length ? new Date(last).toISOString() : null
    case 'date_range':
      return times.length ? Math.round((last - first) / DAY_MS) : null
    case 'month_range':
      return times.length ? Math.round((last - first) / (DAY_MS * 30.44)) : null
    default:
      return undefined
  }
}

interface RangeRef {
  fk_from_column_id?: string | null
  fk_to_column_id?: string | null
}

const NO_VALUE_OPS = ['blank', 'notblank', 'empty', 'notempty', 'null', 'notnull', 'checked', 'notchecked', 'gb_null']

function matchFilter(row: Record<string, any>, f: FilterType, columns: ColumnType[]): boolean {
  const col = columns.find((c) => c.id === f.fk_column_id)
  // widened: groupby requests also send gb_eq / gb_null
  const op: string = f.comparison_op ?? 'eq'
  if (!col) return true
  const raw = row[col.title!]
  const value = f.value === null || f.value === undefined ? '' : String(f.value)
  // the server skips conditions that have no value yet
  if (!value && !NO_VALUE_OPS.includes(op)) return true

  const isUser = col.uidt === UITypes.User
  const text = isUser ? userIds(raw) : raw && typeof raw === 'object' ? JSON.stringify(raw) : String(raw ?? '')
  const items = isUser
    ? (Array.isArray(raw) ? raw : []).flatMap((u) => [u?.id, u?.email])
    : text
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
  const wanted = value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  const isDate = col.uidt === UITypes.Date || col.uidt === UITypes.DateTime
  const left = isDate ? text.slice(0, 10) : text
  const right = isDate ? value.slice(0, 10) : value
  const numeric = !isDate && left !== '' && !Number.isNaN(Number(left)) && !Number.isNaN(Number(right))
  const cmp = numeric ? Number(left) - Number(right) : left.localeCompare(right)

  switch (op) {
    case 'eq':
    case 'is':
      return numeric ? cmp === 0 : left.toLowerCase() === right.toLowerCase()
    case 'neq':
    case 'isnot':
      return numeric ? cmp !== 0 : left.toLowerCase() !== right.toLowerCase()
    case 'like':
      return text.toLowerCase().includes(value.toLowerCase())
    case 'nlike':
      return !text.toLowerCase().includes(value.toLowerCase())
    case 'gt':
      return left !== '' && cmp > 0
    case 'gte':
      return left !== '' && cmp >= 0
    case 'lt':
      return left !== '' && cmp < 0
    case 'lte':
      return left !== '' && cmp <= 0
    case 'blank':
    case 'empty':
    case 'null':
    case 'gb_null':
      return isBlank(raw)
    case 'notblank':
    case 'notempty':
    case 'notnull':
      return !isBlank(raw)
    case 'checked':
      return !!raw
    case 'notchecked':
      return !raw
    case 'anyof':
      return wanted.some((w) => items.includes(w))
    case 'nanyof':
      return !wanted.some((w) => items.includes(w))
    case 'allof':
      return wanted.every((w) => items.includes(w))
    case 'nallof':
      return !wanted.every((w) => items.includes(w))
    case 'gb_eq':
      return text === value
    default:
      return true
  }
}

/** Evaluates a filter tree left to right, each node joined by its own `logical_op`. */
function matchFilters(row: Record<string, any>, filters: FilterType[], columns: ColumnType[]): boolean {
  let result: boolean | undefined
  for (const f of filters) {
    if (f.enabled === false || f.enabled === 0) continue
    const ok = f.is_group ? matchFilters(row, f.children ?? [], columns) : matchFilter(row, f, columns)
    result = result === undefined ? ok : f.logical_op === 'or' ? result || ok : result && ok
  }
  return result ?? true
}

function applySort(rows: Record<string, any>[], columns: ColumnType[], sorts: SortType[]) {
  if (!sorts.length) return rows
  return [...rows].sort((a, b) => {
    for (const s of sorts) {
      if (s.enabled === false) continue
      const title = columns.find((c) => c.id === s.fk_column_id)?.title
      if (!title) continue
      const av = a[title]
      const bv = b[title]
      if (av === bv) continue
      const cmp = av === null || av === undefined ? -1 : bv === null || bv === undefined ? 1 : av > bv ? 1 : -1
      return s.direction === 'desc' ? -cmp : cmp
    }
    return 0
  })
}

export function createMockAdapter(
  db: MockDb,
  onUnmocked: (req: UnmockedRequest) => void,
  passthrough?: AxiosAdapter,
): AxiosAdapter {
  let seq = 0

  const jobs = new Map<string, () => Promise<unknown>>()

  const uploads = new Map<string, File>()

  /** the real backend refuses bookmark targets it doesn't know */
  const bookmarks: Array<Record<string, any>> = []

  const nextKey = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`

  const tableOf = (id: string) => db.tables[id]

  const mainTableId = () => Object.keys(db.tables).find((id) => id !== MOCK_TASKS_TABLE_ID) ?? ''

  const rowsOf = (tableId: string) => (tableId === MOCK_TASKS_TABLE_ID ? db.tasks : db.rows)

  // seed values, so seeded revision history doesn't shift as rows get edited
  const seedById = new Map(buildRows().map((r) => [String(r.Id), r]))

  const viewFilterTree = (viewId?: string) => {
    const build = (parentId: string | null): FilterType[] =>
      db.filters
        .filter((f) => f.fk_view_id === viewId && (f.fk_parent_id ?? null) === parentId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((f) => (f.is_group ? { ...f, children: build(f.id!) } : f))
    return viewId ? build(null) : []
  }

  const viewSorts = (viewId?: string) =>
    db.sorts.filter((s) => viewId && s.fk_view_id === viewId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const listRows = (tableId: string, q: Record<string, any> = {}, viewId: string | undefined = q.viewId) => {
    const columns = (tableOf(tableId)?.columns ?? []) as ColumnType[]
    const filters = [...viewFilterTree(viewId), ...(parseJson<FilterType[]>(q.filterArrJson) ?? [])]
    const rows = applyWhere(rowsOf(tableId), q.where).filter((r) => matchFilters(r, filters, columns))
    // the client only sends sortArrJson when it can't save sorts to the view
    return withVirtuals(tableId, applySort(rows, columns, parseJson<SortType[]>(q.sortArrJson) ?? viewSorts(viewId)))
  }

  const page = (rows: Record<string, any>[], q: Record<string, any> = {}) => {
    const offset = Number(q.offset ?? 0)
    const limit = Number(q.limit ?? 25)
    return { list: rows.slice(offset, offset + limit), pageInfo: pageInfo(rows.length, offset, limit) }
  }

  const grouped = (tableId: string, viewId: string, colId: string, q: Record<string, any> = {}) => {
    const col = (tableOf(tableId)?.columns ?? []).find((c) => c.id === colId)
    if (!col) return []
    const rows = listRows(tableId, q, viewId)
    let titles: Array<string | null> = [
      null,
      ...((col.colOptions as SelectOptionsType | undefined)?.options ?? []).map((o) => o.title ?? null),
    ]
    if (q.optionsArrJson) {
      try {
        titles = JSON.parse(q.optionsArrJson)
      } catch {}
    }
    return titles.map((title) => {
      const stackRows = rows.filter((r) => (r[col.title!] ?? null) === title || (!title && !r[col.title!]))
      return { key: title ?? '', value: page(stackRows, { offset: 0, limit: q.limit ?? 25 }) }
    })
  }

  const groupKey = (col: ColumnType, v: unknown) =>
    isBlank(v) ? '' : col.uidt === UITypes.User ? userIds(v) : v && typeof v === 'object' ? JSON.stringify(v) : String(v)

  /** `GET .../groupby` — one item per distinct value, sorted like `sort=+Title` / `-Title` / `~+Title` (by count). */
  const groupBy = (tableId: string, viewId: string, q: Record<string, any> = {}) => {
    const columns = (tableOf(tableId)?.columns ?? []) as ColumnType[]
    const col = columns.find((c) => c.title === q.column_name)
    if (!col) return page([], q)
    const sub = columns.find((c) => c.title === q.subGroupColumnName)
    const buckets = new Map<string, { value: unknown; rows: Record<string, any>[] }>()
    for (const row of listRows(tableId, q, viewId)) {
      const raw = row[col.title!]
      const key = groupKey(col, raw)
      if (!buckets.has(key)) buckets.set(key, { value: isBlank(raw) ? null : raw, rows: [] })
      buckets.get(key)!.rows.push(row)
    }
    const sort = String(q.sort ?? '')
    const byCount = sort.startsWith('~')
    const dir = sort.replace(/^~/, '').startsWith('-') ? -1 : 1
    const optionOrder = ((col.colOptions as SelectOptionsType | undefined)?.options ?? []).map((o) => o.title)
    const groups = [...buckets.entries()].sort(([ak, a], [bk, b]) => {
      if (byCount) return dir * (a.rows.length - b.rows.length)
      if (!ak || !bk) return ak ? 1 : bk ? -1 : 0
      const ai = optionOrder.indexOf(ak)
      const bi = optionOrder.indexOf(bk)
      return dir * (ai > -1 && bi > -1 ? ai - bi : ak.localeCompare(bk, undefined, { numeric: true }))
    })
    const list = groups.map(([, g]) => ({
      [col.title!]: g.value,
      count: g.rows.length,
      ...(sub ? { __sub_group_count__: new Set(g.rows.map((r) => groupKey(sub, r[sub.title!]))).size } : {}),
    }))
    return page(list, q)
  }

  const groupByCount = (tableId: string, viewId: string, q: Record<string, any> = {}) => {
    const col = (tableOf(tableId)?.columns ?? []).find((c) => c.title === q.column_name)
    if (!col) return 0
    return new Set(listRows(tableId, q, viewId).map((r) => groupKey(col, r[col.title!]))).size
  }

  const recordAudit = (
    tableId: string,
    rowId: unknown,
    opType: string,
    data: Record<string, any>,
    oldData?: Record<string, any>,
  ) => {
    const columns = (tableOf(tableId)?.columns ?? []) as ColumnType[]
    const tracked = columns.filter((c) => !isSystemColumn(c) && !isVirtualCol(c) && c.title! in data).map((c) => c.title!)
    if (!tracked.length) return
    const pick = (src: Record<string, any>) => Object.fromEntries(tracked.map((t) => [t, src[t] ?? null]))
    db.audits.push({
      id: nextKey('pg-audit'),
      row_id: String(rowId),
      fk_model_id: tableId,
      op_type: opType,
      version: 1,
      user: db.user.email,
      fk_user_id: db.user.id,
      created_at: new Date().toISOString(),
      details: JSON.stringify({
        data: pick(data),
        ...(oldData ? { old_data: pick(oldData) } : {}),
        column_meta: auditColumnMeta(columns, tracked),
      }),
    })
  }

  const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

  const updateRow = (rowId: string, data: Record<string, any>, tableId = mainTableId()) => {
    const row = rowsOf(tableId).find((r) => String(r.Id) === String(rowId))
    if (!row) return {}
    const changed = Object.fromEntries(Object.entries(data ?? {}).filter(([k, v]) => k !== 'Id' && !sameValue(row[k], v)))
    const old = Object.fromEntries(Object.keys(changed).map((k) => [k, row[k]]))
    Object.assign(row, data, { UpdatedAt: new Date().toISOString() })
    if (Object.keys(changed).length) recordAudit(tableId, row.Id, 'DATA_UPDATE', changed, old)
    return { ...row }
  }

  const reorder = (rows: Record<string, any>[]) => rows.forEach((r, i) => (r.nc_order = i + 1))

  /** `before` = the pk of the row the new one goes above (insert above/below, duplicate). */
  const insertRow = (data: Record<string, any>, before?: unknown, tableId = mainTableId()) => {
    const rows = rowsOf(tableId)
    const { Id: _id, ...rest } = data ?? {}
    const now = new Date().toISOString()
    const id = rows.reduce((max, r) => Math.max(max, Number(r.Id) || 0), 0) + 1
    const row: Record<string, any> = { ...rest, Id: id, CreatedAt: now, UpdatedAt: now }
    const at = before === undefined || before === null ? -1 : rows.findIndex((r) => String(r.Id) === String(before))
    if (at > -1) rows.splice(at, 0, row)
    else rows.push(row)
    if (rows === db.rows) reorder(rows)
    if (rows === db.rows) recordAudit(tableId, id, 'DATA_INSERT', row)
    applyLinks(tableId, row)
    return row
  }

  const deleteRow = (rowId: unknown, tableId = mainTableId()) => {
    const rows = rowsOf(tableId)
    const idx = rows.findIndex((r) => String(r.Id) === String(rowId))
    if (idx > -1) rows.splice(idx, 1)
    return idx > -1
  }

  const moveRow = (rowId: unknown, before: unknown) => {
    const idx = db.rows.findIndex((r) => String(r.Id) === String(rowId))
    if (idx < 0) return
    const [row] = db.rows.splice(idx, 1)
    const at = before === undefined || before === null ? -1 : db.rows.findIndex((r) => String(r.Id) === String(before))
    db.rows.splice(at > -1 ? at : db.rows.length, 0, row)
    reorder(db.rows)
  }

  const relationOf = (tableId: string, colRef: string) => {
    const col = (tableOf(tableId)?.columns ?? []).find((c) => c.id === colRef || c.title === colRef)
    const opts = col?.colOptions as LinkToAnotherRecordType | undefined
    if (!col || !opts?.fk_related_model_id) return
    const fk = tableOf(opts.fk_related_model_id)?.columns?.find((c) => c.id === opts.fk_child_column_id)?.title
    if (!fk) return
    return { col, fk, childTableId: opts.fk_related_model_id, children: rowsOf(opts.fk_related_model_id) }
  }

  type Relation = NonNullable<ReturnType<typeof relationOf>>

  const recount = (rel: Relation) => {
    for (const r of db.rows) r[rel.col.title!] = rel.children.filter((c) => String(c[rel.fk]) === String(r.Id)).length
  }

  /** Links in an insert body arrive as record lists (nested insert); the cell itself only ever holds the count. */
  function applyLinks(tableId: string, row: Record<string, any>) {
    for (const col of (tableOf(tableId)?.columns ?? []).filter((c) => isLinksOrLTAR(c))) {
      const rel = relationOf(tableId, col.id!)
      if (!rel) continue
      const linked = row[col.title!]
      if (Array.isArray(linked)) {
        for (const ref of linked) {
          const child = rel.children.find((c) => String(c.Id) === String(ref?.Id ?? ref))
          if (child) child[rel.fk] = row.Id
        }
      }
      recount(rel)
    }
  }

  const linkChild = (rel: Relation, parentId: unknown, childId: unknown, link: boolean) => {
    const child = rel.children.find((c) => String(c.Id) === String(childId))
    if (child) child[rel.fk] = link ? Number(parentId) : null
    recount(rel)
  }

  /** `GET .../{rowId}/hm/{column}[/exclude]`, `POST|DELETE .../{rowId}/hm/{column}/{refRowId}` */
  const nested = (
    tableId: string,
    rowId: string,
    colRef: string,
    tail: string | undefined,
    method: string,
    q: Record<string, any>,
  ) => {
    const rel = relationOf(tableId, safeDecode(colRef))
    if (!rel) return page([], q)
    if (method === 'POST' || method === 'DELETE') {
      linkChild(rel, rowId, tail, method === 'POST')
      return { msg: `The relation data has been ${method === 'POST' ? 'created' : 'deleted'} successfully` }
    }
    const isChild = (c: Record<string, any>) => String(c[rel.fk]) === String(rowId)
    const rows = applyWhere(
      rel.children.filter((c) => (tail === 'exclude' ? !isChild(c) && String(c.Id) !== String(rowId) : isChild(c))),
      q.where,
    )
    return page(rows, q)
  }

  const findColumn = (colId: string) =>
    Object.values(db.tables)
      .flatMap((t) => t.columns ?? [])
      .find((c) => c.id === colId)

  const dateDependencyOf = (ganttViewId?: string) =>
    ganttViewId
      ? (db.views[ganttViewId]?.view as { date_dependency?: Record<string, unknown> } | undefined)?.date_dependency
      : undefined

  const ownerOf = (colId: string) => findColumn(colId)?.fk_model_id ?? mainTableId()

  const replaceColumns = (tableId: string, columns: ColumnType[]) => {
    const table = { ...tableOf(tableId), columns, columnsById: Object.fromEntries(columns.map((c) => [c.id!, c])) } as TableType
    db.tables[tableId] = table
    return table
  }

  const columnName = (title: unknown) =>
    String(title ?? '')
      .toLowerCase()
      .replace(/\W+/g, '_')

  /** A new Links field: the server adds the FK to the child table. */
  const linkColOptions = (tableId: string, colId: string, payload: Record<string, any>) => {
    const childId: string = payload.childId ?? MOCK_TASKS_TABLE_ID
    const fkId = `${colId}-fk`
    const child = tableOf(childId)
    if (child) {
      const fk = {
        id: fkId,
        title: `${columnName(payload.title)}_id`,
        column_name: `${columnName(payload.title)}_id`,
        uidt: UITypes.ForeignKey,
        system: true,
        fk_model_id: childId,
        base_id: MOCK_BASE_ID,
      } as ColumnType
      replaceColumns(childId, [...(child.columns ?? []), fk])
    }
    const pk = tableOf(tableId)?.columns?.find((c) => c.pk)
    return { type: payload.type ?? 'hm', fk_related_model_id: childId, fk_child_column_id: fkId, fk_parent_column_id: pk?.id }
  }

  const COL_OPTION_KEYS: Partial<Record<string, string[]>> = {
    [UITypes.Lookup]: ['fk_relation_column_id', 'fk_lookup_column_id'],
    [UITypes.Rollup]: ['fk_relation_column_id', 'fk_rollup_column_id', 'rollup_function'],
    [UITypes.Formula]: ['formula', 'formula_raw'],
    [UITypes.QrCode]: ['fk_qr_value_column_id'],
    [UITypes.Barcode]: ['fk_barcode_value_column_id', 'barcode_format'],
    [UITypes.Button]: ['type', 'label', 'theme', 'color', 'icon', 'formula', 'formula_raw', 'fk_webhook_id', 'fk_script_id'],
  }

  const buildColumn = (tableId: string, payload: Record<string, any>, base?: ColumnType): ColumnType => {
    const { view_id: _v, column_order: _o, userHasChangedTitle: _u, ...rest } = payload ?? {}
    const id = base?.id ?? nextKey('pgc')
    const uidt: string = rest.uidt ?? base?.uidt
    const keys = COL_OPTION_KEYS[uidt]
    let colOptions = rest.colOptions ?? (base?.uidt === uidt ? base?.colOptions : undefined)
    if (keys) {
      colOptions = { ...(colOptions as object), ...Object.fromEntries(keys.filter((k) => k in rest).map((k) => [k, rest[k]])) }
      if (uidt === UITypes.Formula && !rest.formula && rest.formula_raw) colOptions = { ...colOptions, formula: rest.formula_raw }
    } else if (uidt === UITypes.SingleSelect || uidt === UITypes.MultiSelect) {
      const options = ((colOptions as SelectOptionsType | undefined)?.options ?? []).map((o, i) => ({
        ...o,
        id: o.id ?? `${id}-opt-${i}`,
        fk_column_id: id,
        order: o.order ?? i + 1,
      }))
      colOptions = { options }
    } else if (isLinksOrLTAR(uidt) && !base) {
      colOptions = linkColOptions(tableId, id, rest)
    }
    return {
      ...base,
      ...rest,
      id,
      uidt,
      fk_model_id: tableId,
      base_id: MOCK_BASE_ID,
      column_name: rest.column_name || base?.column_name || columnName(rest.title ?? id),
      meta: rest.meta ?? base?.meta ?? {},
      system: base?.system ?? false,
      colOptions,
    } as ColumnType
  }

  const showNewColumn = (tableId: string, colId: string, order?: { order?: number; view_id?: string }) => {
    for (const view of Object.values(db.views).filter((v) => v.fk_model_id === tableId)) {
      const key = `vc-${view.id}-${colId}`
      db.viewColumnPatches[key] = {
        show: true,
        ...(order?.order !== undefined && (!order.view_id || order.view_id === view.id) ? { order: order.order } : {}),
      }
    }
  }

  const addColumn = (tableId: string, payload: Record<string, any>) => {
    if (payload?.uidt === UITypes.Formula && !String(payload.formula_raw ?? payload.formula ?? '').trim())
      throw new MockRequestError('Formula is required')
    const column = buildColumn(tableId, payload)
    // read after buildColumn: a self link adds its FK to this same table
    const table = replaceColumns(tableId, [...(tableOf(tableId)?.columns ?? []), column])
    showNewColumn(tableId, column.id!, payload.column_order)
    const rel = isLinksOrLTAR(column) ? relationOf(tableId, column.id!) : undefined
    if (rel) recount(rel)
    return table
  }

  const updateColumn = (colId: string, payload: Record<string, any>) => {
    const tableId = ownerOf(colId)
    const columns = tableOf(tableId)?.columns ?? []
    const prev = columns.find((c) => c.id === colId)
    if (!prev) return tableOf(tableId) ?? {}
    const next = buildColumn(tableId, payload, prev)
    if (next.title && next.title !== prev.title) {
      for (const row of rowsOf(tableId)) {
        row[next.title] = row[prev.title!]
        delete row[prev.title!]
      }
    }
    if (next.uidt === UITypes.SingleSelect || next.uidt === UITypes.MultiSelect) remapOptions(tableId, prev, next)
    return replaceColumns(
      tableId,
      columns.map((c) => (c.id === colId ? next : c)),
    )
  }

  /** Renamed options carry their values over, removed ones are cleared — as the server rewrites the data. */
  function remapOptions(tableId: string, prev: ColumnType, next: ColumnType) {
    const before = (prev.colOptions as SelectOptionsType | undefined)?.options ?? []
    const after = (next.colOptions as SelectOptionsType | undefined)?.options ?? []
    const renamed = new Map<string, string | null>()
    for (const o of before) {
      const now = after.find((n) => n.id === o.id)
      if (!now) renamed.set(o.title!, null)
      else if (now.title !== o.title) renamed.set(o.title!, now.title!)
    }
    if (!renamed.size) return
    const key = next.title!
    for (const row of rowsOf(tableId)) {
      if (isBlank(row[key])) continue
      const values = String(row[key])
        .split(',')
        .map((v) => (renamed.has(v) ? renamed.get(v) : v))
        .filter((v): v is string => !!v)
      row[key] = values.length ? values.join(',') : null
    }
    for (const view of Object.values(db.views)) {
      const stacks = (view.view as { meta?: Record<string, Array<{ title?: string | null }>> } | undefined)?.meta?.[next.id!]
      for (const stack of stacks ?? []) {
        if (stack.title && renamed.has(stack.title)) stack.title = renamed.get(stack.title) ?? stack.title
      }
    }
  }

  function duplicateColumn(colId: string, body: any) {
    const tableId = ownerOf(colId)
    const source = findColumn(colId)
    if (!source) return
    const titles = new Set((tableOf(tableId)?.columns ?? []).map((c) => c.title))
    let title = `${source.title} copy`
    for (let n = 1; titles.has(title); n++) title = `${source.title} copy_${n}`
    const { id: _id, ...rest } = source
    const colOptions = source.colOptions as SelectOptionsType | undefined
    addColumn(tableId, {
      ...rest,
      title,
      column_name: columnName(title),
      colOptions: colOptions?.options ? { options: colOptions.options.map(({ id: _o, ...o }) => o) } : source.colOptions,
      column_order: body?.extra?.column_order,
    })
    if (!body?.options?.excludeData) for (const row of rowsOf(tableId)) row[title] = row[source.title!]
  }

  const deleteColumn = (colId: string) => {
    const tableId = ownerOf(colId)
    return replaceColumns(
      tableId,
      (tableOf(tableId)?.columns ?? []).filter((c) => c.id !== colId),
    )
  }

  function withVirtuals(tableId: string, rows: Record<string, any>[]) {
    const virtuals = (tableOf(tableId)?.columns ?? []).filter((c) => c.uidt === UITypes.Lookup || c.uidt === UITypes.Rollup)
    if (!virtuals.length) return rows
    return rows.map((row) => {
      const out = { ...row }
      for (const c of virtuals) {
        const opts = (c.colOptions ?? {}) as Partial<LookupType & RollupType>
        const rel = relationOf(tableId, opts.fk_relation_column_id ?? '')
        const targetId = c.uidt === UITypes.Lookup ? opts.fk_lookup_column_id : opts.fk_rollup_column_id
        const target = rel && tableOf(rel.childTableId)?.columns?.find((t) => t.id === targetId)
        if (!rel || !target) continue
        const values = rel.children.filter((ch) => String(ch[rel.fk]) === String(row.Id)).map((ch) => ch[target.title!])
        out[c.title!] = c.uidt === UITypes.Lookup ? values : rollup(values, opts.rollup_function)
      }
      return out
    })
  }

  const viewColumns = (viewId: string) => {
    const view = db.views[viewId]
    const columns = (tableOf(view?.fk_model_id ?? '')?.columns ?? []) as ColumnType[]
    const isCardView = view?.type === ViewTypes.GALLERY || view?.type === ViewTypes.KANBAN
    return columns
      .filter((c) => !c.system)
      .map((c, i) => ({
        id: `vc-${viewId}-${c.id}`,
        fk_view_id: viewId,
        fk_column_id: c.id,
        show: isCardView ? i < 9 && c.uidt !== UITypes.Attachment : i < 14,
        order: i + 1,
        width: c.pv ? '220px' : c.uidt === UITypes.LongText ? '260px' : '180px',
        aggregation: c.uidt === UITypes.Currency ? 'sum' : c.uidt === UITypes.Checkbox ? 'checked' : 'none',
        ...(view?.type === ViewTypes.LIST ? { fk_level_id: (view.view as ListType)?.levels?.[0]?.id } : {}),
        ...db.viewColumnPatches[`vc-${viewId}-${c.id}`],
      }))
  }

  const patchViewColumn = (viewColumnId: string | undefined, payload: unknown) => {
    if (!viewColumnId) return {}
    db.viewColumnPatches[viewColumnId] = {
      ...db.viewColumnPatches[viewColumnId],
      ...(payload && typeof payload === 'object' ? payload : {}),
    }
    const viewId = Object.keys(db.views).find((id) => viewColumnId.startsWith(`vc-${id}-`))
    return (viewId && viewColumns(viewId).find((c) => c.id === viewColumnId)) || { id: viewColumnId }
  }

  const aggregate = (tableId: string, payload: any, q: Record<string, any> = {}) => {
    const rows = listRows(tableId, q, payload?.viewId)
    const out: Record<string, any> = {}
    // no explicit list = every view column's configured aggregation, like the server
    const aggregations: Array<{ field: string; type: string }> = Array.isArray(payload?.aggregation)
      ? payload.aggregation
      : viewColumns(payload?.viewId)
          .filter((c) => c.aggregation !== 'none')
          .map((c) => ({ field: c.fk_column_id!, type: c.aggregation }))
    for (const { field, type } of aggregations) {
      const col = (tableOf(tableId)?.columns ?? []).find((c) => c.id === field || c.title === field)
      if (!col) continue
      const value = aggregateValue(
        type,
        rows.map((r) => r[col.title!]),
      )
      if (value !== undefined) out[col.title!] = value
    }
    return out
  }

  const removeFilters = (match: (f: FilterType) => boolean) => {
    const doomed = new Set(db.filters.filter(match).map((f) => f.id!))
    for (let grew = true; grew; ) {
      grew = false
      for (const f of db.filters) {
        if (f.fk_parent_id && doomed.has(f.fk_parent_id) && !doomed.has(f.id!)) {
          doomed.add(f.id!)
          grew = true
        }
      }
    }
    db.filters.splice(0, db.filters.length, ...db.filters.filter((f) => !doomed.has(f.id!)))
  }

  const conditionOf = (conditionId: string) =>
    Object.values(db.rowColors)
      .flatMap((c) => (c.mode === 'filter' ? c.conditions : []))
      .find((c) => c.id === conditionId)

  const createConditionFilter = (conditionId: string, payload: FilterType): FilterType => {
    const { children, status: _s, ...rest } = (payload ?? {}) as FilterType & { status?: string }
    const filter: FilterType = { ...rest, id: nextKey('pgf'), fk_row_color_condition_id: conditionId, base_id: MOCK_BASE_ID }
    db.filters.push(filter)
    for (const child of children ?? []) createConditionFilter(conditionId, { ...child, fk_parent_id: filter.id })
    return filter
  }

  const dropRowColor = (viewId: string) => {
    const current = db.rowColors[viewId]
    if (current?.mode === 'filter') {
      const ids = new Set(current.conditions.map((c) => c.id))
      removeFilters((f) => !!f.fk_row_color_condition_id && ids.has(f.fk_row_color_condition_id))
    }
    delete db.rowColors[viewId]
  }

  const rowColorInfo = (viewId: string) => {
    const current = db.rowColors[viewId]
    const tableId = db.views[viewId]?.fk_model_id ?? mainTableId()
    if (!current) return null
    if (current.mode === 'select') {
      const selectColumn = (tableOf(tableId)?.columns ?? []).find((c) => c.id === current.fk_column_id)
      if (!selectColumn) return null
      return {
        mode: 'select',
        fk_column_id: current.fk_column_id,
        is_set_as_background: current.is_set_as_background,
        type: 'row',
        options: (selectColumn.colOptions as SelectOptionsType | undefined)?.options ?? [],
        selectColumn,
        fk_model_id: tableId,
        fk_view_id: viewId,
      }
    }
    return {
      mode: 'filter',
      fk_model_id: tableId,
      fk_view_id: viewId,
      conditions: [...current.conditions]
        .sort((a, b) => a.nc_order - b.nc_order)
        .map((c) => ({
          ...c,
          conditions: db.filters
            .filter((f) => f.fk_row_color_condition_id === c.id)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        })),
    }
  }

  /** Like populateSamplePayloadV2: no links / lookups; dummy attachments, as inline data: urls bloat the editor. */
  function samplePayloadRow(tableId: string) {
    const seed = db.rows[0] ?? {}
    const row: Record<string, unknown> = {}
    for (const col of tableOf(tableId)?.columns ?? []) {
      if (col.system || isLinksOrLTAR(col) || col.uidt === UITypes.Lookup || col.uidt === UITypes.Rollup) continue
      row[col.title!] =
        col.uidt === UITypes.Attachment
          ? [{ url: 'https://nocodb.com/dummy.png', title: 'image.png', mimetype: 'image/png', size: 0 }]
          : seed[col.title!] ?? null
    }
    return row
  }

  const internal = (
    operation: string,
    q: Record<string, any>,
    payload: any,
    method: string,
  ): { data: unknown; known: boolean } => {
    const data = internalKnown(operation, q, payload)
    if (data !== undefined) return { data, known: true }
    if (operation.endsWith('List')) return { data: { list: [], pageInfo: pageInfo(0, 0, 25) }, known: false }
    if (/(Create|Update|Delete|Move)$/.test(operation) || method !== 'GET') {
      const idKey = Object.keys(q).find((k) => k.endsWith('Id') && !['tableId', 'baseId', 'workspaceId'].includes(k))
      const id = q.id ?? (idKey ? q[idKey] : undefined) ?? `pg-${Math.random().toString(36).slice(2, 10)}`
      const base = q.viewId && db.views[q.viewId] ? db.views[q.viewId] : {}
      return { data: { ...base, ...(typeof payload === 'object' ? payload : {}), id }, known: false }
    }
    return { data: {}, known: false }
  }

  function internalKnown(operation: string, q: Record<string, any>, payload: any): unknown {
    const tableId = q.tableId ?? q.fk_model_id ?? db.views[q.viewId]?.fk_model_id
    switch (operation) {
      case 'batch':
        return {
          results: (payload?.operations ?? []).map((op: { operation: string; query?: any; payload?: any }) => {
            const res = internal(op.operation, { ...op.query, operation: op.operation }, op.payload, 'GET')
            if (!res.known)
              onUnmocked({ method: 'BATCH', url: '/api/v2/internal (batch)', operation: op.operation, at: Date.now() })
            return { status: 200, data: res.data }
          }),
        }
      case 'bulkDataList':
        return Object.fromEntries(
          (Array.isArray(payload) ? payload : []).map((req: any) => [req.alias, page(listRows(tableId, req, q.viewId), req)]),
        )
      case 'dataList':
        return page(listRows(tableId, q), q)
      case 'dataCount':
        return { count: listRows(tableId, q).length }
      case 'viewColumnList':
        return { list: viewColumns(q.viewId) }
      case 'viewList':
        return { list: Object.values(db.views).filter((v) => v.fk_model_id === tableId) }
      case 'tableGet':
        return tableOf(tableId) ?? {}
      case 'tableList':
        return { list: Object.values(db.tables) }
      case 'baseGet':
        return mockBase()
      case 'formViewGet': {
        const view = db.views[q.formViewId]
        return {
          ...(view?.view ?? {}),
          columns: viewColumns(q.formViewId).map((c) => ({ label: null, help: null, required: false, ...c })),
        }
      }
      case 'formColumnUpdate':
        return patchViewColumn(q.formColumnId, payload)
      case 'formColumnBulkUpdate':
        for (const { id, ...rest } of (payload?.updates ?? []) as Array<{ id: string } & Record<string, unknown>>) {
          patchViewColumn(id, rest)
        }
        return true
      case 'mapViewGet':
        return db.views[q.mapViewId]?.view ?? {}
      // list view = one level over this table: flat rows tagged with the leveled-list markers
      case 'listViewDataList': {
        const modelId = db.views[q.viewId]?.fk_model_id ?? ''
        const rows = listRows(modelId, q).map((r) => ({
          ...r,
          __nc_depth: 0,
          __nc_row_id: r.Id,
          __nc_pk: r.Id,
          __nc_parent_id: null,
          __nc_row_type: modelId,
        }))
        const offset = Number(q.offset ?? 0)
        const limit = Number(q.limit ?? 100)
        return { list: rows.slice(offset, offset + limit), pageInfo: { offset, limit, totalRows: rows.length } }
      }
      case 'listViewDataCount': {
        const modelId = db.views[q.viewId]?.fk_model_id ?? ''
        const total = listRows(modelId, q).length
        return { totalRows: total, counts: { [modelId]: total } }
      }
      case 'columnsHash':
        return { hash: 'playground' }
      case 'commentCount': {
        const ids = (Array.isArray(q.ids) ? q.ids : [q.ids]).map(String)
        return ids.map((id) => ({ row_id: id, count: db.comments.filter((c) => c.row_id === id).length })).filter((c) => c.count)
      }
      case 'commentList':
        return { list: db.comments.filter((c) => c.row_id === String(q.row_id)) }
      case 'commentNotificationPreferenceGet':
        return { preference: 'mentions' }
      case 'commentNotificationPreferenceSet':
        return { preference: payload?.preference ?? 'mentions' }
      case 'tableSampleData':
      case 'hookSamplePayload': {
        const table = tableOf(q.tableId ?? tableId)
        const op = String(q.hookOperation ?? 'insert')
        const row = samplePayloadRow(table?.id ?? tableId)
        return {
          type: `records.after.${op}`,
          id: 'pg-sample-payload',
          ...(q.version === 'v3' ? { version: 'v3' } : {}),
          data: {
            table_id: table?.id,
            table_name: table?.title,
            ...(op === 'update' ? { previous_rows: [row] } : {}),
            rows: [row],
          },
        }
      }
      // plan- or EE-gated loaders some surfaces trigger; empty is a valid answer
      case 'workflowNodes':
        return { nodes: [] }
      case 'baseSchema':
        return {}
      case 'commentRow': {
        const me = MOCK_USERS.find((u) => u.email === db.user.email) ?? MOCK_USERS[0]
        const now = new Date().toISOString()
        const comment: MockComment = {
          id: `pg-cmt-${db.comments.length + 1}-${Date.now()}`,
          row_id: String(payload?.row_id),
          fk_model_id: payload?.fk_model_id,
          comment: payload?.comment ?? '',
          created_by: db.user.id ?? me.id,
          created_by_email: db.user.email ?? me.email,
          created_at: now,
          updated_at: now,
          parent_comment_id: payload?.parent_comment_id ?? null,
        }
        db.comments.push(comment)
        return comment
      }
      case 'commentUpdate': {
        const comment = db.comments.find((c) => c.id === payload?.commentId)
        if (comment) {
          const { commentId: _, ...changes } = payload ?? {}
          Object.assign(comment, changes, { is_edited: true, updated_at: new Date().toISOString() })
        }
        return comment ?? {}
      }
      case 'commentResolve': {
        const comment = db.comments.find((c) => c.id === payload?.commentId)
        if (comment) comment.resolved_by = comment.resolved_by ? null : db.user.id ?? MOCK_USERS[0].id
        return comment ?? {}
      }
      case 'commentDelete': {
        const idx = db.comments.findIndex((c) => c.id === payload?.commentId)
        if (idx > -1) db.comments.splice(idx, 1)
        return {}
      }
      case 'recordAuditList': {
        const seed = seedById.get(String(q.row_id))
        const recorded = db.audits.filter((a) => a.row_id === String(q.row_id)).reverse()
        // a cursor means "older than the last page" — there is only one page
        const list = q.cursor ? [] : [...recorded, ...(seed ? buildAudits(q.fk_model_id, seed) : [])]
        return { list, pageInfo: { isLastPage: true } }
      }
      case 'dataAggregate':
      case 'bulkAggregate': {
        const agg = {
          viewId: q.viewId,
          aggregation: typeof q.aggregation === 'string' ? JSON.parse(q.aggregation) : q.aggregation ?? payload?.aggregation,
        }
        // bulk = one result per group, keyed by the alias the caller generated
        if (Array.isArray(payload))
          return Object.fromEntries(payload.map((p: Record<string, any>) => [p.alias, aggregate(tableId, agg, p)]))
        return aggregate(tableId, agg, q)
      }
      case 'viewRowColorInfo':
        return rowColorInfo(q.viewId)
      case 'viewRowColorSelectAdd':
        dropRowColor(q.viewId)
        db.rowColors[q.viewId] = {
          mode: 'select',
          fk_column_id: payload?.fk_column_id,
          is_set_as_background: !!payload?.is_set_as_background,
        }
        return rowColorInfo(q.viewId)
      case 'viewRowColorConditionAdd': {
        const current = db.rowColors[q.viewId]
        const conditions = current?.mode === 'filter' ? current.conditions : []
        const condition: MockRowColorCondition = {
          id: nextKey('pgrc'),
          color: payload?.color,
          nc_order: payload?.nc_order ?? conditions.length + 1,
          is_set_as_background: !!payload?.is_set_as_background,
          type: payload?.type ?? 'row',
          fk_target_column_id: payload?.fk_target_column_id ?? null,
        }
        if (current?.mode !== 'filter') dropRowColor(q.viewId)
        db.rowColors[q.viewId] = { mode: 'filter', conditions: [...conditions, condition] }
        if (payload?.filter) createConditionFilter(condition.id, payload.filter)
        return { id: condition.id, info: rowColorInfo(q.viewId) }
      }
      case 'viewRowColorConditionUpdate': {
        const condition = conditionOf(q.rowColorConditionId)
        if (condition) {
          const { color, is_set_as_background, nc_order, type, fk_target_column_id } = payload ?? {}
          Object.assign(
            condition,
            Object.fromEntries(
              Object.entries({ color, is_set_as_background, nc_order, type, fk_target_column_id }).filter(
                ([, v]) => v !== undefined,
              ),
            ),
          )
        }
        return condition ?? {}
      }
      case 'viewRowColorConditionDelete':
        for (const color of Object.values(db.rowColors)) {
          if (color.mode === 'filter') color.conditions = color.conditions.filter((c) => c.id !== q.rowColorConditionId)
        }
        removeFilters((f) => f.fk_row_color_condition_id === q.rowColorConditionId)
        return true
      case 'viewRowColorInfoDelete':
        dropRowColor(q.viewId)
        return true
      case 'rowColorConditionsFilterCreate':
        return createConditionFilter(q.rowColorConditionId, payload)
      case 'dataUpdate':
        return Array.isArray(payload)
          ? payload.map((p: Record<string, any>) => updateRow(p.Id, p, tableId))
          : updateRow(q.rowId ?? payload?.Id, payload, tableId)
      case 'dataInsert':
        return Array.isArray(payload)
          ? payload.map((p: Record<string, any>) => ({ Id: insertRow(p, undefined, tableId).Id }))
          : insertRow(payload, q.before, tableId)
      case 'dataDelete': {
        const doomed = (Array.isArray(payload) ? payload : [payload]).map((p: Record<string, any>) => p?.Id)
        for (const id of doomed) deleteRow(id, tableId)
        return Array.isArray(payload) ? doomed.map((Id) => ({ Id })) : { Id: doomed[0] }
      }
      case 'bulkDataDeleteAll': {
        const skip = new Set(
          String(q.skipPks ?? '')
            .split(',')
            .filter(Boolean),
        )
        const doomed = listRows(tableId, q).filter((r) => !skip.has(String(r.Id)))
        for (const r of doomed) deleteRow(r.Id, tableId)
        return doomed.length
      }
      case 'dataMove':
        moveRow(q.rowId ?? payload?.rowId, q.before ?? payload?.before)
        return {}
      // expanded form of a new record: every candidate (no pk to exclude yet)
      case 'linkDataList': {
        const col = findColumn(q.columnId)
        const rel = col ? relationOf(col.fk_model_id!, col.id!) : undefined
        return page(applyWhere(rel?.children ?? [], q.where), q)
      }
      case 'nestedDataReorder':
        return {}
      // the harness renders exactly one view, so a new one would have nowhere to open
      case 'gridViewCreate':
      case 'galleryViewCreate':
      case 'kanbanViewCreate':
      case 'formViewCreate':
      case 'calendarViewCreate':
      case 'mapViewCreate':
      case 'listViewCreate':
      case 'timelineViewCreate':
      case 'ganttViewCreate':
        message.info('The playground shows a single view, so new and duplicated views are not created here.')
        return null
      case 'sendRecordEmail':
        return {}
      case 'checkDependency':
        return { hasBreakingChanges: false, entities: [] }
      case 'getDateDependency':
        return dateDependencyOf(q.fk_gantt_view_id) ?? null
      case 'updateDateDependency': {
        const rule = dateDependencyOf(q.fk_gantt_view_id)
        if (rule) Object.assign(rule, payload ?? {})
        return rule ?? payload ?? {}
      }
      case 'dataExport': {
        const id = nextKey('pg-job')
        jobs.set(id, () => finishExport(id, { viewId: q.viewId, type: payload?.exportAs }))
        return { id, name: 'data-export', status: 'waiting' }
      }
      case 'columnAdd':
        return addColumn(tableId, payload)
      case 'columnUpdate':
        return updateColumn(q.columnId, payload)
      case 'columnDelete':
        return deleteColumn(q.columnId)
      case 'columnSetAsPrimary': {
        const owner = ownerOf(q.columnId)
        replaceColumns(
          owner,
          (tableOf(owner)?.columns ?? []).map((c) => ({ ...c, pv: c.id === q.columnId })),
        )
        return true
      }
      case 'columnsBulk': {
        for (const { op, column } of (payload?.ops ?? []) as Array<{ op: string; column: Record<string, any> }>) {
          if (op === 'add') addColumn(tableId, column)
          else if (op === 'update') updateColumn(column.id, column)
          else if (op === 'delete') deleteColumn(column.id)
        }
        for (const v of (payload?.visibility ?? []) as Array<{ viewId: string; columnId: string; column: { show?: boolean } }>) {
          patchViewColumn(`vc-${v.viewId}-${v.columnId}`, { show: !!v.column?.show })
        }
        return { failedOps: [], failedVisibility: [] }
      }
      case 'nestedDataListCopyPasteOrDeleteAll': {
        const ops = (Array.isArray(payload) ? payload : []) as Array<{ operation: string; rowId: string; columnId: string }>
        const unlink: unknown[] = []
        for (const op of ops.filter((o) => o.operation === 'deleteAll')) {
          const rel = relationOf(tableId, op.columnId)
          if (!rel) continue
          for (const c of rel.children.filter((c) => String(c[rel.fk]) === String(op.rowId))) {
            unlink.push(c.Id)
            c[rel.fk] = null
          }
          recount(rel)
        }
        return { link: [], unlink }
      }
      case 'filterList':
        return { list: viewFilterTree(q.viewId).map(({ children: _, ...f }) => f) }
      case 'filterChildrenList':
        return {
          list: db.filters.filter((f) => f.fk_parent_id === q.filterId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        }
      case 'filterCreate': {
        const { children: _c, status: _s, ...rest } = (payload ?? {}) as FilterType & { status?: string }
        const filter: FilterType = { ...rest, id: nextKey('pgf'), fk_view_id: q.viewId, base_id: MOCK_BASE_ID }
        db.filters.push(filter)
        return filter
      }
      case 'filterUpdate': {
        const filter = db.filters.find((f) => f.id === q.filterId)
        const { children: _c, status: _s, ...rest } = (payload ?? {}) as FilterType & { status?: string }
        if (filter) Object.assign(filter, rest, { id: filter.id })
        return filter ?? { ...rest, id: q.filterId }
      }
      case 'filterDelete': {
        removeFilters((f) => f.id === q.filterId)
        return {}
      }
      case 'sortList':
        return { list: viewSorts(q.viewId) }
      case 'sortCreate': {
        const sort: SortType = {
          order: viewSorts(q.viewId).length + 1,
          ...(payload ?? {}),
          id: nextKey('pgs'),
          fk_view_id: q.viewId,
          base_id: MOCK_BASE_ID,
        }
        db.sorts.push(sort)
        return sort
      }
      case 'sortUpdate': {
        const sort = db.sorts.find((s) => s.id === q.sortId)
        if (sort) Object.assign(sort, payload ?? {}, { id: sort.id })
        return sort ?? { ...(payload ?? {}), id: q.sortId }
      }
      case 'sortDelete': {
        const idx = db.sorts.findIndex((s) => s.id === q.sortId)
        if (idx > -1) db.sorts.splice(idx, 1)
        return {}
      }
      case 'viewColumnUpdate':
        return patchViewColumn(q.columnId, payload)
      case 'gridColumnUpdate':
        return patchViewColumn(q.gridViewColumnId, payload)
      case 'timelineColumnUpdate':
        return patchViewColumn(q.timelineViewColumnId, payload)
      case 'listColumnUpdate':
        return patchViewColumn(q.listViewColumnId, payload)
      case 'ganttColumnUpdate':
        return patchViewColumn(q.ganttViewColumnId, payload)
      case 'showAllColumns':
      case 'hideAllColumns':
        for (const vc of viewColumns(q.viewId)) {
          const col = tableOf(tableId)?.columns?.find((c) => c.id === vc.fk_column_id)
          if (!col?.pv) patchViewColumn(vc.id, { show: operation === 'showAllColumns' })
        }
        return {}
      case 'viewUpdate': {
        const view = db.views[q.viewId]
        if (view) Object.assign(view, payload ?? {})
        return view ?? {}
      }
      // the views store swaps the whole view for these responses, like the server sends
      case 'gridViewUpdate':
      case 'galleryViewUpdate':
      case 'kanbanViewUpdate':
      case 'mapViewUpdate':
      case 'calendarViewUpdate':
      case 'timelineViewUpdate':
      case 'ganttViewUpdate':
      case 'listViewUpdate':
      case 'formViewUpdate': {
        const view = db.views[q.viewId ?? q.formViewId]
        if (view) view.view = { ...(view.view as object), ...(payload ?? {}) } as typeof view.view
        return view ?? {}
      }
      case 'buttonFilterList':
      case 'linkFilterList':
      case 'widgetFilterList':
      case 'hookFilterList':
      case 'rlsPolicyFilterList':
      case 'extensionList':
      case 'documentList':
        return { list: [] }
      default:
        return undefined
    }
  }

  const findRow = (tableId: string, rowId: string) => {
    const row = rowsOf(tableId).find((r) => String(r.Id) === rowId)
    return row ? withVirtuals(tableId, [row])[0] : {}
  }

  const rowRequest = (tableId: string, rowId: string, method: string, body: any) => {
    if (method === 'PATCH') return updateRow(rowId, body, tableId)
    if (method === 'DELETE') return deleteRow(rowId, tableId) ? 1 : 0
    return findRow(tableId, rowId)
  }

  const bulkRequest = (tableId: string, method: string, body: any) => {
    const list = (Array.isArray(body) ? body : []) as Record<string, any>[]
    if (method === 'POST') return list.map((r) => ({ Id: insertRow(r, undefined, tableId).Id }))
    if (method === 'PATCH') return list.map((r) => ({ Id: updateRow(r.Id, r, tableId).Id ?? r.Id }))
    if (method === 'DELETE') return list.filter((r) => deleteRow(r.Id, tableId)).map((r) => ({ Id: r.Id }))
    return []
  }

  const rangeFields = (viewId: string) => {
    const view = db.views[viewId]
    const meta = view?.view as { calendar_range?: RangeRef[]; timeline_range?: RangeRef[] } | undefined
    const range = (meta?.calendar_range ?? meta?.timeline_range ?? [])[0]
    const title = (id?: string | null) => (id ? findColumn(id)?.title : undefined)
    return { from: title(range?.fk_from_column_id), to: title(range?.fk_to_column_id) }
  }

  const day = (v: unknown) => (isBlank(v) ? '' : String(v).slice(0, 10))

  // calendar / timeline endpoints only return records overlapping the visible date window
  const inWindow = (rows: Record<string, any>[], q: Record<string, any>, viewId: string) => {
    const { from, to } = rangeFields(viewId)
    if (!from) return []
    const start = String(q.from_date ?? '').slice(0, 10)
    const end = String(q.to_date ?? '').slice(0, 10)
    return rows.filter((r) => {
      const a = day(r[from])
      if (!a) return false
      const b = (to && day(r[to])) || a
      return !start || !end || (a <= end && b >= start)
    })
  }

  type Handler = (m: RegExpMatchArray, method: string, q: Record<string, any>, body: any) => unknown

  const routes: Array<[RegExp, Handler]> = [
    [/\/api\/v1\/db\/data\/[^/]+\/[^/]+\/([^/]+)\/views\/([^/]+)\/groupby\/count$/, (m, _, q) => groupByCount(m[1], m[2], q)],
    [/\/api\/v1\/db\/data\/[^/]+\/[^/]+\/([^/]+)\/views\/([^/]+)\/groupby$/, (m, _, q) => groupBy(m[1], m[2], q)],
    [/\/api\/v1\/db\/data\/[^/]+\/[^/]+\/([^/]+)\/views\/([^/]+)\/group\/([^/?]+)/, (m, _, q) => grouped(m[1], m[2], m[3], q)],
    [
      /\/api\/v1\/db\/data\/[^/]+\/[^/]+\/([^/]+)\/views\/([^/]+)\/count/,
      (m, _, q) => ({ count: listRows(m[1], q, m[2]).length }),
    ],
    [
      /\/api\/v1\/db\/calendar-data\/[^/]+\/[^/]+\/([^/]+)\/views\/([^/]+)\/countByDate/,
      (m, _, q) => {
        const rows = inWindow(listRows(m[1], q, m[2]), q, m[2])
        const { from } = rangeFields(m[2])
        return { count: rows.length, dates: [...new Set(rows.map((r) => day(r[from!])))] }
      },
    ],
    [
      /\/api\/v1\/db\/calendar-data\/[^/]+\/[^/]+\/([^/]+)\/views\/([^/?]+)/,
      (m, _, q) => {
        const rows = inWindow(listRows(m[1], q, m[2]), q, m[2])
        return { list: rows, pageInfo: pageInfo(rows.length, 0, rows.length) }
      },
    ],
    [
      /\/api\/v1\/db\/(?:timeline|gantt)-summary\/[^/]+\/[^/]+\/([^/]+)\/views\/([^/?]+)/,
      (m, _, __, body) => {
        const rows = inWindow(listRows(m[1], {}, m[2]), body ?? {}, m[2])
        const col = findColumn(body?.summary_field)
        const fn = String(body?.summary_fn ?? 'count')
        const { from, to } = rangeFields(m[2])
        const values = (list: Record<string, any>[]) => (col ? list.map((r) => r[col.title!]) : list)
        const overlaps = (r: Record<string, any>, b: { start: string; end: string }) => {
          const a = day(r[from!])
          const z = (to && day(r[to])) || a
          return a < day(b.end) && z >= day(b.start)
        }
        const buckets = ((body?.buckets ?? []) as Array<{ start: string; end: string }>).map((b, index) => ({
          index,
          value: aggregateValue(fn, values(rows.filter((r) => overlaps(r, b)))) ?? null,
        }))
        return { buckets, grandTotal: aggregateValue(fn, values(rows)) ?? null }
      },
    ],
    [
      /\/api\/v1\/db\/timeline-data\/[^/]+\/[^/]+\/([^/]+)\/views\/([^/?]+)/,
      (m, _, q) => {
        const rows = inWindow(listRows(m[1], q, m[2]), q, m[2])
        return { list: rows, pageInfo: pageInfo(rows.length, 0, rows.length) }
      },
    ],
    [
      /\/api\/v1\/db\/gantt-data\/[^/]+\/[^/]+\/([^/]+)\/views\/[^/]+\/deps/,
      (m) => ({
        edges: listRows(m[1])
          .filter((r) => r.parent_id)
          .map((r) => [String(r.Id), String(r.parent_id)]),
      }),
    ],
    [
      /\/api\/v1\/db\/gantt-data\/[^/]+\/[^/]+\/([^/]+)\/views\/([^/?]+)/,
      (m, _, q) => {
        const rows = [...listRows(m[1], q, m[2])].sort((a, b) => (a['Start date'] > b['Start date'] ? 1 : -1))
        return page(rows, q)
      },
    ],
    // bulk before the row routes, which would read `bulk/noco/<base>/<table>` as a row path
    [
      /\/api\/v1\/db\/data\/bulk\/[^/]+\/[^/]+\/([^/]+)\/all$/,
      (m, method, q, body) => {
        const rows = listRows(m[1], q)
        if (method === 'DELETE') rows.forEach((r) => deleteRow(r.Id, m[1]))
        else rows.forEach((r) => updateRow(r.Id, body, m[1]))
        return rows.length
      },
    ],
    [
      /\/api\/v1\/db\/data\/bulk\/[^/]+\/[^/]+\/([^/]+)\/upsert$/,
      (m, _, __, body) =>
        (Array.isArray(body) ? body : []).map((r: Record<string, any>) =>
          findRow(m[1], String(r.Id)).Id ? { Id: updateRow(r.Id, r, m[1]).Id } : { Id: insertRow(r, undefined, m[1]).Id },
        ),
    ],
    [/\/api\/v1\/db\/data\/bulk\/[^/]+\/[^/]+\/([^/?]+)$/, (m, method, _, body) => bulkRequest(m[1], method, body)],
    [
      /\/api\/v1\/db\/data\/[^/]+\/[^/]+\/([^/]+)\/([^/]+)\/(?:hm|mm|bt|oo)\/([^/?]+)(?:\/([^/?]+))?$/,
      (m, method, q) => nested(m[1], safeDecode(m[2]), m[3], m[4], method, q),
    ],
    [/\/api\/v1\/db\/data\/[^/]+\/[^/]+\/([^/]+)(?:\/views\/[^/]+)?\/find-one$/, (m, _, q) => listRows(m[1], q)[0] ?? {}],
    [
      /\/api\/v1\/db\/data\/[^/]+\/[^/]+\/([^/]+)(?:\/views\/[^/]+)?\/([^/]+)\/exist$/,
      (m) => !!findRow(m[1], safeDecode(m[2])).Id,
    ],
    [
      /\/api\/v1\/db\/data\/[^/]+\/[^/]+\/([^/]+)\/views\/[^/]+\/([^/?]+)$/,
      (m, method, _, body) => rowRequest(m[1], safeDecode(m[2]), method, body),
    ],
    [
      /\/api\/v1\/db\/data\/[^/]+\/[^/]+\/([^/]+)\/views\/([^/?]+)$/,
      (m, method, q, body) => (method === 'POST' ? insertRow(body, q.before, m[1]) : page(listRows(m[1], q, m[2]), q)),
    ],
    [
      /\/api\/v1\/db\/data\/[^/]+\/[^/]+\/([^/]+)\/([^/?]+)$/,
      (m, method, _, body) => rowRequest(m[1], safeDecode(m[2]), method, body),
    ],
    [
      /\/api\/v1\/db\/data\/[^/]+\/[^/]+\/([^/?]+)$/,
      (m, method, q, body) => (method === 'POST' ? insertRow(body, q.before, m[1]) : page(listRows(m[1], q), q)),
    ],
    [/\/api\/v1\/auth\/user\/me/, () => db.user],
    [/\/api\/v1\/db\/meta\/projects\/[^/?]+$/, () => mockBase()],
    [/\/record-templates/, () => ({ list: [] })],
  ]

  async function finishExport(jobId: string, job: { viewId: string; type: string }) {
    const view = db.views[job.viewId]
    const tableId = view?.fk_model_id ?? mainTableId()
    const shown = new Set(
      viewColumns(job.viewId)
        .filter((vc) => vc.show)
        .map((vc) => vc.fk_column_id),
    )
    const columns = (tableOf(tableId)?.columns ?? []).filter((c) => shown.has(c.id) || c.pv)
    await downloadMockExport(job.type, `${tableOf(tableId)?.title} - ${view?.title}`, columns, listRows(tableId, {}, job.viewId))
    return {
      _mid: 1,
      id: jobId,
      status: 'update',
      data: { id: jobId, status: 'completed', data: { result: { url: `${window.location.href.split('#')[0]}#` } } },
    }
  }

  const sheetsOf = async (payload: any) => {
    const file = uploads.get(payload?.attachment?.path)
    return file ? parseImportFile(file, payload?.importType ?? 'csv') : []
  }

  async function finishImport(jobId: string, payload: any) {
    const parsed = await sheetsOf(payload)
    let rowsInserted = 0
    for (const sheet of (payload?.sheets ?? []) as Array<Record<string, any>>) {
      const source = parsed.find((p) => (p.name ?? undefined) === (sheet.sheetName ?? undefined)) ?? parsed[0]
      const tableId: string = sheet.tableId ?? mainTableId()
      if (!source) continue
      const mapping = ((sheet.columnMapping ?? []) as Array<Record<string, any>>).filter((m) => m.enabled)
      for (const m of mapping.filter((m) => m.createColumn)) {
        addColumn(tableId, { title: m.sourceCn, uidt: UITypes.SingleLineText })
        m.destCn = m.sourceCn
      }
      const columns = tableOf(tableId)?.columns ?? []
      for (const record of sheetRecords(source)) {
        const row: Record<string, any> = {}
        for (const m of mapping) {
          const col = columns.find((c) => c.title === m.destCn)
          const raw = record[m.sourceCn]
          if (!col || raw === null || raw === '') continue
          const numeric = [UITypes.Number, UITypes.Decimal, UITypes.Currency, UITypes.Percent, UITypes.Rating].includes(
            col.uidt as UITypes,
          )
          row[col.title!] = numeric ? Number(raw) : col.uidt === UITypes.Checkbox ? /^(true|1|yes)$/i.test(String(raw)) : raw
        }
        insertRow(row, undefined, tableId)
        rowsInserted++
      }
    }
    const log = { status: 'completed', rowsInserted, rowsFailed: 0, linksCreated: 0, valuesUnmatched: 0, linksFailed: 0 }
    return [
      { _mid: 1, id: jobId, status: 'update', data: { id: jobId, status: 'active', data: { message: JSON.stringify(log) } } },
      { _mid: 2, id: jobId, status: 'update', data: { id: jobId, status: 'completed' } },
    ]
  }

  async function asyncRequest(url: string, q: Record<string, any>, body: any): Promise<unknown> {
    if (/\/jobs\/listen$/.test(url)) {
      const job = jobs.get(body?.data?.id)
      if (!job) return undefined
      jobs.delete(body.data.id)
      return job()
    }
    if (/\/api\/v1\/db\/data-import\/upload$/.test(url) && body instanceof FormData) {
      return body.getAll('files').flatMap((file) => {
        if (!(file instanceof File)) return []
        const path = `pg-import/${nextKey('file')}/${file.name}`
        uploads.set(path, file)
        return [{ path, title: file.name, mimetype: file.type, size: file.size }]
      })
    }
    if (q.operation === 'dataImportPreview') {
      const sheets = await sheetsOf(body)
      return {
        sheets: sheets.map((sheet) => ({
          name: sheet.name,
          columns: previewColumns(sheet.headers),
          previewData: sheetRecords(sheet).slice(0, 20),
          totalSampleRows: sheet.rows.length,
          totalRows: sheet.rows.length,
        })),
      }
    }
    const dup = url.match(/\/api\/v1\/db\/meta\/duplicate\/[^/]+\/column\/([^/?]+)$/)
    if (dup) {
      const id = nextKey('pg-job')
      jobs.set(id, async () => {
        duplicateColumn(dup[1], body)
        return [{ _mid: 1, id, status: 'update', data: { id, status: 'completed' } }]
      })
      return { id, name: 'duplicate-column' }
    }
    if (q.operation === 'dataImportFile') {
      const id = nextKey('pg-job')
      jobs.set(id, () => finishImport(id, body))
      return { id, name: 'data-import', status: 'waiting' }
    }
  }

  async function bookmarkRequest(
    method: string,
    url: string,
    body: any,
    config: InternalAxiosRequestConfig,
  ): Promise<AxiosResponse | undefined> {
    const reply = (data: unknown) => ({ data: serialize(data), status: 200, statusText: 'OK', headers: {}, config, request: {} })
    if (/\/api\/v1\/bookmarks$/.test(url) && method === 'POST' && body?.meta?.base_id === MOCK_BASE_ID) {
      const now = new Date().toISOString()
      const view = db.views[body.target_id]
      const bookmark = {
        id: nextKey('pg-bm'),
        fk_user_id: db.user.id,
        title: view?.title ?? body.target_id,
        target_type: body.target_type,
        target_id: body.target_id,
        order: bookmarks.length + 1,
        meta: body.meta,
        created_at: now,
        updated_at: now,
      }
      bookmarks.push(bookmark)
      return reply(bookmark)
    }
    const own = url.match(/\/api\/v1\/bookmarks\/(pg-bm-[^/?]+)$/)
    if (own) {
      const idx = bookmarks.findIndex((b) => b.id === own[1])
      if (method === 'DELETE' && idx > -1) bookmarks.splice(idx, 1)
      else if (method === 'PATCH' && idx > -1) Object.assign(bookmarks[idx], body)
      return reply(method === 'DELETE' ? true : bookmarks[idx] ?? {})
    }
    if (/\/api\/v1\/bookmarks$/.test(url) && method === 'GET' && bookmarks.length && passthrough) {
      const res = await passthrough(config)
      const ungrouped = res.data?.groups?.find((g: { name?: string }) => g.name === 'Ungrouped')
      const mine = bookmarks.map((b) => ({ ...b, fk_group_id: ungrouped?.id }))
      return { ...res, data: { ...res.data, bookmarks: [...(res.data?.bookmarks ?? []), ...mine] } }
    }
  }

  const route = (method: string, url: string, q: Record<string, any>, body: any): { matched: boolean; data?: unknown } => {
    if (/\/api\/v2\/internal\/[^/]+\/[^/?]+/.test(url)) {
      const { data, known } = internal(q.operation, q, body, method)
      return { matched: known, data }
    }
    for (const [re, handler] of routes) {
      const m = url.match(re)
      if (m) return { matched: true, data: handler(m, method, q, body) }
    }
    return { matched: false }
  }

  // mock-base requests are faked; app-wide ones reach the real backend
  const mockScopeRe = new RegExp(`/${MOCK_BASE_ID}(/|$)`)
  const isMockScoped = (url: string, q: Record<string, any>) => mockScopeRe.test(url) || q.base_id === MOCK_BASE_ID

  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const method = (config.method ?? 'get').toUpperCase()
    const url = config.url ?? ''
    const q = { ...(config.params ?? {}) }
    const body = parseBody(config.data)
    const asyncData = await asyncRequest(url, q, body)
    if (asyncData !== undefined)
      return { data: serialize(asyncData), status: 200, statusText: 'OK', headers: {}, config, request: {} }
    const bookmarkReply = await bookmarkRequest(method, url, body, config)
    if (bookmarkReply) return bookmarkReply
    let routed: { matched: boolean; data?: unknown }
    try {
      routed = route(method, url, q, body)
    } catch (e) {
      if (!(e instanceof MockRequestError)) throw e
      const response = { data: { msg: e.message }, status: e.status, statusText: 'Bad Request', headers: {}, config, request: {} }
      throw new AxiosError(e.message, AxiosError.ERR_BAD_REQUEST, config, {}, response)
    }
    const { matched, data } = routed
    if (!matched && passthrough && !isMockScoped(url, q)) return passthrough(config)
    if (!matched) onUnmocked({ method, url, operation: q.operation, at: Date.now() })
    await new Promise((resolve) => setTimeout(resolve, 60))
    // null is a real answer (e.g. no row colouring), undefined means nothing matched
    return { data: serialize(data === undefined ? {} : data), status: 200, statusText: 'OK', headers: {}, config, request: {} }
  }
}
