import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import type { ColumnType, FilterType, ListType, SelectOptionsType, SortType, TableType, ViewType } from 'nocodb-sdk'
import { UITypes, ViewTypes } from 'nocodb-sdk'
import { MOCK_BASE_ID, MOCK_TASKS_TABLE_ID, MOCK_USERS, buildAudits, mockBase } from './mock-data'
import type { MockComment } from './mock-data'

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
  comments: MockComment[]
  user: Record<string, any>
  /** toolbar config saved through filter/sort/view-column ops, across all mock views */
  filters: FilterType[]
  sorts: (SortType & { fk_view_id?: string })[]
  /** view-column overrides keyed by view column id (width, show, group_by, ...) */
  viewColumnPatches: Record<string, Record<string, unknown>>
}

const pageInfo = (total: number, offset: number, limit: number) => ({
  totalRows: total,
  page: Math.floor(offset / Math.max(limit, 1)) + 1,
  pageSize: limit,
  isFirstPage: offset === 0,
  isLastPage: offset + limit >= total,
})

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
      const needle = decodeURIComponent(raw ?? '').replace(/^%|%$/g, '')
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
    // same key the groupby endpoint produced
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

/**
 * Axios adapter that answers the smartsheet data/meta requests from an
 * in-memory table, so the real view components render without a backend.
 * Anything unrecognised resolves with an empty payload and is reported.
 */
export function createMockAdapter(
  db: MockDb,
  onUnmocked: (req: UnmockedRequest) => void,
  passthrough?: AxiosAdapter,
): AxiosAdapter {
  let nextId = db.rows.length + 1

  let seq = 0

  const nextKey = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`

  const tableOf = (id: string) => db.tables[id]

  /** A view's saved filters as a tree (children under `is_group` filters). */
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

  /** Rows as the server would return them: the view's saved filters + sorts, then request-level filters. */
  const listRows = (tableId: string, q: Record<string, any> = {}, viewId: string | undefined = q.viewId) => {
    if (tableId === MOCK_TASKS_TABLE_ID) return []
    const columns = (tableOf(tableId)?.columns ?? []) as ColumnType[]
    const filters = [...viewFilterTree(viewId), ...(parseJson<FilterType[]>(q.filterArrJson) ?? [])]
    const rows = applyWhere(db.rows, q.where).filter((r) => matchFilters(r, filters, columns))
    // the client only sends sortArrJson when it can't save sorts to the view
    return applySort(rows, columns, parseJson<SortType[]>(q.sortArrJson) ?? viewSorts(viewId))
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

  const updateRow = (rowId: string, data: Record<string, any>) => {
    const row = db.rows.find((r) => String(r.Id) === String(rowId))
    if (!row) return {}
    Object.assign(row, data, { UpdatedAt: new Date().toISOString() })
    return { ...row }
  }

  const insertRow = (data: Record<string, any>) => {
    const row = { ...data, Id: nextId++, CreatedAt: new Date().toISOString(), UpdatedAt: new Date().toISOString() }
    db.rows.push(row)
    return row
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
        // gallery/kanban cards: the cover image already shows, and fewer fields read better
        show: isCardView ? i < 9 && c.uidt !== UITypes.Attachment : i < 14,
        order: i + 1,
        width: c.pv ? '220px' : c.uidt === UITypes.LongText ? '260px' : '180px',
        aggregation: c.uidt === UITypes.Currency ? 'sum' : c.uidt === UITypes.Checkbox ? 'checked' : 'none',
        // list view columns belong to a level
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
      const values = rows.map((r) => r[col.title!])
      if (type === 'sum') out[col.title!] = values.reduce((s, v) => s + (Number(v) || 0), 0)
      else if (type === 'checked') out[col.title!] = values.filter(Boolean).length
      else if (type === 'count') out[col.title!] = values.length
      else if (type === 'avg') out[col.title!] = values.reduce((s, v) => s + (Number(v) || 0), 0) / Math.max(values.length, 1)
    }
    return out
  }

  /** `known: false` = answered with a generic fallback; surfaced in the unmocked list. */
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
      // keep the entity id the caller addressed (viewId, filterId, ...) so stores
      // that swap in the response don't lose track of the object
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
          columns: viewColumns(q.formViewId).map((c) => ({ ...c, label: null, help: null, required: false })),
        }
      }
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
        const row = db.rows.find((r) => String(r.Id) === String(q.row_id))
        // a cursor means "older than the last page" — there is only one page
        const list = row && !q.cursor ? buildAudits(q.fk_model_id, row) : []
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
        return null
      case 'dataUpdate':
        return updateRow(q.rowId ?? payload?.Id, payload)
      case 'dataInsert':
        return insertRow(payload)
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
        const doomed = new Set<string>([q.filterId])
        // a group takes its nested conditions with it
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
      case 'gridViewUpdate': {
        const view = db.views[q.viewId]
        if (view) view.view = { ...(view.view as object), ...(payload ?? {}) } as typeof view.view
        return view?.view ?? {}
      }
      // toolbar meta that never gets configured here
      case 'buttonFilterList':
      case 'linkFilterList':
      case 'widgetFilterList':
      case 'hookFilterList':
      case 'rlsPolicyFilterList':
      case 'extensionList':
      case 'documentList':
        return { list: [] }
      case 'formViewUpdate': {
        const view = db.views[q.formViewId ?? q.viewId]
        if (view) view.view = { ...(view.view as object), ...(payload ?? {}) } as typeof view.view
        // the views store swaps the whole view for this response
        return view ?? {}
      }
      default:
        return undefined
    }
  }

  const findRow = (rowId: string) => db.rows.find((r) => String(r.Id) === rowId) ?? {}

  // calendar endpoints only return records inside the visible date window
  const inWindow = (rows: Record<string, any>[], q: Record<string, any>) => {
    const from = String(q.from_date ?? '').slice(0, 10)
    const to = String(q.to_date ?? '').slice(0, 10)
    if (!from || !to) return rows
    return rows.filter((r) => r['Launch date'] >= from && r['Launch date'] <= to)
  }

  type Handler = (m: RegExpMatchArray, method: string, q: Record<string, any>, body: any) => unknown

  // first match wins — more specific paths first
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
        const rows = inWindow(listRows(m[1], q, m[2]), q)
        return { count: rows.length, dates: [...new Set(rows.map((r) => r['Launch date']))] }
      },
    ],
    [
      /\/api\/v1\/db\/calendar-data\/[^/]+\/[^/]+\/([^/]+)\/views\/([^/?]+)/,
      (m, _, q) => {
        const rows = inWindow(listRows(m[1], q, m[2]), q)
        return { list: rows, pageInfo: pageInfo(rows.length, 0, rows.length) }
      },
    ],
    [
      /\/api\/v1\/db\/timeline-data\/[^/]+\/[^/]+\/([^/]+)\/views\/([^/?]+)/,
      (m, _, q) => {
        const from = String(q.from_date ?? '').slice(0, 10)
        const to = String(q.to_date ?? '').slice(0, 10)
        const rows = listRows(m[1], q, m[2]).filter(
          (r) => !from || !to || (r['Start date'] <= to && (r['End date'] ?? r['Start date']) >= from),
        )
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
    [
      /\/api\/v1\/db\/data\/[^/]+\/[^/]+\/([^/]+)\/views\/[^/]+\/([^/?]+)$/,
      (m, method, _, body) => {
        if (method === 'PATCH') return updateRow(m[2], body)
        if (method === 'DELETE') {
          const idx = db.rows.findIndex((r) => String(r.Id) === m[2])
          if (idx > -1) db.rows.splice(idx, 1)
          return 1
        }
        return findRow(m[2])
      },
    ],
    [
      /\/api\/v1\/db\/data\/[^/]+\/[^/]+\/([^/]+)\/views\/([^/?]+)$/,
      (m, method, q, body) => (method === 'POST' ? insertRow(body) : page(listRows(m[1], q, m[2]), q)),
    ],
    [
      /\/api\/v1\/db\/data\/[^/]+\/[^/]+\/([^/]+)\/([^/?]+)$/,
      (m, method, _, body) => (method === 'PATCH' ? updateRow(m[2], body) : findRow(m[2])),
    ],
    [/\/api\/v1\/auth\/user\/me/, () => db.user],
    [/\/api\/v1\/db\/meta\/projects\/[^/?]+$/, () => mockBase()],
    [/\/record-templates/, () => ({ list: [] })],
  ]

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

  // requests about the mock base are faked; app-wide ones (notifications,
  // version, workspace) go to the real backend so the shell keeps working
  const mockScopeRe = new RegExp(`/${MOCK_BASE_ID}(/|$)`)
  const isMockScoped = (url: string, q: Record<string, any>) => mockScopeRe.test(url) || q.base_id === MOCK_BASE_ID

  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const method = (config.method ?? 'get').toUpperCase()
    const url = config.url ?? ''
    const q = { ...(config.params ?? {}) }
    const body = parseBody(config.data)
    const { matched, data } = route(method, url, q, body)
    if (!matched && passthrough && !isMockScoped(url, q)) return passthrough(config)
    if (!matched) onUnmocked({ method, url, operation: q.operation, at: Date.now() })
    // a tick of latency so loaders/skeletons behave like the real thing
    await new Promise((resolve) => setTimeout(resolve, 60))
    return { data: data ?? {}, status: 200, statusText: 'OK', headers: {}, config, request: {} }
  }
}
